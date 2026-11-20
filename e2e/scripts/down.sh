#!/usr/bin/env bash
# Stop the stack by listener port (workspace services only: 3010, 4000, 4400, 3100, 3200). Never touches :3000.
for pair in kiorly:3010 kiorex:4000 passport:4400 pharmacy:3100 lab:3200; do
  p=$(lsof -nP -iTCP:"${pair##*:}" -sTCP:LISTEN -t 2>/dev/null | head -1)
  [ -n "$p" ] && kill "$p" && echo "stopped ${pair%%:*} ($p)" || echo "${pair%%:*} not running"
done
