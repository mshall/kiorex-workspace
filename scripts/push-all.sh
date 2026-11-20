#!/bin/bash
# Pushes committed work of every Kiorex v2 repo to GitHub (founder-authorised 19 Nov 2026).
# Safe by design: pushes only what is already committed, never force-pushes, never touches main of
# clinics-management, skips a repo if a secret pattern is found in tracked files.
# If the remote branch moved (founder pushes from another checkout), it merges in a temp worktree so the
# working tree that agents are editing is never disturbed; run `git merge --ff-only origin/<branch>` later.
# Compatible with macOS bash 3.2.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPOS="clinics-management:kiorex kiorex-contracts:main kiorex-platform:main kiorex-account:main kiorly-pharmacy:main kiorly-lab:main"

for pair in $REPOS; do
  r="${pair%%:*}"; b="${pair##*:}"; d="$ROOT/$r"
  [ -d "$d/.git" ] || continue
  cur="$(git -C "$d" branch --show-current)"
  if [ "$cur" != "$b" ]; then echo "SKIP $r: on '$cur', expected '$b'"; continue; fi
  if git -C "$d" grep -qE 'AKIA[0-9A-Z]{16}|BEGIN (RSA |EC )?PRIVATE KEY' -- . ':!*.md' ':!**/test/**' 2>/dev/null; then
    echo "SKIP $r: possible secret in tracked files"; continue; fi
  if [ -z "$(git -C "$d" rev-list --max-count=1 HEAD 2>/dev/null)" ]; then echo "SKIP $r: no commits"; continue; fi
  git -C "$d" fetch -q origin "$b" 2>/dev/null || true
  if git -C "$d" rev-parse -q --verify "origin/$b" >/dev/null && ! git -C "$d" merge-base --is-ancestor "origin/$b" HEAD; then
    wt="$ROOT/.wt-push-$r"; rm -rf "$wt"; git -C "$d" worktree prune
    git -C "$d" worktree add -q --detach "$wt" HEAD
    if git -C "$wt" merge --no-edit "origin/$b" >/dev/null 2>&1; then
      echo "== push $r ($b) via merge worktree"; git -C "$wt" push origin "HEAD:$b" 2>&1 | tail -1
    else
      echo "CONFLICT $r: remote moved and merge conflicts — needs manual resolution"; git -C "$wt" merge --abort 2>/dev/null
    fi
    git -C "$d" worktree remove --force "$wt"
  else
    echo "== push $r ($b)"; git -C "$d" push -u origin "$b" 2>&1 | tail -1
  fi
done
