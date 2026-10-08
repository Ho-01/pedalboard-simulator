import test from "node:test";
import assert from "node:assert/strict";
import {bd2Circuit} from "../src/circuits/boss-bd2/document";
import {DEFAULT_SETTINGS} from "../src/domain/circuit/types";
import {createNetlist} from "../src/simulation/netlist";

test("PWL serialization preserves all sampled voltages and time knots across card boundaries", () => {
 const samples=Float32Array.from({length:257},(_,i)=>Math.sin(i*.23)*.07);
 const text=createNetlist(bd2Circuit,"",DEFAULT_SETTINGS,{analysis:"transient",samples,duration:.02,sampleRate:48000});
 const data=text.match(/Vsignal signal 0 PWL\(([\s\S]*?)\)/)![1]
   .replace(/\n\+\s*/g," ").trim().split(/\s+/).map(Number);
 assert.equal(data.length,2*(samples.length+2));
 for(let i=0;i<samples.length;i++){
  assert.ok(Math.abs(data[2*i]-i/48000)<1e-10);
  assert.ok(Math.abs(data[2*i+1]-samples[i])<1e-9);
 }
 assert.equal(data.at(-1),0);
 assert.ok(data.every(Number.isFinite));
});
