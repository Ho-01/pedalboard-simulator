#!/usr/bin/env bash
set -euo pipefail
repo=$(git rev-parse --show-toplevel)
cache=${PEDAL_ENGINE_CACHE:-"$HOME/.cache/pedal-engine-build"}
mkdir -p "$cache/tmp" "$cache/native" "$cache/wasm"
export TMPDIR="$cache/tmp"
if [[ ! -d "$cache/source/.git" ]]; then git clone --depth 1 --branch ngspice-47 https://github.com/imr/ngspice.git "$cache/source"; fi
[[ "$(git -C "$cache/source" rev-parse HEAD)" == a80f6e3e95d51534905b1f23410a951802666656 ]]
if [[ ! -d "$cache/emsdk/.git" ]]; then git clone https://github.com/emscripten-core/emsdk.git "$cache/emsdk"; fi
"$cache/emsdk/emsdk" install 4.0.21
"$cache/emsdk/emsdk" activate 4.0.21
python3 "$repo/scripts/patch-engine.py" "$cache/source"
(cd "$cache/source" && ./autogen.sh)
(cd "$cache/native" && "$cache/source/configure" --without-x --with-readline=no --disable-debug --disable-xspice --disable-osdi --disable-cider --disable-openmp --disable-klu CFLAGS=-O3 && nice -n 19 make -j1)
. "$cache/emsdk/emsdk_env.sh"
(cd "$cache/wasm" && emconfigure "$cache/source/configure" --host=wasm32-unknown-emscripten --without-x --with-readline=no --disable-debug --disable-xspice --disable-osdi --disable-cider --disable-openmp --disable-klu --enable-static --disable-shared ac_cv_func_getrusage=no ac_cv_func_times=no ac_cv_func_malloc_0_nonnull=yes ac_cv_func_realloc_0_nonnull=yes CFLAGS=-O3 && nice -n 19 emmake make -j1 LDFLAGS="-O3 -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web,worker,node -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=67108864 -s MAXIMUM_MEMORY=536870912 -s STACK_SIZE=8388608 -s INVOKE_RUN=0 -s EXPORTED_RUNTIME_METHODS=FS,callMain,HEAPU8 -s FORCE_FILESYSTEM=1")
python3 "$repo/scripts/package-engine.py" "$cache" "$repo"
