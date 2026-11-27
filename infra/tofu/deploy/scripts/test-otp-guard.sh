#!/usr/bin/env bash
# Offline test of compose/kx-guard-otp.sh (no cloud): bash infra/tofu/deploy/scripts/test-otp-guard.sh. Runs the script with the host shell and, when docker is available, once more inside the same image the compose service uses.
set -uo pipefail
here="$(cd "$(dirname "$0")/../compose" && pwd)"; tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT; fails=0
run() { # expected_exit env file-content...
  local want="$1" env="$2"; shift 2; printf '%s\n' "$@" > "$tmp/p.env"
  "$here/kx-guard-otp.sh" "$env" "$tmp/p.env" >/dev/null 2>"$tmp/err"; local got=$?
  if [ "$got" = "$want" ]; then echo "ok    $env [$*] -> $got"; else echo "FAIL  $env [$*] -> $got (wanted $want): $(cat "$tmp/err")"; fails=1; fi
}
run 0  test  "ISSUER=https://passport.test.kiorex.com"                                   # mock mode is how kx-test works
run 0  test  "SMS_MODE=mock"
run 78 pilot "ISSUER=https://x"                                                          # nothing set = mock
run 78 prod  "SMS_MODE=mock" "WHATSAPP_MODE=real"
run 78 prod  "SMS_MODE=real" "WHATSAPP_MODE=mock"
run 78 prod  "SMS_MODE=real"
run 0  prod  "SMS_MODE=real" "WHATSAPP_MODE=real"
run 0  pilot "SMS_MODE=\"real\"" "WHATSAPP_MODE=REAL"
run 78 prod  "SMS_MODE=real" "WHATSAPP_MODE=real" "KX_DEV_OTP_BYPASS=true"
run 78 pilot "SMS_MODE=real" "WHATSAPP_MODE=real" "KX_DEV_ENDPOINTS=true"
run 0  pilot "SMS_MODE=real" "WHATSAPP_MODE=real" "KX_DEV_ENDPOINTS=false"
run 78 prod  "SMS_MODE=real" "WHATSAPP_MODE=real" "KX_ENV=test"
run 78 staging "SMS_MODE=real" "WHATSAPP_MODE=real"
"$here/kx-guard-otp.sh" prod /nonexistent >/dev/null 2>&1; [ $? = 64 ] && echo "ok    missing file -> 64" || { echo "FAIL missing file"; fails=1; }
# the same cases inside the image the compose service runs (busybox sh), when docker and the image are present
if command -v docker >/dev/null 2>&1 && docker image inspect caddy:2-alpine >/dev/null 2>&1; then
  d() { printf '%s\n' "$@" > "$tmp/c.env"; docker run --rm --network none -v "$here/kx-guard-otp.sh:/g/kx-guard-otp.sh:ro" -v "$tmp/c.env:/g/passport.env:ro" --entrypoint /bin/sh caddy:2-alpine /g/kx-guard-otp.sh "$ENVID" /g/passport.env >/dev/null 2>&1; }
  ENVID=prod;  d "SMS_MODE=real" "WHATSAPP_MODE=real"; [ $? = 0 ]  && echo "ok    busybox prod real -> 0"  || { echo "FAIL busybox prod real"; fails=1; }
  ENVID=prod;  d "SMS_MODE=mock" "WHATSAPP_MODE=real"; [ $? = 78 ] && echo "ok    busybox prod mock -> 78" || { echo "FAIL busybox prod mock"; fails=1; }
  ENVID=test;  d "X=1";                                [ $? = 0 ]  && echo "ok    busybox test -> 0"       || { echo "FAIL busybox test"; fails=1; }
else echo "skip  busybox cases (docker or caddy:2-alpine not present)"; fi
exit $fails

