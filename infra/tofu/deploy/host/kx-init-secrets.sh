#!/usr/bin/env bash
# Generates the database passwords ON THE HOST the first time (never in tfvars, never in OpenTofu state) and stores them in the
# secret store. Idempotent: an existing secret is never overwritten. Founder-owned secrets (OIDC keys, provider keys) are set by the
# founder with the cloud CLI; see RUNBOOK.md section 4.
. /usr/local/lib/kx/kx-lib.sh
if kx_secret_exists postgres && [ -n "$(kx_secret_get postgres 2>/dev/null || true)" ] && [ "$(kx_secret_get postgres | jq -r 'keys|length')" -gt 0 ]; then kx_log "postgres secret present"; exit 0; fi
json='{}'
json="$(jq -c --arg v "$(openssl rand -base64 36 | tr -dc 'A-Za-z0-9' | head -c 40)" '. + {superuser_password:$v}' <<<"$json")"
for db in $KX_DATABASES; do
  json="$(jq -c --arg k "${db}_password" --arg v "$(openssl rand -base64 36 | tr -dc 'A-Za-z0-9' | head -c 40)" '. + {($k):$v}' <<<"$json")"
done
kx_secret_put postgres "$json"
kx_log "generated database passwords for: $KX_DATABASES"
