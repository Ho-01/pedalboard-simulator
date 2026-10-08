import { nativeRun } from './native-runner';
import assert from "node:assert/strict";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { bd2Circuit } from "../src/circuits/boss-bd2/document";
import {
  DEFAULT_SETTINGS,
  cloneCircuit,
  type PedalSettings,
} from "../src/domain/circuit/types";
import {
  createNetlist,
  assertBias,
  type SimulationOptions,
} from "../src/simulation/netlist";
import { parseRaw, column, type RawPlot } from "../src/simulation/raw";
import { toPCM, signalStats } from "../src/simulation/pcm";
import { runWasm, type EngineFactory } from "../src/simulation/engine";
import { guitarDemo } from "../src/audio/demo";
import { cpus, platform, arch } from "node:os";
import { createHash } from "node:crypto";
import { nativeBinary } from "./native-runner";
const manifest = JSON.parse(
  readFileSync("simulation/engine-manifest.json", "utf8"),
);
const wasmPath = resolve("public" + manifest.wasm),
  factory = (await import(pathToFileURL(resolve("public" + manifest.js)).href))
    .default as EngineFactory;

const models = readFileSync("models/bd2-test-models.spice", "utf8"),
  guesses = JSON.parse(readFileSync("testbench/bd2-bias-guesses.json", "utf8"));
const evidence: { name: string; [key: string]: unknown }[] = [];
const outdir = "simulation/evidence";
mkdirSync(outdir, { recursive: true });
function note(v: { name: string; [key: string]: unknown }) {
  evidence.push(v);
  console.log(JSON.stringify(v));
}
async function pair(s: PedalSettings, o: SimulationOptions, c = bd2Circuit) {
  const netlist = createNetlist(c, models, s, { ...o, biasGuesses: guesses });
  const a = nativeRun(netlist),
    start = performance.now(),
    r = await runWasm(netlist, factory, wasmPath),
    b = parseRaw(r.raw);
  if (o.analysis !== "op") {
    assert.ok(a.bias && r.biasRaw);
    opBias(a.bias, s);
    opBias(parseRaw(r.biasRaw), s);
  }
  return { a, b, wasmMs: performance.now() - start, heapBytes: r.heapBytes };
}
function relative(a: ArrayLike<number>, b: ArrayLike<number>) {
  assert.equal(a.length, b.length);
  let error = 0,
    energy = 0;
  for (let i = 0; i < a.length; i++) {
    error += (a[i] - b[i]) ** 2;
    energy += a[i] ** 2;
  }
  return Math.sqrt(error / Math.max(energy, 1e-24));
}
function opBias(p: RawPlot, s: PedalSettings) {
  assertBias(s, (n) => column(p, "v(" + n + ")")[0]);
}
async function primitive(
  name: string,
  body: string,
  check: (plot: RawPlot) => Record<string, number>,
) {
  const netlist =
    "Primitive component verification\n" +
    models +
    "\n" +
    body +
    "\n.control\nset noaskquit\nset filetype=binary\nop\nwrite result.raw\nquit\n.endc\n.end\n";
  const a = nativeRun(netlist),
    r = await runWasm(netlist, factory, wasmPath),
    b = parseRaw(r.raw);
  const metrics = check(a.plot);
  check(b);
  note({
    name: "primitive-" + name,
    ...metrics,
    nativeWasmMaxRms: relative(
      a.plot.columns.flatMap((v) => Array.from(v)),
      b.columns.flatMap((v) => Array.from(v)),
    ),
  });
}
await primitive(
  "resistor-divider",
  "Vtest vin 0 1\nR1 vin out 1000\nR2 out 0 1000",
  (p) => {
    const volts = column(p, "v(out)")[0];
    assert.ok(Math.abs(volts - 0.5) < 1e-9);
    return { volts };
  },
);
await primitive(
  "2sk184-idss",
  "Vdrain drain 0 10\nVgate gate 0 0\nJ1 drain gate 0 J_2SK184GR_TEST",
  (p) => {
    const amps = Math.abs(column(p, "i(vdrain)")[0]);
    assert.ok(amps > 0.0026 && amps < 0.0065);
    return { amps };
  },
);
await primitive(
  "2sk118-idss",
  "Vdrain drain 0 10\nVgate gate 0 0\nJ1 drain gate 0 J_2SK118Y_TEST",
  (p) => {
    const amps = Math.abs(column(p, "i(vdrain)")[0]);
    assert.ok(amps > 0.0012 && amps < 0.003);
    return { amps };
  },
);
await primitive(
  "1ss133-forward",
  "Itest 0 a 0.1\nD1 a 0 D_1SS133_TEST",
  (p) => {
    const volts = column(p, "v(a)")[0];
    assert.ok(volts > 0.5 && volts < 1.2);
    return { volts, currentAmps: 0.1 };
  },
);
await primitive(
  "2sc2458-hfe",
  "Vce collector 0 5\nIbase 0 base 10u\nQ1 collector base 0 Q_2SC2458GR_TEST",
  (p) => {
    const hfe = Math.abs(column(p, "i(vce)")[0]) / 1e-5;
    assert.ok(hfe > 200 && hfe < 400);
    return { hfe };
  },
);
await primitive(
  "m5218-follower-bias",
  "Vpower vp 0 8\nVinput inp 0 4\nXamp inp out vp 0 out M5218AL_TEST\nRload out 0 100k",
  (p) => {
    const volts = column(p, "v(out)")[0];
    assert.ok(Math.abs(volts - 4) < 0.01);
    return { volts };
  },
);
const rcNet =
  "Analytic RC frequency response\nVinput inp 0 AC 1\nR1 inp out 1000\nC1 out 0 1u\n.control\nset noaskquit\nset filetype=binary\nac dec 20 10 100000\nwrite result.raw v(out)\nquit\n.endc\n.end\n";
