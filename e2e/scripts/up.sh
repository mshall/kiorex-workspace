#!/usr/bin/env bash
# Start the local Kiorex v2 stack as background processes:
#   Passport dev IdP :4400, Kiorly Clinic API :3010 (branch kiorex; :3000 belongs to a different checkout), Kiorex API :4000,
#   Kiorly Pharmacy API :3100, Kiorly Lab API :3200 (real partner services; they talk to Kiorex over real HTTP, KIOREX_MODE=real).
# Logs: ../.e2e/logs   pids: ../.e2e/pids
# Usage: scripts/up.sh [--build] [--seed] [--restart]
#   --build    rebuild the Nest APIs first (clinic, kiorex, pharmacy, lab)
#   --seed     prisma migrate deploy + seeds (idempotent) for all DBs (incl. the dev partner registrations on both sides)
#   --restart  stop recorded/listening processes on :3010 :4000 :4400 :3100 :3200 first (workspace services only)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOGS="$ROOT/.e2e/logs"; PIDS="$ROOT/.e2e/pids"; mkdir -p "$LOGS" "$PIDS"
export PATH="/Users/postgres/bin:$PATH"
KIORLY_PORT=3010; KIOREX_PORT=4000; PASSPORT_PORT=4400; PHARMACY_PORT=3100; LAB_PORT=3200
DBURL() { echo "postgresql://postgres:postgres@127.0.0.1:5433/$1?schema=public"; }
BUILD=0; SEED=0; RESTART=0
for a in "$@"; do case $a in --build) BUILD=1;; --seed) SEED=1;; --restart) RESTART=1;; esac; done

if ! PGPASSWORD=postgres psql -h 127.0.0.1 -p 5433 -U postgres -d postgres -c 'select 1' >/dev/null 2>&1; then
  pg_ctl -D "$ROOT/.pgdata" -l "$ROOT/.pgdata/server.log" -o "-p 5433" start; sleep 3
fi
port_pid() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1 || true; }
stop_port() { local p; p=$(port_pid "$1"); [ -n "$p" ] && { echo "stopping :$1 ($p)"; kill "$p"; sleep 1; kill -9 "$p" 2>/dev/null || true; } || true; }
if [ "$RESTART" = 1 ]; then stop_port $KIORLY_PORT; stop_port $KIOREX_PORT; stop_port $PASSPORT_PORT; stop_port $PHARMACY_PORT; stop_port $LAB_PORT; fi
for p in $KIORLY_PORT $KIOREX_PORT $PHARMACY_PORT $LAB_PORT; do [ -n "$(port_pid $p)" ] && { echo "port $p busy - use --restart"; exit 1; }; done
START_PASSPORT=1; [ -n "$(port_pid $PASSPORT_PORT)" ] && { START_PASSPORT=0; echo "passport already running - reusing"; }

if [ "$BUILD" = 1 ]; then
  (cd "$ROOT/clinics-management" && npm run build -w api) > "$LOGS/build-kiorly.log" 2>&1
  (cd "$ROOT/kiorex-platform" && npm run build -w apps/api) > "$LOGS/build-kiorex.log" 2>&1
  (cd "$ROOT/kiorly-pharmacy" && npm run build -w api) > "$LOGS/build-pharmacy.log" 2>&1
  (cd "$ROOT/kiorly-lab" && npm run build -w api) > "$LOGS/build-lab.log" 2>&1
fi
if [ "$SEED" = 1 ]; then
  (cd "$ROOT/clinics-management" && DATABASE_URL="$(DBURL kiorly)" npm run db:deploy -w api && DATABASE_URL="$(DBURL kiorly)" PRISMA_SEED_ENSURE_DEMO_PASSWORDS=true npm run db:seed -w api) > "$LOGS/seed-kiorly.log" 2>&1
  (cd "$ROOT/kiorex-platform" && DATABASE_URL="$(DBURL kiorex_platform)" npm run db:deploy -w apps/api && DATABASE_URL="$(DBURL kiorex_platform)" npm run db:seed -w apps/api) > "$LOGS/seed-kiorex.log" 2>&1
  (cd "$ROOT/kiorly-pharmacy" && DATABASE_URL="$(DBURL kiorly_pharmacy)" npm run db:deploy -w api && DATABASE_URL="$(DBURL kiorly_pharmacy)" npm run seed -w api) > "$LOGS/seed-pharmacy.log" 2>&1
  (cd "$ROOT/kiorly-lab" && DATABASE_URL="$(DBURL kiorly_lab)" npm run db:deploy -w api && DATABASE_URL="$(DBURL kiorly_lab)" npm run db:seed -w api) > "$LOGS/seed-lab.log" 2>&1
fi

