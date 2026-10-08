import assert from "node:assert/strict";
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {parseRaw} from "../src/simulation/raw";
const cache=process.env.PEDAL_ENGINE_CACHE??"/home/ho/.cache/pedal-engine-build";
const before=cache+"/native/src/ngspice-before-pwl",after=cache+"/native/src/ngspice";
const hash=(p:string)=>createHash("sha256").update(readFileSync(p)).digest("hex");
const fixtures=[
["regular","PWL(0 0 .001 1 .002 -1 .003 0)"],
["repeat","PWL(0 0 .001 1 .002 -1 .003 0) r=0"],
["delay","PWL(0 0 .001 1 .002 -1 .003 0) td=.0003 r=.001"],
["duplicate","PWL(0 0 .001 1 .001 -1 .002 0)"],
["reversed","PWL(0 0 .001 1 .0005 -.5 .002 -1 .003 0)"],
["single","PWL(0 .12)"],
];
const evidence:unknown[]=[];
for(const [name,pwl] of fixtures){
 const net="PWL equivalence fixture\nV1 inp 0 "+pwl+"\nR1 inp out 1000\nC1 out 0 1u\n.control\nset noaskquit\nset filetype=binary\ntran 5u 8m 0 5u\nwrite result.raw v(inp) v(out)\nquit\n.endc\n.end\n";
 const run=(binary:string)=>{
  const dir=mkdtempSync(join(tmpdir(),"pwl-fixture-"));
  try{writeFileSync(dir+"/job.cir",net);execFileSync(binary,["-b","job.cir"],{cwd:dir,timeout:60000,maxBuffer:2*1024*1024});return parseRaw(new Uint8Array(readFileSync(dir+"/result.raw")));}
  finally{rmSync(dir,{recursive:true,force:true});}
 };
 const a=run(before),b=run(after);
 assert.deepEqual(a.names,b.names);
 assert.equal(a.points,b.points);
 let max=0;
 for(let j=0;j<a.columns.length;j++)
  for(let i=0;i<a.columns[j].length;i++)max=Math.max(max,Math.abs(a.columns[j][i]-b.columns[j][i]));
 assert.ok(max<1e-12);
 evidence.push({name,points:a.points,maxAbsoluteDelta:max});
 console.log(JSON.stringify(evidence.at(-1)));
}
writeFileSync("simulation/evidence/pwl-engine.json",JSON.stringify({beforeSha256:hash(before),afterSha256:hash(after),evidence},null,2)+"\n");