const rcNative = nativeRun(rcNet),
  rcWasm = parseRaw((await runWasm(rcNet, factory, wasmPath)).raw);
for (const plot of [rcNative.plot, rcWasm]) {
  const f = plot.columns[plot.names.indexOf("frequency")],
    v = plot.columns[plot.names.indexOf("v(out)")];
  let maxError = 0;
  for (let i = 0; i < plot.points; i++) {
    const w = 2 * Math.PI * f[i * 2] * 0.001;
    maxError = Math.max(
      maxError,
      Math.hypot(v[i * 2] - 1 / (1 + w * w), v[i * 2 + 1] + w / (1 + w * w)),
    );
  }
  assert.ok(maxError < 1e-8);
  note({
    name: "primitive-analytic-rc",
    engine: plot === rcNative.plot ? "native" : "wasm",
    maxComplexError: maxError,
  });
}
for (const on of [false, true]) {
  const s = { ...DEFAULT_SETTINGS, on },
    p = await pair(s, { analysis: "op" });
  opBias(p.a.plot, s);
  opBias(p.b, s);
  let max = 0;
  p.a.plot.names.forEach((n, i) => {
    const j = p.b.names.indexOf(n);
    assert.ok(j >= 0);
    max = Math.max(max, Math.abs(p.a.plot.columns[i][0] - p.b.columns[j][0]));
  });
  assert.ok(max < 1e-5);
  note({
    name: "native-wasm-dc",
    on,
    maxAbsolute: max,
    nativeMs: p.a.ms,
    wasmMs: p.wasmMs,
    heapBytes: p.heapBytes,
  });
  const ac = await pair(s, { analysis: "ac" }),
    ai = ac.a.plot.names.indexOf("v(output)"),
    bi = ac.b.names.indexOf("v(output)");
  const av = ac.a.plot.columns[ai],
    bv = ac.b.columns[bi];
  let db = 0,
    phase = 0;
  for (let i = 0; i < av.length; i += 2) {
    const ma = Math.hypot(av[i], av[i + 1]),
      mb = Math.hypot(bv[i], bv[i + 1]);
    if (ma < 1e-9) continue;
    db = Math.max(db, Math.abs(20 * Math.log10(mb / ma)));
    let d =
      ((Math.atan2(bv[i + 1], bv[i]) - Math.atan2(av[i + 1], av[i])) * 180) /
      Math.PI;
    d = ((d + 540) % 360) - 180;
    phase = Math.max(phase, Math.abs(d));
  }
  assert.ok(db < 0.1 && phase < 1);
  note({
    name: "native-wasm-ac",
    on,
    maxDb: db,
    maxPhaseDegrees: phase,
    points: ac.a.plot.points,
  });
  const tr = await pair(s, {
    analysis: "transient",
    duration: 0.1,
    source: "sine",
  });
  const a = toPCM(tr.a.plot, "v(output)", 0.1),
    b = toPCM(tr.b, "v(output)", 0.1),
    err = relative(a, b);
  assert.ok(err < 0.001);
  note({
    name: "native-wasm-transient",
    on,
    relativeRms: err,
    nativePoints: tr.a.plot.points,
    wasmPoints: tr.b.points,
  });
}
let matrix = 0;
const matrixRows: unknown[] = [];
for (const gain of [0, 2.5, 5, 7.5, 10])
  for (const tone of [0, 2.5, 5, 7.5, 10])
    for (const level of [0, 5, 10])
      for (const on of [false, true]) {
        const settings = { gain, tone, level, on };
        const dc = nativeRun(
          createNetlist(bd2Circuit, models, settings, {
            analysis: "op",
            biasGuesses: guesses,
          }),
        );
        opBias(dc.plot, settings);
        const ac = nativeRun(
          createNetlist(bd2Circuit, models, settings, {
            analysis: "ac",
            biasGuesses: guesses,
          }),
        );
        opBias(ac.bias!, settings);
        const tr = nativeRun(
          createNetlist(bd2Circuit, models, settings, {
            analysis: "transient",
            duration: 0.04,
            biasGuesses: guesses,
          }),
        );
        opBias(tr.bias!, settings);
        const output = toPCM(tr.plot, "v(output)", 0.04),
          stats = signalStats(output),
          index = ac.plot.names.indexOf("v(output)");
        matrixRows.push({
          settings,
          biasV8: column(dc.plot, "v(v8)")[0],
          biasVb: column(dc.plot, "v(vb)")[0],
          acOutputRelativeRms: signalStats(ac.plot.columns[index]).rms,
          outputRmsV: stats.rms,
          outputPeakV: stats.peak,
          points: tr.plot.points,
        });
        matrix++;
      }
