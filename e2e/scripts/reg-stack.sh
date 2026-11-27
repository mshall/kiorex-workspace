#!/usr/bin/env bash
# PRIVATE full stack for the 27 Nov 2026 regression run (copy of w9-stack.sh; the Clinic repo is READ-ONLY here: its existing dist/ is used, nothing is built or written there): its own Passport, Kiorly Clinic, Kiorex, Kiorly Pharmacy and Kiorly Lab, each on its OWN database (clones of the dev databases,
# current migrations applied on top) and on ports of its own. Nothing on the shared stack (:3010 :4000 :4400 :3100 :3200) or on :3000 :5173 :5175 is read, written or stopped, and
# nothing is built into a shared `dist/` (every build goes to dist-w9, removed by `down`).
#
#   scripts/w9-stack.sh up       clone databases, rewrite every stored URL to the private ports, migrate, build to dist-w9, start, wait
#   scripts/w9-stack.sh down     stop what this script started, drop the w9_* databases, remove dist-w9 and the private idp config
#   scripts/w9-stack.sh env      print the environment the e2e suite needs (eval it)
# Variables: TAG (default w9), PORT_BASE (default 4710): Passport +0, fake upstream +1, Clinic +2, Kiorex +3, Pharmacy +4, Lab +5.  SKIP_BUILD=1 reuses dist-$TAG.
# Run:  eval "$(scripts/w9-stack.sh env)" && npx vitest run            (all of 01..55 in one ordered invocation; 30-security has its own production-mode stack: scripts/sec-stack.sh)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; LOGS="$ROOT/.e2e/logs"; PIDS="$ROOT/.e2e/pids"; mkdir -p "$LOGS" "$PIDS"
export PATH="$HOME/.local/node-26/node-v26.13.1-darwin-arm64/bin:/Users/postgres/bin:$PATH" PGPASSWORD=postgres
TAG=${TAG:-reg}; PORT_BASE=${PORT_BASE:-4810}; SKIP_BUILD=${SKIP_BUILD:-0}
P_PASSPORT=$PORT_BASE; P_UPSTREAM=$((PORT_BASE+1)); P_CLINIC=$((PORT_BASE+2)); P_KIOREX=$((PORT_BASE+3)); P_PHARMACY=$((PORT_BASE+4)); P_LAB=$((PORT_BASE+5))
for p in $P_PASSPORT $P_UPSTREAM $P_CLINIC $P_KIOREX $P_PHARMACY $P_LAB; do case $p in 3000|5173|5175|3010|4000|4400|3100|3200) echo "refusing shared port $p"; exit 3;; esac; done
PSQL="psql -q -h 127.0.0.1 -p 5433 -U postgres"
DB() { echo "postgresql://postgres:postgres@127.0.0.1:5433/$1?schema=public&connection_limit=6"; }
DIST=dist-$TAG; IDP_CFG="$ROOT/.e2e/$TAG-idp.json"
port_pid() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1 || true; }
case "${1:-}" in
  env)
    cat <<EOF
