#!/usr/bin/env bash
# Isolated throw-away stack for the security suite (pentest 2026-11): clones the dev databases into sec_* DBs, brings them to the head of the CURRENT trees, and boots
# Kiorly Clinic :4301, Kiorex :4300, Pharmacy :4302, Lab :4303 and a PRIVATE Passport :4304 (fake upstream :4305, its own sec_kiorex_account clone, an idp.json copy with every
# local URL re-pointed through KX_IDP_CONFIG). Nothing on the shared stack (:3010 :4000 :4400 :3100 :3200) or on :3000 :5173 :5175 is read, written or stopped, and every build
# goes to dist-sec (the shared dist/ is never used). Destructive security tests (races, restore abuse, ...) run here, never on the shared dev stack.
#   scripts/sec-stack.sh up [--prod]     clone DBs, migrate, build to dist-sec, start; --prod boots the four APIs with NODE_ENV=production
#   scripts/sec-stack.sh down            stop what this script started (by recorded pid), drop the sec_* databases, remove dist-sec and the private idp config
#   scripts/sec-stack.sh env             print the environment the suite needs:  eval "$(scripts/sec-stack.sh env)" && npx vitest run test/30-security.e2e.ts
# Needs the dev stack's Postgres on :5433 (read only: pg_dump). Node 26 is put first on PATH. Logs: ../.e2e/logs/sec-*.log
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; LOGS="$ROOT/.e2e/logs"; PIDS="$ROOT/.e2e/pids"; mkdir -p "$LOGS" "$PIDS"
export PATH="$HOME/.local/node-26/node-v26.13.1-darwin-arm64/bin:/Users/postgres/bin:$PATH" PGPASSWORD=postgres
PSQL="psql -q -h 127.0.0.1 -p 5433 -U postgres"
DB() { echo "postgresql://postgres:postgres@127.0.0.1:5433/$1?schema=public&connection_limit=6"; }
P_KIOREX=4300; P_CLINIC=4301; P_PHARMACY=4302; P_LAB=4303; P_PASSPORT=4304; P_UPSTREAM=4305
for p in $P_KIOREX $P_CLINIC $P_PHARMACY $P_LAB $P_PASSPORT $P_UPSTREAM; do case $p in 3000|5173|5175|3010|4000|4400|3100|3200) echo "refusing shared port $p"; exit 3;; esac; done
DIST=dist-sec; IDP_CFG="$ROOT/.e2e/sec-idp.json"
MODE_ENV=development; [ "${2:-}" = "--prod" ] && MODE_ENV=production
port_pid() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1 || true; }
case "${1:-}" in
  env)
    cat <<EOF
export E2E_SEC_STACK=1 E2E_PASSPORT_URL=http://localhost:$P_PASSPORT E2E_KIORLY_URL=http://localhost:$P_CLINIC E2E_KIOREX_URL=http://localhost:$P_KIOREX E2E_PHARMACY_URL=http://localhost:$P_PHARMACY E2E_LAB_URL=http://localhost:$P_LAB
export E2E_DB_MAP=kiorex_account=sec_kiorex_account E2E_PASSPORT_LOG=$LOGS/sec-passport.log
export PATH="$HOME/.local/node-26/node-v26.13.1-darwin-arm64/bin:\$PATH"
EOF
    exit 0 ;;
  down)
    for f in "$PIDS"/sec-*.pid; do [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null || true; rm -f "$f"; done
    for port in $P_KIOREX $P_CLINIC $P_PHARMACY $P_LAB $P_PASSPORT $P_UPSTREAM; do pid=$(port_pid $port); [ -n "$pid" ] && { kill "$pid" 2>/dev/null || true; }; done; sleep 2
    for port in $P_KIOREX $P_CLINIC $P_PHARMACY $P_LAB $P_PASSPORT $P_UPSTREAM; do pid=$(port_pid $port); [ -n "$pid" ] && kill -9 "$pid" 2>/dev/null || true; done
    for d in kiorly kiorex_platform kiorly_pharmacy kiorly_lab kiorex_account; do $PSQL -d postgres -c "drop database if exists sec_$d" 2>/dev/null || true; done
    for r in clinics-management kiorex-platform kiorly-pharmacy kiorly-lab; do rm -rf "$ROOT/$r/apps/api/$DIST"; done
    rm -f "$IDP_CFG"; exit 0 ;;
  up) ;;
  *) echo "usage: $0 up [--prod] | down | env"; exit 2 ;;
esac

