import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { bd2Circuit } from '../src/circuits/boss-bd2/document';
import { DEFAULT_SETTINGS } from '../src/domain/circuit/types';
import { createNetlist } from '../src/simulation/netlist';
import { parseRaw } from '../src/simulation/raw';
const binary=process.env.NGSPICE_NATIVE ?? '/home/ho/.cache/pedal-engine-build/native/src/ngspice';
const models=readFileSync('models/bd2-test-models.spice','utf8'),dir=mkdtempSync(join(tmpdir(),'bd2-bias-'));
try {
  writeFileSync(join(dir,'job.cir'),createNetlist(bd2Circuit,models,DEFAULT_SETTINGS,{analysis:'op'}));
  execFileSync(binary,['-b','job.cir'],{cwd:dir,stdio:'pipe',timeout:120000});
  const plot=parseRaw(new Uint8Array(readFileSync(join(dir,'result.raw')))),guesses:Record<string,number>={};
  plot.names.forEach((n,i)=>{ const m=n.match(/^v\(([^)]+)\)$/);if(m&&!m[1].includes('latch')) guesses[m[1]]=plot.columns[i][0]; });
  if(Object.keys(guesses).length<30) throw new Error('바이어스 초기값 누락');
  writeFileSync('testbench/bd2-bias-guesses.json',JSON.stringify(guesses,null,2)+'\n');
  console.log('Bootstrap: '+Object.keys(guesses).length+' non-latch Newton initial guesses. Not forced voltages.');
} finally { rmSync(dir,{recursive:true,force:true}); }
