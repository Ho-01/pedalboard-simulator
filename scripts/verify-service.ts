import { readFileSync, writeFileSync } from "node:fs";
import { bd2Circuit } from "../src/circuits/boss-bd2/document";
import { createNetlist, assertBias } from "../src/simulation/netlist";
import { column } from "../src/simulation/raw";
import { nativeRun, nativeBinary } from "./native-runner";
import { createHash } from "node:crypto";
const models = readFileSync("models/bd2-test-models.spice", "utf8");
const biasGuesses = JSON.parse(readFileSync("testbench/bd2-bias-guesses.json", "utf8"));
const rows = [];
for (const tone of [0, 10]) {
  const settings = { gain: 10, level: 10, tone, on: true };
  const netlist = createNetlist(bd2Circuit, models, settings, {
    analysis: "transient", source: "square", duration: 0.12, biasGuesses,
  });
  const run = nativeRun(netlist);
  assertBias(settings, (n) => column(run.bias!, "v(" + n + ")")[0]);
  const time = column(run.plot, "time"), input = column(run.plot, "v(input)"), output = column(run.plot, "v(output)");
  let csv = "time_s,input_V,output_V\n", peak = 0;
  for (let i = 0; i < time.length; i++) {
    if (time[i] < 0.08 || time[i] > 0.095) continue;
    peak = Math.max(peak, Math.abs(output[i]));
    csv += time[i] + "," + input[i] + "," + output[i] + "\n";
  }
  const file = "simulation/evidence/service-tone-" + tone + ".csv";
  writeFileSync(file, csv);
  const dc = nativeRun(createNetlist(bd2Circuit, models, settings, { analysis: "op", biasGuesses })).plot;
  const branchCurrents = Object.fromEntries(dc.names.flatMap((n, i) => n.startsWith("i(") ? [[n, dc.columns[i][0]]] : []));
  rows.push({ settings, peakV: peak, points: run.plot.points, file, branchCurrentsA: branchCurrents,
    netlistSha256: createHash("sha256").update(netlist).digest("hex") });
}
writeFileSync("simulation/evidence/service-endpoints.json", JSON.stringify({
  generatedAt: new Date().toISOString(), nativeBinarySha256: createHash("sha256").update(readFileSync(nativeBinary)).digest("hex"),
  source: "BOSS BD-2 service notes, February 1995, appendix page 4",
  stimulus: "200 Hz square, generator 5 mV p-p, 1 us edges; gain/level maximum",
  conditions: "9 V, 25 C, source 1 kOhm, load 1 MOhm",
  status: "Research models; figure comparison is qualitative, not measured hardware validation",
  rows,
}, null, 2) + "\n");
console.log(JSON.stringify(rows));
