import {readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {bd2Circuit} from '../src/circuits/boss-bd2/document';
import {DEFAULT_SETTINGS} from '../src/domain/circuit/types';
import {createNetlist,assertBias} from '../src/simulation/netlist';
import {parseRaw,column} from '../src/simulation/raw';
import {toPCM,signalStats} from '../src/simulation/pcm';
const native='/home/ho/.cache/pedal-engine-build/native/src/ngspice';
const models=readFileSync('models/bd2-test-models.spice','utf8');
const guesses=JSON.parse(readFileSync('testbench/bd2-bias-guesses.json','utf8'));
const results=[];
for(const on of [false,true]){
  const settings={...DEFAULT_SETTINGS,on},dir=mkdtempSync(join(tmpdir(),'bd2-smoke-'));
  try{
    writeFileSync(join(dir,'job.cir'),createNetlist(bd2Circuit,models,settings,{analysis:'transient',duration:.05,biasGuesses:guesses}));
    const started=Date.now();execFileSync(native,['-b','job.cir'],{cwd:dir,timeout:300000});
    const bias=parseRaw(new Uint8Array(readFileSync(join(dir,'bias.raw'))));
    assertBias(settings,n=>column(bias,'v('+n+')')[0]);
    const plot=parseRaw(new Uint8Array(readFileSync(join(dir,'result.raw'))));
    const stats=signalStats(toPCM(plot,'v(output)',.05));
    const row={on,latchLeft:column(bias,'v(latch_left)')[0],latchRight:column(bias,'v(latch_right)')[0],v8:column(bias,'v(v8)')[0],vb:column(bias,'v(vb)')[0],points:plot.points,elapsedMs:Date.now()-started,...stats};
    results.push(row);console.log(JSON.stringify(row));
  }finally{rmSync(dir,{recursive:true,force:true});}
}
mkdirSync('simulation/evidence',{recursive:true});writeFileSync('simulation/evidence/native-smoke.json',JSON.stringify(results,null,2)+'\n');
