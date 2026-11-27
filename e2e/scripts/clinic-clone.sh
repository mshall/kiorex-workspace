#!/usr/bin/env bash
# Creates or refreshes the THROW-AWAY Clinic clone the isolated stacks (sec-stack.sh, nurse-lab-stack.sh) build from, so nothing is ever built, generated or written in the
# founder's checkout (clinics-management). It is a local `git clone` (read-only on the source: it only reads objects) of branch `kiorex` into .e2e/clinic-clone, with its own node_modules.
#   scripts/clinic-clone.sh            create, or fast-forward to the source's kiorex tip and re-install only when the lockfile changed
# The clone has no remote and is git-ignored (.e2e/). Remove it with:  rm -rf .e2e/clinic-clone
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; DEST="$ROOT/.e2e/clinic-clone"
export PATH="$HOME/.local/node-26/node-v26.13.1-darwin-arm64/bin:$PATH"
mkdir -p "$ROOT/.e2e"
if [ ! -d "$DEST/.git" ]; then
  git clone -q --no-hardlinks --branch kiorex "$ROOT/clinics-management" "$DEST"
  git -C "$DEST" remote remove origin
  (cd "$DEST" && npm ci --no-audit --no-fund --ignore-scripts)
else
  before="$(git -C "$DEST" rev-parse HEAD:package-lock.json)"
  git -C "$DEST" fetch -q "$ROOT/clinics-management" kiorex && git -C "$DEST" reset -q --hard FETCH_HEAD
  [ "$before" = "$(git -C "$DEST" rev-parse HEAD:package-lock.json)" ] || (cd "$DEST" && npm ci --no-audit --no-fund --ignore-scripts)
fi
# the workspace library the Clinic API imports must be built (dist is git-ignored)
(cd "$DEST" && npm run build -w @kiorly/field-visit >/dev/null)
echo "clinic clone at $DEST ($(git -C "$DEST" log --oneline -1))"
