# End-to-end full pass on kx-test, 28 Nov 2026

Mandate (founder): a complete end-to-end pass over AWS kx-test for every flow and edge case, fix what is found, re-run until green. Run by one QA agent (Sonnet 5.5) on 28 Nov 2026, 07:45 to about 10:00 Gulf time. Hosts come from `_docs/registry/service-url-registry.yaml`. Nothing here records the Egypt gate `market.eg.live`, enables the MFA policy, publishes a real Clinic price or uses a published demo credential on a live system. The Clinic organisation Dr Ahmed Shall was only read.

Legend for "Result": PASS (ran, green), FIXED (failed first, product or spec fixed, re-run green), SKIP (not runnable here, reason given), OPEN (found, not fixed, owner named). "Evidence" is the spec or log; spec files live in `e2e/kx-test/tests`, private-stack suites in the repos named. Commit ids are in section 9.

Passport phone codes (20 per hour per address, 5 per number) were planned in waves with saved sessions; the run waited (shell sleeps and the five-minute code lifetime) instead of skipping. A temporary compose override raised the lead-form limits for one hour (restored, section 8).

## 1. Identity (Passport, Kiorly roles)

| Flow | Edge cases covered | Result | Evidence | Fix commit |
|---|---|---|---|---|
| Register a NEW patient through the real Passport page | consent gate (button refuses without the tick), Arabic page and font, Arabic-Indic digits typed become 0-9, name optional, "Add a passkey?" offered and skippable | PASS | `19-passport-register` 7/7, `18-patient-onboarding` 5/5 | spec 18 now ticks consent (`d9b4562`) |
| Duplicate registration | number with an account says "You already have an account" only after the code; Sign in link carries on | PASS | `19` (codes 3 and 4) | - |
| Hostile `return_to` / `redirect_uri` | `https://evil...`, `javascript:`, `//evil`, `@evil` never followed, no 5xx | PASS | `19`, `22-edge-all-hosts` (authorize with hostile redirect URIs) | - |
| Back, Go back, browser Back | one screen at a time, no number in the address, cancelled flow returns to the app with no session | PASS | `19`, `23` test 4 | `23` runs the page in English (`d9b4562`) |
| Resend | 30 s countdown, the older code stops working, the newer works | PASS | `23` test 1 | - |
| Expired code | lifetime 300 s: the test waits 310 s, then the code is refused with an error, still on Passport | PASS | `23` test 2 | - |
| Wrong code lockout | five wrong codes lock the number, the right code is refused afterwards, a new code request produces no new code, nothing in the address leaks code or number | PASS | `23` test 3 | - |
| Sign in (existing person) | phone code, TOTP for ops roles, saved sessions reused | PASS | every persona in `02`..`17` | - |
| MFA OFF (default) | owners of Pharmacy and Lab reach privileged areas with a phone code only; pharmacist without MFA claim answers 200 while the policy is off | PASS | `14-dual-login`, `06-privileged-mfa` | - |
| MFA ON (private stack only, never live) | policy ON by SQL in a throwaway Passport: enrolment page cannot be skipped, MFA claim works, an older session and the owner password are refused (`PASSPORT_REQUIRED_FOR_ROLE`), OFF again restores the password | PASS 16/16 | `e2e/scripts/mfa-policy-private-proof.mts` (Passport :4491, Pharmacy in production mode :3191, own databases) | - |
| MFA policy maker-checker on the live Passport | spec `08-mfa-policy` changes the live policy | SKIP | founder rule: never enable the MFA policy; proven on the private stack above | - |
| Passkey option | present after a new account and offered at sign-in as optional | PASS | `19`, `23` | - |
| Logout and sessions | sign out ends the session, back-channel logout, "sign out other sessions" | PASS | `03`, `13`, `20-cdo-sessions`, `21-cdo-passport-account` | - |
| Sign-in limits settings (maker-checker) | ops proposes, a different admin approves, defaults respected, hard ranges | PASS | `12-signin-limits` | - |
| Kiorly roles grant and revoke | only a super admin grants, audit, separate accounts, sessions ended | PASS | `17-role-dashboards` | - |
| Mixed-role refusal | an account with Kiorex roles is refused the Kiorly role; a mixed token gets `FORBIDDEN_MIXED_ROLES` | PASS (live: grant refusal; guard: generated platform test `kiorly-roles.int.spec.ts`, full integration run) | `17`, platform integration | - |

