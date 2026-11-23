#!/usr/bin/env bash
# Seeds the synthetic Egyptian demo dataset into the RUNNING local Kiorex v2 stack, in dependency order (DEV ONLY, see ../TEST_DATA.md):
#   1 Passport accounts -> 2 Kiorly Clinic (+ Rev 2.3: Nurse edition tenants, physio, home visits, care plans, MAR) -> 3 Clinic Kiorly app seed (Basic clinic, critical alerts) -> 4 Pharmacy (+ its seed:mobile) -> 5 Lab -> 6 Lab Kiorly app seed (chain-lab / basic-lab, critical-lab order) -> 7 Kiorex provider sync -> 8 Kiorex platform (+ home bookings, safety feed)
# Idempotent. The Kiorly app seeds (db:seed:mobile; seed:mobile in Pharmacy) run right after their base demo seed and are idempotent (deterministic ids); `--reset` does not apply to them. `--reset` first removes the demo records only (never non-demo data; Pharmacy/Lab ledgers are append-only, see TEST_DATA.md).
# Prereq: stack up (e2e/scripts/up.sh [--build] [--seed]) so the base seeds + migrations exist.  Usage: scripts/seed-all.sh [--reset]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/Users/postgres/bin:$PATH" NODE_ENV=development
export DEMO_SEED_NOW="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"   # same instant for the Kiorly and Kiorex home-visit seeds (live visits are relative to now)
RESET=""; [ "${1:-}" = "--reset" ] && RESET="--reset"
# connection_limit: the shared Postgres has max_connections=100 and the stack already holds ~90 pooled connections
DBURL() { echo "postgresql://postgres:postgres@127.0.0.1:5433/$1?schema=public&connection_limit=3"; }
export DEMO_SEED_ALLOWED=true KIORLY_ENV=local          # demo seeds refuse to run otherwise (src/common/demo-seed-guard.ts)
export DEMO_HANDOFF_FILE="$ROOT/.e2e/demo-handoff.json" # Lab seed -> Kiorex seed hand-off (KNLAB01 nurse samples); on AWS the Lambda response carries it
rm -f "$DEMO_HANDOFF_FILE"; [ -n "$RESET" ] && export DEMO_REISSUE_LINKS=true || true
step() { printf '\n==> %s\n' "$*"; }
for p in 4400:Passport 3010:Kiorly 3100:Pharmacy 3200:Lab 4000:Kiorex; do
  curl -s -m3 -o /dev/null "http://localhost:${p%%:*}/" || { echo "!! ${p##*:} (:${p%%:*}) is not running. Start the stack: e2e/scripts/up.sh"; exit 1; }
done

step "1/8 Passport accounts, families, org memberships (kiorex-account)"
(cd "$ROOT/kiorex-account" && DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/kiorex_account?connection_limit=3" npx tsx scripts/seed-demo.ts $RESET)
if ! grep -q "+201000003011" "$ROOT/.e2e/logs/passport.log" 2>/dev/null; then
  echo "   restarting the Passport dev IdP so the OTP 000000 test-number list includes the demo accounts"
  pid="$(lsof -nP -iTCP:4400 -sTCP:LISTEN -t | head -1)"; [ -n "$pid" ] && kill "$pid" && sleep 1
  (cd "$ROOT/kiorex-account/apps/dev-idp" && nohup env NODE_ENV=development npx tsx src/index.ts > "$ROOT/.e2e/logs/passport.log" 2>&1 &)
  for i in $(seq 1 40); do curl -fs -m2 http://localhost:4400/.well-known/openid-configuration >/dev/null 2>&1 && break; sleep 1; done
  mkdir -p "$ROOT/.e2e/pids"; lsof -nP -iTCP:4400 -sTCP:LISTEN -t | head -1 > "$ROOT/.e2e/pids/passport.pid" || true
fi

step "2/8 Kiorly Clinic: 3 organisations + Nurse-edition solo/agency tenants (db:seed:nurse is folded in), physio, home visits, care plans, MAR (clinics-management)"
(cd "$ROOT/clinics-management" && DATABASE_URL="$(DBURL kiorly)" npm run db:seed:demo -w api -- $RESET)
step "3/8 Kiorly app seed, Clinic side: Basic (Lite) clinic, critical-vitals alert, critical lab result waiting for the doctor (clinics-management db:seed:mobile)"
(cd "$ROOT/clinics-management" && DATABASE_URL="$(DBURL kiorly)" npm run db:seed:mobile -w api)
step "4/8 Kiorly Pharmacy (kiorly-pharmacy) + its Kiorly app seed (Solo and Lite tenants, controlled-drug alerts)"
(cd "$ROOT/kiorly-pharmacy" && DATABASE_URL="$(DBURL kiorly_pharmacy)" npm run seed:demo -w api -- $RESET)
(cd "$ROOT/kiorly-pharmacy" && DATABASE_URL="$(DBURL kiorly_pharmacy)" npm run seed:mobile -w api)
step "5/8 Kiorly Lab (kiorly-lab)"
(cd "$ROOT/kiorly-lab" && DATABASE_URL="$(DBURL kiorly_lab)" npm run db:seed:demo -w api -- $RESET)
step "6/8 Kiorly app seed, Lab side: chain-lab (CHAIN) + basic-lab (LITE) tenants, critical-lab order (kiorly-lab db:seed:mobile)"
(cd "$ROOT/kiorly-lab" && DATABASE_URL="$(DBURL kiorly_lab)" npm run db:seed:mobile -w api)
step "7/8 Kiorex provider sync from Kiorly (HMAC, via ops login)"
node "$ROOT/scripts/ops-sync.mjs"
step "8/8 Kiorex platform: bookings, ledger, reviews, vault, verticals, flags, home bookings, address book, safety feed (kiorex-platform)"
(cd "$ROOT/kiorex-platform" && DATABASE_URL="$(DBURL kiorex_platform)" npm run db:seed:demo -w apps/api -- $RESET)
printf '\nDemo data ready. Logins and where to click: %s/TEST_DATA.md\n' "$ROOT"
