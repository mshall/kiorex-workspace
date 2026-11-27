#!/usr/bin/env bash
# Applies a release on this host. Triggered by SSM Run Command (AWS) or by kx-deploy-poll.timer (any provider).
#   kx-deploy             apply releases/current from the deploy bucket
#   kx-deploy --rollback  re-apply releases/previous
# A release = docker-compose.yml + Caddyfile + release.env (image tags) + urls/<product>.env (generated from the URL registry).
. /usr/local/lib/kx/kx-lib.sh
exec 9>/var/lock/kx-deploy.lock; flock -n 9 || { kx_log "another deploy is running"; exit 75; }
SRC=releases/current; [ "${1:-}" = "--rollback" ] && SRC=releases/previous
STAGE=/opt/kx/releases/incoming; rm -rf "$STAGE"; mkdir -p "$STAGE" /opt/kx/releases
kx_obj_sync "$SRC/" "$STAGE"
[ -f "$STAGE/docker-compose.yml" ] && [ -f "$STAGE/release.env" ] || { kx_log "release incomplete"; exit 66; }
# Poll mode: do nothing when the release id did not change.
rid="$(cat "$STAGE/RELEASE_ID" 2>/dev/null || echo none)"
if [ "${KX_FORCE:-0}" != 1 ] && [ "$rid" = "$(cat /opt/kx/releases/current/RELEASE_ID 2>/dev/null || echo x)" ] && [ "${1:-}" != "--rollback" ]; then exit 0; fi
[ -d /opt/kx/releases/current ] && { rm -rf /opt/kx/releases/last; mv /opt/kx/releases/current /opt/kx/releases/last; }
mv "$STAGE" /opt/kx/releases/current
/usr/local/lib/kx/kx-init-secrets.sh
/usr/local/lib/kx/kx-render-env.sh
kx_registry_login
cd /opt/kx/releases/current
export COMPOSE_PROJECT_NAME="kx-${KX_ENV}"
# Compose profiles decide what runs HERE: "localdb" = postgres in a container (host database mode); "jobs" = the single scheduler
# container, enabled on exactly one host (KX_JOBS_HOST=true on host 0 only), so jobs never run twice.
profiles=""; [ "$KX_DB_MODE" = "host" ] && profiles="localdb"
[ "${KX_JOBS_HOST:-true}" = "true" ] && profiles="${profiles:+$profiles,}jobs"
export COMPOSE_PROFILES="$profiles"
docker compose --env-file release.env pull
if [ "$KX_DB_MODE" = "host" ]; then
  docker compose --env-file release.env up -d --wait --wait-timeout 120 postgres
  /usr/local/lib/kx/kx-pg-reconcile.sh
fi
docker compose --env-file release.env up -d --remove-orphans --wait --wait-timeout 300 || { kx_log "release unhealthy"; docker compose ps; exit 1; }
# Caddy bind-mounts ./Caddyfile from releases/current, which is replaced (moved) on every deploy: a running container would keep the OLD file
# (stale inode) and compose sees no change in its own config. Recreate the edge container on every release (a few seconds, the CDN retries).
docker compose --env-file release.env up -d --force-recreate --no-deps --wait --wait-timeout 60 caddy || kx_log "caddy recreate failed"
docker image prune -f --filter "until=168h" >/dev/null
kx_log "release ${rid} applied"
kx_obj_put /opt/kx/releases/current/RELEASE_ID "state/${KX_ENV}/applied" "$KX_DEPLOY_BUCKET" || true