## 2. Kiorex patient

| Flow | Edge cases covered | Result | Evidence | Fix commit |
|---|---|---|---|---|
| Landing, Sign in and Join us entry | Arabic RTL mirrored, honest market status, provider link to the Kiorly site | PASS | `18`, `25` | - |
| Onboarding (six steps), skip, resume, existing member | a second visit skips onboarding; seeded patient signs in through the entry page | PASS | `18` | - |
| Home, search, appointments, records, services, pharmacy, lab, telemedicine, account, addresses, notifications, preferences, referral, loyalty, care plans, waitlist | every signed-in route in English and Arabic: html lang and dir, a heading, no error boundary, no 5xx, no console error | PASS 2/2 | `25-patient-web-walk` | - |
| Western digits | Arabic pages show 0-9 | PASS | `25` | - |
| Language and theme | toggles switch and persist; the choice survives a reload | PASS | `25` | - |
| Sign out | exactly once at desktop width (header), once on the Account page below 1024 px (founder decision) | FIXED | `25` | `0df73d3` (platform), deployed to kx-test |
| Market gate (Egypt closed) | search empty and honest, provider page `FEATURE_DISABLED` / `AWAITING_GATE`, never an error | PASS | `03` | - |
| Booking path | live booking is SKIPPED while the gate is closed (only a human records it). The path ran on a PRIVATE stack (gate recorded there): hold, confirm with Idempotency-Key, Kiorly owns the appointment, double claim returns `SLOT_TAKEN`, consent required, another patient cannot read it | PASS (private) | `e2e/test/03-booking-golden.e2e.ts` 6/6 and the 595-test regression suite (section 6) | - |
| Privacy and consent choices | public preferences page lists the choices | PASS | `25` | - |
| Offline, 500, 401 states | offline banner announced and cleared; a 500 shows a friendly error state, no raw message; a 401 sends the person to sign in | PASS | `25` | - |
| Time zones | the same appointment shows the clinic-local clock in Cairo (UTC+2) and in the Gulf (UTC+4), no ISO strings, no NaN | PASS | `25` | - |
| Kiorex patient app fonts | Plus Jakarta Sans plus IBM Plex Sans Arabic in the Expo app (package `@expo-google-fonts/plus-jakarta-sans`); mobile jest 344 pass, typecheck clean; no release build made (founder: not required now, takes effect at the next build) | FIXED | mobile jest | `0df73d3` |

## 3. Providers

