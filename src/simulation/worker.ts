/// <reference lib="webworker" />
import { bd2Circuit } from '../circuits/boss-bd2/document';
import models from '../../models/bd2-test-models.spice?raw';
import guesses from '../../testbench/bd2-bias-guesses.json';
import manifest from '../../simulation/engine-manifest.json';
import { guitarDemo, DEMO_SECONDS } from '../audio/demo';
import { createNetlist, assertBias } from './netlist';
import { runWasm, type EngineFactory } from './engine';
import { parseRaw, column } from './raw';
import { toPCM } from './pcm';
import type { PedalSettings } from '../domain/circuit/types';
import type { WorkerResponse } from './messages';
const scope=self as unknown as DedicatedWorkerGlobalScope;
function send(m: WorkerResponse, transfer: Transferable[]=[]){scope.postMessage(m,transfer);}
scope.onmessage=async(e:MessageEvent<{jobId:number;settings:PedalSettings}>)=>{
  const {jobId,settings}=e.data,started=performance.now();
  try {
    send({type:'progress',jobId,message:'회로 엔진을 준비하고 있어요'});
    const engineURL=new URL(manifest.js,scope.location.origin).href;
    const wasmURL=new URL(manifest.wasm,scope.location.origin).href;
    const factory=(await import(/* @vite-ignore */ engineURL)).default as EngineFactory;
    const samples=guitarDemo();
    const netlist=createNetlist(bd2Circuit,models,settings,{analysis:'transient',samples,duration:DEMO_SECONDS,oversample:4,biasGuesses:guesses});
    send({type:'progress',jobId,message:'8초의 회로 응답을 계산하고 있어요'});
    const result=await runWasm(netlist,factory,wasmURL);
    if(!result.biasRaw)throw new Error('바이어스 검증 데이터 누락');
    const bias=parseRaw(result.biasRaw);assertBias(settings,name=>column(bias,'v('+name+')')[0]);
    send({type:'progress',jobId,message:'계산 결과를 재생 신호로 변환하고 있어요'});
    const raw=parseRaw(result.raw),input=toPCM(raw,'v(input)',DEMO_SECONDS),output=toPCM(raw,'v(output)',DEMO_SECONDS);
    const probes={gain1_out:toPCM(raw,'v(gain1_out)',DEMO_SECONDS),gain2_out:toPCM(raw,'v(gain2_out)',DEMO_SECONDS)};
    const inputDigest=await crypto.subtle.digest('SHA-256',samples.buffer as ArrayBuffer);
    const inputSha256=Array.from(new Uint8Array(inputDigest),v=>v.toString(16).padStart(2,'0')).join('');
    const conditions={circuitRevision:bd2Circuit.revision,engineVersion:manifest.version,inputSha256,sourceOhms:1000,loadOhms:1000000,temperatureC:25,supplyVolts:9,sampleRate:48000,oversample:4};
    send({type:'result',result:{jobId,settings,input,output,probes,conditions,elapsedMs:performance.now()-started,heapBytes:result.heapBytes,rawBytes:result.raw.length}},
      [input.buffer,output.buffer,probes.gain1_out.buffer,probes.gain2_out.buffer]);
  } catch(error) { send({type:'error',jobId,message:error instanceof Error?error.message:String(error)}); }
};
