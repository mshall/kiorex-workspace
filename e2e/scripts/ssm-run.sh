#!/bin/bash
# usage: ssm-run.sh '<shell command>' ; runs on the kx-test host and prints stdout
set -euo pipefail
ID=$(aws ssm send-command --region eu-central-1 --instance-ids i-0823d9ef0bcda4a52 --document-name AWS-RunShellScript --parameters "$(python3 -c 'import json,sys;print(json.dumps({"commands":[sys.argv[1]]}))' "$1")" --query Command.CommandId --output text)
for i in $(seq 1 60); do
  S=$(aws ssm get-command-invocation --region eu-central-1 --command-id $ID --instance-id i-0823d9ef0bcda4a52 --query Status --output text 2>/dev/null || echo Pending)
  case $S in Success|Failed|Cancelled|TimedOut) break;; esac; sleep 2; done
aws ssm get-command-invocation --region eu-central-1 --command-id $ID --instance-id i-0823d9ef0bcda4a52 --query StandardOutputContent --output text
echo "[status=$S]"
