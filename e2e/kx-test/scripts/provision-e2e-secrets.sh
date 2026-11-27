#!/usr/bin/env bash
# One-time (idempotent) provisioning of the secrets the kx-test e2e suite needs. Nothing secret is printed or written to git.
#
#   scripts/provision-e2e-secrets.sh            create /kx/test/e2e if missing and apply it to Passport
#   scripts/provision-e2e-secrets.sh --rotate   generate new TOTP secrets and apply them
#
# What it does
#  1. Generates a fresh random TOTP secret for each privileged demo account (ops_admin +201000009001, finance +201000009002, super_admin +201000000099, Pharmacy owner +201000002007,
#     Lab owner +201000002010) and stores them ONLY in AWS Secrets Manager as /kx/test/e2e (JSON). The Passport demo seed enrolled the ops accounts with the PUBLISHED dev TOTP secrets
#     (public repository); this replaces them. Existing keys are kept unless --rotate.
#  2. Gives the two OWNER accounts the Passport `owner` role so Passport demands TOTP at their sign-in (see the comment in the remote script), then runs one SSM command on the kx-test host that reads the secret with the host's own instance role and updates Passport's totp_credentials. The secret values never
#     appear in the SSM command text or its history, only the names of the variables.
# Needs: aws CLI with access to account 990597228737, node.
set -euo pipefail
REGION="${AWS_REGION:-eu-central-1}"; INSTANCE="${KX_E2E_INSTANCE:-i-0823d9ef0bcda4a52}"; SECRET_ID="${KX_E2E_SECRET_ID:-/kx/test/e2e}"
ROTATE=0; [ "${1:-}" = "--rotate" ] && ROTATE=1

b32() { node -e 'const c=require("crypto");const A="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";let b="";for(const x of c.randomBytes(20))b+=x.toString(2).padStart(8,"0");let o="";for(let i=0;i+5<=b.length;i+=5)o+=A[parseInt(b.slice(i,i+5),2)];process.stdout.write(o)'; }

KEYS="ops_admin_totp finance_totp super_admin_totp pharmacy_owner_totp lab_owner_totp"
tmp="$(mktemp)"; chmod 600 "$tmp"; trap 'rm -f "$tmp"' EXIT
exists=0; aws secretsmanager describe-secret --region "$REGION" --secret-id "$SECRET_ID" >/dev/null 2>&1 && exists=1
# merge: keep existing keys (unless --rotate), generate the missing ones; the JSON is built in a file, never on a command line
CURRENT='{}'; if [ "$exists" = 1 ] && [ "$ROTATE" = 0 ]; then CURRENT="$(aws secretsmanager get-secret-value --region "$REGION" --secret-id "$SECRET_ID" --query SecretString --output text)"; fi
KX_KEYS="$KEYS" KX_CURRENT="$CURRENT" node -e '
const c=require("crypto");const A="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";const gen=()=>{let b="";for(const x of c.randomBytes(20))b+=x.toString(2).padStart(8,"0");let o="";for(let i=0;i+5<=b.length;i+=5)o+=A[parseInt(b.slice(i,i+5),2)];return o};
const cur=JSON.parse(process.env.KX_CURRENT);let added=0;for(const k of process.env.KX_KEYS.split(" ")){if(!cur[k]){cur[k]=gen();added++}}
cur.note="kx-test e2e only (synthetic demo accounts); managed by e2e/kx-test/scripts/provision-e2e-secrets.sh";
require("fs").writeFileSync(process.argv[1],JSON.stringify(cur));process.stderr.write("keys added: "+added+"\n")' "$tmp"
if [ "$exists" = 0 ]; then aws secretsmanager create-secret --region "$REGION" --name "$SECRET_ID" --description "kx-test e2e suite: TOTP secrets of synthetic demo accounts (no real people)" --secret-string "file://$tmp" >/dev/null && echo "secret $SECRET_ID created"
else aws secretsmanager put-secret-value --region "$REGION" --secret-id "$SECRET_ID" --secret-string "file://$tmp" >/dev/null && echo "secret $SECRET_ID updated"; fi

REMOTE='set -e
SEC=$(aws secretsmanager get-secret-value --region '"$REGION"' --secret-id '"$SECRET_ID"' --query SecretString --output text)
psql_() { docker exec -i kx-test-postgres-1 psql -U postgres -d passport -v ON_ERROR_STOP=1 -q -c "$1" >/dev/null; }
for pair in 01HZKXD0000000000000009001:ops_admin_totp 01HZKXD0000000000000009002:finance_totp 01HZKX00000000000000000099:super_admin_totp 01HZKXD0000000000000002007:pharmacy_owner_totp 01HZKXD0000000000000002010:lab_owner_totp; do
  sub=${pair%%:*}; key=${pair##*:}; val=$(echo "$SEC" | jq -r ".$key")
  case "$val" in ""|null) echo "missing $key"; exit 1;; esac
  psql_ "INSERT INTO totp_credentials (sub, secret, confirmed_at) VALUES ('"'"'$sub'"'"', '"'"'$val'"'"', now()) ON CONFLICT (sub) DO UPDATE SET secret=EXCLUDED.secret, last_step=0, confirmed_at=COALESCE(totp_credentials.confirmed_at, now())"
  echo "totp applied for $key"
done
# Passport asks for the second factor at sign-in only for accounts that hold a role of mfaPolicy.requiredForRoles (owner, admin, finance, ops_admin, super_admin). The two demo OWNER accounts had only the patient role, so their sign-in never produced an MFA claim and the products (correctly) answered MFA_REQUIRED. Adding the owner role makes Passport demand TOTP for them: a stricter rule, not a weaker one.
for sub in 01HZKXD0000000000000002007 01HZKXD0000000000000002010; do
  psql_ "UPDATE accounts SET roles = roles || '"'"'[\"owner\"]'"'"'::jsonb WHERE sub='"'"'$sub'"'"' AND NOT (roles ? '"'"'owner'"'"')"
  echo "owner role ensured for $sub"
done'
CMD_ID=$(aws ssm send-command --region "$REGION" --instance-ids "$INSTANCE" --document-name AWS-RunShellScript --parameters "$(node -e 'process.stdout.write(JSON.stringify({commands:[process.argv[1]]}))' "$REMOTE")" --query Command.CommandId --output text)
for _ in $(seq 1 60); do
  st=$(aws ssm get-command-invocation --region "$REGION" --command-id "$CMD_ID" --instance-id "$INSTANCE" --query Status --output text 2>/dev/null || true)
  case "$st" in Success|Failed|Cancelled|TimedOut) break;; esac; sleep 2
done
aws ssm get-command-invocation --region "$REGION" --command-id "$CMD_ID" --instance-id "$INSTANCE" --query '[Status,StandardOutputContent,StandardErrorContent]' --output text
[ "$st" = "Success" ]