start() { local name=$1 cwd=$2; shift 2; (cd "$cwd" && nohup "$@" > "$LOGS/$name.log" 2>&1 & echo $! > "$PIDS/$name.pid"); }
[ "$START_PASSPORT" = 1 ] && start passport "$ROOT/kiorex-account/apps/dev-idp" env NODE_ENV=development npx tsx src/index.ts

# Kiorly Clinic API: env from apps/api/.env (KIOREX_* -> :4000/:4400); topology pinned here.
start kiorly "$ROOT/clinics-management/apps/api" env NODE_ENV=development PORT=$KIORLY_PORT APP_WEB_URL=http://localhost:5174 DATABASE_URL="$(DBURL kiorly)" \
  KIOREX_OUTBOX_WEBHOOK_URL="http://localhost:$KIOREX_PORT/api/v1/webhooks/kiorly" KIOREX_OUTBOX_WEBHOOK_SECRET=kx_dev_webhook_secret \
  KIOREX_CONTROL_PLANE_URL="http://localhost:$KIOREX_PORT" KIOREX_FLAGS_PRODUCT_KEY=ff_kiorly-clinic_dev KIOREX_FLAGS_SECRET=ff_dev_secret_change_me \
  KIOREX_OIDC_ISSUER="http://localhost:$PASSPORT_PORT" node --enable-source-maps dist/src/main.js

# Kiorex API: env from .env.example (INTEGRATION.md values)
(
  set -a; . "$ROOT/kiorex-platform/apps/api/.env.example"; set +a
  export NODE_ENV=development PORT=$KIOREX_PORT DATABASE_URL="$(DBURL kiorex_platform)" JOBS_ENABLED=true PSP_MODE=sandbox-fake MESSAGING_MODE=log AI_PROVIDER=fake
  start kiorex "$ROOT/kiorex-platform/apps/api" node dist/main.js
)

# Kiorly Pharmacy / Lab: real outbox delivery to Kiorex (KIOREX_MODE=real), fast flag polling so a Kiorex flag change reaches them in ~1.5 s,
# fast outbox sweeps. Per-tenant webhook URL/secret/client key come from the seeded IntegrationClient (dev registration, INTEGRATION.md).
# Lab AUTH_MODE=dev and pharmacy AUTH_MODE=local (staff login) are local-only.
PARTNER_ENV="KIOREX_MODE=real KIOREX_BASE_URL=http://localhost:$KIOREX_PORT FLAGS_POLL_ENABLED=true FLAGS_POLL_INTERVAL_MS=1500 KIOREX_FLAGS_URL=http://localhost:$KIOREX_PORT/api/v1/control/v1/flags/snapshot KIOREX_PRODUCT_SECRET=ff_dev_secret_change_me OUTBOX_POLL_INTERVAL_MS=1000"
start pharmacy "$ROOT/kiorly-pharmacy/apps/api" env NODE_ENV=development PORT=$PHARMACY_PORT DATABASE_URL="$(DBURL kiorly_pharmacy)" AUTH_MODE=local KIOREX_PRODUCT_KEY=ff_kiorly-pharmacy_dev $PARTNER_ENV node --enable-source-maps dist/main.js
start lab "$ROOT/kiorly-lab/apps/api" env NODE_ENV=development PORT=$LAB_PORT DATABASE_URL="$(DBURL kiorly_lab)" AUTH_MODE=dev KIOREX_PRODUCT_KEY=ff_kiorly-lab_dev $PARTNER_ENV node --enable-source-maps dist/main.js

wait_ready() { for i in $(seq 1 90); do curl -fs -m3 "$2" >/dev/null 2>&1 && { echo "$1 ready"; return 0; }; sleep 1; done; echo "$1 NOT ready - see $LOGS/$1.log"; return 1; }
wait_ready passport "http://localhost:$PASSPORT_PORT/.well-known/openid-configuration"
wait_ready kiorly "http://localhost:$KIORLY_PORT/api/v1/health/ready"
wait_ready kiorex "http://localhost:$KIOREX_PORT/api/v1/health/ready"
wait_ready pharmacy "http://localhost:$PHARMACY_PORT/api/v1/health/ready"
wait_ready lab "http://localhost:$LAB_PORT/api/v1/health/ready"
[ "$START_PASSPORT" = 1 ] && port_pid $PASSPORT_PORT > "$PIDS/passport.pid"
port_pid $KIORLY_PORT > "$PIDS/kiorly.pid"; port_pid $KIOREX_PORT > "$PIDS/kiorex.pid"; port_pid $PHARMACY_PORT > "$PIDS/pharmacy.pid"; port_pid $LAB_PORT > "$PIDS/lab.pid"
echo "pids: passport=$(port_pid $PASSPORT_PORT) kiorly=$(cat "$PIDS/kiorly.pid") kiorex=$(cat "$PIDS/kiorex.pid")"
