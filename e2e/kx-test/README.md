# kx-test end-to-end suite (deployed hosts)

Playwright suite that runs against the DEPLOYED kx-test hosts (patient web, ops console, Passport, Pharmacy, Lab, platform API) using only HTTP and a real browser. Everything external stays mock; the data it checks is the tagged demo data (`DemoMarker`).

```bash
# once: Node 24+, then at the workspace root (kiorex-v2/)
npm install && npx playwright install chromium
# once per environment (idempotent): TOTP secrets of the privileged demo accounts into AWS Secrets Manager /kx/test/e2e and into Passport
e2e/kx-test/scripts/provision-e2e-secrets.sh
# every time
npx playwright test -c e2e/kx-test                    # whole suite
npx playwright test -c e2e/kx-test 02-ops             # one spec
npx playwright show-report e2e/kx-test/playwright-report
```

## What it needs and where it gets it (no secret in git)

| Need | Source at run time |
|---|---|
| Hosts | the URL registry `_docs/registry/service-url-registry.yaml` (`KX_E2E_ENV`, default `test`); never typed in code |
| AWS access | your own AWS CLI credentials for account 990597228737 (`AWS_PROFILE` if needed) |
| Phone one-time codes (mock sender) | read-only `docker logs` of the Passport container through `aws ssm send-command`; only the six digits are used, never printed |
| TOTP secrets (ops_admin, finance, Pharmacy owner, Lab owner) | AWS Secrets Manager `/kx/test/e2e` through `aws secretsmanager get-secret-value` |
| Partner credentials | NOT used: the signed positive partner check runs the platform's own signing code inside its container over SSM |

Optional overrides: copy `.env.example` to `.env` (git-ignored; it holds no secret). Saved browser sessions live in `.auth/` (git-ignored, deleted by the sign-out tests).

## Personas (synthetic accounts of the Passport demo seed)

| Persona | Phone | Used for |
|---|---|---|
| patient (Hoda Mahmoud) | +201000001001 | patient web: sign-in, account, appointments, pharmacy orders |
| ops (ops_admin) | +201000009001 | ops console providers, orders, finance (phone code + TOTP) |
| opsFinance | +201000009002 | commission summary, claims, statements, runs (role `finance`) |
| pharmacyCashier | +201000002008 | Pharmacy web dashboard, customers, catalogue, growth, role matrix |
| pharmacyOwner | +201000002007 | Pharmacy privileged role (phone code + TOTP) |
| pharmacistNoMfa | +201000002004 | proves the MFA rule: phone code only gives 403 MFA_REQUIRED |
| labTech | +201000002005 | Lab dashboard, orders, worklist |
| labOwner | +201000002010 | Lab privileged role (phone code + TOTP) |

Passport allows 5 one-time codes per phone and 20 per IP and hour. A saved session is reused for 6 minutes (platform apps: 15-minute access tokens) or 40 minutes (Pharmacy, Lab), so a quick re-run costs no codes; `KX_E2E_FRESH=1` forces new sign-ins. A full cold run uses about 9 codes. Do not reset the IdP's rate limits to work around it.

## Specs

| File | Covers |
|---|---|
| `01-edge-security.spec.ts` | health, security headers, `X-Robots-Tag: noindex` on non-production, CORS refusal for an evil origin (platform, Pharmacy, Lab, Passport), no localhost URL in bundles |
| `02-ops-console.spec.ts` | Passport sign-in with TOTP (acr mfa), providers list, order monitors, finance, commission summary, claims with every tender kind (CASH_TRANSFER), settlement statement, runs, role gating |
| `03-patient-web.spec.ts` | patient sign-in, account, search and provider page (market gate aware), appointments, pharmacy orders, services, no foreign hosts, sign-out |
| `04-pharmacy-web.spec.ts` | cashier: dashboard, customers, catalogue, inventory, growth and commission statement section, role matrix in UI and API |
| `04-lab-web.spec.ts` | technologist and owner: dashboard, orders (Kiorex and Nurse sources), filters, worklist, role matrix |
| `05-partner-hmac.spec.ts` | Pharmacy and Lab partner routes: unsigned, forged and stale requests refused; platform-signed GETs accepted through the public hosts |
| `06-privileged-mfa.spec.ts` | privileged role without MFA is refused (403 MFA_REQUIRED), with TOTP it works; owner orders, finance and statement |

Tests marked `test.fail` are KNOWN GAPS: they pass while the gap exists and turn red when it is fixed (then remove the marker). `test.fixme` lists what cannot be tested yet and why.

## Privileged roles and the 403 on /auth/me (findings, 27 Nov 2026)

* Cause (confirmed in code and by the response body `{"code":"MFA_REQUIRED"}`): Pharmacy `auth.guard.ts` and Lab `auth.guard.ts` refuse a privileged staff role whose session has no MFA claim when `NODE_ENV=production` and `AUTH_MODE=oidc`. Pharmacy privileged roles: OWNER, PHARMACIST, BRANCH_MANAGER, CHAIN_OPS (the cashier and assistant are not). Lab: OWNER, LAB_DIRECTOR, AUTHORIZED_SIGNATORY. The product session token keeps only an `mfa` flag derived from Passport's `acr`/`amr`, so a phone code (`amr: otp`) alone never satisfies it, in either product.
* Passport only asks for a second factor at sign-in for accounts holding a Passport role listed in `config/idp.json` `mfaPolicy.requiredForRoles` (`owner`, `admin`, `finance`, `ops_admin`, `super_admin`). The demo owners had only `patient`, so they were never asked and could never get an MFA claim. `provision-e2e-secrets.sh` adds the `owner` role to the two demo owner accounts and enrols a generated TOTP secret (stored only in Secrets Manager). That is a stricter rule, not a weaker one; no product or Passport rule was changed.
* Test approach: non-privileged personas for the bulk (cashier, technologist), TOTP-enrolled owners for the privileged views, and one negative test that signs a PHARMACIST in with the phone code alone and expects 403 (the rule stays proven).
* Product gap to decide (not changed here): real pharmacy owners get a membership role, not a Passport role, so Passport will not ask them for TOTP and they cannot satisfy the Pharmacy rule except with a user-verifying passkey. Passport should treat privileged membership roles as `requiredForRoles` at sign-in (or the products should map membership roles to the policy). The Pharmacy roles with `orders.read` and `finance.read` are all privileged, so a non-privileged persona can never see Kiorex orders or statements.

## Known gaps this suite reports (see the run report)

* The Egypt market gate `market.eg.live` is closed (no human gate evidence): patient search is empty and the provider page answers FEATURE_DISABLED until a human records it in the ops console. The suite asserts the closed state and switches to the data assertions by itself once it is open.
* The Passport dev IdP reflects any `Origin` on authenticated endpoints; the Pharmacy and Lab API hosts send no `X-Robots-Tag`; the Pharmacy names the failure reason (`bad_signature`) on a rejected partner signature while the Lab does not.
* Passport's per-IP one-time-code limit (20 per hour) is keyed on the CloudFront edge address (`otp_send_log.ip` shows 3.172.97.x), not on the visitor: every user behind the same edge shares one bucket (a limiter that does not limit the attacker and can lock honest users out). Fix at the edge: trust CloudFront's `X-Forwarded-For` in Caddy and set `KX_TRUST_PROXY=true` for Passport, or key the limit on a validated client IP. Until then a cold full run (about 9 codes) can be refused when the window is crowded; wait or reuse saved sessions.
* Booking a slot needs a Clinic wired to kx-test (none is).
