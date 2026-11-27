#!/usr/bin/env bash
# Daily logical backup: one pg_dump per product database, gzip, uploaded to the encrypted backup bucket; the bucket lifecycle expires
# old dumps. Disk-level protection is separate (snapshot policy on the data volume). Skipped when the database is managed (its own backups).
. /usr/local/lib/kx/kx-lib.sh
[ "$KX_DB_MODE" = "host" ] || { kx_log "managed database: provider backups apply"; exit 0; }
day="$(date -u +%F)"; dir=/srv/kx/backup-staging; mkdir -p "$dir"; ok=1
for db in $KX_DATABASES; do
  f="$dir/${db}-${day}.sql.gz"
  if docker exec "kx-${KX_ENV}-postgres-1" pg_dump -U postgres --no-owner --format=plain "$db" | gzip -9 > "$f" && [ -s "$f" ]; then
    kx_obj_put "$f" "dumps/${KX_ENV}/${db}/${day}.sql.gz" "$KX_BACKUP_BUCKET" || ok=0
  else ok=0; fi
  rm -f "$f"
done
kx_metric BackupOk "$ok"
[ "$ok" = 1 ] || { kx_log "backup FAILED"; exit 1; }
kx_log "backup ok for $KX_DATABASES"
