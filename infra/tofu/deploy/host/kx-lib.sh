#!/usr/bin/env bash
# Provider shim, sourced by every kx-* script. The ONLY place that knows which cloud the host runs on.
# Contract (same on both providers):  kx_secret_get <name>   kx_secret_put <name> <json>   kx_obj_get <key> <dest>   kx_obj_put <src> <key>
#                                     kx_registry_login      kx_metric <name> <value>
# Config comes from /etc/kx/host.env, written once by the bootstrap (cloud-init).
set -euo pipefail
# shellcheck disable=SC1091
. /etc/kx/host.env

kx_log() { printf '%s kx[%s] %s\n' "$(date -u +%FT%TZ)" "${0##*/}" "$*" >&2; }

case "$KX_PROVIDER" in
  aws)
    export AWS_DEFAULT_REGION="$KX_REGION"
    kx_secret_get() { aws secretsmanager get-secret-value --secret-id "${KX_SECRETS_PREFIX}/$1" --query SecretString --output text 2>/dev/null; }
    kx_secret_exists() { aws secretsmanager describe-secret --secret-id "${KX_SECRETS_PREFIX}/$1" >/dev/null 2>&1; }
    kx_secret_put() { aws secretsmanager put-secret-value --secret-id "${KX_SECRETS_PREFIX}/$1" --secret-string "$2" >/dev/null; }
    kx_obj_get() { aws s3 cp "s3://${KX_DEPLOY_BUCKET}/$1" "$2" --only-show-errors; }
    kx_obj_sync() { aws s3 sync "s3://${KX_DEPLOY_BUCKET}/$1" "$2" --only-show-errors --delete; }
    kx_obj_put() { aws s3 cp "$1" "s3://$3/$2" --only-show-errors --sse AES256; }
    kx_registry_login() { aws ecr get-login-password | docker login --username AWS --password-stdin "${KX_REGISTRY_URL%%/*}" >/dev/null; }
    kx_metric() { aws cloudwatch put-metric-data --namespace "Kiorex/${KX_ENV}" --metric-name "$1" --value "$2" --dimensions "Env=${KX_ENV}"; }
    ;;
  huawei)
    # UNVERIFIED AT RUNTIME (written from the provider and CLI documentation, never executed). Needs `hcloud` (Huawei Cloud CLI) and
    # `obsutil` on the host, installed by the bootstrap, authenticated through the ECS agency (temporary credentials from the metadata service).
    # CSMS names cannot contain "/": /kx/test + postgres becomes kx-test-postgres (the same rule the OpenTofu modules use).
    kx_csms_name() { printf '%s' "${KX_SECRETS_PREFIX#/}-$1" | tr / -; }
    kx_secret_get() { hcloud CSMS ShowSecretVersion --cli-region="$KX_REGION" --secret_name="$(kx_csms_name "$1")" --version_id=latest --cli-query='version.secret_string' --cli-output=raw 2>/dev/null; }
    kx_secret_exists() { hcloud CSMS ShowSecret --cli-region="$KX_REGION" --secret_name="$(kx_csms_name "$1")" >/dev/null 2>&1; }
    kx_secret_put() { hcloud CSMS CreateSecretVersion --cli-region="$KX_REGION" --secret_name="$(kx_csms_name "$1")" --version.secret_string="$2" >/dev/null; }
    kx_obj_get() { obsutil cp "obs://${KX_DEPLOY_BUCKET}/$1" "$2" -f >/dev/null; }
    kx_obj_sync() { obsutil sync "obs://${KX_DEPLOY_BUCKET}/$1" "$2" -f >/dev/null; }
    kx_obj_put() { obsutil cp "$1" "obs://$3/$2" -f >/dev/null; }
    kx_registry_login() {
      # SWR login: user "<region>@<AK>", password = hex(HMAC-SHA256(key=SK, msg=AK)). Pull-only IAM user credentials live in the CSMS secret "registry-pull".
      local j ak sk; j="$(kx_secret_get registry-pull)"; ak="$(jq -r .access_key <<<"$j")"; sk="$(jq -r .secret_key <<<"$j")"
      printf '%s' "$ak" | openssl dgst -binary -sha256 -hmac "$sk" | od -An -vtx1 | tr -d ' \n' | docker login -u "${KX_REGION}@${ak}" --password-stdin "${KX_REGISTRY_URL%%/*}" >/dev/null
    }
    kx_metric() { kx_log "metric $1=$2 (Huawei CES custom metric push not implemented; alarm uses ECS metrics only)"; }
    ;;
  *) kx_log "unknown KX_PROVIDER=$KX_PROVIDER"; exit 64 ;;
esac
