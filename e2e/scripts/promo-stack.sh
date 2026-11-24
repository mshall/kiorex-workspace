#!/usr/bin/env bash
# Private Clinic + Kiorex instance for the sponsored-promotion and credit suites (51, 52 part B, 50, 31, 32; GRW-P2-S lane A2 follow-up).
# Clones the dev databases into p2s_* DBs, applies the CURRENT migrations of both trees to the clones, builds both APIs into dist-p2s (the shared dist is never touched),
# and boots Kiorly Clinic :4311 and Kiorex :4310 against them, wired to each other (Passport :4400 is shared, read-only use). Pharmacy and Lab are not started.
# The shared stack (:3010 :4000 :4400 :3100 :3200) and ports 3000, 5173, 5175 are never used or stopped.
#   scripts/promo-stack.sh up      clone, migrate, build, start
#   scripts/promo-stack.sh down    stop what this script started and drop the p2s_* databases
# Several lanes can run side by side: TAG=<name> (database prefix and pid files), KIOREX_PORT, CLINIC_PORT and, with SKIP_BUILD=1, DIST=<dir> to reuse an existing dist-<tag> build (never rebuilt, never removed by `down`),
# e.g. `TAG=f31 KIOREX_PORT=4320 CLINIC_PORT=4321 SKIP_BUILD=1 DIST=dist-p2s scripts/promo-stack.sh up`; the suites then run with E2E_DB_MAP=kiorex_platform=<tag>_kiorex_platform,kiorly=<tag>_kiorly.
# Run a suite against it:  E2E_KIOREX_URL=http://localhost:4310 E2E_KIORLY_URL=http://localhost:4311 E2E_DB_MAP=kiorex_platform=${TAG}_kiorex_platform,kiorly=${TAG}_kiorly npx vitest run test/51-sponsored-promotions.e2e.ts
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; LOGS="$ROOT/.e2e/logs"; PIDS="$ROOT/.e2e/pids"; mkdir -p "$LOGS" "$PIDS"
export PATH="/Users/postgres/bin:$PATH" PGPASSWORD=postgres
PSQL="psql -q -h 127.0.0.1 -p 5433 -U postgres"
DB() { echo "postgresql://postgres:postgres@127.0.0.1:5433/$1?schema=public"; }
TAG=${TAG:-p2s}; KIOREX_PORT=${KIOREX_PORT:-4310}; CLINIC_PORT=${CLINIC_PORT:-4311}; SKIP_BUILD=${SKIP_BUILD:-0}; DIST=${DIST:-dist-$TAG}
case "${1:-}" in
  up)
    for port in $KIOREX_PORT $CLINIC_PORT; do pid=$(lsof -nP -iTCP:$port -sTCP:LISTEN -t 2>/dev/null | head -1 || true); [ -n "$pid" ] && { kill "$pid" 2>/dev/null || true; }; done; sleep 2
    for d in kiorly kiorex_platform; do
      $PSQL -d postgres -c "drop database if exists ${TAG}_$d" -c "create database ${TAG}_$d" 2>/dev/null
      pg_dump -h 127.0.0.1 -p 5433 -U postgres "$d" | $PSQL -d "${TAG}_$d" >/dev/null 2>&1
    done
    # the clones must never talk to the shared dev stack: no queued outbox work, partner registrations (vertical partners) point nowhere
    $PSQL -d ${TAG}_kiorly -c "update \"OutboxEvent\" set status = 'SENT' where status = 'PENDING'" >/dev/null 2>&1 || true
    $PSQL -d ${TAG}_kiorex_platform -c "update \"OutboxEvent\" set status = 'SENT' where status = 'PENDING'" >/dev/null 2>&1 || true
    $PSQL -d ${TAG}_kiorex_platform -c "update \"PartnerRegistration\" set \"baseUrl\" = 'http://localhost:1'" >/dev/null 2>&1 || true
    # leftovers of suites that ran on the shared stack at clone time (a booking slug and a growth admin fixture the suites re-create themselves)
    $PSQL -d ${TAG}_kiorly -c "update \"Clinic\" set \"bookingSlug\" = null where \"bookingSlug\" = 'e2e-kxdev-zamalek'" -c "delete from \"User\" where id = 'e2e_growth_admin'" >/dev/null 2>&1 || true
    (cd "$ROOT/kiorex-platform" && DATABASE_URL="$(DB ${TAG}_kiorex_platform)" npm run db:deploy -w apps/api) > "$LOGS/${TAG}-migrate-kiorex.log" 2>&1
    (cd "$ROOT/clinics-management" && DATABASE_URL="$(DB ${TAG}_kiorly)" npm run db:deploy -w api) > "$LOGS/${TAG}-migrate-clinic.log" 2>&1
    [ "$SKIP_BUILD" = 1 ] || (cd "$ROOT/clinics-management/apps/api" && npx prisma generate >/dev/null 2>&1; rm -rf $DIST && npx tsc -p tsconfig.build.json --incremental false --outDir $DIST && mkdir -p $DIST/src/assistant && cp -r src/assistant/prompts $DIST/src/assistant/ 2>/dev/null || true) > "$LOGS/${TAG}-build-clinic.log" 2>&1
    [ "$SKIP_BUILD" = 1 ] || (cd "$ROOT/kiorex-platform/apps/api" && npx prisma generate >/dev/null 2>&1; rm -rf $DIST && npx tsc -p tsconfig.build.json --incremental false --outDir $DIST) > "$LOGS/${TAG}-build-kiorex.log" 2>&1
    start() { local name=$1 cwd=$2; shift 2; (cd "$cwd" && exec nohup "$@" > "$LOGS/${TAG}-$name.log" 2>&1) & echo $! > "$PIDS/${TAG}-$name.pid"; }
    start clinic "$ROOT/clinics-management/apps/api" env NODE_ENV=development PORT=$CLINIC_PORT DATABASE_URL="$(DB ${TAG}_kiorly)" APP_WEB_URL=http://localhost:5174 SIGNIN_DEFAULT_METHOD=PASSPORT \
      KIOREX_OUTBOX_WEBHOOK_URL=http://localhost:$KIOREX_PORT/api/v1/webhooks/kiorly KIOREX_OUTBOX_WEBHOOK_SECRET=kx_dev_webhook_secret \
      KIOREX_CONTROL_PLANE_URL=http://localhost:$KIOREX_PORT KIOREX_FLAGS_PRODUCT_KEY=ff_kiorly-clinic_dev KIOREX_FLAGS_SECRET=ff_dev_secret_change_me KIOREX_OIDC_ISSUER=http://localhost:4400 node --enable-source-maps $DIST/src/main.js
    ( set -a; . "$ROOT/kiorex-platform/apps/api/.env.example"; set +a
      export NODE_ENV=development PORT=$KIOREX_PORT DATABASE_URL="$(DB ${TAG}_kiorex_platform)" JOBS_ENABLED=true PSP_MODE=sandbox-fake MESSAGING_MODE=log AI_PROVIDER=fake IMPORT_TARGET_MODE=kiorly KIORLY_BASE_URL=http://localhost:$CLINIC_PORT/marketplace/v1 SANDBOX_PAYMENTS_ALLOWED=true
      start kiorex "$ROOT/kiorex-platform/apps/api" node $DIST/main.js )
    for p in $CLINIC_PORT:clinic $KIOREX_PORT:kiorex; do ok=0; for i in $(seq 1 90); do curl -fs -m3 "http://localhost:${p%%:*}/api/v1/health/ready" >/dev/null 2>&1 && { echo "${p##*:} ready :${p%%:*}"; ok=1; break; }; sleep 1; done; [ $ok = 1 ] || { echo "${p##*:} NOT ready, see $LOGS/${TAG}-${p##*:}.log"; exit 1; }; done ;;
  down)
    for f in "$PIDS"/${TAG}-*.pid; do [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null || true; rm -f "$f"; done
    for port in $KIOREX_PORT $CLINIC_PORT; do pid=$(lsof -nP -iTCP:$port -sTCP:LISTEN -t 2>/dev/null | head -1 || true); [ -n "$pid" ] && { kill "$pid" 2>/dev/null || true; }; done; sleep 2
    for d in kiorly kiorex_platform; do $PSQL -d postgres -c "drop database if exists ${TAG}_$d" 2>/dev/null || true; done
    [ "$SKIP_BUILD" = 1 ] || rm -rf "$ROOT/clinics-management/apps/api/$DIST" "$ROOT/kiorex-platform/apps/api/$DIST" ;;
  *) echo "usage: $0 up | down"; exit 2 ;;
esac