fail() { echo "!! $1 FAILED, last lines of $2:" >&2; tail -40 "$2" >&2; exit 1; }
for port in $P_KIOREX $P_CLINIC $P_PHARMACY $P_LAB $P_PASSPORT $P_UPSTREAM; do [ -n "$(port_pid $port)" ] && { echo "port $port busy - run '$0 down' first"; exit 1; }; done
for d in kiorly kiorex_platform kiorly_pharmacy kiorly_lab kiorex_account; do
  $PSQL -d postgres -c "drop database if exists sec_$d" -c "create database sec_$d" 2>/dev/null
  pg_dump -h 127.0.0.1 -p 5433 -U postgres "$d" | $PSQL -d "sec_$d" >/dev/null 2>&1
done
# current migrations on top of the clones, and the idempotent Kiorex seed (flag catalogue of newer contract versions, dev partner registrations)
(cd "$ROOT/kiorex-platform" && DATABASE_URL="$(DB sec_kiorex_platform)" npm run db:deploy -w apps/api) > "$LOGS/sec-migrate-kiorex.log" 2>&1 || fail "kiorex migrate" "$LOGS/sec-migrate-kiorex.log"
(cd "$ROOT/clinics-management" && DATABASE_URL="$(DB sec_kiorly)" npm run db:deploy -w api) > "$LOGS/sec-migrate-clinic.log" 2>&1 || fail "clinic migrate" "$LOGS/sec-migrate-clinic.log"
(cd "$ROOT/kiorly-pharmacy" && DATABASE_URL="$(DB sec_kiorly_pharmacy)" npm run db:deploy -w api) > "$LOGS/sec-migrate-pharmacy.log" 2>&1 || fail "pharmacy migrate" "$LOGS/sec-migrate-pharmacy.log"
(cd "$ROOT/kiorly-lab" && DATABASE_URL="$(DB sec_kiorly_lab)" npm run db:deploy -w api) > "$LOGS/sec-migrate-lab.log" 2>&1 || fail "lab migrate" "$LOGS/sec-migrate-lab.log"
(cd "$ROOT/kiorex-platform" && DATABASE_URL="$(DB sec_kiorex_platform)" npm run db:seed -w apps/api) > "$LOGS/sec-seed-kiorex.log" 2>&1 || fail "kiorex seed" "$LOGS/sec-seed-kiorex.log"
# the clones must never talk to the shared dev stack: partner registrations at the sec ports (after the seed, which resets them), queued outbox work dropped
$PSQL -d sec_kiorex_platform -c "update \"PartnerRegistration\" set \"baseUrl\" = case when kind = 'PHARMACY' then 'http://localhost:$P_PHARMACY' else 'http://localhost:$P_LAB' end" -c "update \"ProductRegistration\" set \"webhookUrl\" = 'http://localhost:$P_CLINIC/api/v1/feature-flags/kiorex/changed' where product = 'kiorly-clinic'" -c "update \"OutboxEvent\" set status = 'SENT' where status = 'PENDING'" >/dev/null 2>&1 || true
$PSQL -d sec_kiorly -c "update \"KiorexIdentityLink\" set issuer = 'http://localhost:$P_PASSPORT' where issuer = 'http://localhost:4400'" -c "update \"OutboxEvent\" set status = 'SENT' where status = 'PENDING'" >/dev/null 2>&1 || true
$PSQL -d sec_kiorly_pharmacy -c "update \"IntegrationClient\" set \"kiorexBaseUrl\" = 'http://localhost:$P_KIOREX' where \"kiorexBaseUrl\" like 'http://localhost:4000%'" >/dev/null 2>&1 || true
$PSQL -d sec_kiorly_lab -c "update \"IntegrationClient\" set \"kiorexBaseUrl\" = 'http://localhost:$P_KIOREX' where \"kiorexBaseUrl\" like 'http://localhost:4000%'" -c "update \"OutboxEvent\" set status = 'SENT' where status <> 'SENT'" >/dev/null 2>&1 || true

# builds into dist-sec (plain tsc: the swagger plugin is not needed, production boots with docs off)
build() { # repo, name
  local dir="$ROOT/$1/apps/api"
  (cd "$dir" && npx prisma generate >/dev/null 2>&1; rm -rf $DIST && npx tsc -p tsconfig.build.json --outDir $DIST --incremental false) > "$LOGS/sec-build-$2.log" 2>&1 || fail "$2 build" "$LOGS/sec-build-$2.log"
}
build clinics-management clinic; build kiorex-platform kiorex; build kiorly-pharmacy pharmacy; build kiorly-lab lab
(cd "$ROOT/clinics-management/apps/api" && mkdir -p $DIST/src/assistant && cp -r src/assistant/prompts $DIST/src/assistant/ 2>/dev/null || true)
entry() { local d="$ROOT/$1/apps/api/$DIST"; if [ -f "$d/src/main.js" ]; then echo "$DIST/src/main.js"; else echo "$DIST/main.js"; fi; }

