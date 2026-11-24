#!/usr/bin/env bash
# Throw-away ISOLATED stack for 39-growth-cross-product.e2e.ts (GRW-P4-A, wave 8 lane A3): Kiorex :4103 (built from the lane's worktree), Kiorly Pharmacy :3103 and Kiorly Lab :3203
# (the workspace's existing builds), each on its OWN database (kiorex_e2e_a3 / kiorly_pharmacy_e2e_a3 / kiorly_lab_e2e_a3). It never touches the shared dev stack (:3010 :4000 :3100 :3200 :4400 stay as they are),
# never restarts anything shared, and builds to .e2e-dist-a3 (not dist/). The Passport dev IdP (:4400) is only READ (patient and ops tokens). Kiorly Clinic is not part of it: the suite plays the Clinic with
# the signed webhook, as 04-pharmacy.e2e.ts does (the Clinic itself is exercised by 03-booking-golden).
#   scripts/cross-product-stack.sh up | down | drop        KX_WT=<worktree of kiorex-platform>  (default: ../_wt-w8a3)
# Then:  E2E_KIOREX_URL=http://localhost:4103 E2E_PHARMACY_URL=http://localhost:3103 E2E_LAB_URL=http://localhost:3203 \
#        E2E_DB_MAP="kiorex_platform=kiorex_e2e_a3,kiorly_pharmacy=kiorly_pharmacy_e2e_a3,kiorly_lab=kiorly_lab_e2e_a3" npx vitest run test/39-growth-cross-product.e2e.ts
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WT="${KX_WT:-$ROOT/_wt-w8a3}"
LOGS="$ROOT/.e2e/logs"; PIDS="$ROOT/.e2e/pids"; mkdir -p "$LOGS" "$PIDS"
export PATH="/Users/postgres/bin:$PATH" PGPASSWORD=postgres
KIOREX_PORT=4103; PHARMACY_PORT=3103; LAB_PORT=3203
DBS=(kiorex_e2e_a3 kiorly_pharmacy_e2e_a3 kiorly_lab_e2e_a3)
U() { echo "postgresql://postgres:postgres@127.0.0.1:5433/$1?schema=public&connection_limit=3"; }
port_pid() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1 || true; }
stop_port() { local p; p=$(port_pid "$1"); [ -n "$p" ] && { echo "stopping :$1 ($p)"; kill "$p"; sleep 1; kill -9 "$p" 2>/dev/null || true; } || true; }
psqlx() { psql -h 127.0.0.1 -p 5433 -U postgres -d postgres -tAc "$1"; }
case "${1:-up}" in
down) stop_port $KIOREX_PORT; stop_port $PHARMACY_PORT; stop_port $LAB_PORT; exit 0 ;;
drop) "$0" down; for d in "${DBS[@]}"; do psqlx "drop database if exists $d" >/dev/null; done; rm -rf "$WT/apps/api/.e2e-dist-a3"; exit 0 ;;
up) ;;
*) echo "usage: $0 up|down|drop"; exit 2 ;;
esac
for p in $KIOREX_PORT $PHARMACY_PORT $LAB_PORT; do [ -n "$(port_pid $p)" ] && { echo "port $p busy - run '$0 down'"; exit 1; }; done
for d in "${DBS[@]}"; do [ "$(psqlx "select 1 from pg_database where datname='$d'")" = 1 ] || psqlx "create database $d" >/dev/null; done

(cd "$WT/apps/api" && npx prisma generate >/dev/null && npx tsc -p tsconfig.build.json --outDir .e2e-dist-a3) > "$LOGS/e2e-a3-build-kiorex.log" 2>&1 || { tail -30 "$LOGS/e2e-a3-build-kiorex.log"; exit 1; }
seed_failed() { echo "!! $1 migrate/seed FAILED - last lines of $2:" >&2; tail -40 "$2" >&2; exit 1; }
(cd "$WT/apps/api" && set -a && . ./.env.example && set +a && export KIORLY_PHARMACY_BASE_URL=http://localhost:$PHARMACY_PORT KIORLY_LAB_BASE_URL=http://localhost:$LAB_PORT \
  && DATABASE_URL="$(U kiorex_e2e_a3)" npx prisma migrate deploy && DATABASE_URL="$(U kiorex_e2e_a3)" npx ts-node --transpile-only prisma/seed.ts) > "$LOGS/e2e-a3-seed-kiorex.log" 2>&1 || seed_failed kiorex "$LOGS/e2e-a3-seed-kiorex.log"
