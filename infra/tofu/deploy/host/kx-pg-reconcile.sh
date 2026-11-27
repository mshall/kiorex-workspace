#!/usr/bin/env bash
# Idempotently creates one role + one database per product (separate database per product, each role owns only its own database)
# and (re)sets the password from the secret store. Runs on every deploy after postgres is healthy.
. /usr/local/lib/kx/kx-lib.sh
[ "$KX_DB_MODE" = "host" ] || exit 0
pg="$(kx_secret_get postgres)"; c="kx-${KX_ENV}-postgres-1"
for db in $KX_DATABASES; do
  pw="$(jq -r --arg k "${db}_password" '.[$k]' <<<"$pg")"
  docker exec -i "$c" psql -U postgres -v ON_ERROR_STOP=1 -v pw="$pw" <<SQL
SELECT format('CREATE ROLE %I LOGIN', '$db') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='$db')\gexec
ALTER ROLE "$db" PASSWORD :'pw';
SELECT format('CREATE DATABASE %I OWNER %I', '$db', '$db') WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname='$db')\gexec
REVOKE ALL ON DATABASE "$db" FROM PUBLIC;
SQL
done
