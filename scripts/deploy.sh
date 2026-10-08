#!/usr/bin/env bash
set -euo pipefail
sha=${1:?Usage: bash scripts/deploy.sh <full-commit-sha>}
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo 'A full commit SHA is required' >&2; exit 1; }
repo=$(git rev-parse --show-toplevel)
root=/var/www/pedalboard-simulator
release="$root/releases/$sha"
[[ -z "$(git -C "$repo" status --porcelain)" ]] || { echo 'Checkout must be clean' >&2; exit 1; }
git -C "$repo" cat-file -e "$sha^{commit}"
[[ ! -e "$release" ]] || { echo 'Release exists; activate using rollback.sh' >&2; exit 1; }
build_root=${PEDAL_BUILD_ROOT:-"$HOME/.cache/pedal-deploy"}
mkdir -p "$build_root"
build_dir=$(mktemp -d "$build_root/pedal-build.XXXXXXXX")
export TMPDIR="$build_root"
cleanup() { git -C "$repo" worktree remove --force "$build_dir" >/dev/null 2>&1 || true; }
trap cleanup EXIT
git -C "$repo" worktree add --detach "$build_dir" "$sha"
cd "$build_dir"
npm ci --no-audit --no-fund
npm run build
node -e 'const v=JSON.parse(require("fs").readFileSync("dist/version.json"));if(v.commit!==process.argv[1]||v.dirty)process.exit(1)' "$sha"
sudo install -d -m 755 "$root/releases" "$root/shared/assets" "$root/shared/engine" "$release"
sudo cp -a dist/. "$release/"
sudo cp -a dist/assets/. "$root/shared/assets/"
if [[ -d dist/engine ]]; then sudo cp -a dist/engine/. "$root/shared/engine/"; fi
sudo find "$release" -type d -exec chmod 755 {} +
sudo find "$release" -type f -exec chmod 644 {} +
sudo ln -s "$release" "$root/current.next"
sudo mv -Tf "$root/current.next" "$root/current"
echo "Activated $sha"
