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
| superAdmin | +201000000099 | join-request settings and test-data removal (role `super_admin`; phone code + TOTP from `/kx/test/e2e`) |
| pharmacyCashier | +201000002008 | Pharmacy web dashboard, customers, catalogue, growth, role matrix |
| pharmacyOwner | +201000002007 | Pharmacy privileged role (phone code + TOTP) |
| pharmacistNoMfa | +201000002004 | proves the MFA rule: phone code only gives 403 MFA_REQUIRED |
| labTech | +201000002005 | Lab dashboard, orders, worklist |
| labOwner | +201000002010 | Lab privileged role (phone code + TOTP) |

Passport allows 5 one-time codes per phone and 20 per real client IP and hour (the limit sees the visitor, not the CloudFront edge, since the 27 Nov 2026 edge change; all runs from one workstation still share one bucket). A saved session is reused for 6 minutes (platform apps: 15-minute access tokens) or 40 minutes (Pharmacy, Lab), so a quick re-run costs no codes; `KX_E2E_FRESH=1` forces new sign-ins. A full cold run uses about 9 codes. Do not reset the IdP's rate limits to work around it.

## Specs

| File | Covers |
|---|---|
| `01-edge-security.spec.ts` | health, security headers, `X-Robots-Tag: noindex` on non-production, CORS refusal for an evil origin (platform, Pharmacy, Lab, Passport), no localhost URL in bundles |
| `02-ops-console.spec.ts` | Passport sign-in with TOTP (acr mfa), providers list, order monitors, finance, commission summary, claims with every tender kind (CASH_TRANSFER), settlement statement, runs, role gating |
| `03-patient-web.spec.ts` | patient sign-in, account, search and provider page (market gate aware), appointments, pharmacy orders, services, no foreign hosts, sign-out |
| `04-pharmacy-web.spec.ts` | cashier: dashboard, customers, catalogue, inventory, growth and commission statement section, role matrix in UI and API |
| `04-lab-web.spec.ts` | technologist and owner: dashboard, orders (Kiorex and Nurse sources), filters, worklist, role matrix |
| `05-partner-hmac.spec.ts` | Pharmacy and Lab partner routes: unsigned, forged and stale requests refused; platform-signed GETs accepted through the public hosts |
| `07-clinic-wiring.spec.ts` | the live AWS Clinic on `clinics.test.kiorly.com` and its legacy host: SPA, health, CORS, Passport offered (password stays the default), authorization URL and callback through the NAT, signed platform to Clinic providers and slots, ops provider sync. READ-ONLY against the live Clinic (real organisation Dr Ahmed Shall) except the login of the owner of the tagged throwaway organisation "[TEST] KX E2E Clinic (removable)" (password from `/kx/test/e2e` key `CLINIC_E2E_OWNER_PASSWORD`, skips with a message when absent) and the platform's provider sync; the booking test in `03-patient-web.spec.ts` books that organisation's provider "Dr KX E2E Test" from the patient session and cancels the booking, and skips with a clear message while the Egypt gate `market.eg.live` is closed (a human records the gate, never code) |
| `06-privileged-mfa.spec.ts` | privileged role without MFA is refused (403 MFA_REQUIRED), with TOTP it works; owner orders, finance and statement |
| `08-mfa-policy.spec.ts` | MFA policy end to end on kx-test: default OFF, ops propose (maker), a different ops approves (checker), the demo pharmacist is walked through mandatory enrolment and then works in the Pharmacy web, switch off again (optional, offered code), the friendly "set up two-step verification" screen with the Passport link in the Pharmacy web and the Lab web; the policy ends OFF and the pharmacist's enrolment is removed |
| `09-old-demo-totp.spec.ts` | the demo TOTP seeds once published in the repositories are worthless on kx-test: the code computed from the old secret is refused at the Passport sign-in of the ops accounts, and no `totp_credentials` row holds an old secret. The old values are read from the git history at run time (nothing typed); skips when the history no longer has them |
| `13-kiorly-home.spec.ts` | Kiorly Home (ADR-038) at `app.test.kiorly.com`: the SPA on `/signin`, `/signin/<product>` and the callback (noindex, no localhost in the bundle); the `kiorly-home` Passport client accepts Home's redirect URI and refuses a foreign one; the same-origin `/idp/*` path reaches Passport; the Clinic, Pharmacy and Lab handoff preflight allows Home only; Lab and Pharmacy "Switch product" opens Home with the four tiles; a Passport sign-in for the Lab tile ends in the Lab (reuses a saved session, at most one phone code) |
| `17-role-dashboards.spec.ts` | Kiorly-only roles and role dashboards (ADR-062): only a super admin may grant `kiorly_ops` and `kiorly_admin` (audited; an account with Kiorex roles is refused), a Kiorly sign-in carries only its role with MFA, the API answers 200 on the allow-list and 403 FORBIDDEN_ROLE on every other area (sample; the generated platform test covers the whole route table), each console role lands on its own dashboard (EN/AR, Western digits, light/dark), menus show only allowed routes, a refused address shows the no-access page, the Kiorex console refuses a Kiorly-only sign-in. Needs `scripts/provision-role-accounts.sh` once (three throwaway tagged accounts `+20100000970x`, TOTP secrets in `/kx/test/e2e`) |
| `10-site-leads.spec.ts` | Kiorly site join flow on the deployed hosts: public config and CORS, the single-page site in EN and AR, a real form submission with a TEST-tagged lead (name prefix [TEST], reserved e-mail domain), idempotent replay, 400/413/honeypot, the lead in the Kiorex admin (ops) and the Kiorly admin (super admin), CSV export, role limits (ops cannot save settings or remove test data), and removal of the test lead (count, then confirm) |
| `10b-site-leads-matrix.spec.ts` | join-request MATRIX (28 Nov 2026): 9 provider types x 2 interest modes (STANDALONE, CONNECTED) = 18 submissions through the REAL five-step form (English and Arabic alternate), plus hostile input (honeypot, 413, unknown field, markup, 7 bad phone shapes, wrong type/mode/market/governorate, OTHER without description, chain with one branch, idempotency replay/conflict), phone normalisation (3 notations = one number, 4th submission 429), duplicates by phone and e-mail, formula-injection CSV cell; then ops_admin (Kiorly ops role) in both consoles (masked list, decrypted detail equals typed data for all 18, filters, lifecycle incl. every forbidden jump, owner, tags, notes, CSV, 403/401 limits, the read-only Start onboarding helper) and super_admin (test tag, settings concurrency, count-then-remove). Needs the per-address lead limits of kx-test raised while it runs (the default 20 per day per address allows about one run; the invalid-input limit of 30 per 10 minutes allows one run per 10 minutes) |
| `18-patient-onboarding.spec.ts` | Kiorex patient entry and first-run onboarding (28 Nov 2026): the new landing page (three claims, honest market status from `/markets`, provider link to the Kiorly site join form), Join us opens the Kiorex entry page before Passport (Arabic RTL mirrored), the cancelled flow (Back from Passport, refused callback, private page asks on the entry page), a NEW throwaway patient (synthetic phone `+201000007xxx`, name `[TEST] Onboarding <tag>`) registers through the REAL Passport page and completes the six onboarding steps (profile, preferences and the personalised home verified through the existing APIs, a second visit skips onboarding), and the seeded patient signs in through the entry page and goes straight home. TWO phone codes (the second is skipped with a fresh saved session). Cleanup: the Passport account is tagged `data_class=DEMO` and the platform profile gets a `DemoMarker` (batch `e2e-onboarding`); the global `demo-data:remove` sweep is not run from the test (it would also remove the seeded personas) |

