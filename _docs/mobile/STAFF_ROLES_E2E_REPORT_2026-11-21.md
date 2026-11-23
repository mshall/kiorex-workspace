# Staff app: role-by-role end-to-end report (21 Nov 2026)

> **Scope.** Kiorly, the staff app (named Kiorly Team when this report was written; repo `kiorly-team`, being renamed to `kiorly`; formerly `kiorly-work`) for every Clinic, Pharmacy and Lab demo role, on the app routes (`/mobile/*`) **and** on the web (each product's web API, plus the staff app's Expo web build driven by Playwright). Seeded demo data only. Persona and login tables: [`DEMO_DATA.md`](../../DEMO_DATA.md) and `kiorly-team/DEMO_DATA.md`.

## Result
| Layer | Suite | Result |
|---|---|---|
| App routes vs web API, Clinic | `e2e/test/16-staff-mobile-clinic.e2e.ts` | 46 passed |
| App routes vs web API, Pharmacy | `e2e/test/17-staff-mobile-pharmacy.e2e.ts` | 30 passed |
| App routes vs web API, Lab | `e2e/test/18-staff-mobile-lab.e2e.ts` | 34 passed |
| Expo web, per role (Playwright, real APIs) | `kiorly-team/e2e-web/{clinic-roles,pharmacy-staff,lab-staff}.spec.ts` | clinic 6, pharmacy 19, lab 20 passed (run by the authoring agents against their own web builds; not re-run after the final API restart) |
| Unit | `kiorly-team` jest 140; backends' mobile node tests; `tsc` clean in all four | green |

Run: `e2e/scripts/up.sh --build --restart`, then `cd e2e && npx vitest run test/16-… test/17-… test/18-…`. The suites create fresh fixtures per run and cap-tolerate the shared demo DB.

## What each role is proven to do (and not do)
* **Clinic.** Front desk checks in (idempotent); nurse records vitals incl. a critical value that raises a safety alert to nurse/manager/owner (not front desk); doctor reads the queue, writes SOAP, signs a prescription (a second sign 409s; other doctor and nurse refused) and approves a critical lab result once; accountant/manager/owner revenue equals the web totals; solo nurse Mona and agency nurses run a home visit (depart, arrive, SOS visible on app and web, unsafe abort, nursing note then finished); device register and remote sign-out kill the tokens.
* **Pharmacy.** Pharmacist validates, overrides an interaction block with a reason and signs off, then dispenses FEFO; cashier cannot validate, receive, count or witness; assistant/manager receive a PO (partial then full) and count stock (manager approves); recalled lot raises a critical alert; controlled-drug discrepancy needs a different witness; online orders progress and reject; shift open/close reconciles.
* **Lab.** Reception creates a STAT order; phlebotomist collects by scan (wrong tube refused); tech receives, runs QC, enters a critical value with dual control; the alert reaches director/signatory/tech/owner only; read-back acknowledgement is idempotent; only a signatory with a licence signs (owner refused); reception releases; QC failure blocks release; TAT breach alerts once.
* **Lite / BASIC (all three products).** `entitlement.enabled=false`, no modules, `safetyAlertsOnly`, every `/mobile/*` route except alerts and upgrade-request answers 403 `FEATURE_DISABLED`; the web is unaffected. The app shows role-specific locked tiles and one upgrade request (de-duplicated for 24 h).

## Bugs found and fixed
| Area | Bug | Fix |
|---|---|---|
| Clinic API | `/mobile/search`, `/prescriptions`, `/lab-results` open to every role (accountant, front desk could read Rx and labs) | 403 `MODULE_NOT_ALLOWED`, matching bootstrap |
| Clinic API | offline replay of `POST /mobile/vitals` stored the reading, alert and push twice | idempotent on `Idempotency-Key` |
| Clinic API | revenue snapshot used UTC days, "today" differed from the web around midnight | local day, same as web |
| Clinic API | repeated check-in issued a second ticket and payment | returns the existing ticket |
| Lab API | owner offered a sign-off screen the server refuses | `modulesForRole(role, licence)` |
| Pharmacy API | recalled lot invisible on expiry screen; no alert for a recalled lot without a notice; `lots?status=bad` returned 500; managers had no validate screen | blocked-stock section, alert, 400, `rx.validate` |
| Staff app | web/production builds ignored `EXPO_PUBLIC_*_API` (Metro does not inline `process.env`) | literal reads + jest guard |
| Staff app | home-visit "Finish visit" always 400 (needs a finalized nursing note) | nursing-note card |
| Staff app | pharmacy: validated Rx dead end, role-blind buttons, 402 after sign-off shown as error, non-overridable WARN blocked sign-off, money rounded to whole pounds | `rxActions(status, role)`, `signedPendingPayment`, `formatMoney(digits)` |
| Staff app | lab sign-off button shown from the licence flag alone | driven by the server `sign-off` screen |
| Staff app | greeting "Good morning, Dr" | honorifics skipped |

