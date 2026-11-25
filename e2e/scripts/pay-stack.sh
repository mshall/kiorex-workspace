#!/usr/bin/env bash
# Private Kiorex API for the PAY-READY lane (payments, corporate benefit in Pay): suite 39b-corporate-pay and the Playwright runs of the corporate and payments ops pages. Clones the dev Kiorex database into pay_kiorex_platform, applies the migrations of the lane worktree
# (kiorex-v2-pay/kiorex-platform, branch pay-ready), builds that worktree's API into dist-pay and boots it on :4393. Passport :4400 is shared (read-only use). No Clinic, Pharmacy or Lab is started and nothing on
# the shared stack (:3010 :4000 :4400 :3100 :3200) or on :3000 :5173 :5175 is stopped or written.
#   scripts/pay-stack.sh up | down
# Run:  E2E_KIOREX_URL=http://localhost:4393 E2E_DB_MAP=kiorex_platform=pay_kiorex_platform npx vitest run test/38-market-zy.e2e.ts
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; LOGS="$ROOT/.e2e/logs"; PIDS="$ROOT/.e2e/pids"; mkdir -p "$LOGS" "$PIDS"
export PATH="/Users/postgres/bin:$PATH" PGPASSWORD=postgres
PSQL="psql -q -h 127.0.0.1 -p 5433 -U postgres"; TAG=pay; KPORT=${KIOREX_PORT:-4398}; WT="${WT:-$ROOT/../kiorex-v2-pay/kiorex-platform}"; DBN=${TAG}_kiorex_platform
DB() { echo "postgresql://postgres:postgres@127.0.0.1:5433/$1?schema=public"; }
case "${1:-}" in
  up)
    pid=$(lsof -nP -iTCP:$KPORT -sTCP:LISTEN -t 2>/dev/null | head -1 || true); [ -n "$pid" ] && { kill "$pid" 2>/dev/null || true; sleep 2; }
    $PSQL -d postgres -c "drop database if exists $DBN" -c "create database $DBN"
    pg_dump -h 127.0.0.1 -p 5433 -U postgres kiorex_platform | $PSQL -d "$DBN" >/dev/null 2>&1
    $PSQL -d $DBN -c "update \"OutboxEvent\" set status = 'SENT' where status = 'PENDING'" -c "update \"PartnerRegistration\" set \"baseUrl\" = 'http://localhost:1'" >/dev/null 2>&1 || true
    (cd "$WT/apps/api" && DATABASE_URL="$(DB $DBN)" npx prisma migrate deploy) > "$LOGS/$TAG-migrate.log" 2>&1
    (cd "$WT/apps/api" && npx prisma generate >/dev/null 2>&1; rm -rf dist-$TAG && npx tsc -p tsconfig.build.json --outDir dist-$TAG --incremental false) > "$LOGS/$TAG-build.log" 2>&1
    ( cd "$WT/apps/api"; set -a; . "$ROOT/kiorex-platform/apps/api/.env.example"; set +a
      export NODE_ENV=development PORT=$KPORT DATABASE_URL="$(DB $DBN)" JOBS_ENABLED=false PSP_MODE=sandbox-fake MESSAGING_MODE=log AI_PROVIDER=fake KIORLY_BASE_URL=http://localhost:1/marketplace/v1 SANDBOX_PAYMENTS_ALLOWED=true
      exec nohup node dist-$TAG/main.js > "$LOGS/$TAG-kiorex.log" 2>&1 ) &
    echo $! > "$PIDS/$TAG-kiorex.pid"
    for i in $(seq 1 90); do curl -fs -m3 "http://localhost:$KPORT/api/v1/health/ready" >/dev/null 2>&1 && { echo "ready :$KPORT"; exit 0; }; sleep 1; done; echo "NOT ready, see $LOGS/$TAG-kiorex.log"; exit 1 ;;
  down)
    [ -f "$PIDS/$TAG-kiorex.pid" ] && kill "$(cat "$PIDS/$TAG-kiorex.pid")" 2>/dev/null || true; rm -f "$PIDS/$TAG-kiorex.pid"
    pid=$(lsof -nP -iTCP:$KPORT -sTCP:LISTEN -t 2>/dev/null | head -1 || true); [ -n "$pid" ] && { kill "$pid" 2>/dev/null || true; }; sleep 1
    $PSQL -d postgres -c "drop database if exists $DBN" 2>/dev/null || true; rm -rf "$WT/apps/api/dist-$TAG" ;;
  *) echo "usage: $0 up | down"; exit 2 ;;
esac
