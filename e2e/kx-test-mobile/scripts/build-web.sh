#!/usr/bin/env bash
# Exports both mobile apps as web builds with the kx-test profile into e2e/kx-test-mobile/.web/<app>. Public configuration only.
set -euo pipefail
ws="$(cd "$(dirname "$0")/../../.." && pwd)"; out="$ws/e2e/kx-test-mobile/.web"; profile="${1:-test}"
mkdir -p "$out"
( cd "$ws/kiorex-platform/apps/mobile" && node scripts/with-env.mjs "$profile" -- npx expo export --platform web --output-dir "$out/kiorex" >/dev/null )
( cd "$ws/kiorly" && node scripts/with-env.mjs "$profile" -- npx expo export --platform web --output-dir "$out/kiorly" >/dev/null )
echo "exported $profile builds to $out"