## Founder decisions applied (21 Nov 2026)
1. **Dispatcher** (receptionist or call-centre user in a Nurse-edition org) now gets the home-visit module and the org's home-visit safety alerts (SOS, missed check-in, nurse safety) in the app, and read access to `/home-visits/safety-alerts` on the web (acknowledge/resolve stay manager-only). No clinical record access. Clinic front desk is unchanged.
2. **Lab critical-value read-back note** is stored on web and app acknowledgements alike (`CriticalAlert.readBackNote`, 500 chars, first acknowledger wins, never in notifications or audit text).
3. **Finance officer** no longer has Admin tabs (operations, expenses, revenue, reports, profile); branch manager keeps branch admin.
4. **Lite owners** see staff upgrade requests on the Home upgrade card (bootstrap `upgrade.openRequestItems`, approvers only, excluding their own), with a count badge on Me.

## Open items fixed afterwards (21 Nov 2026)
* **Lab release queue** now returns `{readyToSign, readyToRelease, signedNotReleased}`; a signed order no longer shows as ready to sign (re-sign 409).
* **Lab "today"** uses local midnight in `LAB_TIMEZONE` (default Africa/Cairo).
* **Replayed home-visit transitions** by the assigned clinician are idempotent (200, `replayed:true`); illegal ones still 409.
* **Arrival distance**: stored as `arrivalDistanceM` / `arrivedOffSite` (default threshold 500 m, `HOME_VISIT_ARRIVAL_THRESHOLD_M`), never blocks, shown only to dispatchers/owners (web badge, `/mobile/schedule`).
* **Lite plan gate beats permission errors** on every `/mobile` route in all three products (`FEATURE_DISABLED` first).
* **Staff app**: notification permission asked via a one-time explanatory sheet (14-day "Not now", Me > Notifications switch); first-run direction banner in Expo Go and a guarded reload in real builds; Android clipped status pill fixed (`numberOfLines={1}` on Badge/Chip/Button labels); optional upgrade note; lab approver follows the server `canApprove`.
* **Patient app**: forms lift above the keyboard (`KeyboardForm`, verified on the iPhone simulator). **Platform**: Kiorex DB client honours `sslrootcert` / `DATABASE_SSL_CA` / `PGSSLROOTCERT`; web and ops lint at zero warnings with the React Compiler rules on; TypeScript 7 type-checks cleanly (blockers are tooling only, see `kiorex-platform/Docs/UPGRADE_NOTES.md`); seed image aligned to Node 24 (Lambda runtime).
* **Clinic web** lint: 246 warnings to 0, golden-flow and RBAC Playwright smoke green.
* **Seeds/docs**: `seed-all.sh` runs the mobile seeds; dev scripts no longer touch ports 3000/5173/5175; pharmacy recall notice and an open lab alert seeded; DEMO_DATA counts corrected and verified; contracts fixtures cover all 35 personas; pharmacy/lab web default to 5192/5193.

## Still open (updated 22 Nov 2026)
Resolved since 21 Nov: automatic RTL reload verified on real iOS and Android development builds; Android re-check of Arabic labels and the light-mode pass done (keyboard handling added to the staff app); raw status enums and Latin-digit countdowns fixed; pharmacy consent/AI/storage adapters wired; push registration, deep-link routing and payload fixtures built and verified on the iOS simulator. Details: [DEVICE_TEST_REPORT_2026-11-20.md](./DEVICE_TEST_REPORT_2026-11-20.md) and [../PROVIDER_GO_LIVE.md](../PROVIDER_GO_LIVE.md).
1. Real push delivery (APNs/FCM), Android push, the home-screen badge number and a background-state tap are unverified: they need an EAS projectId, an APNs key, an FCM v1 key and `PUSH_MODE=real`.
2. A release (production) build and the language switch in Me were not run on a dev build.
3. The seed Docker image has not been built (`docker build -f apps/api/Dockerfile.seed .` before the next deploy).
4. Kiorex-side mirror of pharmacy orders and live lab bookings needs `KIOREX_MODE=real` flag polling (already on in `e2e/scripts/up.sh`; not exercised on a deployed stack).
5. The app is still titled "Kiorly" until the mobile design pack is approved.
6. Real vendors for SMS/Email/WhatsApp/payments/consent/AI/storage: URLs and credentials only (see the provider guide).

## Not covered
Native camera, biometrics, push tokens, a physical device, the offline conflict UI (only server idempotency), Passport sign-in for the staff app (not registered), and the Pharmacy/Lab modules on iOS/Android simulators.
