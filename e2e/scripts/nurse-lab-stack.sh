#!/usr/bin/env bash
# Throw-away ISOLATED stack for 11-nurse-lab.e2e.ts (KNLAB01): Kiorly Clinic :3012, Kiorex :4002, Kiorly Lab :3202, each on its OWN database
# (kiorly_e2e11 / kiorex_e2e11 / kiorly_lab_e2e11) so it never competes with the shared dev stack's outbox workers (:3010 / :4000 / :3200)
# and never needs it restarted. Passport (:4400) is not needed (nurse login = e-mail/password, lab = dev-login, webhooks = HMAC).
# Small DB pools (connection_limit=3): the shared Postgres has max_connections=100.
#   scripts/nurse-lab-stack.sh up      create DBs, migrate + seed, build to .e2e-dist (not dist/), start the 3 services
#   scripts/nurse-lab-stack.sh down    stop them (by port)
#   scripts/nurse-lab-stack.sh drop    down + drop the three databases and remove .e2e-dist
# Then: E2E_KIORLY_URL=http://localhost:3012 E2E_KIOREX_URL=http://localhost:4002 E2E_LAB_URL=http://localhost:3202 E2E_NURSE_STACK=1 npm test -- test/11-nurse-lab.e2e.ts
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOGS="$ROOT/.e2e/logs"; PIDS="$ROOT/.e2e/pids"; mkdir -p "$LOGS" "$PIDS"
export PATH="/Users/postgres/bin:$PATH" PGPASSWORD=postgres
CLINIC_PORT=3012; KIOREX_PORT=4002; LAB_PORT=3202
DBS=(kiorly_e2e11 kiorex_e2e11 kiorly_lab_e2e11)
U() { echo "postgresql://postgres:postgres@127.0.0.1:5433/$1?schema=public&connection_limit=3"; }
port_pid() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1 || true; }
stop_port() { local p; p=$(port_pid "$1"); [ -n "$p" ] && { echo "stopping :$1 ($p)"; kill "$p"; sleep 1; kill -9 "$p" 2>/dev/null || true; } || true; }
psqlx() { psql -h 127.0.0.1 -p 5433 -U postgres -d postgres -tAc "$1"; }

case "${1:-up}" in
down) stop_port $CLINIC_PORT; stop_port $KIOREX_PORT; stop_port $LAB_PORT; exit 0 ;;
drop)
  "$0" down
  for d in "${DBS[@]}"; do psqlx "drop database if exists $d" >/dev/null; done
  rm -rf "$ROOT/clinics-management/apps/api/.e2e-dist" "$ROOT/kiorex-platform/apps/api/.e2e-dist" "$ROOT/kiorly-lab/apps/api/.e2e-dist"; exit 0 ;;
up) ;;
*) echo "usage: $0 up|down|drop"; exit 2 ;;
esac

for p in $CLINIC_PORT $KIOREX_PORT $LAB_PORT; do [ -n "$(port_pid $p)" ] && { echo "port $p busy - run '$0 down'"; exit 1; }; done
for d in "${DBS[@]}"; do [ "$(psqlx "select 1 from pg_database where datname='$d'")" = 1 ] || psqlx "create database $d" >/dev/null; done

# --- build to .e2e-dist (the shared dist/ of other agents' running servers is never touched)
(cd "$ROOT/clinics-management/apps/api" && DATABASE_URL="$(U kiorly_e2e11)" npx prisma generate >/dev/null && npx tsc -p tsconfig.build.json --outDir .e2e-dist && cp -R dist/assistant .e2e-dist/ 2>/dev/null || true) > "$LOGS/e2e11-build-clinic.log" 2>&1
(cd "$ROOT/kiorex-platform/apps/api" && npx prisma generate >/dev/null && npx tsc -p tsconfig.build.json --outDir .e2e-dist) > "$LOGS/e2e11-build-kiorex.log" 2>&1
(cd "$ROOT/kiorly-lab/apps/api" && npx prisma generate >/dev/null && npx tsc -p tsconfig.build.json --outDir .e2e-dist) > "$LOGS/e2e11-build-lab.log" 2>&1