# private Passport: the committed idp.json with every local URL moved to the sec ports (back-channel logout must reach the PRIVATE Kiorex)
sed -e "s#localhost:3010#localhost:$P_CLINIC#g" -e "s#localhost:3100#localhost:$P_PHARMACY#g" -e "s#localhost:3200#localhost:$P_LAB#g" -e "s#localhost:4000#localhost:$P_KIOREX#g" -e "s#localhost:4400#localhost:$P_PASSPORT#g" -e "s#localhost:4401#localhost:$P_UPSTREAM#g" "$ROOT/kiorex-account/config/idp.json" > "$IDP_CFG"
start() { local name=$1 cwd=$2; shift 2; (cd "$cwd" && exec nohup "$@" > "$LOGS/sec-$name.log" 2>&1) & echo $! > "$PIDS/sec-$name.pid"; }
start passport "$ROOT/kiorex-account/apps/dev-idp" env NODE_ENV=development PORT=$P_PASSPORT KX_FAKE_UPSTREAM_PORT=$P_UPSTREAM KX_IDP_CONFIG="$IDP_CFG" DATABASE_URL="$(DB sec_kiorex_account)" npx tsx src/index.ts
JWT=$(openssl rand -hex 32)
start clinic "$ROOT/clinics-management/apps/api" env NODE_ENV=$MODE_ENV SWAGGER_ENABLED= PORT=$P_CLINIC DATABASE_URL="$(DB sec_kiorly)" JWT_SECRET="$JWT" APP_WEB_URL=http://localhost:5174 SIGNIN_DEFAULT_METHOD=PASSPORT \
  KIOREX_OUTBOX_WEBHOOK_URL=http://localhost:$P_KIOREX/api/v1/webhooks/kiorly KIOREX_OUTBOX_WEBHOOK_SECRET=kx_dev_webhook_secret KIOREX_OIDC_ISSUER=http://localhost:$P_PASSPORT node "$(entry clinics-management)"
( set -a; . "$ROOT/kiorex-platform/apps/api/.env.example"; set +a
  export NODE_ENV=$MODE_ENV PORT=$P_KIOREX DATABASE_URL="$(DB sec_kiorex_platform)" JOBS_ENABLED=true KIORLY_BASE_URL=http://localhost:$P_CLINIC/marketplace/v1 KIORLY_PHARMACY_BASE_URL=http://localhost:$P_PHARMACY KIORLY_LAB_BASE_URL=http://localhost:$P_LAB OIDC_ISSUER=http://localhost:$P_PASSPORT PARTNER_LEAD_SIGNING_SECRET=0123456789abcdef0123456789abcdef01 ALLOW_INSECURE_DEFAULT_SECRETS=true SANDBOX_PAYMENTS_ALLOWED=true
  start kiorex "$ROOT/kiorex-platform/apps/api" node "$(entry kiorex-platform)" )
start pharmacy "$ROOT/kiorly-pharmacy/apps/api" env NODE_ENV=$MODE_ENV SWAGGER_ENABLED= PORT=$P_PHARMACY DATABASE_URL="$(DB sec_kiorly_pharmacy)" AUTH_MODE=local OIDC_ISSUER=http://localhost:$P_PASSPORT node "$(entry kiorly-pharmacy)"
start lab "$ROOT/kiorly-lab/apps/api" env NODE_ENV=$MODE_ENV SWAGGER_ENABLED= PORT=$P_LAB DATABASE_URL="$(DB sec_kiorly_lab)" AUTH_MODE=dev KIOREX_OIDC_ISSUER=http://localhost:$P_PASSPORT node "$(entry kiorly-lab)"
for u in "passport:$P_PASSPORT:.well-known/openid-configuration" "clinic:$P_CLINIC:api/v1/health/live" "kiorex:$P_KIOREX:api/v1/health/live" "pharmacy:$P_PHARMACY:api/v1/health/live" "lab:$P_LAB:api/v1/health/live"; do
  n=${u%%:*}; r=${u#*:}; port=${r%%:*}; path=${r#*:}; ok=0
  for i in $(seq 1 90); do curl -fs -m3 "http://localhost:$port/$path" >/dev/null 2>&1 && { echo "$n ready :$port"; ok=1; break; }; sleep 1; done
  [ $ok = 1 ] || fail "$n start" "$LOGS/sec-$n.log"
done
