#!/bin/sh
# Deploy guard: one-time Passport codes must never reach a container log outside a hosted TEST environment.
#
# WHY: Passport in mock messaging mode (SMS_MODE / WHATSAPP_MODE unset or "mock") writes every one-time code to its stdout as
#   [otp-sender:log] to=<phone> locale=<l> code=<code> (dev only)
# On kx-test that is deliberate: the live e2e suite reads the code with a read-only `docker logs` over SSM (e2e/kx-test/lib/aws.ts) because the test
# environment holds synthetic and tagged-dummy data and no real SMS provider is paid for. In pilot and prod a code in a log is an account takeover for anyone
# who can read logs, so those environments must not be able to run in that mode at all.
#
# HOW IT RUNS: as the one-shot compose service `otp-guard` (docker-compose.yml, image caddy:2-alpine which is already on the host, POSIX sh) that `passport` depends on with
# condition service_completed_successfully, so it ships inside every release bundle (the host bootstrap scripts are never re-delivered to a running host) and a refusal stops
# Passport from starting and fails `docker compose up` ("release unhealthy"). It reads the rendered /opt/kx/env/passport.env read-only.
#
#   kx-guard-otp.sh <env> <passport.env>     exit 0 = allowed, exit 78 = refused (the deploy stops before any container is touched)
#
# Rules (pilot and prod only; "test" is allowed to stay in mock mode, and says so in the deploy log):
#   * SMS_MODE=real and WHATSAPP_MODE=real must both be present (a missing value means mock);
#   * KX_DEV_OTP_BYPASS and KX_DEV_ENDPOINTS (the dev inbox, which also lists codes) must not be "true";
#   * KX_ENV in the Passport environment must not be "test" or "dev" (a copied test env file).
# Anything but test, pilot or prod is refused. Testable offline: deploy/scripts/test-otp-guard.sh (also run by infra/tofu/scripts/validate-all.sh).
set -u
env_id="${1:-}"; file="${2:-}"
log() { printf 'kx-guard-otp: %s\n' "$*" >&2; }
[ -n "$env_id" ] && [ -f "$file" ] || { log "usage: kx-guard-otp.sh <test|pilot|prod> <passport.env>"; exit 64; }
val() { grep -E "^$1=" "$file" | tail -1 | cut -d= -f2- | tr -d '"' | tr 'A-Z' 'a-z'; }
case "$env_id" in
  test)
    sms="$(val SMS_MODE)"; wa="$(val WHATSAPP_MODE)"
    if [ "$sms" != real ] || [ "$wa" != real ]; then log "test: Passport is in mock messaging mode, so one-time codes are written to its container log (intended on kx-test; never allowed in pilot or prod)"; fi
    exit 0 ;;
  pilot|prod) ;;
  *) log "unknown environment '$env_id'"; exit 78 ;;
esac
bad=0
for k in SMS_MODE WHATSAPP_MODE; do [ "$(val $k)" = real ] || { log "$env_id: $k must be 'real' (mock mode writes one-time codes to the container log)"; bad=1; }; done
for k in KX_DEV_OTP_BYPASS KX_DEV_ENDPOINTS; do [ "$(val $k)" = true ] && { log "$env_id: $k=true is not allowed (the demo code and the dev inbox expose one-time codes)"; bad=1; }; done
case "$(val KX_ENV)" in test|dev|development|local) log "$env_id: KX_ENV in the Passport environment says '$(val KX_ENV)'"; bad=1 ;; esac
[ "$bad" = 0 ] || { log "refusing to start Passport in $env_id: see infra/tofu/README.md, section 'One-time codes in logs'"; exit 78; }
exit 0
