#!/usr/bin/env bash
# GRW-P3-H: (1) migration replay from an EMPTY database to head for the four Prisma schemas, with an order check (applied order == lexicographic order of the migration folders, every folder applied,
# none failed), and (2) the local backup and restore drill for the growth tables: dump the data tables of a populated database (default the private stack's w9_kiorex_platform), restore them into
# the freshly replayed database and compare row counts and an order-independent checksum per table. Scratch databases only (w9drill_*), dropped at the end. Never touches the shared databases.
#   scripts/migration-replay.sh [source_db]       (default w9_kiorex_platform; needs the private stack's databases, `scripts/w9-stack.sh up`)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; LOGS="$ROOT/.e2e/logs"; mkdir -p "$LOGS"
export PATH="$HOME/.local/node-26/node-v26.13.1-darwin-arm64/bin:/Users/postgres/bin:$PATH" PGPASSWORD=postgres
SRC=${1:-w9_kiorex_platform}; P() { psql -q -h 127.0.0.1 -p 5433 -U postgres "$@"; }
U() { echo "postgresql://postgres:postgres@127.0.0.1:5433/$1?schema=public&connection_limit=3"; }
fail=0
replay() { # label repo prisma-dir workspace-cmd
  local label=$1 repo=$2 dir=$3 db="w9drill_$1"
  P -d postgres -c "drop database if exists $db" -c "create database $db"
  (cd "$ROOT/$repo" && DATABASE_URL="$(U $db)" npm run db:deploy -w "$4") > "$LOGS/w9drill-$label.log" 2>&1 || { echo "FAIL $label: migrate deploy"; tail -5 "$LOGS/w9drill-$label.log"; fail=1; return; }
  local want applied failed
  want=$(ls "$ROOT/$repo/$dir/migrations" | grep -E '^[0-9]{14}_' | sort | tr '\n' ' ')
  applied=$(P -d $db -tAc "select migration_name from _prisma_migrations where finished_at is not null and rolled_back_at is null order by finished_at, migration_name" | tr '\n' ' ')
  failed=$(P -d $db -tAc "select count(*) from _prisma_migrations where finished_at is null or rolled_back_at is not null")
  local n_want n_applied; n_want=$(echo $want | wc -w | tr -d ' '); n_applied=$(echo $applied | wc -w | tr -d ' ')
  local sorted; sorted=$(echo $applied | tr ' ' '\n' | sort | tr '\n' ' ')
  if [ "$n_want" = "$n_applied" ] && [ "$failed" = 0 ] && [ "$want" = "$sorted" ]; then echo "OK   $label: $n_applied migrations from empty to head, none failed, folder set == applied set"; else echo "FAIL $label: folders=$n_want applied=$n_applied failed=$failed"; fail=1; fi
  # applied order must be the lexicographic order (timestamps strictly increasing)
  [ "$applied" = "$sorted" ] && echo "OK   $label: applied order is the timestamp order" || { echo "FAIL $label: applied order differs from timestamp order"; fail=1; }
}
replay kiorex kiorex-platform apps/api/prisma apps/api
replay clinic clinics-management apps/api/prisma api
replay pharmacy kiorly-pharmacy apps/api/prisma api
replay lab kiorly-lab apps/api/prisma api

# --- growth data restore drill (Kiorex)
DB=w9drill_kiorex
TABLES=$(P -d $SRC -tAc "select string_agg(quote_ident(table_name), ' ') from information_schema.tables where table_schema='public' and table_type='BASE TABLE' and table_name ~ '^(Growth|Lifecycle|Referral|Reward|Assistant|Corporate|Promotion|Sponsored|Campaign|Experiment|Fraud|Cohort|Attribution|Seo)' and table_name <> '_prisma_migrations'")
args=""; for t in $TABLES; do args="$args -t public.$t"; done
pg_dump -h 127.0.0.1 -p 5433 -U postgres --data-only --disable-triggers $args $SRC > "$LOGS/w9drill-growth.sql"
size=$(du -h "$LOGS/w9drill-growth.sql" | cut -f1)
P -d $DB -v ON_ERROR_STOP=1 -f "$LOGS/w9drill-growth.sql" > "$LOGS/w9drill-restore.log" 2>&1 && echo "OK   restore: growth data restored into the replayed schema ($size, $(echo $TABLES | wc -w | tr -d ' ') tables)" || { echo "FAIL restore"; tail -5 "$LOGS/w9drill-restore.log"; fail=1; }
bad=0; total=0
for t in $TABLES; do
  a=$(P -d $SRC -tAc "select count(*)||':'||coalesce(md5(string_agg(x::text, '|' order by x::text)),'') from \"${t//\"/}\" x" 2>/dev/null || echo err)
  b=$(P -d $DB -tAc "select count(*)||':'||coalesce(md5(string_agg(x::text, '|' order by x::text)),'') from \"${t//\"/}\" x" 2>/dev/null || echo err)
  total=$((total+1)); [ "$a" = "$b" ] || { bad=$((bad+1)); echo "DIFF $t src=$a restored=$b"; }
done
[ $bad = 0 ] && echo "OK   checksum: $total growth tables identical (row count and md5 of all rows) after restore" || { echo "FAIL checksum: $bad of $total tables differ"; fail=1; }
for d in kiorex clinic pharmacy lab; do P -d postgres -c "drop database if exists w9drill_$d"; done; rm -f "$LOGS/w9drill-growth.sql"
exit $fail
