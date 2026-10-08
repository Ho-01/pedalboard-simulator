from pathlib import Path
import hashlib, json, shutil, subprocess, sys
cache, repo=map(Path,sys.argv[1:3])
js=(cache/'wasm/src/ngspice').read_bytes()
wasm=(cache/'wasm/src/ngspice.wasm').read_bytes()
hashes={'js':hashlib.sha256(js).hexdigest(),'wasm':hashlib.sha256(wasm).hexdigest()}
artifact=hashlib.sha256(js+wasm).hexdigest()[:20]
folder=repo/'public/engine'/artifact
folder.mkdir(parents=True,exist_ok=True)
(folder/'ngspice.mjs').write_bytes(js)
(folder/'ngspice.wasm').write_bytes(wasm)
shutil.copyfile(cache/'source/COPYING',folder/'COPYING')
diff=subprocess.check_output(['git','diff','--','src/spicelib/analysis/cktsopt.c','src/spicelib/devices/dev.c','src/spicelib/devices/Makefile.am','src/Makefile.am'],cwd=cache/'source')
(repo/'simulation/ngspice47-build.patch').write_bytes(diff)
manifest={'engine':'ngspice','version':'47','sourceCommit':'a80f6e3e95d51534905b1f23410a951802666656','emscripten':'4.0.21','emsdkCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=cache/'emsdk').decode().strip(),'js':'/engine/'+artifact+'/ngspice.mjs','wasm':'/engine/'+artifact+'/ngspice.wasm','sha256':hashes,'patchSha256':hashlib.sha256(diff).hexdigest(),'cflags':'-O3','memory':{'initialBytes':67108864,'maximumBytes':536870912,'stackBytes':8388608},'deviceSubset':['asrc','bjt','cap','cccs','ccvs','csw','dio','ind','isrc','jfet','jfet2','ltra','mos1','mos2','mos3','mos6','mos9','res','sw','tra','urc','vccs','vcvs','vdmos','vsrc'],'modelSha256':hashlib.sha256((repo/'models/bd2-test-models.spice').read_bytes()).hexdigest(),'circuitSha256':hashlib.sha256((repo/'src/circuits/boss-bd2/circuit.json').read_bytes()).hexdigest(),'inputSourceSha256':hashlib.sha256((repo/'src/audio/demo.ts').read_bytes()).hexdigest(),'verification':'see simulation/evidence; physical sound unverified'}
(repo/'simulation/engine-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'artifact':artifact,'jsBytes':len(js),'wasmBytes':len(wasm),'sha256':hashes}))
