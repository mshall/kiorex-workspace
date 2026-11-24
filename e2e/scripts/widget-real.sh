#!/usr/bin/env bash
# REAL Passport widget run: the booking widget (embedded on an allow-listed https host page) books through the real Kiorex API :4000, the real Kiorly Clinic :3010
# and the real dev Passport :4400 (popup sign-in, client `kiorex-widget`). Nothing is stubbed except the HOST PAGE, which Playwright serves for the https origin.
# Prerequisite: e2e/scripts/up.sh --restart --only=passport (so the `kiorex-widget` client from kiorex-account/config/idp.json is loaded) and a seeded stack.
# Usage: e2e/scripts/widget-real.sh [playwright args]    e.g.  --project=desktop
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT/e2e" && npx tsx widget-real/fixture.mts up || exit 1
cleanup() { (cd "$ROOT/e2e" && npx tsx widget-real/fixture.mts down); }
trap cleanup EXIT
cd "$ROOT/kiorex-platform/apps/widget" && WIDGET_REAL_FIXTURE="$ROOT/e2e/.cache/widget-real.json" npx playwright test -c playwright.real.config.ts "$@"