| Flow | Edge cases covered | Result | Evidence | Fix commit |
|---|---|---|---|---|
| Clinic: wiring, Passport plus password, switch product | SPA, health, CORS, Passport offered, authorization URL and callback through the NAT, signed providers and slots, ops sync; READ-ONLY against the real organisation | PASS | `07-clinic-wiring` | - |
| Clinic host security headers | `clinics.test.kiorly.com` had no nosniff, HSTS or frame protection | FIXED | `22-edge-all-hosts`; headers verified with curl, API headers kept (override false) | `108b9b7` (tofu `clinic_link`, applied with `-target`, 1 resource changed) |
| Throwaway tagged owner org, bookings sync to Kiorex, markets, plans, subscriptions | owner of "[TEST] KX E2E Clinic" signs in; markets read-only (Kiorly admin); plans preview/propose/reject/withdraw, own approval refused; no price published | PASS | `07`, `11-kiorly-markets`, `15-landing-plans`, `16-plan-prices-maker-checker` | - |
| Pharmacy and Lab web: Passport, e-mail and password, roles, privileged-role rules with the policy OFF, cashier flows, orders, worklist | cashier, owner, technologist, owner; role matrix in UI and API; pharmacist refused without MFA claim while the policy is on in production mode (private) | PASS | `04-pharmacy-web`, `04-lab-web`, `06`, `14` | - |
| Pharmacy and Lab API suites (prescriptions, stock/expiry, dispense, lab orders, specimens, QC, validation, release, critical values, tenancy) | tenancy isolation, connected vs standalone, idempotency, replay | PASS | Pharmacy api e2e 253/253, unit 301; Lab api e2e 237/237, unit 324 (private databases) | `3f8d488` (limiter in the runner), `e7a5bb1` (two Lab test fixes) |
| Partner HMAC channel | unsigned, forged, stale, replayed; signed GETs accepted | PASS | `05-partner-hmac`, regression suites 15/22/44/45 | - |
| Pharmacy and Lab web Playwright on private stacks | sign-in card (EN/AR, light/dark, 320 to 2560 px, offline, keyboard), growth, Kiorex tab, staff management, a11y/RTL, crash sweep, quick setup, subscription | FIXED then PASS (see section 7 for the counts) | `kiorly-pharmacy/apps/web/e2e`, `kiorly-lab/apps/web/e2e` | `98dc79c`, `1666c48`, `ee30402` (specs follow the unified card, 320 px header overflow fixed) |
| Staff app and patient app | staff jest 460/460, typecheck clean; patient app jest 344/344 | PASS (unit); web-export smoke see section 7 | `kiorly`, `kiorex-platform/apps/mobile` | - |

## 4. Kiorex and Kiorly admin

| Flow | Edge cases covered | Result | Evidence | Fix commit |
|---|---|---|---|---|
| Ops console: providers, order monitors, finance, commissions, claims with every tender kind, settlement statement, runs | role gating; ops_admin without finance gets the No access page | FIXED (spec) | `02-ops-console` | `108b9b7` (spec accepts the No access page of ADR-062) |
| Role dashboards and route access per role | every console role lands on its own dashboard (EN/AR, light/dark, Western digits), menu shows only allowed routes, refused address shows No access, API 200 on the allow-list and 403 elsewhere; the generated allow-list proof runs in platform integration | PASS | `17-role-dashboards`, platform `ops-role-matrix.int.spec.ts`, `kiorly-roles.int.spec.ts` | - |
| Join requests (leads) pipeline | 9 provider types x 2 modes = 18 submissions through the real five-step form (EN/AR), hostile input, idempotency replay/conflict, duplicates, CSV formula injection, filters, lifecycle incl. every forbidden jump, both consoles, test-data removal | PASS 35/35 | `10`, `10b`, `10c` | needed the temporary limit raise (section 8) |
| WON creates a DRAFT onboarding request, approval by a different super admin | one per lead, LOST none, approve/reject only by another super admin | PASS | `10c` | - |
| Partner onboarding | Start onboarding helper from a qualified connected lead creates nothing | PASS | `10b` | - |
| Plans and price proposals maker-checker | Clinic preview/propose/reject/withdraw, own approval refused, price rows identical before and after. Pharmacy and Lab price connection is DORMANT on kx-test (founder secrets not set): its five tests SKIP with the reason; the same code is proven on private databases (platform integration, Pharmacy `plan-prices.e2e`, Lab e2e) | PASS / SKIP (dormant connection) | `15`, `16`, platform integration | - |
| Markets | Kiorly admin read-only against the live Clinic; super admin changes only | PASS | `11` | - |
| Commission policy maker-checker, flags, audit logs | covered by platform integration (policy, flags, audit chain) and `02` | PASS | platform integration 1485 tests | - |
| Demo-data tagging and removal dry-run | tagged rows listed, dry run changes nothing | PASS | `demo-data` e2e in Pharmacy/Lab, platform and Passport dry runs in the 27 Nov report; throwaway rows of this pass are tagged (section 10) | - |

## 5. Cross-cutting

