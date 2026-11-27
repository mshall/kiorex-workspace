#!/usr/bin/env bash
# Builds /opt/kx/env/<product>.env (0600) from: registry URLs shipped in the release + the product secret bag + DATABASE_URL.
. /usr/local/lib/kx/kx-lib.sh
REL=/opt/kx/releases/current; OUT=/opt/kx/env; umask 077; mkdir -p "$OUT"
pg="$(kx_secret_get postgres)"
for product in $KX_PRODUCTS; do
  f="$OUT/$product.env.new"; : > "$f"
  [ -f "$REL/urls/$product.env" ] && cat "$REL/urls/$product.env" >> "$f"
  bag="$(kx_secret_get "$product" 2>/dev/null || echo '{}')"; [ -n "$bag" ] || bag='{}'
  jq -r 'to_entries[] | select(.value|type=="string") | "\(.key)=\(.value)"' <<<"$bag" >> "$f"
  if [ "$KX_DB_MODE" = "host" ]; then host=postgres; port=5432; else c="$(kx_secret_get dbconn)"; host="$(jq -r .host <<<"$c")"; port="$(jq -r .port <<<"$c")"; fi
  pw="$(jq -r --arg k "${product}_password" '.[$k] // empty' <<<"$pg")"
  [ -n "$pw" ] && printf 'DATABASE_URL=postgresql://%s:%s@%s:%s/%s?schema=public\n' "$product" "$pw" "$host" "$port" "$product" >> "$f"
  mv "$f" "$OUT/$product.env"
done
# Edge gate for Caddy: reject any request that did not come through our CDN.
printf 'KX_ORIGIN_SECRET=%s\n' "$(kx_secret_get edge | jq -r .origin_secret)" > "$OUT/edge.env"
printf 'POSTGRES_PASSWORD=%s\n' "$(jq -r .superuser_password <<<"$pg")" > "$OUT/postgres.env"
for product in $KX_DATABASES; do printf '%s_PASSWORD=%s\n' "$(tr a-z A-Z <<<"$product")" "$(jq -r --arg k "${product}_password" '.[$k]' <<<"$pg")" >> "$OUT/postgres.env"; done
