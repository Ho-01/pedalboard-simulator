import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { parseRaw } from '../src/simulation/raw';
import { createNetlist } from '../src/simulation/netlist';
import { bd2Circuit } from '../src/circuits/boss-bd2/document';
import { DEFAULT_SETTINGS } from '../src/domain/circuit/types';
import { guitarDemo } from '../src/audio/demo';

const baseline = process.env.NGSPICE_BASELINE;
const optimized = process.env.NGSPICE_NATIVE;
assert.ok(baseline && optimized, 'Set NGSPICE_BASELINE and NGSPICE_NATIVE to distinct builds');
function hash(path: string) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
assert.notEqual(hash(baseline), hash(optimized), 'Regression requires different binaries');
function run(binary: string, netlist: string) {
  const dir = mkdtempSync(join(tmpdir(), 'pwl-regression-'));
  try {
    writeFileSync(join(dir, 'job.cir'), netlist);
    const start = performance.now();
    const log = execFileSync(binary, ['-b', 'job.cir'], {cwd: dir, timeout: 120000, maxBuffer: 8 * 1024 * 1024}).toString();
    assert.doesNotMatch(log, /timestep too small|doAnalyses:.*failed/i);
    const raw = new Uint8Array(readFileSync(join(dir, 'result.raw')));
    return {plot: parseRaw(raw), elapsedMs: performance.now() - start};
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
}
const dense = Array.from({length: 2401}, (_, i) => (i / 48000).toPrecision(12) + ' ' + (0.1 * Math.sin(i * 0.17)).toPrecision(12)).join(' ');
const stimuli = [
  {name: 'single-knot', source: 'PWL(0 0.1)'},
  {name: 'boundaries-and-tail', source: 'PWL(0 0 0.01 0.1 0.02 -0.1 0.03 0)'},
  {name: 'dense-audio', source: 'PWL(' + dense + ')'},
  {name: 'repeat-and-delay', source: 'PWL(0 0 0.01 0.1 0.02 -0.1 0.03 0) r=0 td=0.005'},
  {name: 'duplicate-knots-upstream-fallback', source: 'PWL(0 0 0.01 0.1 0.01 -0.1 0.03 0)'},
  {name: 'reversed-knots-upstream-fallback', source: 'PWL(0 0 0.02 0.1 0.01 -0.1 0.03 0)'},
];
const cases = stimuli.map(s => ({
  name: s.name,
  netlist: 'PWL lookup regression\nVsignal signal 0 ' + s.source + '\nR1 signal out 1000\nC1 out 0 1u\n.control\nset noaskquit\nset filetype=binary\nsave v(signal) v(out)\ntran 5.208333333e-6 0.055 0 5.208333333e-6\nwrite result.raw v(signal) v(out)\nquit\n.endc\n.end\n',
}));
const models = readFileSync('models/bd2-test-models.spice', 'utf8');
const biasGuesses = JSON.parse(readFileSync('testbench/bd2-bias-guesses.json', 'utf8'));
for (const on of [false, true]) {
  cases.push({name: 'BD2-short-demo-' + (on ? 'on' : 'off'), netlist: createNetlist(bd2Circuit, models, {...DEFAULT_SETTINGS, on}, {analysis: 'transient', samples: guitarDemo(0.1), duration: 0.1, biasGuesses})});
}
const results = cases.map(c => {
  const a = run(baseline, c.netlist), b = run(optimized, c.netlist);
  assert.deepEqual(a.plot.names, b.plot.names);
  assert.equal(a.plot.points, b.plot.points);
  let maxAbsolute = 0, bitwiseIdentical = true;
  for (let k = 0; k < a.plot.columns.length; k++) {
    const av = a.plot.columns[k], bv = b.plot.columns[k];
    for (let i = 0; i < av.length; i++) {
      maxAbsolute = Math.max(maxAbsolute, Math.abs(av[i] - bv[i]));
      if (!Object.is(av[i], bv[i])) bitwiseIdentical = false;
    }
  }
  assert.ok(maxAbsolute < 1e-12, c.name + ': PWL output changed');
  const row = {name: c.name, points: a.plot.points, maxAbsolute, bitwiseIdentical, baselineMs: a.elapsedMs, optimizedMs: b.elapsedMs};
  console.log(JSON.stringify(row));
  return row;
});
mkdirSync('simulation/evidence', {recursive: true});
writeFileSync('simulation/evidence/pwl-regression.json', JSON.stringify({generatedAt: new Date().toISOString(), baselineSha256: hash(baseline), optimizedSha256: hash(optimized), results}, null, 2) + '\n');
