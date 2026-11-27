#!/usr/bin/env bash
# Offline test of the deploy.sh guards (no cloud): bash infra/tofu/deploy/scripts/test-deploy-guards.sh
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; fails=0
t() { # name expected_exit registry
  KX_OFFLINE=1 DEPLOY_BUCKET=none KX_REGISTRY="$3" bash "$here/deploy.sh" test --dry-run --tag platform=t --tag passport=t --tag pharmacy-api=t --tag lab-api=t >/dev/null 2>&1; rc=$?
  if [ "$rc" = "$2" ]; then echo "ok   $1"; else echo "FAIL $1 (exit $rc, wanted $2)"; fails=$((fails+1)); fi
}
t "display name without dot or slash is refused" 65 "kx-test"
t "full registry URL passes" 0 "123456789012.dkr.ecr.eu-central-1.amazonaws.com/kx-test"
t "local registry with slash passes" 0 "registry.local/kx"
exit $fails