Tests marked `test.fail` would be KNOWN GAPS: they pass while the gap exists and turn red when it is fixed (then remove the marker); there are none at the moment. `test.fixme` lists what cannot be tested yet and why.

## Privileged roles and the 403 on /auth/me (findings, 27 Nov 2026)

* Cause (confirmed in code and by the response body `{"code":"MFA_REQUIRED"}`): Pharmacy `auth.guard.ts` and Lab `auth.guard.ts` refuse a privileged staff role whose session has no MFA claim when `NODE_ENV=production` and `AUTH_MODE=oidc`. Pharmacy privileged roles: OWNER, PHARMACIST, BRANCH_MANAGER, CHAIN_OPS (the cashier and assistant are not). Lab: OWNER, LAB_DIRECTOR, AUTHORIZED_SIGNATORY. The product session token keeps only an `mfa` flag derived from Passport's `acr`/`amr`, so a phone code (`amr: otp`) alone never satisfies it, in either product.
* Passport only asks for a second factor at sign-in for accounts holding a Passport role listed in `config/idp.json` `mfaPolicy.requiredForRoles` (`owner`, `admin`, `finance`, `ops_admin`, `super_admin`). The demo owners had only `patient`, so they were never asked and could never get an MFA claim. `provision-e2e-secrets.sh` adds the `owner` role to the two demo owner accounts and enrols a generated TOTP secret (stored only in Secrets Manager). That is a stricter rule, not a weaker one; no product or Passport rule was changed.
* Test approach: non-privileged personas for the bulk (cashier, technologist), TOTP-enrolled owners for the privileged views, and one negative test that signs a PHARMACIST in with the phone code alone and expects 403 (the rule stays proven).
* Product gap, DECIDED 27 Nov 2026 (founder): MFA stays OPTIONAL by default; a Passport admin or ops user makes it mandatory in the Passport console (Ops, MFA policy) per role, organisation type or organisation, with maker-checker and audit (`kiorex-account/Docs/MFA_POLICY.md`). Pharmacy and Lab keep their `MFA_REQUIRED` rule unchanged; with the policy off, a real owner who skipped enrolment gets 403 and now sees a friendly screen with a link to Passport Security (`08-mfa-policy.spec.ts`). The Pharmacy roles with `orders.read` and `finance.read` are all privileged, so a non-privileged persona can never see Kiorex orders or statements.

## Known gaps this suite reports (see the run report)

* The Egypt market gate `market.eg.live` is closed (no human gate evidence): patient search is empty and the provider page answers FEATURE_DISABLED until a human records it in the ops console. The suite asserts the closed state and switches to the data assertions by itself once it is open.
* CLOSED 27 Nov 2026 (were known gaps, now real assertions in `01-edge-security` and `05-partner-hmac`): Pharmacy and Lab API hosts send `X-Robots-Tag: noindex, nofollow` (the origin router adds it on every response of a non-production environment); the Passport dev IdP no longer reflects an arbitrary `Origin` (allow-list of the registered client origins); the Lab names a rejected partner signature exactly like the Pharmacy (`{ statusCode: 401, code: "HMAC_REJECTED", message: <reason> }`); the Passport per-IP one-time-code limit is keyed on the real visitor (the origin router hands over the address CloudFront recorded, `KX_TRUST_PROXY=true`; trust boundary documented in `infra/tofu/deploy/compose/Caddyfile` and kiorex-account `Docs/DEPLOY_DEV.md`); the fake hospital SSO button is hidden on a hosted Passport.
* Booking a slot: the Clinic IS wired now (`07-clinic-wiring.spec.ts`), but a patient booking still needs the human `market.eg.live` gate and a throwaway Clinic organisation (public signup needs a real WhatsApp OTP, the Platform tab a platform-admin credential); both stay `fixme`.
