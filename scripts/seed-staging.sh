#!/usr/bin/env bash
# Seeds the synthetic DEMO dataset into the AWS STAGING stacks, in dependency order (Q10 Part B). NON-PRODUCTION ONLY.
#   1 Passport (Cognito users)  2 Kiorly Clinic  3 Kiorly Pharmacy  4 Kiorly Lab  5 Kiorex provider sync  6 Kiorex demo data
# Run it by hand AFTER a human deployed staging and pushed the seed images (apps/api/Dockerfile.seed -> <name>-seed ECR repos; see each repo's infra/tofu/README.md).
# It never deploys or changes infrastructure: it only invokes the demo-seed Lambdas (tofu output `demo_seed_function_name`) and the Cognito seed script.
#
#   scripts/seed-staging.sh --dry-run                 print the plan only (no AWS, no tofu, nothing runs)
#   scripts/seed-staging.sh --yes [--reset]           run all steps (--reset removes and re-creates the demo records only)
#   scripts/seed-staging.sh --yes --only lab,kiorex   run selected steps: passport,clinic,pharmacy,lab,kiorex-sync,kiorex
# Overrides (instead of tofu outputs): PASSPORT_POOL_ID FN_CLINIC FN_PHARMACY FN_LAB FN_PLATFORM CLINIC_URL LAB_URL  (CLINIC_URL = Kiorly Clinic origin, LAB_URL = Lab origin)
# AWS: AWS_PROFILE (default aws-kiorex-profile), AWS_REGION (default eu-central-1). Refuses any account except the staging one (STAGING_ACCOUNT_ID, default 599243104052).
# The same file lives in kiorex-platform/scripts/. Sibling repos are found next to it (workspace root) or one level up.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -d "$HERE/../clinics-management" ]; then ROOT="$(cd "$HERE/.." && pwd)"; elif [ -d "$HERE/../../clinics-management" ]; then ROOT="$(cd "$HERE/../.." && pwd)"; else ROOT="${WORKSPACE_ROOT:-$(cd "$HERE/.." && pwd)}"; fi
DRY=0; YES=0; RESET=false; ONLY=""; SKIP=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;; --yes) YES=1 ;; --reset) RESET=true ;;
    --only) ONLY="$2"; shift ;; --skip) SKIP="$2"; shift ;;
    -h|--help) sed -n 2,16p "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac; shift
done
export AWS_PROFILE="${AWS_PROFILE:-aws-kiorex-profile}" AWS_REGION="${AWS_REGION:-eu-central-1}" AWS_DEFAULT_REGION="${AWS_REGION:-eu-central-1}"
STAGING_ACCOUNT_ID="${STAGING_ACCOUNT_ID:-599243104052}"
STEPS=(passport clinic pharmacy lab kiorex-sync kiorex)
want() { local s="$1"; if [ -n "$ONLY" ]; then case ",$ONLY," in *",$s,"*) ;; *) return 1 ;; esac; fi; case ",$SKIP," in *",$s,"*) return 1 ;; esac; return 0; }
STACK="infra/tofu/live/staging/frankfurt"
dir_of() { case "$1" in passport) echo "$ROOT/kiorex-account/$STACK/kiorex-account" ;; clinic) echo "$ROOT/clinics-management/$STACK/kiorly-clinic" ;; pharmacy) echo "$ROOT/kiorly-pharmacy/$STACK/kiorly-pharmacy" ;; lab) echo "$ROOT/kiorly-lab/$STACK/kiorly-lab" ;; platform) echo "$ROOT/kiorex-platform/$STACK/kiorex-platform" ;; esac; }
# staging stack directories live under infra/tofu/live/staging/..., never prod
case "$(dir_of clinic)" in *"/live/staging/"*) ;; *) echo "refusing: not a staging stack path" >&2; exit 1 ;; esac
tofu_out() { (cd "$(dir_of "$1")" && tofu output -raw "$2" 2>/dev/null) || true; }