export E2E_PASSPORT_URL=http://localhost:$P_PASSPORT E2E_KIORLY_URL=http://localhost:$P_CLINIC E2E_KIOREX_URL=http://localhost:$P_KIOREX E2E_PHARMACY_URL=http://localhost:$P_PHARMACY E2E_LAB_URL=http://localhost:$P_LAB
export E2E_DB_MAP=kiorex_platform=${TAG}_kiorex_platform,kiorly=${TAG}_kiorly,kiorly_pharmacy=${TAG}_kiorly_pharmacy,kiorly_lab=${TAG}_kiorly_lab,kiorex_account=${TAG}_kiorex_account
export E2E_PASSPORT_LOG=$LOGS/$TAG-passport.log E2E_OPS_CACHE=$ROOT/e2e/.cache/ops-login-$TAG.json E2E_FULL_STACK=1 E2E_STACK_SCRIPT=reg-stack.sh LAB_PUBLIC_BASE_URL=http://localhost:5193
export PATH="$HOME/.local/node-26/node-v26.13.1-darwin-arm64/bin:\$PATH"
EOF
    exit 0 ;;
  down)
    for f in "$PIDS"/$TAG-*.pid; do [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null || true; rm -f "$f"; done
    for p in $P_PASSPORT $P_UPSTREAM $P_CLINIC $P_KIOREX $P_PHARMACY $P_LAB; do pid=$(port_pid $p); [ -n "$pid" ] && { kill "$pid" 2>/dev/null || true; }; done; sleep 2
    for p in $P_PASSPORT $P_UPSTREAM $P_CLINIC $P_KIOREX $P_PHARMACY $P_LAB; do pid=$(port_pid $p); [ -n "$pid" ] && kill -9 "$pid" 2>/dev/null || true; done
    for d in kiorly kiorex_platform kiorly_pharmacy kiorly_lab kiorex_account; do $PSQL -d postgres -c "drop database if exists ${TAG}_$d" 2>/dev/null || true; done
    for r in kiorex-platform kiorly-pharmacy kiorly-lab; do rm -rf "$ROOT/$r/apps/api/$DIST" "$ROOT/$r/apps/api/tsconfig.build.$TAG.json"; done
    rm -f "$IDP_CFG" "$ROOT/e2e/.cache/ops-login-$TAG.json"; exit 0 ;;
  clinic-stop) # used by 10-resilience through svc.sh: ONLY the private Clinic
    pid=$(port_pid $P_CLINIC); [ -z "$pid" ] && exit 0; kill "$pid"; for i in $(seq 1 16); do [ -z "$(port_pid $P_CLINIC)" ] && break; sleep 0.5; done; [ -n "$(port_pid $P_CLINIC)" ] && kill -9 "$pid" 2>/dev/null; exit 0 ;;
  clinic-start)
    [ -n "$(port_pid $P_CLINIC)" ] && exit 0
    ENTRY="dist/src/main.js"
    (cd "$ROOT/clinics-management/apps/api" && nohup env NODE_ENV=development SIGNIN_DEFAULT_METHOD=PASSPORT PORT=$P_CLINIC OUTBOX_POLL_INTERVAL_MS=1000 APP_WEB_URL=http://localhost:5174 DATABASE_URL="$(DB ${TAG}_kiorly)" \
      KIOREX_OUTBOX_WEBHOOK_URL="http://localhost:$P_KIOREX/api/v1/webhooks/kiorly" KIOREX_OUTBOX_WEBHOOK_SECRET=kx_dev_webhook_secret KIOREX_CONTROL_PLANE_URL="http://localhost:$P_KIOREX" \
      KIOREX_FLAGS_PRODUCT_KEY=ff_kiorly-clinic_dev KIOREX_FLAGS_SECRET=ff_dev_secret_change_me KIOREX_OIDC_ISSUER="http://localhost:$P_PASSPORT" node --enable-source-maps "$ENTRY" < /dev/null >> "$LOGS/$TAG-clinic.log" 2>&1 &)
    for i in $(seq 1 90); do curl -fs -m3 "http://localhost:$P_CLINIC/api/v1/health/ready" >/dev/null 2>&1 && exit 0; sleep 1; done; exit 1 ;;
  up) ;;
  *) echo "usage: $0 up | down | env | clinic-stop | clinic-start"; exit 2 ;;
esac

for p in $P_PASSPORT $P_UPSTREAM $P_CLINIC $P_KIOREX $P_PHARMACY $P_LAB; do [ -n "$(port_pid $p)" ] && { echo "port $p busy - run '$0 down' first"; exit 1; }; done
fail() { echo "!! $1 FAILED, last lines of $2:" >&2; tail -40 "$2" >&2; exit 1; }

# ---- 1. databases: clone the dev databases (they carry the demo seeds and the dev partner registrations), then bring every one to the head of the CURRENT trees
for d in kiorly kiorex_platform kiorly_pharmacy kiorly_lab kiorex_account; do
  $PSQL -d postgres -c "drop database if exists ${TAG}_$d" -c "create database ${TAG}_$d" 2>/dev/null
  pg_dump -h 127.0.0.1 -p 5433 -U postgres "$d" | $PSQL -d "${TAG}_$d" >/dev/null 2>&1
