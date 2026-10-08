import test from 'node:test';
import assert from 'node:assert/strict';
import { bd2Circuit } from '../src/circuits/boss-bd2/document';
import { cloneCircuit,validateCircuit,DEFAULT_SETTINGS } from '../src/domain/circuit/types';
import { potRatio,createNetlist,assertBias } from '../src/simulation/netlist';
import { clampPosition,fitWorkspace,PEDAL_SIZE } from '../src/domain/workspace';
import { parseRaw } from '../src/simulation/raw';
import { firKernel,toPCM,signalStats } from '../src/simulation/pcm';
import { guitarDemo } from '../src/audio/demo';
test('CircuitDocument validates all pin/net memberships and rejects a dangling pin',()=>{
  validateCircuit(bd2Circuit);const c=cloneCircuit(bd2Circuit);c.components[0].pins[0].net='missing';
  assert.throws(()=>validateCircuit(c));
});
test('custom component edits feed the same generator without mutating stock',()=>{
  const c=cloneCircuit(bd2Circuit),r=c.components.find(c=>c.refdes==='R9')!;
  r.value=12345;const net=createNetlist(c,'',DEFAULT_SETTINGS,{analysis:'op'});
  assert.match(net,/R9 amp_minus amp_out 12345/);assert.equal(bd2Circuit.components.find(c=>c.refdes==='R9')!.value,6800);
});
test('physical pot tapers, endpoints and dual-gang gain',()=>{
  assert.equal(potRatio(0,'audio15-provisional'),0);assert.ok(Math.abs(potRatio(5,'audio15-provisional')-.15)<1e-12);
  assert.equal(potRatio(10,'audio15-provisional'),1);assert.equal(potRatio(5,'linear'),.5);assert.throws(()=>potRatio(NaN,'linear'));
  const net=createNetlist(bd2Circuit,'',DEFAULT_SETTINGS,{analysis:'op'});
  for(const gang of ['A','B']) {const v=Number(net.match(new RegExp('RVR1'+gang+'_lo \\S+ \\S+ (\\S+)'))?.[1]);assert.ok(Math.abs(v-37500)<1e-6);}
});
test('bad or symmetric latch state is rejected even if solver exits successfully',()=>{
  assert.throws(()=>assertBias(DEFAULT_SETTINGS,n=>n==='v8'?8:n==='vb'?4:1.7));
  assertBias(DEFAULT_SETTINGS,n=>({v8:8,vb:4,latch_left:.02,latch_right:5.4})[n]!);
});
test('free world coordinates clamp and screen scaling is reversible',()=>{
  assert.deepEqual(clampPosition(-100,1000),{x:0,y:350-PEDAL_SIZE.height});
  const f=fitWorkspace(1000,300),x=137.3;assert.ok(Math.abs(((x*f.scale+f.left)-f.left)/f.scale-x)<1e-12);
});
function rawSignal(freq:number){
  const fs=192000,n=Math.ceil(.051*fs)+1,t=new Float64Array(n),v=new Float64Array(n);
  for(let i=0;i<n;i++){t[i]=i/fs;v[i]=Math.sin(2*Math.PI*freq*t[i]);}
  return {names:['time','v(out)'],columns:[t,v],points:n,complex:false};
}
test('FIR preserves passband and suppresses out-of-band energy before decimation',()=>{
  const kernel=firKernel(4);assert.ok(Math.abs(kernel.reduce((a,b)=>a+b,0)-1)<1e-12);
  const low=toPCM(rawSignal(1000),'v(out)',.05),high=toPCM(rawSignal(30000),'v(out)',.05);
  const lowRms=signalStats(low.subarray(100,low.length-100)).rms,highRms=signalStats(high.subarray(100,high.length-100)).rms;
  assert.ok(Math.abs(lowRms-Math.SQRT1_2)<.003);assert.ok(highRms/lowRms<.001);
});
test('truncated/corrupt raw fails; generated guitar is finite, deterministic and voltage-scaled',()=>{
  assert.throws(()=>parseRaw(new Uint8Array(100)));
  const a=guitarDemo(.1),b=guitarDemo(.1);assert.deepEqual(a,b);assert.ok(a.every(Number.isFinite));
  assert.ok(signalStats(a).peak>.001&&signalStats(a).peak<.2);
});
