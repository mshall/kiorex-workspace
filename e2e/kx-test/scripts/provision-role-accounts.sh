#!/usr/bin/env bash
# One-time (idempotent) creation of the THROWAWAY, TAGGED test accounts that the role-dashboard spec (tests/17-role-dashboards.spec.ts) signs in with. Nothing secret is printed or committed.
#
#   scripts/provision-role-accounts.sh            create the accounts and TOTP secrets if missing
#   scripts/provision-role-accounts.sh --remove   delete exactly these three accounts (and their authenticators) from Passport
#
# Accounts (synthetic, tagged data_class='TEST', names start with "[TEST] KX E2E", phones in the +20100009700 series, never a real person; none of them is a published demo account):
#   +201000009701  growth_admin    (Passport asks for the code: enrolled authenticator)
#   +201000009702  starts as a plain patient account; the SPEC grants it kiorly_ops as the super admin (that is what proves the grant screen/API)
#   +201000009703  starts as a plain patient account; the SPEC grants it kiorly_admin
# TOTP secrets are generated here and stored ONLY in AWS Secrets Manager /kx/test/e2e (keys growth_admin_totp, kiorly_ops_totp, kiorly_admin_totp), then applied to Passport by one SSM command
# on the kx-test host (the host reads the secret with its own instance role; the values never appear in the command text).
# Needs: aws CLI for account 990597228737, node.
set -euo pipefail
REGION="${AWS_REGION:-eu-central-1}"; INSTANCE="${KX_E2E_INSTANCE:-i-0823d9ef0bcda4a52}"; SECRET_ID="${KX_E2E_SECRET_ID:-/kx/test/e2e}"
MODE=create; [ "${1:-}" = "--remove" ] && MODE=remove
ssm_run() {
  local cmd; cmd=$(aws ssm send-command --region "$REGION" --instance-ids "$INSTANCE" --document-name AWS-RunShellScript --parameters "$(node -e 'process.stdout.write(JSON.stringify({commands:[process.argv[1]]}))' "$1")" --query Command.CommandId --output text)
  local st=""; for _ in $(seq 1 60); do st=$(aws ssm get-command-invocation --region "$REGION" --command-id "$cmd" --instance-id "$INSTANCE" --query Status --output text 2>/dev/null || true); case "$st" in Success|Failed|Cancelled|TimedOut) break;; esac; sleep 2; done
  aws ssm get-command-invocation --region "$REGION" --command-id "$cmd" --instance-id "$INSTANCE" --query '[Status,StandardOutputContent,StandardErrorContent]' --output text
  [ "$st" = "Success" ]
}
if [ "$MODE" = remove ]; then
  ssm_run 'psql_() { docker exec -i kx-test-postgres-1 psql -U postgres -d passport -v ON_ERROR_STOP=1 -q -c "$1"; }
for sub in kx_e2e_growth_admin kx_e2e_kiorly_ops kx_e2e_kiorly_admin; do
  psql_ "DELETE FROM totp_credentials WHERE sub='"'"'$sub'"'"'"; psql_ "DELETE FROM accounts WHERE sub='"'"'$sub'"'"' AND data_class='"'"'TEST'"'"'"; echo "removed $sub"
done'
  exit $?
fi
KEYS="growth_admin_totp kiorly_ops_totp kiorly_admin_totp"
tmp="$(mktemp)"; chmod 600 "$tmp"; trap 'rm -f "$tmp"' EXIT
CURRENT="$(aws secretsmanager get-secret-value --region "$REGION" --secret-id "$SECRET_ID" --query SecretString --output text)"
KX_KEYS="$KEYS" KX_CURRENT="$CURRENT" node -e '
const c=require("crypto");const A="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";const gen=()=>{let b="";for(const x of c.randomBytes(20))b+=x.toString(2).padStart(8,"0");let o="";for(let i=0;i+5<=b.length;i+=5)o+=A[parseInt(b.slice(i,i+5),2)];return o};
const cur=JSON.parse(process.env.KX_CURRENT);let added=0;for(const k of process.env.KX_KEYS.split(" ")){if(!cur[k]){cur[k]=gen();added++}}
require("fs").writeFileSync(process.argv[1],JSON.stringify(cur));process.stderr.write("keys added: "+added+"\n")' "$tmp"
aws secretsmanager put-secret-value --region "$REGION" --secret-id "$SECRET_ID" --secret-string "file://$tmp" >/dev/null && echo "secret $SECRET_ID updated"
ssm_run 'set -e
SEC=$(aws secretsmanager get-secret-value --region '"$REGION"' --secret-id '"$SECRET_ID"' --query SecretString --output text)
psql_() { docker exec -i kx-test-postgres-1 psql -U postgres -d passport -v ON_ERROR_STOP=1 -q -c "$1" >/dev/null; }
mk() { sub=$1; phone=$2; name=$3; roles=$4; key=$5; val=$(echo "$SEC" | jq -r ".$key"); case "$val" in ""|null) echo "missing $key"; exit 1;; esac
  psql_ "INSERT INTO accounts (sub, phone, phone_verified, name, locale, roles, data_class) VALUES ('"'"'$sub'"'"', '"'"'$phone'"'"', true, '"'"'$name'"'"', '"'"'en'"'"', '"'"'$roles'"'"'::jsonb, '"'"'TEST'"'"') ON CONFLICT (sub) DO NOTHING"
  psql_ "INSERT INTO totp_credentials (sub, secret, confirmed_at) VALUES ('"'"'$sub'"'"', '"'"'$val'"'"', now()) ON CONFLICT (sub) DO UPDATE SET secret=EXCLUDED.secret, last_step=0, confirmed_at=COALESCE(totp_credentials.confirmed_at, now())"
  echo "ensured $sub"; }
mk kx_e2e_growth_admin +201000009701 "[TEST] KX E2E Growth admin" "[\"growth_admin\"]" growth_admin_totp
mk kx_e2e_kiorly_ops +201000009702 "[TEST] KX E2E Kiorly ops" "[\"patient\"]" kiorly_ops_totp
mk kx_e2e_kiorly_admin +201000009703 "[TEST] KX E2E Kiorly admin" "[\"patient\"]" kiorly_admin_totp'