done
(cd "$ROOT/kiorex-platform" && DATABASE_URL="$(DB ${TAG}_kiorex_platform)" npm run db:deploy -w apps/api) > "$LOGS/$TAG-migrate-kiorex.log" 2>&1 || fail "kiorex migrate" "$LOGS/$TAG-migrate-kiorex.log"
(cd "$ROOT/clinics-management" && DATABASE_URL="$(DB ${TAG}_kiorly)" npm run db:deploy -w api) > "$LOGS/$TAG-migrate-clinic.log" 2>&1 || fail "clinic migrate" "$LOGS/$TAG-migrate-clinic.log"
(cd "$ROOT/kiorly-pharmacy" && DATABASE_URL="$(DB ${TAG}_kiorly_pharmacy)" npm run db:deploy -w api) > "$LOGS/$TAG-migrate-pharmacy.log" 2>&1 || fail "pharmacy migrate" "$LOGS/$TAG-migrate-pharmacy.log"
(cd "$ROOT/kiorly-lab" && DATABASE_URL="$(DB ${TAG}_kiorly_lab)" npm run db:deploy -w api) > "$LOGS/$TAG-migrate-lab.log" 2>&1 || fail "lab migrate" "$LOGS/$TAG-migrate-lab.log"

# idempotent seeds on top of the clones (as `up.sh --seed`): they register the flags of newer contract versions and the dev partner registrations; without them a flag that is not yet in the clone's catalogue behaves as unregistered
(cd "$ROOT/kiorex-platform" && DATABASE_URL="$(DB ${TAG}_kiorex_platform)" npm run db:seed -w apps/api) > "$LOGS/$TAG-seed-kiorex.log" 2>&1 || fail "kiorex seed" "$LOGS/$TAG-seed-kiorex.log"
(cd "$ROOT/clinics-management" && DATABASE_URL="$(DB ${TAG}_kiorly)" PRISMA_SEED_ENSURE_DEMO_PASSWORDS=true npm run db:seed -w api) > "$LOGS/$TAG-seed-clinic.log" 2>&1 || fail "clinic seed" "$LOGS/$TAG-seed-clinic.log"
$PSQL -d ${TAG}_kiorex_platform -c "update \"PartnerRegistration\" set active = false where id not like '%\\_dev'" >/dev/null 2>&1 || true

# rewritten AFTER the seeds (the Kiorex seed resets the dev partner registrations to the shared default ports)
# every stored URL of the clones points at the private ports; queued outbox work of the clones is dropped (it belongs to the shared stack)
$PSQL -d ${TAG}_kiorly -c "update \"KiorexIdentityLink\" set issuer = 'http://localhost:$P_PASSPORT' where issuer = 'http://localhost:4400'" -c "update \"OutboxEvent\" set status = 'SENT' where status <> 'SENT'" >/dev/null 2>&1 || true
$PSQL -d ${TAG}_kiorex_platform -c "update \"PartnerRegistration\" set \"baseUrl\" = case when kind = 'PHARMACY' then 'http://localhost:$P_PHARMACY' else 'http://localhost:$P_LAB' end" \
  -c "update \"ProductRegistration\" set \"webhookUrl\" = 'http://localhost:$P_CLINIC/api/v1/feature-flags/kiorex/changed' where product = 'kiorly-clinic'" -c "update \"OutboxEvent\" set status = 'SENT' where status = 'PENDING'" >/dev/null 2>&1 || true