| Flow | Edge cases covered | Result | Evidence | Fix commit |
|---|---|---|---|---|
| Security headers, CSP, CORS, noindex on every host | nine web hosts plus four API hosts: nosniff, frame protection, HSTS, noindex, no localhost in page or entry bundles, immutable asset caching, CORS refusal of evil origins | PASS (Clinic hosts: see F-CACHE-1 / F-HDR-2) | `01`, `22-edge-all-hosts` 71/71 | `108b9b7` |
| TLS and redirects | plain http never serves content on any host | PASS | `22` | - |
| CloudFront and S3 routes | SPA fallback on deep links (all web hosts), the Kiorly site answers its branded 404, missing assets 404, path traversal never leaks | PASS | `22` | - |
| Error pages | unknown route has no stack trace or internal path (platform, Pharmacy, Lab, Passport) | PASS | `22` | - |
| Rate limits and hostile inputs | malformed JSON, wrong content type, null bytes, 2 MiB bodies, 5000-character tokens, SQL/path/unicode ids, TRACE | PASS | `22`, `24`, `10b` | - |
| Idempotency, replay, double submit | lead form replay (same key same body replays, other body conflicts); six concurrent preference PATCHes answer without 5xx; booking double claim (private) | PASS | `10b`, `24`, regression suite | - |
| Large and special payloads | 1 MiB profile refused (4xx), Arabic/emoji/markup/null names accepted or refused cleanly | PASS | `24` | - |
| Data isolation | patient token never opens admin routes; patient and ops tokens are not Pharmacy or Lab sessions; another patient's booking/safety card/share/review ids answer 4xx the same as unknown ids; tenant isolation of Pharmacy and Lab proven in `tenancy.e2e` (private) | PASS | `24`, Pharmacy/Lab api e2e | - |
| Country immutability (ADR-060) | no market switch, sync and booking refuse cross-market | PASS | `11`, Pharmacy `market-fixed.e2e`, Lab schema trigger tests, platform integration | - |
| Registry-driven URLs | every host https, none localhost, bundles carry no localhost | PASS | `22`, `01` | - |
| Mixed language, RTL, Western digits | covered per page in `25`, Passport `19`, sign-in card specs | PASS | `25`, `19` | - |
| Unified login card parity | the three web apps carry the same card (hash check, parity tests); lint regexes fixed | FIXED | `unified-sign-in.parity.node.test.ts` in account, Pharmacy, Lab, Clinic | `7e4706d`, `7961c33`, `60e3784`, Clinic `a2025ae1`/`39fb51c6` |
| Kiorly Home switch product from every module | Lab and Pharmacy open Home with the four tiles; Passport sign-in ends in the Lab | PASS | `13-kiorly-home`. Clinic web has no Switch product link on kx-test (open item of handoff section 18) | - |
| Health checks | all seven health URLs answer 200 in under five seconds | PASS | `01`, `22` | - |

## 6. Platform health (private stacks, own databases)

| Suite | Result | Notes |
|---|---|---|
| Passport (`kiorex-account`) `tsc -b` and vitest | PASS 66 files, 516 tests | - |
| Platform lint, typecheck, api unit | PASS (api unit 2023 tests) | - |
| Platform ops (409) and web (391) vitest | PASS | - |
| Platform full integration | 1485 pass, 1 skipped; ONE failure in the full run only: `pay.int.spec.ts` "PSP adapters other than the sandbox fake are NEEDS_HUMAN"; it passes alone and with all other pay suites (64/64) | OPEN: order-dependent test, cause not found (see F-PAY-1) |
| Pharmacy typecheck, lint, unit 301, web unit 73, api e2e 253 | PASS (lint was red: 2 regex errors, fixed) | FIXED |
| Lab typecheck, lint, unit 324, web unit 73, api e2e 237 | PASS (lint red: 2 errors plus an unused-directive warning, fixed; e2e had 2 stale tests, fixed) | FIXED |
| Contracts 455, pay-contract 34, staff app 460, patient app 344 | PASS | - |
| Cross-product regression suite (`e2e/`, 58 files, 595 tests) on the private stack `reg-stack.sh` | first run 550 pass, 8 fail, 37 skipped; the 8 were stale expectations (suites 25, 27 and 51: fee now decided by the seeded commission policy, a stray ACTIVE promotion of the cloned data), fixed; those three suites 16/16 and 7/7 green afterwards | FIXED |
| Clinic API typecheck, web unit 219, web lint | PASS (lint was red: 2 regex errors, fixed on both branches) | FIXED |
| Clinic Playwright still-failing specs (private stack) | `signin-default` and `theme`: GREEN now (the unified card replaced the old page); `on08-help-sample`: FIXED (shared login helper, 6-step tour); `growth-workspace`: 21 pass, 1 skip after the helper fix (the Arabic page matched the e-mail label twice); `pay-collections`: 10/10 on its own Pay stack (the failure was the missing flag fixture on the default stack); `quick-setup-clinic` (5 of 12 fail) and `quick-setup-nurse` (2): OPEN, stale against the sequential-wizard redesign (see F-QS-1) | mixed |

