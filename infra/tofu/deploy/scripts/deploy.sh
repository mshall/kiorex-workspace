#!/usr/bin/env bash
# Build a release bundle and hand it to the host. Works from a laptop (read-only review first: --dry-run) and from CI.
#
#   deploy.sh <test|pilot|prod> [--tag product=<image tag>]... [--rollback] [--dry-run]     (KX_OFFLINE=1: never contact the cloud)
#
# Needs: DEPLOY_BUCKET (and for AWS push mode SSM_DOCUMENT, AWS_REGION) in the environment, or `tofu` able to read the env's outputs.
# KX_PROVIDER=aws (default) uses S3 + SSM Run Command; KX_PROVIDER=huawei uses OBS (obsutil) and the host polls every 60 s.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; root="$(cd "$here/.." && pwd)"; tofu_root="$(cd "$root/.." && pwd)"; ws="$(cd "$tofu_root/../.." && pwd)"
env_id="${1:?usage: deploy.sh <test|pilot|prod> [--tag product=tag]... [--rollback] [--dry-run]}"; shift
provider="${KX_PROVIDER:-aws}"; dry=0; rollback=0; declare -a tags=()
while [ $# -gt 0 ]; do case "$1" in --tag) tags+=("$2"); shift 2;; --dry-run) dry=1; shift;; --rollback) rollback=1; shift;; *) echo "unknown arg $1" >&2; exit 64;; esac; done
case "$env_id" in test|pilot|prod) ;; *) echo "env must be test, pilot or prod" >&2; exit 64;; esac

if [ -z "${DEPLOY_BUCKET:-}" ] && command -v tofu >/dev/null; then
  out="$(tofu -chdir="$tofu_root/envs/$env_id" output -json deploy 2>/dev/null || true)"
  [ -n "$out" ] && { DEPLOY_BUCKET="$(jq -r .deploy_bucket <<<"$out")"; SSM_DOCUMENT="${SSM_DOCUMENT:-$(jq -r '.ssm_document // empty' <<<"$out")}"; }
fi
: "${DEPLOY_BUCKET:?set DEPLOY_BUCKET (tofu output deploy)}"

cp_obj() { if [ "$provider" = aws ]; then aws s3 cp "$1" "$2" --only-show-errors --sse AES256; else obsutil cp "$1" "$2" -f >/dev/null; fi; }
sync_up() { if [ "$provider" = aws ]; then aws s3 sync "$1" "$2" --only-show-errors --delete --sse AES256; else obsutil sync "$1" "$2" -f >/dev/null; fi; }
sync_dn() { if [ "$provider" = aws ]; then aws s3 sync "$1" "$2" --only-show-errors --delete; else obsutil sync "$1" "$2" -f >/dev/null; fi; }
scheme() { if [ "$provider" = aws ]; then echo "s3://$DEPLOY_BUCKET"; else echo "obs://$DEPLOY_BUCKET"; fi; }

trigger() {
  local mode="$1"
  if [ "$provider" = aws ]; then
    : "${SSM_DOCUMENT:?set SSM_DOCUMENT}"
    cid="$(aws ssm send-command --document-name "$SSM_DOCUMENT" --parameters "mode=$mode" --targets "Key=tag:KxEnv,Values=$env_id" --comment "kx deploy $env_id" --query Command.CommandId --output text)"
    echo "SSM command $cid sent; waiting"
    for _ in $(seq 1 90); do
      sleep 10
      st="$(aws ssm list-command-invocations --command-id "$cid" --query 'CommandInvocations[0].Status' --output text)"
      case "$st" in Success) echo "deploy applied"; return 0;; Failed|Cancelled|TimedOut) aws ssm list-command-invocations --command-id "$cid" --details --query 'CommandInvocations[0].CommandPlugins[0].Output' --output text | tail -40; return 1;; esac
    done; echo "timed out waiting for the host" >&2; return 1
  else
    echo "pull-based deploy: the host applies the new release id within about 60 seconds (kx-deploy-poll.timer)."
  fi
}

if [ "$rollback" = 1 ]; then
  [ "$dry" = 1 ] && { echo "would promote releases/previous to releases/current for $env_id and apply it"; exit 0; }
  rb="$(mktemp -d)"; trap 'rm -rf "$rb"' EXIT
  sync_dn "$(scheme)/releases/previous/" "$rb/prev"; [ -f "$rb/prev/RELEASE_ID" ] || { echo "no previous release to roll back to" >&2; exit 66; }
  # promote in object storage first, so a pull-mode host (which follows releases/current) does not flip back to the bad release
  sync_up "$rb/prev/" "$(scheme)/releases/current/"
  trigger apply; exit $?
fi

work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT; rel="$work/release"; mkdir -p "$rel/urls"
cp "$root/compose/docker-compose.yml" "$root/compose/Caddyfile" "$rel/"; cp "$root/compose/$env_id/docker-compose.override.yml" "$rel/"

# 1. image tags: start from the release that is running now, then apply --tag overrides
if [ "${KX_OFFLINE:-0}" != 1 ] && sync_dn "$(scheme)/releases/current/" "$work/prev" 2>/dev/null && [ -f "$work/prev/release.env" ]; then cp "$work/prev/release.env" "$rel/release.env"; else : > "$rel/release.env"; fi
upsert() { local k="$1" v="$2"; grep -v "^$k=" "$rel/release.env" > "$rel/.t" || true; echo "$k=$v" >> "$rel/.t"; mv "$rel/.t" "$rel/release.env"; }
for t in ${tags[@]+"${tags[@]}"}; do
  p="${t%%=*}"; v="${t#*=}"
  case "$p" in platform) upsert PLATFORM_TAG "$v";; passport) upsert PASSPORT_TAG "$v";; pharmacy-api) upsert PHARMACY_API_TAG "$v";; lab-api) upsert LAB_API_TAG "$v";; *) echo "unknown product $p" >&2; exit 64;; esac
done
reg="${KX_REGISTRY:-}"; [ -n "$reg" ] && upsert KX_REGISTRY "$reg"; upsert KX_ENV "$env_id"
for k in KX_REGISTRY PLATFORM_TAG PASSPORT_TAG PHARMACY_API_TAG LAB_API_TAG; do grep -q "^$k=" "$rel/release.env" || { echo "release.env is missing $k (pass --tag and KX_REGISTRY on the first deploy)" >&2; exit 65; }; done

# 2. URLs come from the registry, never typed: one env file per product (deployment unit)
node "$ws/_docs/registry/validate-registry.mjs" --emit env --env "$env_id" | while IFS=$'\t' read -r svc kv; do
  case "$svc" in kiorex.api|kiorex.webhooks) f=platform;; kiorex.passport) f=passport;; kiorly.pharmacies) f=pharmacy;; kiorly.labs) f=lab;; *) continue;; esac
  echo "$kv" >> "$rel/urls/$f.env"
done
touch "$rel/urls/"{platform,passport,pharmacy,lab}.env

# 3. release id and upload (previous release is kept for rollback)
rid="$(date -u +%Y%m%dT%H%M%SZ)-$(cat "$rel/release.env" "$rel/docker-compose.yml" | shasum | cut -c1-8)"; echo "$rid" > "$rel/RELEASE_ID"
echo "release $rid"; sed 's/^/  /' "$rel/release.env"
[ "$dry" = 1 ] && { echo "dry run: nothing uploaded"; exit 0; }
if [ -d "$work/prev" ] && [ -f "$work/prev/RELEASE_ID" ]; then sync_up "$work/prev/" "$(scheme)/releases/previous/"; fi
sync_up "$rel/" "$(scheme)/releases/current/"
trigger apply
