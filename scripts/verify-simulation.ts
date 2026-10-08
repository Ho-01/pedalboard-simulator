import assert from 'node:assert/strict';
import { existsSync,readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { bd2Circuit } from '../src/circuits/boss-bd2/document';
import { DEFAULT_SETTINGS,cloneCircuit,type PedalSettings } from '../src/domain/circuit/types';
import { createNetlist,assertBias,type SimulationOptions } from '../src/simulation/netlist';
import { parseRaw,column,type RawPlot } from '../src/simulation/raw';
import { toPCM,signalStats } from '../src/simulation/pcm';
import { runWasm,type EngineFactory } from '../src/simulation/engine';
import { guitarDemo } from '../src/audio/demo';
const manifest=JSON.parse(readFileSync('simulation/engine-manifest.json','utf8'));
const wasmPath=resolve('public'+manifest.wasm),factory=(await import(pathToFileURL(resolve('public'+manifest.js)).href)).default as EngineFactory;
const native=process.env.NGSPICE_NATIVE??'/home/ho/.cache/pedal-engine-build/native/src/ngspice';
const models=readFileSync('models/bd2-test-models.spice','utf8'),guesses=JSON.parse(readFileSync('testbench/bd2-bias-guesses.json','utf8'));
const evidence:{name:string;[key:string]:unknown}[]=[];
const outdir='simulation/evidence';mkdirSync(outdir,{recursive:true});
function note(v:{name:string;[key:string]:unknown}){evidence.push(v);console.log(JSON.stringify(v));}
function nativeRun(netlist:string){
  const dir=mkdtempSync(join(tmpdir(),'bd2-verify-')),start=performance.now();
  try{
    writeFileSync(join(dir,'job.cir'),netlist);
    const log=execFileSync(native,['-b','job.cir'],{cwd:dir,timeout:900000,maxBuffer:8*1024*1024}).toString();
    if(/timestep too small|doAnalyses:.*failed/i.test(log))throw new Error(log);
    const raw=new Uint8Array(readFileSync(join(dir,'result.raw')));
    const biasFile=join(dir,'bias.raw');
    return {plot:parseRaw(raw),bias:existsSync(biasFile)?parseRaw(new Uint8Array(readFileSync(biasFile))):null,rawBytes:raw.length,ms:performance.now()-start};
  }finally{rmSync(dir,{recursive:true,force:true});}
}
async function pair(s:PedalSettings,o:SimulationOptions,c=bd2Circuit){
  const netlist=createNetlist(c,models,s,{...o,biasGuesses:guesses});
  const a=nativeRun(netlist),start=performance.now(),r=await runWasm(netlist,factory,wasmPath),b=parseRaw(r.raw);
  if(o.analysis!=='op'){assert.ok(a.bias&&r.biasRaw);opBias(a.bias,s);opBias(parseRaw(r.biasRaw),s);}
  return {a,b,wasmMs:performance.now()-start,heapBytes:r.heapBytes};
}
function relative(a:ArrayLike<number>,b:ArrayLike<number>){
  assert.equal(a.length,b.length);let error=0,energy=0;
  for(let i=0;i<a.length;i++){error+=(a[i]-b[i])**2;energy+=a[i]**2;}
  return Math.sqrt(error/Math.max(energy,1e-24));
}
function opBias(p:RawPlot,s:PedalSettings){assertBias(s,n=>column(p,'v('+n+')')[0]);}
for(const on of [false,true]){
  const s={...DEFAULT_SETTINGS,on},p=await pair(s,{analysis:'op'});opBias(p.a.plot,s);opBias(p.b,s);
  let max=0;p.a.plot.names.forEach((n,i)=>{const j=p.b.names.indexOf(n);assert.ok(j>=0);max=Math.max(max,Math.abs(p.a.plot.columns[i][0]-p.b.columns[j][0]));});
  assert.ok(max<1e-5);note({name:'native-wasm-dc',on,maxAbsolute:max,nativeMs:p.a.ms,wasmMs:p.wasmMs,heapBytes:p.heapBytes});
  const ac=await pair(s,{analysis:'ac'}),ai=ac.a.plot.names.indexOf('v(output)'),bi=ac.b.names.indexOf('v(output)');
  const av=ac.a.plot.columns[ai],bv=ac.b.columns[bi];let db=0,phase=0;
  for(let i=0;i<av.length;i+=2){const ma=Math.hypot(av[i],av[i+1]),mb=Math.hypot(bv[i],bv[i+1]);if(ma<1e-9)continue;
    db=Math.max(db,Math.abs(20*Math.log10(mb/ma)));let d=(Math.atan2(bv[i+1],bv[i])-Math.atan2(av[i+1],av[i]))*180/Math.PI;d=(d+540)%360-180;phase=Math.max(phase,Math.abs(d));}
  assert.ok(db<.1&&phase<1);note({name:'native-wasm-ac',on,maxDb:db,maxPhaseDegrees:phase,points:ac.a.plot.points});
  const tr=await pair(s,{analysis:'transient',duration:.1,source:'sine'});
  const a=toPCM(tr.a.plot,'v(output)',.1),b=toPCM(tr.b,'v(output)',.1),err=relative(a,b);assert.ok(err<.001);
  note({name:'native-wasm-transient',on,relativeRms:err,nativePoints:tr.a.plot.points,wasmPoints:tr.b.points});
}
let matrix=0;
const matrixRows:unknown[]=[];
for(const gain of [0,2.5,5,7.5,10])for(const tone of [0,2.5,5,7.5,10])for(const level of [0,5,10])for(const on of [false,true]){
  const settings={gain,tone,level,on};
  const dc=nativeRun(createNetlist(bd2Circuit,models,settings,{analysis:'op',biasGuesses:guesses}));opBias(dc.plot,settings);
  const ac=nativeRun(createNetlist(bd2Circuit,models,settings,{analysis:'ac',biasGuesses:guesses}));opBias(ac.bias!,settings);
  const tr=nativeRun(createNetlist(bd2Circuit,models,settings,{analysis:'transient',duration:.04,biasGuesses:guesses}));opBias(tr.bias!,settings);
  const output=toPCM(tr.plot,'v(output)',.04),stats=signalStats(output),index=ac.plot.names.indexOf('v(output)');
  matrixRows.push({settings,biasV8:column(dc.plot,'v(v8)')[0],biasVb:column(dc.plot,'v(vb)')[0],acOutputRelativeRms:signalStats(ac.plot.columns[index]).rms,outputRmsV:stats.rms,outputPeakV:stats.peak,points:tr.plot.points});matrix++;
}
writeFileSync(join(outdir,'control-matrix.json'),JSON.stringify(matrixRows,null,2)+'\n');
note({name:'native-dc-ac-transient-control-matrix',cases:matrix,transientStimulus:'220Hz 50mV sine, 40ms',evidence:'simulation/evidence/control-matrix.json',limit:'8-second decay and all amplitudes not exhaustively tested for every combination'});
const square=nativeRun(createNetlist(bd2Circuit,models,{...DEFAULT_SETTINGS,on:true},{analysis:'transient',duration:.05,source:'square',biasGuesses:guesses}));
note({name:'service-test-stimulus',frequencyHz:200,inputVpp:.005,points:square.plot.points,comparison:'stimulus run only; scanned manual image is not a numeric golden fixture'});
const baseline=nativeRun(createNetlist(bd2Circuit,models,{...DEFAULT_SETTINGS,on:true},{analysis:'transient',duration:.1,biasGuesses:guesses}));
const refined=nativeRun(createNetlist(bd2Circuit,models,{...DEFAULT_SETTINGS,on:true},{analysis:'transient',duration:.1,oversample:8,biasGuesses:guesses}));
const refinement=relative(toPCM(refined.plot,'v(output)',.1,8),toPCM(baseline.plot,'v(output)',.1,4));
assert.ok(refinement<.01);note({name:'native-timestep-refinement',signal:'220Hz 50mV sine / knobs5 ON',relativeRms:refinement});
const custom=cloneCircuit(bd2Circuit);custom.components.find(c=>c.refdes==='R9')!.value=13600;
const modified=nativeRun(createNetlist(custom,models,{...DEFAULT_SETTINGS,on:true},{analysis:'transient',duration:.1,biasGuesses:guesses}));
const customDelta=relative(toPCM(baseline.plot,'v(output)',.1),toPCM(modified.plot,'v(output)',.1));
assert.ok(customDelta>.001);note({name:'custom-component-path',component:'R9',before:6800,after:13600,relativeOutputChange:customDelta});
const demo=guitarDemo();
for(const on of [false,true]){
  const p=await pair({...DEFAULT_SETTINGS,on},{analysis:'transient',samples:demo,duration:8});
  const a=toPCM(p.a.plot,'v(output)',8),b=toPCM(p.b,'v(output)',8),error=relative(a,b);assert.ok(error<.001);
  note({name:'eight-second-demo',on,relativeRms:error,nativeMs:p.a.ms,wasmMs:p.wasmMs,heapBytes:p.heapBytes,rawBytes:p.a.rawBytes,points:p.a.plot.points,...signalStats(a)});
}
writeFileSync(join(outdir,'numerical.json'),JSON.stringify({generatedAt:new Date().toISOString(),engine:manifest,evidence,notPerformed:['independent schematic-to-netlist audit','measured semiconductor parameter fit','physical BD-2 A/B listening','all-amplitude long decay matrix','Safari/Edge integration']},null,2)+'\n');
console.log('Numerical validation completed. Physical sound match remains unverified.');
