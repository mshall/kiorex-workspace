#!/usr/bin/env bash
# Throw-away PRIVATE real stack for 40-cross-product-real-clinic.e2e.ts (gap closure): the REAL Kiorly Clinic (:3139) and a Kiorex API (:4139) built from the lane's worktrees, each on its OWN database
# cloned from the shared dev databases (kiorly_e2e40, kiorex_e2e40), so nothing here touches the shared stack's outbox workers, ports 3010 / 4000 or the founder's checkouts. The Passport dev IdP (:4400) is only READ
# (patient and staff tokens). Small pools (connection_limit=3). No push, no deploy; the clones are dropped by `drop`.
#   CLINIC_WT=<worktree of clinics-management>  KIOREX_WT=<worktree of kiorex-platform>  scripts/gap-stack.sh up | down | drop
# Then: E2E_KIORLY_URL=http://localhost:3139 E2E_KIOREX_URL=http://localhost:4139 E2E_DB_MAP="kiorly=kiorly_e2e40,kiorex_platform=kiorex_e2e40" npx vitest run test/40-cross-product-real-clinic.e2e.ts
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLINIC_WT="${CLINIC_WT:-$ROOT/clinics-management}"; KIOREX_WT="${KIOREX_WT:-$ROOT/kiorex-platform}"
LOGS="$ROOT/.e2e/logs"; PIDS="$ROOT/.e2e/pids"; mkdir -p "$LOGS" "$PIDS"
export PATH="/Users/postgres/bin:$PATH" PGPASSWORD=postgres
CLINIC_PORT=3139; KIOREX_PORT=4139
DBS=(kiorly_e2e40 kiorex_e2e40)
U() { echo "postgresql://postgres:postgres@127.0.0.1:5433/$1?schema=public&connection_limit=3"; }
port_pid() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1 || true; }
stop_port() { local p; p=$(port_pid "$1"); [ -n "$p" ] && { echo "stopping :$1 ($p)"; kill "$p"; sleep 1; kill -9 "$p" 2>/dev/null || true; } || true; }
psqlx() { psql -h 127.0.0.1 -p 5433 -U postgres -d postgres -tAc "$1"; }
case "${1:-up}" in
down) stop_port $CLINIC_PORT; stop_port $KIOREX_PORT; exit 0 ;;
drop) "$0" down; for d in "${DBS[@]}"; do psqlx "drop database if exists $d" >/dev/null; done; rm -rf "$CLINIC_WT/apps/api/.e2e-dist-gap" "$KIOREX_WT/apps/api/.e2e-dist-gap"; exit 0 ;;
up) ;;
*) echo "usage: $0 up|down|drop"; exit 2 ;;
esac
for p in $CLINIC_PORT $KIOREX_PORT; do [ -n "$(port_pid $p)" ] && { echo "port $p busy - run '$0 down'"; exit 1; }; done
clone() { local src=$1 dst=$2; [ "$(psqlx "select 1 from pg_database where datname='$dst'")" = 1 ] && return 0; psqlx "create database $dst" >/dev/null; pg_dump -h 127.0.0.1 -p 5433 -U postgres "$src" | psql -q -h 127.0.0.1 -p 5433 -U postgres "$dst" >/dev/null 2>&1; }
clone kiorly kiorly_e2e40; clone kiorex_platform kiorex_e2e40
seed_failed() { echo "!! $1 migrate FAILED - last lines of $2:" >&2; tail -40 "$2" >&2; exit 1; }
(cd "$CLINIC_WT/apps/api" && DATABASE_URL="$(U kiorly_e2e40)" npx prisma generate >/dev/null && DATABASE_URL="$(U kiorly_e2e40)" npx prisma migrate deploy && npx tsc -p tsconfig.build.json --outDir .e2e-dist-gap && cp -R dist/assistant .e2e-dist-gap/ 2>/dev/null || true) > "$LOGS/e2e40-build-clinic.log" 2>&1 || seed_failed clinic "$LOGS/e2e40-build-clinic.log"
(cd "$KIOREX_WT/apps/api" && set -a && . ./.env.example && set +a && DATABASE_URL="$(U kiorex_e2e40)" npx prisma generate >/dev/null && DATABASE_URL="$(U kiorex_e2e40)" npx prisma migrate deploy && npx tsc -p tsconfig.build.json --outDir .e2e-dist-gap) > "$LOGS/e2e40-build-kiorex.log" 2>&1 || seed_failed kiorex "$LOGS/e2e40-build-kiorex.log"
start() { local name=$1 cwd=$2; shift 2; (cd "$cwd" && nohup "$@" > "$LOGS/$name.log" 2>&1 & echo $! > "$PIDS/$name.pid"); }
start e2e40-kiorly "$CLINIC_WT/apps/api" env NODE_ENV=development PORT=$CLINIC_PORT APP_WEB_URL=http://localhost:5174 DATABASE_URL="$(U kiorly_e2e40)" SIGNIN_DEFAULT_METHOD=PASSPORT \
  KIOREX_OUTBOX_WEBHOOK_URL="http://localhost:$KIOREX_PORT/api/v1/webhooks/kiorly" KIOREX_OUTBOX_WEBHOOK_SECRET=kx_dev_webhook_secret \
  KIOREX_CONTROL_PLANE_URL="http://localhost:$KIOREX_PORT" KIOREX_FLAGS_PRODUCT_KEY=ff_kiorly-clinic_dev KIOREX_FLAGS_SECRET=ff_dev_secret_change_me \
  KIOREX_OIDC_ISSUER="http://localhost:4400" node --enable-source-maps .e2e-dist-gap/src/main.js
(
  set -a; . "$KIOREX_WT/apps/api/.env.example"; set +a
  export NODE_ENV=development PORT=$KIOREX_PORT DATABASE_URL="$(U kiorex_e2e40)" JOBS_ENABLED=true PSP_MODE=sandbox-fake MESSAGING_MODE=log AI_PROVIDER=fake \
    KIORLY_BASE_URL="http://localhost:$CLINIC_PORT/marketplace/v1" PUBLIC_BASE_URL="http://localhost:$KIOREX_PORT"
  start e2e40-kiorex "$KIOREX_WT/apps/api" node .e2e-dist-gap/main.js
)
wait_ready() { for i in $(seq 1 90); do curl -fs -m3 "$2" >/dev/null 2>&1 && { echo "$1 ready"; return 0; }; sleep 1; done; echo "$1 NOT ready - see $LOGS/$1.log"; return 1; }
wait_ready e2e40-kiorly "http://localhost:$CLINIC_PORT/api/v1/health/ready"
wait_ready e2e40-kiorex "http://localhost:$KIOREX_PORT/api/v1/health/ready"
