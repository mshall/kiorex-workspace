#!/usr/bin/env bash
# fmt + init -backend=false + validate for every module (both providers), the stack, the bootstrap stack and the three env roots.
# Never touches the cloud (validate does not configure providers). Usage: scripts/validate-all.sh [--fmt-only]
set -uo pipefail
cd "$(dirname "$0")/.."
export TF_PLUGIN_CACHE_DIR="${TF_PLUGIN_CACHE_DIR:-$HOME/.terraform.d/plugin-cache}"; mkdir -p "$TF_PLUGIN_CACHE_DIR"
tofu fmt -recursive . >/dev/null || exit 1
[ "${1:-}" = "--fmt-only" ] && exit 0
fail=0
dirs=$(find modules envs bootstrap -name '*.tf' -not -path '*/.terraform/*' -exec dirname {} \; | sort -u)
for d in $dirs; do
  out=$( (cd "$d" && tofu init -backend=false -input=false >/dev/null 2>&1 && tofu validate -no-color 2>&1) ) && echo "ok    $d" || { echo "FAIL  $d"; echo "$out" | sed 's/^/      /'; fail=1; }
done
exit $fail