# the reward rules of the clone carry the raised goodwill caps of someone else's suite 50 run: the in-force version goes back to the shipped caps (suites 50 and 52 start from the defaults)
$PSQL -d ${TAG}_kiorex_platform -c "set session_replication_role = replica; update \"GrowthConfigVersion\" set payload = jsonb_set(jsonb_set(payload, '{credit,goodwill,perAgentDailyCapMinor}', '50000'), '{credit,goodwill,perPatient90dCapMinor}', '20000') where kind = 'REWARD_RULES' and payload #>> '{credit,goodwill,perAgentDailyCapMinor}' is not null" >/dev/null 2>&1 || true
# fixtures of suites 27/28/42/51/52 that an interrupted run of someone else left in the dev Clinic database (a booking slug on a KX-DEV clinic, a growth admin user)
$PSQL -d ${TAG}_kiorly -c "update \"Clinic\" set \"bookingSlug\" = null where \"bookingSlug\" = 'e2e-kxdev-zamalek'" -c "delete from \"User\" where id = 'e2e_growth_admin'" >/dev/null 2>&1 || true
# upcoming bookings left in the clone by other people's runs make the assistant's booking list (and slot availability) differ from a clean stack: the clone's Kiorex side forgets them
$PSQL -d ${TAG}_kiorex_platform -c "update \"BookingIntent\" set status = 'CANCELLED', \"terminalAt\" = now() where status in ('CONFIRMED','PENDING_CLINIC','HELD') and \"startsAt\" > now()" >/dev/null 2>&1 || true
$PSQL -d ${TAG}_kiorly_pharmacy -c "update \"IntegrationClient\" set \"kiorexBaseUrl\" = 'http://localhost:$P_KIOREX' where \"kiorexBaseUrl\" like 'http://localhost:4000%'" >/dev/null 2>&1 || true
$PSQL -d ${TAG}_kiorly_lab -c "update \"IntegrationClient\" set \"kiorexBaseUrl\" = 'http://localhost:$P_KIOREX' where \"kiorexBaseUrl\" like 'http://localhost:4000%'" -c "update \"OutboxEvent\" set status = 'SENT' where status <> 'SENT'" >/dev/null 2>&1 || true
# ---- 2. builds into dist-$TAG (nest build keeps the swagger plugin; deleteOutDir only ever deletes dist-$TAG because the tsconfig's outDir is overridden)
build() { # repo name, workspace dir
  local repo=$1 name=$2 dir="$ROOT/$1/apps/api"
  cat > "$dir/tsconfig.build.$TAG.json" <<EOF
{ "extends": "./tsconfig.build.json", "compilerOptions": { "outDir": "./$DIST", "tsBuildInfoFile": "./$DIST/tsconfig.build.tsbuildinfo", "incremental": false } }
EOF
  (cd "$dir" && npx prisma generate >/dev/null 2>&1; npx nest build --path "tsconfig.build.$TAG.json") > "$LOGS/$TAG-build-$name.log" 2>&1 || fail "$name build" "$LOGS/$TAG-build-$name.log"
  rm -f "$dir/tsconfig.build.$TAG.json"
}
if [ "$SKIP_BUILD" != 1 ]; then
  build kiorex-platform kiorex; build kiorly-pharmacy pharmacy; build kiorly-lab lab
fi
# nest build may nest the output under src/ (rootDir inferred); resolve the entry point of each build
entry() { local d="$ROOT/$1/apps/api/$DIST"; if [ -f "$d/src/main.js" ]; then echo "$DIST/src/main.js"; else echo "$DIST/main.js"; fi; }

# ---- 3. private Passport: the committed idp.json with every local URL moved to the private ports (the back-channel logout must reach the PRIVATE Kiorex)
sed -e "s#localhost:3010#localhost:$P_CLINIC#g" -e "s#localhost:3100#localhost:$P_PHARMACY#g" -e "s#localhost:3200#localhost:$P_LAB#g" -e "s#localhost:4000#localhost:$P_KIOREX#g" -e "s#localhost:4400#localhost:$P_PASSPORT#g" -e "s#localhost:4401#localhost:$P_UPSTREAM#g" "$ROOT/kiorex-account/config/idp.json" > "$IDP_CFG"
start() { local name=$1 cwd=$2; shift 2; (cd "$cwd" && exec nohup "$@" > "$LOGS/$TAG-$name.log" 2>&1) & echo $! > "$PIDS/$TAG-$name.pid"; }
start passport "$ROOT/kiorex-account/apps/dev-idp" env NODE_ENV=development PORT=$P_PASSPORT KX_FAKE_UPSTREAM_PORT=$P_UPSTREAM KX_IDP_CONFIG="$IDP_CFG" DATABASE_URL="$(DB ${TAG}_kiorex_account)" npx tsx src/index.ts

# ---- 4. the four APIs (wiring as scripts/up.sh, ports moved)
start clinic "$ROOT/clinics-management/apps/api" env NODE_ENV=development SIGNIN_DEFAULT_METHOD=PASSPORT PORT=$P_CLINIC OUTBOX_POLL_INTERVAL_MS=1000 APP_WEB_URL=http://localhost:5174 DATABASE_URL="$(DB ${TAG}_kiorly)" \
  KIOREX_OUTBOX_WEBHOOK_URL="http://localhost:$P_KIOREX/api/v1/webhooks/kiorly" KIOREX_OUTBOX_WEBHOOK_SECRET=kx_dev_webhook_secret \
  KIOREX_CONTROL_PLANE_URL="http://localhost:$P_KIOREX" KIOREX_FLAGS_PRODUCT_KEY=ff_kiorly-clinic_dev KIOREX_FLAGS_SECRET=ff_dev_secret_change_me \
  KIOREX_OIDC_ISSUER="http://localhost:$P_PASSPORT" node --enable-source-maps "dist/src/main.js"
