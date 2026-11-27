# kx-test release: MFA policy and no published demo TOTP secrets (27 Nov 2026, evening)

No secret values here. The AWS Clinic stack (E1DE0H2K3M17YL, its RDS and App Runner) and every Clinic-related tofu module were not touched; no tofu was applied. Redeploying Passport, Pharmacy and Lab was approved by the founder.

## What was released

| Service | Change | Artefact |
|---|---|---|
| Passport | MFA policy (tables `mfa_policy`, `mfa_policy_changes` created by the idempotent migration at start-up; `/api/ops/mfa-policy*`; Ops, MFA policy page; sign-in offers the code to enrolled people and enforces it where the policy says); no TOTP is loaded from the seed on a hosted start | image `kx-test/passport:04ca9f7f` (kiorex-account `04ca9f7`), release applied with `infra/tofu/deploy/scripts/deploy.sh test --tag passport=04ca9f7f` |
| Pharmacy web | friendly screen for `403 MFA_REQUIRED` with the link to Passport Security (EN/AR) | static build of kiorly-pharmacy `118329d`, synced to `kx-test-site-kiorly-pharmacies-990597228737`, CloudFront `E3G9V72X5CEJC2` invalidated |
| Lab web | same | static build of kiorly-lab `b5006d6`, synced to `kx-test-site-kiorly-labs-990597228737`, CloudFront `E2L76Q76R1IOYS` invalidated |
| Pharmacy API, Lab API, platform | unchanged (`5c458fd6`, `a38ec5e6`, `2958d42c`) | |

## Incident during the release (fixed, no lasting effect)

The first `deploy.sh` run produced a release whose `urls/*.env` files were EMPTY, so Passport refused to start ("ISSUER must be the final public https URL") and was down for about three minutes. Cause: the script was run from `/tmp/...` on macOS, where `/tmp` is a symlink to `/private/tmp`; `_docs/registry/validate-registry.mjs` decides whether it is the entry point by comparing `path.resolve(argv[1])` with the real path of the module, so under a symlinked path it printed nothing and the host rendered Passport without `ISSUER`. The previous release was restored with `deploy.sh test --rollback` (healthz 200 again), then the release was redone from the real path `/private/tmp/...` with non-empty url files. Why it was exported at all: the working tree of the workspace held another agent's uncommitted edits to `deploy.sh` and `docker-compose.yml` (OTP guard), so the release was built from `git archive HEAD` instead. Follow-up for the deploy tooling (not changed here): make `validate-registry.mjs` compare real paths (`fs.realpathSync`) and let `deploy.sh` fail when a url env file is empty.

## Verification (live hostnames)

- `https://passport.test.kiorex.com/healthz` 200 after the release; the Passport account site serves the new page `/account/ops/mfa` for ops.
- Policy default on kx-test: OFF (`mfa_policy` empty, optional for everybody). The live spec switched it on for one organisation and back off; the final state was asserted by a read-only database query (policy disabled, the demo pharmacist has no authenticator row). The change history (maker `+201000009001`, checker `+201000009002`) stays in `mfa_policy_changes` and the hash-chained audit log.
- Old demo TOTP secrets: for each of the three ops accounts the phone code was real and the code computed from the OLD secret was refused by Passport ("Incorrect code", no session); `SELECT count(*) FROM totp_credentials WHERE secret IN (<old secrets>)` returned 0 (read only, over SSM).
- Pharmacy web: a PHARMACIST signed in with the phone code only reaches the friendly "set up two-step verification" screen with the link to `https://passport.test.kiorex.com/account/security`; with the policy on for the organisation the same person is walked through enrolment (no skip), signs in with the MFA claim and `/auth/me` answers 200. Lab web: same screen when the API answers 403 `MFA_REQUIRED` (injected at the browser, no privileged Lab demo persona without MFA exists).

## Suite (`npx playwright test -c e2e/kx-test`, 27 Nov 2026)

- Full run after the release: 113 passed, 1 failed, 2 skipped (both `test.fixme`: patient booking and the throwaway Clinic organisation), 5 did not run (they follow the failure in a serial group). The one failure was the new `08-mfa-policy` first test: its helper waited for the browser to leave the Passport host, but the Passport account site IS the Passport host (a bug in the new spec, not in the release).
- After fixing the spec (the helper now ends on `/account`; the ops personas use their saved session plus a real `/api/step-up` call instead of a new phone code): `08-mfa-policy` re-run alone, 6 passed.
- A second complete run was not possible in the same hour: Passport allows 20 one-time codes per client IP per hour and the first complete run plus the new specs used 20 (the limit was NOT reset). Re-run the whole suite after the window (the oldest code of this session expires at 14:19 UTC); expected 119 passed, 2 skipped.
