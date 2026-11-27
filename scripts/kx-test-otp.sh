#!/usr/bin/env bash
# kx-test ONLY: print the latest one-time sign-in code that Kiorex Passport "sent" to a phone number.
#
# kx-test runs every messaging provider in MOCK mode (no SMS or WhatsApp is paid for), so Passport writes the code to its container log instead of sending
# it. This helper reads that log read-only over AWS Systems Manager with YOUR OWN AWS CLI credentials (account 990597228737) and prints only the digits.
# It cannot work in pilot or prod (the deploy guard infra/tofu/deploy/compose/kx-guard-otp.sh makes mock messaging impossible there).
#
#   scripts/kx-test-otp.sh +201000001001            wait up to 60 s for a code that is newer than the call, print it
#   scripts/kx-test-otp.sh +201000001001 --last     print the newest code of the last 20 minutes without waiting
#
# Only synthetic demo numbers exist on kx-test; do not type a real person's number. Never share a code. Limits: 5 codes per phone and 20 per IP and hour.
set -euo pipefail
phone="${1:-}"; mode="${2:-wait}"
[[ "$phone" =~ ^\+[0-9]{8,15}$ ]] || { echo "usage: $0 +<phone digits> [--last]" >&2; exit 64; }
region="${AWS_REGION:-eu-central-1}"; instance="${KX_E2E_INSTANCE:-i-0823d9ef0bcda4a52}"; container="${KX_E2E_PASSPORT_CONTAINER:-kx-test-passport-1}"
read_code() {
  local id st out
  id="$(aws ssm send-command --region "$region" --instance-ids "$instance" --document-name AWS-RunShellScript \
    --parameters "commands=[\"docker logs --since 20m $container 2>&1 | grep -F 'to=${phone} ' | tail -1 | sed -E 's/.*code=([0-9]+).*/\\\\1/'\"]" --query Command.CommandId --output text)"
  for _ in $(seq 1 30); do
    st="$(aws ssm get-command-invocation --region "$region" --command-id "$id" --instance-id "$instance" --query Status --output text 2>/dev/null || echo Pending)"
    case "$st" in Success) out="$(aws ssm get-command-invocation --region "$region" --command-id "$id" --instance-id "$instance" --query StandardOutputContent --output text)"; echo "$out" | tr -d '[:space:]'; return 0;; Failed|Cancelled|TimedOut) return 1;; esac
    sleep 1.5
  done; return 1
}
before="$(read_code || true)"
if [ "$mode" = "--last" ]; then [[ "$before" =~ ^[0-9]{4,10}$ ]] && { echo "$before"; exit 0; } || { echo "no code in the last 20 minutes for $phone" >&2; exit 1; }; fi
echo "Request the code in the app now (waiting up to 60 s)..." >&2
for _ in $(seq 1 30); do
  c="$(read_code || true)"
  if [[ "$c" =~ ^[0-9]{4,10}$ ]] && [ "$c" != "$before" ]; then echo "$c"; exit 0; fi
  sleep 2
done
echo "no new code for $phone within 60 s (check the number, and the 5 codes per hour limit)" >&2; exit 1
