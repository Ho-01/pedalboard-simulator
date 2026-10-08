import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {bd2Circuit} from '../src/circuits/boss-bd2/document';
import {DEFAULT_SETTINGS} from '../src/domain/circuit/types';
import {createNetlist,assertBias} from '../src/simulation/netlist';
import {column} from '../src/simulation/raw';
import {guitarDemo} from '../src/audio/demo';
import {nativeRun} from './native-runner';
const models=readFileSync('models/bd2-test-models.spice','utf8'),guesses=JSON.parse(readFileSync('testbench/bd2-bias-guesses.json','utf8'));
const samples=guitarDemo(),rows=[];
for(const on of [false,true]){
  const settings={...DEFAULT_SETTINGS,on},result=nativeRun(createNetlist(bd2Circuit,models,settings,{analysis:'transient',samples,duration:8,oversample:4,biasGuesses:guesses}));
  if(!result.bias)throw new Error('Missing bias');
  assertBias(settings,n=>column(result.bias!,'v('+n+')')[0]);
  const row={on,nativeMs:result.ms,points:result.plot.points,rawBytes:result.rawBytes,cacheHit:result.cacheHit};
  rows.push(row);console.log(JSON.stringify(row));
}
mkdirSync('simulation/evidence',{recursive:true});
writeFileSync('simulation/evidence/native-demo.json',JSON.stringify(rows,null,2)+'\n');
