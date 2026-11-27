#!/usr/bin/env bash
# Waits for the separately attached, encrypted data volume, formats it ONLY if it has no filesystem, mounts it at /srv/kx.
# Never formats a volume that already has data (a replaced host re-attaches the same volume and keeps its database).
set -euo pipefail
. /etc/kx/host.env
MNT=/srv/kx
if [ "$KX_DB_MODE" != "host" ]; then # managed database: no data volume, only scratch space on the root disk
  mkdir -p "$MNT/vault" "$MNT/backup-staging"; chown 1000:1000 "$MNT/vault"; exit 0
fi
mountpoint -q "$MNT" && exit 0
root_src="$(findmnt -n -o SOURCE /)"; root_disk="$(lsblk -no PKNAME "$root_src" 2>/dev/null | head -1)"
for _ in $(seq 1 90); do
  dev="$(lsblk -dpno NAME,TYPE | awk '$2=="disk"{print $1}' | grep -v "/${root_disk}$" | head -1 || true)"
  [ -n "${dev:-}" ] && break
  sleep 5
done
[ -n "${dev:-}" ] || { echo "no data volume attached after 450 s" >&2; exit 1; }
if ! blkid "$dev" >/dev/null 2>&1; then mkfs.ext4 -L kxdata "$dev"; fi
mkdir -p "$MNT"
uuid="$(blkid -s UUID -o value "$dev")"
grep -q "$uuid" /etc/fstab || echo "UUID=$uuid $MNT ext4 defaults,nofail,noatime 0 2" >> /etc/fstab
mount "$MNT"
mkdir -p "$MNT/pgdata" "$MNT/vault" "$MNT/backup-staging"
chmod 700 "$MNT/pgdata"
chown 1000:1000 "$MNT/vault" # the Node images run as uid 1000