(cd "$ROOT/kiorly-pharmacy" && DATABASE_URL="$(U kiorly_pharmacy_e2e_a3)" npm run db:deploy -w api && DATABASE_URL="$(U kiorly_pharmacy_e2e_a3)" KIOREX_BASE_URL=http://localhost:$KIOREX_PORT npm run seed -w api) > "$LOGS/e2e-a3-seed-pharmacy.log" 2>&1 || seed_failed pharmacy "$LOGS/e2e-a3-seed-pharmacy.log"
(cd "$ROOT/kiorly-lab" && DATABASE_URL="$(U kiorly_lab_e2e_a3)" npm run db:deploy -w api && DEMO_SEED_ALLOWED=true KIORLY_ENV=local KIOREX_BASE_URL=http://localhost:$KIOREX_PORT DATABASE_URL="$(U kiorly_lab_e2e_a3)" npm run db:seed -w api) > "$LOGS/e2e-a3-seed-lab.log" 2>&1 || seed_failed lab "$LOGS/e2e-a3-seed-lab.log"

start() { local name=$1 cwd=$2; shift 2; (cd "$cwd" && nohup "$@" > "$LOGS/$name.log" 2>&1 & echo $! > "$PIDS/$name.pid"); }
(
  set -a; . "$WT/apps/api/.env.example"; set +a
  export NODE_ENV=development PORT=$KIOREX_PORT DATABASE_URL="$(U kiorex_e2e_a3)" JOBS_ENABLED=true PSP_MODE=sandbox-fake MESSAGING_MODE=log AI_PROVIDER=fake IMPORT_TARGET_MODE=kiorly \
    KIORLY_PHARMACY_BASE_URL="http://localhost:$PHARMACY_PORT" KIORLY_LAB_BASE_URL="http://localhost:$LAB_PORT" PUBLIC_BASE_URL="http://localhost:$KIOREX_PORT"
  start e2e-a3-kiorex "$WT/apps/api" node .e2e-dist-a3/main.js
)
PARTNER_ENV="KIOREX_MODE=real KIOREX_BASE_URL=http://localhost:$KIOREX_PORT FLAGS_POLL_ENABLED=true FLAGS_POLL_INTERVAL_MS=1500 KIOREX_FLAGS_URL=http://localhost:$KIOREX_PORT/api/v1/control/v1/flags/snapshot KIOREX_PRODUCT_SECRET=ff_dev_secret_change_me OUTBOX_POLL_INTERVAL_MS=1000 SIGNIN_DEFAULT_METHOD=PASSPORT"
start e2e-a3-pharmacy "$ROOT/kiorly-pharmacy/apps/api" env NODE_ENV=development PORT=$PHARMACY_PORT DATABASE_URL="$(U kiorly_pharmacy_e2e_a3)" AUTH_MODE=local AUTH_ACCEPT_PASSPORT=true OIDC_ISSUER="http://localhost:4400" KIOREX_PRODUCT_KEY=ff_kiorly-pharmacy_dev $PARTNER_ENV node --enable-source-maps dist/main.js
start e2e-a3-lab "$ROOT/kiorly-lab/apps/api" env NODE_ENV=development PORT=$LAB_PORT PUBLIC_BASE_URL="http://localhost:5193" DATABASE_URL="$(U kiorly_lab_e2e_a3)" AUTH_MODE=dev AUTH_ACCEPT_PASSPORT=true KIOREX_OIDC_ISSUER="http://localhost:4400" KIOREX_PRODUCT_KEY=ff_kiorly-lab_dev $PARTNER_ENV node --enable-source-maps dist/main.js

wait_ready() { for i in $(seq 1 90); do curl -fs -m3 "$2" >/dev/null 2>&1 && { echo "$1 ready"; return 0; }; sleep 1; done; echo "$1 NOT ready - see $LOGS/$1.log"; return 1; }
wait_ready e2e-a3-kiorex "http://localhost:$KIOREX_PORT/api/v1/health/ready"
wait_ready e2e-a3-pharmacy "http://localhost:$PHARMACY_PORT/api/v1/health/ready"
wait_ready e2e-a3-lab "http://localhost:$LAB_PORT/api/v1/health/ready"
