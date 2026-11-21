# Staff app: role-by-role end-to-end report (21 Nov 2026)

> **Scope.** Kiorly Work (`kiorly-work`, still titled "Kiorly Work") for every Clinic, Pharmacy and Lab demo role, on the app routes (`/mobile/*`) **and** on the web (each product's web API, plus the staff app's Expo web build driven by Playwright). Seeded demo data only. Persona and login tables: [`DEMO_DATA.md`](../../DEMO_DATA.md) and `kiorly-work/DEMO_DATA.md`.

## Result
| Layer | Suite | Result |
|---|---|---|
| App routes vs web API, Clinic | `e2e/test/16-staff-mobile-clinic.e2e.ts` | 46 passed |
| App routes vs web API, Pharmacy | `e2e/test/17-staff-mobile-pharmacy.e2e.ts` | 30 passed |
| App routes vs web API, Lab | `e2e/test/18-staff-mobile-lab.e2e.ts` | 34 passed |
| Expo web, per role (Playwright, real APIs) | `kiorly-work/e2e-web/{clinic-roles,pharmacy-staff,lab-staff}.spec.ts` | clinic 6, pharmacy 19, lab 20 passed (run by the authoring agents against their own web builds; not re-run after the final API restart) |
| Unit | `kiorly-work` jest 127; backends' mobile node tests; `tsc` clean in all four | green |

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

## Found, not fixed (decisions or schema changes needed)
1. Lab `release-queue` keeps a signed-but-unreleased order under "ready to sign" (re-sign 409); a naive fix would hide amendments.
2. Lab summary `ordersToday` uses the UTC day; the app uses local midnight (disagree 00:00-02:00 Cairo).
3. Replayed home-visit transitions answer 409 (shown as a conflict in Sync); a same-state transition could be treated as OK. Arrival is not checked against the district geofence (mock maps).
4. Kiorex-side mirror of pharmacy orders and live lab bookings need `KIOREX_MODE=real` flag pollers; the dev stack runs them without polling a dev gate.

## Not covered
Native camera, biometrics, push tokens, a physical device, the offline conflict UI (only server idempotency), Passport sign-in for the staff app (not registered), and the Pharmacy/Lab modules on iOS/Android simulators.
