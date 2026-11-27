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
- Committed locally in the workspace repo; nothing pushed.

## Kiorly marketing site and Kiorly admin hosted (27 Nov 2026)
No secret values here. Clinic stack untouched.

**Infra (OpenTofu, `infra/tofu/envs/test`, additive: 21 added, 5 changed in place, 0 destroyed).** `static_site` module extended (not copied): per-service `rewrite = "spa" | "directory"` (directory = the kiorly-site CloudFront Function, loaded from `kiorex-account/apps/kiorly-site/deploy/cloudfront-index-rewrite.js`, plus 403/404 -> `/404.html` with status 404) and `api_service` (the service header the origin routes `/api/*` on; lets `kiorly.admin` use `kiorex.admin`, so no Caddy change). Stack fix: `static_sites_out` uses `one(concat(splat))` instead of `try()`, because `try()` made the whole site map unknown as soon as a new site existed (broke for_each keys of the CDN 5xx alarms).
New: `kiorly.marketing` (test.kiorly.com, bucket `kx-test-site-kiorly-marketing-990597228737`, distribution E15BCBE1TTZP1L, rewrite directory, no API) and `kiorly.admin` (admin.test.kiorly.com, bucket `kx-test-site-kiorly-admin-990597228737`, distribution EQGFK1VR1MHT5, `/api/*` to the Kiorex API), each with bucket, policy, OAC share, A/AAAA alias records in the test.kiorly.com zone and a 5xx alarm; both use the existing ACM certificate for test.kiorly.com (wildcard level covers admin). In place: CI role policy and the four existing bucket policies (extra bucket and distribution ARNs, same content otherwise). The pending `volume_tags` drift on the data volume was excluded (`-exclude`) and stays unapplied.
**Why a second distribution:** the existing admin distribution holds only the kiorex.com certificate, so an alias for another domain cannot be added.

**Builds uploaded.** Kiorly site: `npm run build -w @kiorex/kiorly-site -- --env test` (mock lead form, noindex, "Preview build" strip; test does not require a lead endpoint), HTML `max-age=300`, assets immutable. Ops console: platform tree at `753dc6c`, built with the regenerated `ops.build.env` (now carries `VITE_KIORLY_ADMIN_HOSTS=admin.test.kiorly.com`); the same build was uploaded to BOTH admin buckets (the kiorex host also now carries the edition code, no visible change there). CloudFront invalidated on all three.
**Passport.** `KX_CLIENT_OVERRIDES_JSON` in `/kx/test/passport`: only `kiorex-ops` changed (adds `https://admin.test.kiorly.com/auth/callback` and post-logout `/`); secrets of the other clients kept as they were. Applied with the SSM deploy document (`KX_FORCE`): only Passport (and Caddy, by design) recreated.
**Registry.** `kiorly.marketing` status reserved -> planned (note updated); validator OK.

| Check | Result |
|---|---|
| https://test.kiorly.com/, /ar/, /en/, /en/plans/ | 200; unknown page 404 (own 404 page); `x-robots-tag: noindex, nofollow`, HSTS; no localhost in the pages |
| https://admin.test.kiorly.com/ and `/api/v1/health/live` | 200; API same-origin 200 `{"status":"ok"}` |
| Passport `/auth` for kiorex-ops with the Kiorly callback | 303 (accepted); an unregistered host 400 |
| Headless browser, admin.test.kiorly.com | tab title "Kiorly Admin" (Kiorly edition); redirects to Passport, returns to `/auth/callback` on the Kiorly host (the pane's existing SSO session is the non-ops owner persona, so the app then shows "No access", same as on admin.test.kiorex.com) |

## Demo data and the e2e suite (27 Nov 2026, evening)

Still no secret values here. No service was redeployed in this step (the platform release image is unchanged, `2958d42c`); only a one-shot seed container was run next to it. The Clinic stack was not touched.

1. Platform trimmed demo seed (`npm run db:seed:demo:deployed`, kiorex-platform commits e955882 and 5e97d19): built from `Dockerfile.seed` as `kx-test/platform:seed-5e97d19` (arm64, pushed to ECR next to the earlier seed tags) and run on the host over SSM: `docker run --rm --network kx-test_default --env-file /opt/kx/env/platform.env -e DEMO_SEED_ALLOWED=true -e KIOREX_ENV=test --entrypoint node <image> dist-seed/prisma/demo/seed-deployed.js`. First run created 12 patient profiles, 8 LIVE demo providers (4 clinic organisations), 15 bookings with deposits and 25 ledger transactions, 4 reviews, 12 commission claims (ONLINE, CASH, CASH_TRANSFER with BANK_TRANSFER, INSTAPAY and CARD_TERMINAL; PENDING, CONFIRMED, DISPUTED, REVERSED, WAIVED) and 2 collection runs; the second run (after the partner-client fix) added 8 pharmacy orders and 8 lab bookings from the live partner catalogues and changed nothing else (idempotent). Everything is in `DemoMarker`. No gate evidence, no product keys, no secrets were written. The patient search stays empty because `market.eg.live` is a human gate (see below).
2. Verified: ops console providers list, order monitors, finance and commissions (finance role) show the data; `GET /api/v1/admin/providers`, `/admin/commissions/{summary,claims,runs,settlement-statement/demo_dt_1}` answer with it; the patient web shows the demo patient's pharmacy order and Past appointment; `GET /api/v1/search/providers?q=Demo` is empty and `GET /api/v1/providers/demo_dp_3` answers 403 FEATURE_DISABLED (`market.eg.live`, AWAITING_GATE).
3. Passport TOTP: the demo seed had enrolled the ops accounts (+201000009001, 9002, +201000000099) with the PUBLISHED deterministic dev TOTP secrets (public repository). Replaced by generated secrets stored only in AWS Secrets Manager `/kx/test/e2e` (`e2e/kx-test/scripts/provision-e2e-secrets.sh`; the host reads the secret with its own role, nothing secret in the SSM command text). The two demo OWNER accounts (+201000002007 Pharmacy, +201000002010 Lab) got the Passport `owner` role and a generated TOTP so they can produce an MFA claim.
4. Pharmacy owner 403 on `/auth/me` explained: production MFA rule for privileged roles (see `e2e/kx-test/README.md`, section "Privileged roles"). Lab owners hit the same rule. No product or Passport rule was changed.
5. Not done on purpose: the IdP's `/dev/reset-rate-limits` was not used (OTP limits are a security control); Pharmacy and Lab APIs still send no `X-Robots-Tag` (needs a Caddy change and a redeploy of the edge, left for the founder's go-ahead).