## 7. Playwright on private stacks (counts)

| Suite | Result |
|---|---|
| Pharmacy web (private API on the cloned regression stack) | sign-in default/edge/method 30 pass, staff management and a11y/RTL 11 pass, crash sweep 20 + growth + Kiorex tab + golden flow + passport-session-end 63 pass in the first pass (25 failed: 20 crash-sweep with the wrong API port, 4 quick-setup and 11 staff/a11y because the login helper used labels the unified card no longer has, 1 flaky axe); after the fixes everything green: quick-setup 4/4, subscription, crash sweep 20/20; 1 skipped in file |
| Lab web | sign-in default/edge/method 31 pass (2 real defects found and fixed: 320 px header overflow, flaky contrast measured mid-fade), golden flow, growth, Kiorex tab, quick setup, subscription, LIS smoke, crash sweep (all roles, EN/AR, light/dark): 96 pass, 1 skipped, 0 fail |
| Passport UI (hermetic IdP :4851) | 37 pass (includes the untracked `12-reduced-motion.spec.ts` that another session left in the working tree; it passes and was left untracked) |
| Clinic chromium project (private clone at `kiorex` tip `04d379da`, DB `e2e_kxcpw`) | `growth-workspace` 21 pass 1 skip, `on08` 2 pass, `signin-default` and `theme` pass, `pay-collections` 10/10 on its Pay stack; quick-setup specs OPEN (F-QS-1) |
| Mobile web exports against kx-test | see section 9 |

## 8. Releases and live changes made during this pass

| What | Detail |
|---|---|
| Patient web | platform `0df73d3`, built from a clean worktree with the registry-generated `web.build.env`, `check-release-bundle.sh` clean, synced to `kx-test-site-kiorex-marketplace-990597228737`, CloudFront `E2LL663XIANQEF` invalidated (`I9BNHHPE0AXHOHIR9ZGSCR4AJX`). Live check `25` Sign-out test green. |
| Clinic host headers | `tofu apply -target=module.clinic_link` (1 changed: response headers policy gets security headers, override false so the API's own headers win). The legacy distribution `d92iz83i79c05.cloudfront.net` and the Clinic App Runner were not touched. |
| Temporary lead limits | `deploy.sh test` from a clean archive of workspace HEAD with the override `LEADS_RATE_IP_PER_10MIN=80`, `LEADS_RATE_IP_PER_DAY=500` (compose, Caddyfile and guard compared byte for byte with the live release first; tags unchanged: platform `fb98333`, pharmacy-api `c3496f9`, lab-api `a650127`, passport `65305c1c`); the 35 lead tests ran; then restored with a second release from the committed override (no `LEADS_RATE_*` variable in the container; `/public/leads/config` 200). |
| Clinic main | two test-only commits cherry-picked to `main` (web-only scope, no API, no migration): run 46115141463 green. |

## 9. Findings and decisions

(see section 10 and the report)