writeFileSync(
  join(outdir, "control-matrix.json"),
  JSON.stringify(matrixRows, null, 2) + "\n",
);
note({
  name: "native-dc-ac-transient-control-matrix",
  cases: matrix,
  transientStimulus: "220Hz 50mV sine, 40ms",
  evidence: "simulation/evidence/control-matrix.json",
  limit:
    "8-second decay and all amplitudes not exhaustively tested for every combination",
});
const square = nativeRun(
  createNetlist(
    bd2Circuit,
    models,
    { ...DEFAULT_SETTINGS, on: true },
    {
      analysis: "transient",
      duration: 0.05,
      source: "square",
      biasGuesses: guesses,
    },
  ),
);
note({
  name: "service-test-stimulus",
  frequencyHz: 200,
  inputVpp: 0.005,
  points: square.plot.points,
  comparison:
    "stimulus run only; scanned manual image is not a numeric golden fixture",
});
const baseline = nativeRun(
  createNetlist(
    bd2Circuit,
    models,
    { ...DEFAULT_SETTINGS, on: true },
    { analysis: "transient", duration: 0.1, biasGuesses: guesses },
  ),
);
const refined = nativeRun(
  createNetlist(
    bd2Circuit,
    models,
    { ...DEFAULT_SETTINGS, on: true },
    {
      analysis: "transient",
      duration: 0.1,
      oversample: 8,
      biasGuesses: guesses,
    },
  ),
);
const refinement = relative(
  toPCM(refined.plot, "v(output)", 0.1, 8),
  toPCM(baseline.plot, "v(output)", 0.1, 4),
);
assert.ok(refinement < 0.01);
note({
  name: "native-timestep-refinement",
  signal: "220Hz 50mV sine / knobs5 ON",
  relativeRms: refinement,
});
const custom = cloneCircuit(bd2Circuit);
custom.components.find((c) => c.refdes === "R9")!.value = 13600;
const modified = nativeRun(
  createNetlist(
    custom,
    models,
    { ...DEFAULT_SETTINGS, on: true },
    { analysis: "transient", duration: 0.1, biasGuesses: guesses },
  ),
);
const customDelta = relative(
  toPCM(baseline.plot, "v(output)", 0.1),
  toPCM(modified.plot, "v(output)", 0.1),
);
assert.ok(customDelta > 0.001);
note({
  name: "custom-component-path",
  component: "R9",
  before: 6800,
  after: 13600,
  relativeOutputChange: customDelta,
});
const demo = guitarDemo();
for (const on of [false, true]) {
  const p = await pair(
    { ...DEFAULT_SETTINGS, on },
    { analysis: "transient", samples: demo, duration: 8 },
  );
  const a = toPCM(p.a.plot, "v(output)", 8),
    b = toPCM(p.b, "v(output)", 8),
    error = relative(a, b);
  assert.ok(error < 0.001);
  note({
    name: "eight-second-demo",
    on,
    relativeRms: error,
    nativeMs: p.a.ms,
    wasmMs: p.wasmMs,
    heapBytes: p.heapBytes,
    rawBytes: p.a.rawBytes,
    points: p.a.plot.points,
    ...signalStats(a),
  });
}
writeFileSync(
  join(outdir, "numerical.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      validationHost: { platform: platform(), arch: arch(), cpu: cpus()[0]?.model, node: process.version },
      nativeBinarySha256: createHash("sha256").update(readFileSync(nativeBinary)).digest("hex"),
      engine: manifest,
      evidence,
      notPerformed: [
        "independent schematic-to-netlist audit",
        "measured semiconductor parameter fit",
        "physical BD-2 A/B listening",
        "all-amplitude long decay matrix",
        "Safari/Edge integration",
      ],
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Numerical validation completed. Physical sound match remains unverified.",
);
