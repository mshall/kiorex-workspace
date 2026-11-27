# kx-test hardening release (27 Nov 2026, afternoon)

No secret values here. The AWS Clinic stack (E1DE0H2K3M17YL, its RDS and App Runner) and every Clinic-related tofu module were not touched; no tofu was applied (deploy script and images only).

Closes the known gaps the deployed e2e suite reported. Founder approved redeploying the affected services.

| # | Gap | Fix | Where |
|---|---|---|---|
| 1 | Pharmacy and Lab APIs sent no `X-Robots-Tag` | Caddy adds `X-Robots-Tag: noindex, nofollow` to every response when `KX_ENV` is not `prod` (`?` prefix: keeps the value the platform or Passport already set, so never duplicated). `KX_ENV` is passed to the caddy container by compose. | `infra/tofu/deploy/compose/Caddyfile`, `docker-compose.yml` |
| 2 | Passport reflected any `Origin` on `/me` | The oidc-provider library reflects the Origin on requests that fail before a client is known (no or invalid token) and only withdraws it once a client is refused. A post-processing middleware now strips every CORS header unless the Origin is one of the origins of the registered clients' redirect and post-logout URIs. | kiorex-account `provider.ts` (`corsAllowList`), test `cors-and-client-ip.test.ts` |
| 3 | Lab did not name a rejected signature like the Pharmacy | The Lab now answers 401 `{ statusCode, code: "HMAC_REJECTED", message: <reason> }` for unknown key, bad signature, stale timestamp and replayed nonce (was `INVALID_CLIENT`, `INVALID_SIGNATURE` + `reason`, `REPLAYED_NONCE`). The contract openapi description was updated (documentation only; no schema, path or field changed; the platform client only reads the status). | kiorly-lab `integration-auth.service.ts`, kiorex-contracts `openapi/kiorly-lab.v1.openapi.json` |
| 4 | Per-IP OTP limit keyed on the CloudFront edge address | Caddy hands the apps exactly the LAST `X-Forwarded-For` entry (the viewer address CloudFront appended; earlier entries are visitor-controlled and never used) as a single-value header. Passport `KX_TRUST_PROXY=true` reads the last entry and ignores a non-IP value; platform, Pharmacy and Lab get `TRUSTED_PROXY_HOPS=1` (Express `trust proxy`). Trust boundary: the host security group admits only the CDN prefix list and every request needs the shared `X-Origin-Secret`, so a request that passed the secret check came through our CDN. | `Caddyfile` (snippet `upstream`, comment), `docker-compose.yml`, kiorex-account `http.ts` |
| 5 | "Continue with Fake Hospital SSO (dev)" shown | `account.provider_sso` now defaults to OFF on a public deployment (explicit `KX_FLAG_ACCOUNT_PROVIDER_SSO=true` still works); local dev keeps it. Production refusal and the other public-mode rules are untouched. | kiorex-account `config.ts` |
| 6a | Statement screens dropped the cash vs cash-transfer split | `cashBreakdown` and `unknownTender` are kept by `normalizeStatement` and shown as their own rows (EN/AR) in the Pharmacy and Lab web card, the printable statement and the staff app card. | kiorly-pharmacy, kiorly-lab, kiorly |
| 6b | Mobile statement route answered 503 for an unconnected organisation | `GET /mobile/growth/commission-statement` answers 200 `{ connected: false, code: "STATEMENT_NOT_CONNECTED", period }`; real failures (`STATEMENT_UNAVAILABLE`) and role refusals still throw. The staff app shows the neutral not-connected line (an older API's 503 is still handled). The web workspace route keeps its 503 with the same code. | kiorly-pharmacy, kiorly-lab, kiorly |
| + | Finding while verifying: every Passport restart reverted the e2e provisioning and wrote the PUBLISHED dev TOTP secrets back into the hosted database | The demo seed reconciled the demo accounts on each start (roles, status, deterministic dev TOTP). On a public deployment it is now insert-if-missing only and writes no TOTP. After the first Passport restart of this release the ops_admin and finance TOTP secrets were the published ones and the owners had lost the `owner` role; `e2e/kx-test/scripts/provision-e2e-secrets.sh` (idempotent) was re-run and the values were compared with Secrets Manager (same). A restart no longer reverts them. | kiorex-account `accounts.ts` |

## Images and release
arm64 images pushed to ECR `kx-test/*`: passport `68dba813` (first `3a74e749`, superseded), pharmacy-api `5c458fd6`, lab-api `a38ec5e6`; platform image unchanged (`2958d42c`; its container is recreated only for the new `TRUSTED_PROXY_HOPS`). Releases applied with `infra/tofu/deploy/scripts/deploy.sh test --tag ...` (SSM): `20261127T115727Z-e567972e` and the Passport follow-up. Static: Pharmacy web and Lab web rebuilt with `VITE_KIORLY_HOME_URL=https://app.test.kiorly.com` (as before), synced to the two site buckets, CloudFront invalidated.

## Verification (live hostnames)
- `x-robots-tag: noindex, nofollow` (single value) on `api.test.kiorex.com`, `passport.test.kiorex.com`, `pharmacies.test.kiorly.com`, `labs.test.kiorly.com`, also on 401, 404 and partner paths.
- `GET https://passport.test.kiorex.com/me` with `Origin: https://evil.example.com`: no `access-control-allow-origin`; with `Origin: https://pharmacies.test.kiorly.com`: allowed.
- Partner route without credentials: `{"statusCode":401,"code":"HMAC_REJECTED","message":"unknown client key"}` on both products.
- `otp_send_log.ip` after the release shows the real visitor address (the workstation's), no longer a 3.172.97.x edge address.
- Passport sign-in page: no Fake Hospital button.
- Suite: `npx playwright test -c e2e/kx-test`: 91 passed, 1 skipped (`test.fixme`: booking needs a Clinic wired to kx-test). The three known-gap tests are now real assertions.

## Operator notes
- The per-IP OTP limit (20 per hour) now counts the real visitor; all runs from one workstation share one bucket (the suite used 19 of 20 in the busy hour of this release).
- Saved e2e sessions outlive a Passport reprovisioning: after changing roles or TOTP delete `e2e/kx-test/.auth/*.json` (a session saved before the owner role existed has no MFA claim).
- Not done on purpose: MFA role policy for real owners (founder decision pending), the `market.eg.live` gate, the Clinic copy of the statement normaliser (separate repo and rules).