( set -a; . "$ROOT/kiorex-platform/apps/api/.env.example"; set +a
  export NODE_ENV=development PORT=$P_KIOREX OUTBOX_POLL_INTERVAL_MS=1000 DATABASE_URL="$(DB ${TAG}_kiorex_platform)" JOBS_ENABLED=true PSP_MODE=sandbox-fake MESSAGING_MODE=log AI_PROVIDER=fake IMPORT_TARGET_MODE=kiorly SANDBOX_PAYMENTS_ALLOWED=true \
    OIDC_ISSUER="http://localhost:$P_PASSPORT" KIORLY_BASE_URL="http://localhost:$P_CLINIC/marketplace/v1" KIORLY_PHARMACY_BASE_URL="http://localhost:$P_PHARMACY" KIORLY_LAB_BASE_URL="http://localhost:$P_LAB" \
    KIOREX_PAY_LINK_BASE_URL="http://localhost:$P_KIOREX/api/v1/pay/links" PUBLIC_BASE_URL="http://localhost:$P_KIOREX"
  start kiorex "$ROOT/kiorex-platform/apps/api" node "$(entry kiorex-platform)" )
PARTNER_ENV="CORS_ORIGINS=${REG_CORS_ORIGINS:-http://localhost:8862,http://127.0.0.1:8862,http://localhost:5761,http://127.0.0.1:5761,http://localhost:5762,http://127.0.0.1:5762} KIOREX_MODE=real KIOREX_BASE_URL=http://localhost:$P_KIOREX FLAGS_POLL_ENABLED=true FLAGS_POLL_INTERVAL_MS=1500 KIOREX_FLAGS_URL=http://localhost:$P_KIOREX/api/v1/control/v1/flags/snapshot KIOREX_PRODUCT_SECRET=ff_dev_secret_change_me OUTBOX_POLL_INTERVAL_MS=1000 SIGNIN_DEFAULT_METHOD=PASSPORT"
start pharmacy "$ROOT/kiorly-pharmacy/apps/api" env NODE_ENV=development PORT=$P_PHARMACY DATABASE_URL="$(DB ${TAG}_kiorly_pharmacy)" AUTH_MODE=local AUTH_ACCEPT_PASSPORT=true OIDC_ISSUER="http://localhost:$P_PASSPORT" KIOREX_PRODUCT_KEY=ff_kiorly-pharmacy_dev $PARTNER_ENV node --enable-source-maps "$(entry kiorly-pharmacy)"
start lab "$ROOT/kiorly-lab/apps/api" env NODE_ENV=development PORT=$P_LAB PUBLIC_BASE_URL=http://localhost:5193 DATABASE_URL="$(DB ${TAG}_kiorly_lab)" AUTH_MODE=dev AUTH_ACCEPT_PASSPORT=true KIOREX_OIDC_ISSUER="http://localhost:$P_PASSPORT" KIOREX_PRODUCT_KEY=ff_kiorly-lab_dev KIOREX_WEBHOOK_URL="http://localhost:$P_KIOREX/api/v1/webhooks/kiorly" $PARTNER_ENV node --enable-source-maps "$(entry kiorly-lab)"

wait_ready() { for i in $(seq 1 120); do curl -fs -m3 "$2" >/dev/null 2>&1 && { echo "$1 ready"; return 0; }; sleep 1; done; echo "$1 NOT ready - see $LOGS/$TAG-$1.log"; return 1; }
wait_ready passport "http://localhost:$P_PASSPORT/.well-known/openid-configuration"
wait_ready clinic "http://localhost:$P_CLINIC/api/v1/health/ready"
wait_ready kiorex "http://localhost:$P_KIOREX/api/v1/health/ready"
wait_ready pharmacy "http://localhost:$P_PHARMACY/api/v1/health/ready"
wait_ready lab "http://localhost:$P_LAB/api/v1/health/ready"
echo "private stack $TAG: passport :$P_PASSPORT clinic :$P_CLINIC kiorex :$P_KIOREX pharmacy :$P_PHARMACY lab :$P_LAB"
