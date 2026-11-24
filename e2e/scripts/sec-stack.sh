#!/usr/bin/env bash
# Isolated throw-away stack for the security suite (pentest 2026-11): clones the dev databases into sec_* DBs and boots
# Kiorly Clinic :4301, Kiorex :4300, Pharmacy :4302, Lab :4303 against them (Passport :4400 is shared, read-only use).
# Destructive security tests (races, restore abuse, ...) run here, never on the shared dev stack.
#   scripts/sec-stack.sh up [--prod]     clone DBs, build to dist-sec (clinic) and start; --prod boots with NODE_ENV=production
#   scripts/sec-stack.sh down            stop what this script started (by recorded pid) and drop the sec_* databases
# Needs Node 26 first on PATH and the dev stack's Postgres on :5433. Logs: ../.e2e/logs/sec-*.log
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; LOGS="$ROOT/.e2e/logs"; PIDS="$ROOT/.e2e/pids"; mkdir -p "$LOGS" "$PIDS"
export PATH="/Users/postgres/bin:$PATH" PGPASSWORD=postgres
PSQL="psql -q -h 127.0.0.1 -p 5433 -U postgres"
DB() { echo "postgresql://postgres:postgres@127.0.0.1:5433/$1?schema=public"; }
MODE_ENV=development; [ "${2:-}" = "--prod" ] && MODE_ENV=production
case "${1:-}" in
  up)
    for port in 4300 4301 4302 4303; do pid=$(lsof -nP -iTCP:$port -sTCP:LISTEN -t 2>/dev/null | head -1 || true); [ -n "$pid" ] && { kill "$pid" 2>/dev/null || true; }; done; sleep 2   # only the sec ports 43xx
    for d in kiorly kiorex_platform kiorly_pharmacy kiorly_lab; do
      $PSQL -d postgres -c "drop database if exists sec_$d" -c "create database sec_$d" 2>/dev/null
      pg_dump -h 127.0.0.1 -p 5433 -U postgres "$d" | $PSQL -d "sec_$d" >/dev/null 2>&1
    done
    # the clones must never talk to the shared dev stack: point partner registrations at the sec ports and drop queued outbox work
    $PSQL -d sec_kiorex_platform -c "update \"PartnerRegistration\" set \"baseUrl\" = case when kind = 'PHARMACY' then 'http://localhost:4302' else 'http://localhost:4303' end" >/dev/null 2>&1 || true
    $PSQL -d sec_kiorly -c "update \"OutboxEvent\" set status = 'SENT' where status = 'PENDING'" >/dev/null 2>&1 || true
    (cd "$ROOT/clinics-management/apps/api" && rm -rf dist-sec && npx tsc -p tsconfig.build.json --outDir dist-sec && mkdir -p dist-sec/src/assistant && cp -r src/assistant/prompts dist-sec/src/assistant/ 2>/dev/null || true)
    JWT=$(openssl rand -hex 32)
    start() { local name=$1 cwd=$2; shift 2; (cd "$cwd" && exec nohup "$@" > "$LOGS/sec-$name.log" 2>&1) & echo $! > "$PIDS/sec-$name.pid"; }
    start clinic "$ROOT/clinics-management/apps/api" env NODE_ENV=$MODE_ENV SWAGGER_ENABLED= PORT=4301 DATABASE_URL="$(DB sec_kiorly)" JWT_SECRET="$JWT" APP_WEB_URL=http://localhost:5174 SIGNIN_DEFAULT_METHOD=PASSPORT \
      KIOREX_OUTBOX_WEBHOOK_URL=http://localhost:4300/api/v1/webhooks/kiorly KIOREX_OUTBOX_WEBHOOK_SECRET=kx_dev_webhook_secret KIOREX_OIDC_ISSUER=http://localhost:4400 node dist-sec/src/main.js
    ( set -a; . "$ROOT/kiorex-platform/apps/api/.env.example"; set +a
      export NODE_ENV=$MODE_ENV PORT=4300 DATABASE_URL="$(DB sec_kiorex_platform)" JOBS_ENABLED=true KIORLY_BASE_URL=http://localhost:4301/marketplace/v1 PARTNER_LEAD_SIGNING_SECRET=0123456789abcdef0123456789abcdef01 ALLOW_INSECURE_DEFAULT_SECRETS=true SANDBOX_PAYMENTS_ALLOWED=true
      start kiorex "$ROOT/kiorex-platform/apps/api" node dist/main.js )
    start pharmacy "$ROOT/kiorly-pharmacy/apps/api" env NODE_ENV=$MODE_ENV SWAGGER_ENABLED= PORT=4302 DATABASE_URL="$(DB sec_kiorly_pharmacy)" AUTH_MODE=local node dist/main.js
    start lab "$ROOT/kiorly-lab/apps/api" env NODE_ENV=$MODE_ENV SWAGGER_ENABLED= PORT=4303 DATABASE_URL="$(DB sec_kiorly_lab)" AUTH_MODE=dev node dist/main.js
    for p in 4301:clinic 4300:kiorex 4302:pharmacy 4303:lab; do for i in $(seq 1 60); do curl -fs -m3 "http://localhost:${p%%:*}/api/v1/health/live" >/dev/null 2>&1 && { echo "${p##*:} ready :${p%%:*}"; break; }; sleep 1; done; done ;;
  down)
    for f in "$PIDS"/sec-*.pid; do [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null || true; rm -f "$f"; done
    for port in 4300 4301 4302 4303; do pid=$(lsof -nP -iTCP:$port -sTCP:LISTEN -t 2>/dev/null | head -1 || true); [ -n "$pid" ] && { kill "$pid" 2>/dev/null || true; }; done; sleep 2
    for d in kiorly kiorex_platform kiorly_pharmacy kiorly_lab; do $PSQL -d postgres -c "drop database if exists sec_$d" 2>/dev/null || true; done ;;
  *) echo "usage: $0 up [--prod] | down"; exit 2 ;;
esac
