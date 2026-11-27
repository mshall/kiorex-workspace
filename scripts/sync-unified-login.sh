#!/usr/bin/env bash
# Copies the canonical unified sign-in card (kiorex-account/packages/unified-login) into the three web apps, byte for byte, and records its hash.
# `scripts/sync-unified-login.sh --check` only verifies (exit 1 on divergence). Each repo also has a node test that checks its own copy against the recorded hash.
set -euo pipefail
ws="$(cd "$(dirname "$0")/.." && pwd)"
src="$ws/kiorex-account/packages/unified-login/unified-sign-in.tsx"
hash="$(shasum -a 256 "$src" | cut -d' ' -f1)"
targets=("kiorly-pharmacy/apps/web/src/components" "kiorly-lab/apps/web/src/components" "clinics-management/apps/web/src/components")
rc=0
for t in "${targets[@]}"; do
  d="$ws/$t"
  if [ "${1:-}" = "--check" ]; then
    cmp -s "$src" "$d/unified-sign-in.tsx" || { echo "DIVERGED: $t/unified-sign-in.tsx"; rc=1; }
    [ "$(cat "$d/unified-sign-in.sha256" 2>/dev/null)" = "$hash" ] || { echo "HASH FILE STALE: $t"; rc=1; }
  else
    cp "$src" "$d/unified-sign-in.tsx"; printf '%s' "$hash" > "$d/unified-sign-in.sha256"
  fi
done
cp "$src" /dev/null; printf '%s' "$hash" > "$ws/kiorex-account/packages/unified-login/unified-sign-in.sha256" 2>/dev/null || true
[ "$rc" = 0 ] && echo "unified login: ${1:-synced} ok ($hash)"
exit $rc