# --- migrate + seed (idempotent)
(cd "$ROOT/clinics-management/apps/api" && DATABASE_URL="$(U kiorly_e2e11)" npx prisma migrate deploy && DATABASE_URL="$(U kiorly_e2e11)" PRISMA_SEED_ENSURE_DEMO_PASSWORDS=true npx tsx prisma/seed.ts && DATABASE_URL="$(U kiorly_e2e11)" npx tsx prisma/nurse-demo.seed.ts) > "$LOGS/e2e11-seed-clinic.log" 2>&1
(cd "$ROOT/kiorex-platform/apps/api" && set -a && . ./.env.example && set +a && DATABASE_URL="$(U kiorex_e2e11)" KIORLY_LAB_BASE_URL=http://localhost:$LAB_PORT npx prisma migrate deploy && DATABASE_URL="$(U kiorex_e2e11)" KIORLY_LAB_BASE_URL=http://localhost:$LAB_PORT npx tsx prisma/seed.ts) > "$LOGS/e2e11-seed-kiorex.log" 2>&1
(cd "$ROOT/kiorly-lab/apps/api" && DATABASE_URL="$(U kiorly_lab_e2e11)" npx prisma migrate deploy && for i in 1 2; do DEMO_SEED_ALLOWED=true KIORLY_ENV=local KIOREX_BASE_URL=http://localhost:$KIOREX_PORT DATABASE_URL="$(U kiorly_lab_e2e11)" npx tsx src/seed/seed.ts || true; done) > "$LOGS/e2e11-seed-lab.log" 2>&1

start() { local name=$1 cwd=$2; shift 2; (cd "$cwd" && nohup "$@" > "$LOGS/$name.log" 2>&1 & echo $! > "$PIDS/$name.pid"); }
start e2e11-kiorly "$ROOT/clinics-management/apps/api" env NODE_ENV=development PORT=$CLINIC_PORT APP_WEB_URL=http://localhost:5174 DATABASE_URL="$(U kiorly_e2e11)" \
  KIOREX_OUTBOX_WEBHOOK_URL="http://localhost:$KIOREX_PORT/api/v1/webhooks/kiorly" KIOREX_OUTBOX_WEBHOOK_SECRET=kx_dev_webhook_secret \
  KIOREX_CONTROL_PLANE_URL="http://localhost:$KIOREX_PORT" KIOREX_FLAGS_PRODUCT_KEY=ff_kiorly-clinic_dev KIOREX_FLAGS_SECRET=ff_dev_secret_change_me \
  KIOREX_OIDC_ISSUER="http://localhost:4400" node --enable-source-maps .e2e-dist/src/main.js
(
  set -a; . "$ROOT/kiorex-platform/apps/api/.env.example"; set +a
  export NODE_ENV=development PORT=$KIOREX_PORT DATABASE_URL="$(U kiorex_e2e11)" JOBS_ENABLED=true PSP_MODE=sandbox-fake MESSAGING_MODE=log AI_PROVIDER=fake \
    KIORLY_BASE_URL="http://localhost:$CLINIC_PORT/marketplace/v1" KIORLY_LAB_BASE_URL="http://localhost:$LAB_PORT" PUBLIC_BASE_URL="http://localhost:$KIOREX_PORT"
  start e2e11-kiorex "$ROOT/kiorex-platform/apps/api" node .e2e-dist/main.js
)
start e2e11-lab "$ROOT/kiorly-lab/apps/api" env NODE_ENV=development PORT=$LAB_PORT DATABASE_URL="$(U kiorly_lab_e2e11)" AUTH_MODE=dev KIOREX_MODE=real KIOREX_BASE_URL=http://localhost:$KIOREX_PORT OUTBOX_POLL_INTERVAL_MS=1000 node --enable-source-maps .e2e-dist/main.js

wait_ready() { for i in $(seq 1 90); do curl -fs -m3 "$2" >/dev/null 2>&1 && { echo "$1 ready"; return 0; }; sleep 1; done; echo "$1 NOT ready - see $LOGS/$1.log"; return 1; }
wait_ready e2e11-kiorly "http://localhost:$CLINIC_PORT/api/v1/health/ready"
wait_ready e2e11-kiorex "http://localhost:$KIOREX_PORT/api/v1/health/ready"
wait_ready e2e11-lab "http://localhost:$LAB_PORT/api/v1/health/ready"