describe() { # step -> human description of the command it runs
  case "$1" in
    passport)    echo "DEMO_SEED_ALLOWED=true KIORLY_ENV=staging node kiorex-account/scripts/seed-cognito-demo.mjs --user-pool-id <${PASSPORT_POOL_ID:-tofu output user_pool_id (kiorex-account staging)}> --out \$WORK/cognito-sub-map.json   (creates the demo users in the staging Cognito pool; writes phone -> Cognito sub)" ;;
    clinic)      echo "aws lambda invoke --function-name <${FN_CLINIC:-tofu output demo_seed_function_name (kiorly-clinic staging)}> --payload {reset:$RESET, env:{DEMO_SUB_MAP_JSON}}   (migrate -> base seed -> demo seed: Kiorly Clinic + Nurse edition tenants)" ;;
    pharmacy)    echo "aws lambda invoke --function-name <${FN_PHARMACY:-tofu output demo_seed_function_name (kiorly-pharmacy staging)}> --payload {reset:$RESET, env:{DEMO_SUB_MAP_JSON}}   (migrate -> base seed -> demo seed)" ;;
    lab)         echo "aws lambda invoke --function-name <${FN_LAB:-tofu output demo_seed_function_name (kiorly-lab staging)}> --payload {reset:$RESET}   (migrate -> base seed -> demo seed incl. KNLAB01 nurse samples; the response carries the hand-off for step 6)" ;;
    kiorex-sync) echo "aws lambda invoke --function-name <${FN_PLATFORM:-tofu output demo_seed_function_name (kiorex-platform staging)}> --payload {steps:[migrate,base,sync], env:{KIORLY_BASE_URL}}   (Kiorex pulls the providers from Kiorly Clinic; needs the egress path HB07)" ;;
    kiorex)      echo "aws lambda invoke --function-name <${FN_PLATFORM:-tofu output demo_seed_function_name (kiorex-platform staging)}> --payload {steps:[demo], reset:$RESET, env:{DEMO_SUB_MAP_JSON, DEMO_HANDOFF_JSON, KIORLY_BASE_URL, LAB_BASE_URL}}   (patients, bookings, ledger, home visits, nurse-lab relay + push back to the clinic)" ;;
  esac
}

echo "Kiorex v2 STAGING demo seed (non-production only). AWS profile=$AWS_PROFILE region=$AWS_REGION reset=$RESET"
n=0; for s in "${STEPS[@]}"; do if want "$s"; then n=$((n+1)); printf '  %d. [%s] %s\n' "$n" "$s" "$(describe "$s")"; fi; done
if [ "$DRY" = 1 ]; then echo "(dry run: nothing was executed)"; exit 0; fi
if [ "$YES" != 1 ]; then read -r -p "Seed these STAGING stacks now? Type 'staging' to continue: " ans; [ "$ans" = "staging" ] || { echo "aborted"; exit 1; }; fi

command -v aws >/dev/null || { echo "aws CLI is required" >&2; exit 1; }
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
[ "$ACCOUNT" = "$STAGING_ACCOUNT_ID" ] || { echo "refusing: AWS account $ACCOUNT is not the staging account ($STAGING_ACCOUNT_ID)" >&2; exit 1; }
WORK="${SEED_WORK_DIR:-$ROOT/.seed}"; mkdir -p "$WORK"; chmod 700 "$WORK"
export KIORLY_ENV=staging DEMO_SEED_ALLOWED=true
SUBMAP="{}"; HANDOFF="{}"
SEED_NOW="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"   # one instant for the Kiorly and Kiorex home-visit seeds (live visits are relative to it)
jsonq() { node -e 'const j=JSON.parse(require("fs").readFileSync(0,"utf8")); const v=process.argv[1].split(".").reduce((a,k)=>a?.[k],j); process.stdout.write(typeof v==="string"?v:JSON.stringify(v??null))' "$1"; }
invoke() { # <function> <json payload> <out file>; fails on a Lambda error or ok:false
  local fn="$1" payload="$2" out="$3"
  aws lambda invoke --function-name "$fn" --cli-read-timeout 900 --cli-binary-format raw-in-base64-out --payload "$payload" "$out" >"$out.meta"
  if grep -q '"FunctionError"' "$out.meta"; then echo "Lambda $fn failed:" >&2; cat "$out" >&2; exit 1; fi
  [ "$(jsonq ok <"$out")" = "true" ] || { echo "seed $fn reported failure:" >&2; cat "$out" >&2; exit 1; }
  jsonq steps <"$out"; echo
}
payload() { node -e 'const [reset,steps,...kv]=process.argv.slice(1); const env={}; for(const p of kv){const i=p.indexOf("="); if(i>0&&p.slice(i+1)) env[p.slice(0,i)]=p.slice(i+1);} const o={reset:reset==="true",env}; if(steps) o.steps=steps.split(","); process.stdout.write(JSON.stringify(o))' "$@"; }

