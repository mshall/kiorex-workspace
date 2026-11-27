# kx-test deploy log (27 Nov 2026)

No secret values in this file. Host `i-0823d9ef0bcda4a52`, account 990597228737, eu-central-1. The Clinic stack (E1DE0H2K3M17YL, its RDS and App Runner) was not touched.

## What runs
Images (arm64, ECR `kx-test/*`): platform `2958d42c`, passport `1809726c`, pharmacy-api `52967f05`, lab-api `c0ef1c5e`. One container with jobs on (`kx-test-platform-jobs`), Caddy, PostgreSQL 16 (private). Seed images (not part of the release) are in the same repos as tags `seed-<sha>`.
Static: patient web and ops console (platform `2958d42c`), pharmacy web (`52967f05`), lab web (`719af05`), uploaded to the four site buckets, CloudFront invalidated.

| URL | Result |
|---|---|
| https://api.test.kiorex.com/api/v1/health/live, /ready | 200 |
| https://passport.test.kiorex.com/healthz, discovery, /jwks | 200, endpoints on the public https host |
| https://pharmacies.test.kiorly.com/api/v1/health/live, /ready | 200 (database ok) |
| https://labs.test.kiorly.com/api/v1/health/live, /ready | 200 (database ok) |
| https://test.kiorex.com, https://admin.test.kiorex.com, pharmacies, labs (SPA) | 200, no localhost URL (only library constants) |
| https://test.kiorex.com/api/v1/health/live and admin | 200 (same-origin /api now routed) |
| https://webhooks.test.kiorex.com/api/v1/webhooks/* only | other paths 404 by design |

## Steps and fixes
1. Secret bags `/kx/test/{platform,passport,pharmacy,lab}` written with generated values (platform also carries the template literals and the registry-generated host file). Providers stay mock. Pharmacy and Lab run `AUTH_MODE=oidc` (this disables Lab dev sign-in: `POST /auth/dev-login` answers `DEV_AUTH_DISABLED`).
2. Fix: compose set `NODE_ENV=production` for Passport, which the dev IdP refuses by design. Now `development` (public DEV mode).
3. Fix: Caddy multi-value header matcher invalid; now `header_regexp`. Caddy bind-mounts a file from a directory that every deploy replaces, so a changed Caddyfile never reached the running container; `kx-deploy.sh` now force-recreates caddy on each release (also patched on the host copy).
4. Fix (infra, applied with targeted tofu, CloudFront only): the patient web and ops console call `/api/*` on their own host, so `kiorex.marketplace` and `kiorex.admin` now have `with_api = true`; pharmacy and lab also route `/marketplace/*` (signed Kiorex partner API, outside `/api/v1`); new `api_paths` option in the services variable.
5. Fix (infra): CloudFront used the AllViewerExceptHostHeader origin policy, so Passport built its discovery URLs from the EC2 host name. Now AllViewer (public Host reaches the app) plus `X-Forwarded-Proto: https` set by Caddy.
6. Fix (code, kiorly-lab commit 719af05): the Lab web did not type-check (`Input` rejected `ref`); `ComponentProps<"input">`.
7. Seeds (founder said demo data existed; checked: the databases were empty, nothing duplicated): Passport demo seed (46 accounts); Pharmacy base and demo; Lab base and demo; platform BASE seed run with `NODE_ENV=production` (flag registry, commission defaults, no dev product keys, no dev gates).
8. Security clean-up after the seeds: the Pharmacy and Lab seeds register Kiorex clients with the PUBLISHED dev secrets. Those rows were deactivated and replaced by generated clients (`kx_test_pharmacy`, `kl_test_kiorex`); the platform `PartnerRegistration` rows (`pr_pharmacy_test`, `pr_lab_test`) use the public hosts and the same generated secrets (stored encrypted, never printed).
9. Passport clients: `KX_CLIENT_OVERRIDES_JSON` from `client-overrides:emit --env test --with-secrets --backchannel same-origin`. Authorization requests with the registered redirect URIs are accepted for kiorex-web, kiorex-ops, kiorly-home, kiorly-pharmacy-web, kiorly-lab-web; an unregistered URI gets 400.

## Verification
- Platform to Pharmacy (`GET /pharmacies`, `/catalogue`) and platform to Lab (`/tests`) through the public hosts, HMAC signed: 200, 100 catalogue items, 400 lab tests.
- Browser: Pharmacy web to Passport, phone OTP (code read from the Passport container log, mock sender), passkey step skipped, back to the Pharmacy web, `/auth/oidc/exchange` 200. Then `/auth/me` 403 for the seeded owner persona (+201000002007): almost certainly the production rule "privileged roles need MFA"; not confirmed from a log. Use a non-privileged persona or one with TOTP.
- CORS: allowed origins get `access-control-allow-origin` on the platform API (test, admin); `evil.example.com` is refused. Origin bypass (EC2 DNS name direct) times out.

## Not done / blockers
- Platform DEMO seed: it needs demo providers synced from a Kiorly Clinic (`no demo providers: run Kiorly demo seed + provider sync`) and records public dev gate evidence and dev product keys unconditionally. Needs a founder decision (a synced demo Clinic, or a trimmed seed). The platform base seed is in.
- Clinic is not wired to Passport (separate Clinic deploy, outside this task).
- `webhooks`, `book.test.kiorex.com` (widget host) are not separate CDN hosts yet.
- Pharmacy/Lab outbox events to the platform were not driven end to end (clients registered; send an order to test).
- Passport CORS reflects any origin (dev IdP behaviour); the Passport container logs OTP codes (mock mode), so anyone with host access sees codes.
- Pending in git: tofu edits and the log are uncommitted in the workspace repo next to unrelated `.gitignore` changes.
