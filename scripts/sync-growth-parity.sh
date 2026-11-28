#!/usr/bin/env bash
# Copies the canonical Growth wording manifest (scripts/growth-parity/growth-parity.json) byte for byte into the Clinic, Pharmacy and Lab web apps and records its hash.
# `scripts/sync-growth-parity.sh --check` only verifies (exit 1 on divergence). Each product also has a node test (growth-parity.node.test.ts) that checks its copy against the recorded hash
# and every shared string of its own Growth screen against the manifest, so the three Growth screens cannot drift apart in wording.
set -euo pipefail
ws="$(cd "$(dirname "$0")/.." && pwd)"
src="$ws/scripts/growth-parity/growth-parity.json"
hash="$(shasum -a 256 "$src" | cut -d' ' -f1)"
targets=("kiorly-pharmacy/apps/web/src/features/growth" "kiorly-lab/apps/web/src/features/growth" "clinics-management/apps/web/src/features/growth")
rc=0
for t in "${targets[@]}"; do
  d="$ws/$t"
  if [ "${1:-}" = "--check" ]; then
    cmp -s "$src" "$d/growth-parity.json" || { echo "DIVERGED: $t/growth-parity.json"; rc=1; }
    [ "$(cat "$d/growth-parity.sha256" 2>/dev/null)" = "$hash" ] || { echo "HASH FILE STALE: $t"; rc=1; }
  else
    cp "$src" "$d/growth-parity.json"; printf '%s' "$hash" > "$d/growth-parity.sha256"
  fi
done
[ "$rc" = 0 ] && echo "growth parity: ${1:-synced} ok ($hash)"
exit $rc
