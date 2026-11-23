#!/usr/bin/env bash
# Stop/start ONE service (used by the resilience scenario): scripts/svc.sh kiorly stop|start
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOGS="$ROOT/.e2e/logs"; PIDS="$ROOT/.e2e/pids"
DBURL() { echo "postgresql://postgres:postgres@127.0.0.1:5433/$1?schema=public"; }
svc=$1; act=$2
[ "$svc" = kiorly ] || { echo "only 'kiorly' is supported"; exit 2; }
port_pid() { lsof -nP -iTCP:3010 -sTCP:LISTEN -t 2>/dev/null | head -1 || true; }
case $act in
  stop) p=$(port_pid); [ -n "$p" ] && kill "$p" && echo "stopped kiorly ($p)" || echo "kiorly not running";;
  start)
    [ -n "$(port_pid)" ] && { echo "kiorly already running"; exit 0; }
    (cd "$ROOT/clinics-management/apps/api" && nohup env NODE_ENV=development SIGNIN_DEFAULT_METHOD=PASSPORT PORT=3010 APP_WEB_URL=http://localhost:5174 DATABASE_URL="$(DBURL kiorly)" \
      KIOREX_OUTBOX_WEBHOOK_URL="http://localhost:4000/api/v1/webhooks/kiorly" KIOREX_OUTBOX_WEBHOOK_SECRET=kx_dev_webhook_secret \
      KIOREX_CONTROL_PLANE_URL="http://localhost:4000" KIOREX_FLAGS_PRODUCT_KEY=ff_kiorly-clinic_dev KIOREX_FLAGS_SECRET=ff_dev_secret_change_me \
      KIOREX_OIDC_ISSUER="http://localhost:4400" node --enable-source-maps dist/src/main.js < /dev/null >> "$LOGS/kiorly.log" 2>&1 &)
    for i in $(seq 1 90); do curl -fs -m3 http://localhost:3010/api/v1/health/ready >/dev/null 2>&1 && { port_pid > "$PIDS/kiorly.pid"; echo "kiorly ready"; exit 0; }; sleep 1; done
    echo "kiorly NOT ready"; exit 1;;
esac
