import {existsSync,readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync,copyFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {parseRaw} from '../src/simulation/raw';
export const nativeBinary=process.env.NGSPICE_NATIVE??'/home/ho/.cache/pedal-engine-build/native/src/ngspice';
const binaryHash=createHash('sha256').update(readFileSync(nativeBinary)).digest('hex');
const cache=process.env.PEDAL_VALIDATION_CACHE??join(tmpdir(),'pedal-numerical-cache');
mkdirSync(cache,{recursive:true});
export function nativeRun(netlist:string){
  const key=createHash('sha256').update(binaryHash).update(netlist).digest('hex');
  const rawPath=join(cache,key+'.raw'),biasPath=join(cache,key+'.bias.raw'),metaPath=join(cache,key+'.json');
  if(existsSync(rawPath)&&existsSync(metaPath)){
    const meta=JSON.parse(readFileSync(metaPath,'utf8'));
    return {plot:parseRaw(new Uint8Array(readFileSync(rawPath))),bias:existsSync(biasPath)?parseRaw(new Uint8Array(readFileSync(biasPath))):null,rawBytes:meta.rawBytes,ms:meta.ms,cacheHit:true};
  }
  const dir=mkdtempSync(join(tmpdir(),'bd2-verify-')),start=performance.now();
  try{
    writeFileSync(join(dir,'job.cir'),netlist);
    const log=execFileSync(nativeBinary,['-b','job.cir'],{cwd:dir,stdio:'pipe',timeout:900000,maxBuffer:8*1024*1024}).toString();
    if(/timestep too small|doAnalyses:.*failed/i.test(log))throw new Error(log);
    const raw=new Uint8Array(readFileSync(join(dir,'result.raw')));
    const plot=parseRaw(raw),biasFile=join(dir,'bias.raw'),bias=existsSync(biasFile)?parseRaw(new Uint8Array(readFileSync(biasFile))):null;
    const ms=performance.now()-start;
    writeFileSync(rawPath,raw);if(bias)copyFileSync(biasFile,biasPath);
    writeFileSync(metaPath,JSON.stringify({binaryHash,netlistHash:createHash('sha256').update(netlist).digest('hex'),ms,rawBytes:raw.length}));
    return {plot,bias,rawBytes:raw.length,ms,cacheHit:false};
  }finally{rmSync(dir,{recursive:true,force:true});}
}
