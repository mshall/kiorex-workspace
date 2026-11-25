#!/usr/bin/env bash
# Stop/start ONE service (used by the resilience scenario): scripts/svc.sh kiorly stop|start
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOGS="$ROOT/.e2e/logs"; PIDS="$ROOT/.e2e/pids"
DBURL() { echo "postgresql://postgres:postgres@127.0.0.1:5433/$1?schema=public"; }
svc=$1; act=$2
# private full stack (scripts/w9-stack.sh): NEVER touch the shared :3010
if [ -n "${E2E_FULL_STACK:-}" ]; then exec "$(dirname "${BASH_SOURCE[0]}")/w9-stack.sh" "clinic-$act"; fi
[ "$svc" = kiorly ] || { echo "only 'kiorly' is supported"; exit 2; }
port_pid() { lsof -nP -iTCP:3010 -sTCP:LISTEN -t 2>/dev/null | head -1 || true; }
case $act in
  stop) p=$(port_pid)
    if [ -z "$p" ]; then echo "kiorly not running"; exit 0; fi
    # SIGTERM starts a graceful shutdown that keeps serving already-open keep-alive connections, so a client with a pooled socket would still get 200s from the
    # "stopped" API. Wait until the port is really closed (SIGKILL after 8 s) so the scenario starts from a genuinely down service.
    kill "$p"; for i in $(seq 1 16); do [ -z "$(port_pid)" ] && break; sleep 0.5; done
    [ -n "$(port_pid)" ] && kill -9 "$p" 2>/dev/null && sleep 1
    echo "stopped kiorly ($p)";;
  start)
    [ -n "$(port_pid)" ] && { echo "kiorly already running"; exit 0; }
    (cd "$ROOT/clinics-management/apps/api" && nohup env NODE_ENV=development SIGNIN_DEFAULT_METHOD=PASSPORT PORT=3010 APP_WEB_URL=http://localhost:5174 DATABASE_URL="$(DBURL kiorly)" \
      KIOREX_OUTBOX_WEBHOOK_URL="http://localhost:4000/api/v1/webhooks/kiorly" KIOREX_OUTBOX_WEBHOOK_SECRET=kx_dev_webhook_secret \
      KIOREX_CONTROL_PLANE_URL="http://localhost:4000" KIOREX_FLAGS_PRODUCT_KEY=ff_kiorly-clinic_dev KIOREX_FLAGS_SECRET=ff_dev_secret_change_me \
      KIOREX_OIDC_ISSUER="http://localhost:4400" node --enable-source-maps dist/src/main.js < /dev/null >> "$LOGS/kiorly.log" 2>&1 &)
    for i in $(seq 1 90); do curl -fs -m3 http://localhost:3010/api/v1/health/ready >/dev/null 2>&1 && { port_pid > "$PIDS/kiorly.pid"; echo "kiorly ready"; exit 0; }; sleep 1; done
    echo "kiorly NOT ready"; exit 1;;
esac
