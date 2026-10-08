import type { PedalSettings } from '../domain/circuit/types';
export interface RenderResult {
  jobId: number; settings: PedalSettings | null; input: Float32Array; output: Float32Array;
  conditions?: Record<string,string|number>; probes: Record<string, Float32Array>; elapsedMs: number; heapBytes: number; rawBytes: number;
}
export type WorkerResponse = { type: 'progress';jobId:number;message:string } |
  {type:'result';result:RenderResult} | {type:'error';jobId:number;message:string};
