#!/usr/bin/env bash
set -euo pipefail
sha=${1:?Usage: bash scripts/rollback.sh <full-commit-sha>}
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || exit 1
root=/var/www/pedalboard-simulator
release="$root/releases/$sha"
[[ -f "$release/index.html" && -f "$release/version.json" ]] || { echo 'No complete release' >&2; exit 1; }
node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[2]));if(v.commit!==process.argv[1]||v.dirty)process.exit(1)' "$sha" "$release/version.json"
sudo ln -s "$release" "$root/current.next"
sudo mv -Tf "$root/current.next" "$root/current"
echo "Activated $sha"