for s in "${STEPS[@]}"; do
  want "$s" || continue
  echo; echo "==> $s"
  case "$s" in
    passport)
      POOL="${PASSPORT_POOL_ID:-$(tofu_out passport user_pool_id)}"; [ -n "$POOL" ] || { echo "no user pool id (tofu output user_pool_id / PASSPORT_POOL_ID)" >&2; exit 1; }
      RESETARG=""; [ "$RESET" = true ] && RESETARG="--reset"
      (cd "$ROOT/kiorex-account" && node scripts/seed-cognito-demo.mjs --user-pool-id "$POOL" --region "$AWS_REGION" --out "$WORK/cognito-sub-map.json" $RESETARG) ;;
    clinic)   FN="${FN_CLINIC:-$(tofu_out clinic demo_seed_function_name)}"; [ -n "$FN" ] || { echo "no clinic seed function" >&2; exit 1; }
              [ -f "$WORK/cognito-sub-map.json" ] && SUBMAP="$(cat "$WORK/cognito-sub-map.json")"
              invoke "$FN" "$(payload "$RESET" "" "DEMO_SUB_MAP_JSON=$SUBMAP" "DEMO_SEED_NOW=$SEED_NOW")" "$WORK/clinic.json" ;;
    pharmacy) FN="${FN_PHARMACY:-$(tofu_out pharmacy demo_seed_function_name)}"; [ -n "$FN" ] || { echo "no pharmacy seed function" >&2; exit 1; }
              [ -f "$WORK/cognito-sub-map.json" ] && SUBMAP="$(cat "$WORK/cognito-sub-map.json")"
              invoke "$FN" "$(payload "$RESET" "" "DEMO_SUB_MAP_JSON=$SUBMAP")" "$WORK/pharmacy.json" ;;
    lab)      FN="${FN_LAB:-$(tofu_out lab demo_seed_function_name)}"; [ -n "$FN" ] || { echo "no lab seed function" >&2; exit 1; }
              invoke "$FN" "$(payload "$RESET" "")" "$WORK/lab.json"
              jsonq handoff <"$WORK/lab.json" >"$WORK/lab-handoff.json" ;;
    kiorex-sync)
              FN="${FN_PLATFORM:-$(tofu_out platform demo_seed_function_name)}"; [ -n "$FN" ] || { echo "no kiorex seed function" >&2; exit 1; }
              CLINIC_ORIGIN="${CLINIC_URL:-$(tofu_out clinic app_url)}"
              invoke "$FN" "$(payload false "migrate,base,sync" "KIORLY_BASE_URL=${CLINIC_ORIGIN:+$CLINIC_ORIGIN/marketplace/v1}")" "$WORK/kiorex-sync.json" ;;
    kiorex)   FN="${FN_PLATFORM:-$(tofu_out platform demo_seed_function_name)}"; [ -n "$FN" ] || { echo "no kiorex seed function" >&2; exit 1; }
              CLINIC_ORIGIN="${CLINIC_URL:-$(tofu_out clinic app_url)}"; LAB_ORIGIN="${LAB_URL:-$(tofu_out lab app_url)}"
              [ -f "$WORK/cognito-sub-map.json" ] && SUBMAP="$(cat "$WORK/cognito-sub-map.json")"
              [ -s "$WORK/lab-handoff.json" ] && HANDOFF="$(cat "$WORK/lab-handoff.json")"
              invoke "$FN" "$(payload "$RESET" "demo" "DEMO_SUB_MAP_JSON=$SUBMAP" "DEMO_HANDOFF_JSON=$HANDOFF" "KIORLY_BASE_URL=${CLINIC_ORIGIN:+$CLINIC_ORIGIN/marketplace/v1}" "LAB_BASE_URL=$LAB_ORIGIN" "DEMO_SEED_NOW=$SEED_NOW")" "$WORK/kiorex.json" ;;
  esac
done
echo; echo "Staging demo data seeded. Logins and where to click: TEST_DATA.md -> 'Seeding staging on AWS'."
