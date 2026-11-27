# Kiorly staff app: coverage matrix (module x role x capability)

28 Nov 2026 (UTC+4). Repo `kiorly` (plain "Kiorly", `com.kiorly.app`). No secrets, no real data. Read with `_docs/mobile/FEATURE_TIER_MATRIX.md` (tiers and backend status, 20 Nov), `_docs/mobile/ADR-033_One_Kiorly_App_Tiered_Mobile.md` and `_docs/guides/MOBILE_TESTING_GUIDE.md`.

## 0. How to read this

**Cell values**

| Value | Meaning |
|---|---|
| present | The role has the screen or action in the app today and the server lets it through. |
| partial | The role has part of it (what is missing is in the Note). |
| missing | Core daily work, not built, and nothing blocks it. Built in this pass where marked NEW. |
| web | Intentionally web-only (ADR-033: the phone is a companion, not a POS or a back office). |
| n/a | The role does not do this work (scope of practice, role design). |
| NEEDS_HUMAN | A founder or counsel decision is needed first; left out on purpose. |

**Who decides what a role sees.** Never the app. Each product's `GET /mobile/bootstrap` returns `modules[]` (and, for Lab, `permissions[]`) computed from the role; the app only shows tiles the server enabled and treats every 403 as "your role does not include this" (or the two-step verification screen for `MFA_REQUIRED`). The tables below were produced from the servers' own tables: Pharmacy and Lab by `kiorly/scripts/gen-role-matrix.mjs` (evaluates `mobile-plan.ts`, `permissions.ts`, `mobile-modules.ts`, `rbac.ts` of the two repos into `src/__tests__/fixtures/role-modules.generated.json`; the Jest suite `role-matrix.test.ts` asserts every role), Clinic from `mobile-roles.ts` mirrored in `src/__tests__/fixtures/clinic-role-modules.ts` (the Clinic file is Prisma-bound; the live servers are proven by the workspace suites `e2e/test/16..18`).

**Roles asked for** (server role names): Clinic: owner / admin (`GROUP_ADMIN` owner, `CLINIC_ADMIN`, `BRANCH_MANAGER`), doctor (`PHYSICIAN`), nurse (`NURSE`), receptionist (`RECEPTIONIST`, also `CALL_CENTER`), billing (`FINANCE_OFFICER`). Pharmacy: owner (`OWNER`), pharmacist (`PHARMACIST`), cashier (`CASHIER`), branch manager (`BRANCH_MANAGER`). Lab: owner (`OWNER`, `LAB_DIRECTOR`), technologist (`TECHNOLOGIST`), receptionist (`RECEPTION`), results reviewer (`AUTHORIZED_SIGNATORY`; sign-off only with a recorded licence number).

**Plan.** Every cell assumes a PRO or higher organisation. On a Basic organisation every role has safety alerts, the upgrade request and nothing else (entitlement `mobile_staff_app`, `Docs/ENTITLEMENTS.md`).

## 1. Clinic (and Nurse edition)

| Capability | Owner / admin | Doctor | Nurse | Receptionist | Billing | Note |
|---|---|---|---|---|---|---|
| Today's schedule and live queue | present | present | present | present | present (read) | `/clinic/schedule`; 30 s refresh; stats tiles |
| Check in an arrived patient | present | present | present | present | partial | Same server action as the web front desk; billing role has the schedule tile, the server decides |
| Mark no-show | present (NEW) | present (NEW) | present (NEW) | present (NEW) | partial | PATCH `/appointments/:id/status`; only before arrival; confirm sheet; the server decides who may and what follows (deposit policy). 403 and 409 are friendly |
| Book, cancel, reschedule | web | web | web | web | n/a | Booking uses slot rules, deposits and cancellation credit; leave on web. NEEDS_HUMAN CLN-BOOK-1: do you want mobile booking at all |
| Patient lookup and summary (allergies, problems, meds, vitals, balance, upcoming) | present | present | present | present | n/a | `/mobile/search`, `/patients/:id/summary` |
| Register a patient | web | web | web | web | n/a | Identity and consent capture stay on web |
| Quick vitals (with critical alert) | present | present | present | n/a | n/a | Online or queued; idempotent |
| Visit note (SOAP, vitals) and sign | partial (owner/`GROUP_ADMIN` only) | present | n/a | n/a | n/a | Doctor roles only; nurse-profession users never |
| Prescriptions: review and sign | partial (owner/`GROUP_ADMIN` only) | present | n/a | n/a | n/a | Creating or editing medications stays web (the PRD matrix item P1). Online only |
| Lab results: review and approve | partial (owner/`GROUP_ADMIN` only) | present | n/a (scope of practice) | n/a | n/a | Online only |
| Home-visit rounds, arrival, SOS, nursing note | partial (Nurse edition) | partial (Nurse edition) | present | partial (dispatcher, Nurse edition) | n/a | `/clinic/rounds`, safety alerts |
| Revenue snapshot | present | n/a | n/a | n/a | present | `/mobile/revenue/snapshot` |
| Kiorex commission rate and settlement statement | present (NEW) | n/a | n/a | n/a | present (NEW) | `/clinic/commission`, from Revenue. The Clinic API decides (`GET /billing/kiorex-commissions/access`): finance, and admins when the organisation enables it. Read only; payouts are bank transfers only |
| Kiorex fee statement (Growth) | present | n/a | n/a | n/a | n/a | admin level of the Growth tab |
| Growth links, QR, share | present | present (own link) | n/a | n/a | n/a | Receptionist: web |
| Collect a payment, invoices, refunds, cash close | NEEDS_HUMAN | n/a | n/a | NEEDS_HUMAN | NEEDS_HUMAN | CLN-PAY-1: collection depends on market transfer rules, transfer receipts, the CASH_TRANSFER tender treatment (LG-COM-20) and commission netting. Mock mode exists on the server, but whether staff may take money on a phone (ADR-033 says no mobile POS) is a founder decision. The outstanding balance is shown read only on the patient summary |
| Notifications, safety alerts, acknowledge | present | present | present | partial (dispatcher alerts, Nurse edition) | n/a | Inbox, badge, alert acknowledge; push permission sheet; mock push |
| Plan: ask your admin to upgrade, approvers see requests | present | present | present | present | present | Manage the plan on the web (store policy: no in-app purchase) |
| Staff, settings, subscription, reports, expenses, HR | web | n/a | n/a | n/a | web | |

## 2. Pharmacy

| Capability | Owner | Pharmacist | Cashier | Branch manager | Note |
|---|---|---|---|---|---|
| Rx verification queue and detail | present | present | partial (read only) | present | `/pharmacy/rx` |
| Validate, reject an Rx | present | present | n/a | present (validate screen) | Server permission `rx.validate` |
| Run safety checks, override with reason, pharmacist sign-off, dispense (FEFO) | present | present | n/a | partial (no sign-off or override) | Sign-off is licence-bound and never overridable per tenant |
| Kiorex orders: accept, reject, ready, out for delivery | present | present | n/a | present | Integrated organisations only; SLA countdown; online only |
| Barcode, price and stock lookup | present | present | present | present | GS1 parse, lots |
| Receiving against a purchase order | present | present | n/a | present | Partial receipts; offline queue is out of scope (R-OFF-1) |
| Stock count | present | present | n/a | present | Variance approval stays web |
| Expiry, low stock, recalled lots | present | present | present | present | |
| Controlled-drug balances and witness countersign | present | present | n/a | present | Same-user rule enforced by the server |
| Shift cash summary | present | present | present | present | Read only |
| Customer lookup | present | present | present | present | |
| Commission rate and settlement statement | present | n/a | n/a | present | Roles `OWNER`, `BRANCH_MANAGER`, `CHAIN_OPS`; read only; "not connected" state |
| Growth links, QR, share | present | partial (read) | partial (read) | present | Create and pause: owner and manager |
| Notifications, safety alerts | present | present | present | present | |
| Sell at the counter (POS), refunds, discounts, cash drawer | web | web | web | web | ADR-033: no mobile POS |
| Purchase orders, suppliers, catalogue, prices, staff, reports, finance, loyalty | web | web | n/a | web | |
| Branch transfers (Chain and Enterprise) | NEEDS_HUMAN | NEEDS_HUMAN | n/a | NEEDS_HUMAN | PH-XFER-1: tier (matrix Q9) |

## 3. Lab

| Capability | Owner | Technologist | Receptionist | Results reviewer | Note |
|---|---|---|---|---|---|
| Today's orders and bookings (list, search, status) | present | present | present | present | `/lab/orders`; Kiorex bookings arrive as orders |
| Create or edit an order or booking | web | n/a | web | n/a | Identity check, consent and price rules; NEEDS_HUMAN LAB-BOOK-1 if mobile booking is wanted |
| Sample collection (scan, collect, custody, home round) | present | n/a | present | n/a | Offline queue out of scope |
| Sample receipt and processing (accession, labels) | present | present | partial (labels, collect) | n/a | |
| Result entry (numeric, choice, text) | present (NEW) | present (NEW) | n/a | n/a | `/lab/results/<specimen>` from the work list; permission `results.enter`; instrument chooser; the server owns ranges, flags, critical limits, delta checks and QC cover |
| Second entry (dual control) | present (NEW) | present (NEW) | n/a | n/a | Blind re-key by a different person; same person refused with a plain message |
| Technical validation (with delta acknowledgement) | present | present | n/a | n/a | |
| Medical validation and report sign-off | partial (never the owner: no signatory role) | n/a | n/a | present (needs licence) | |
| Release a signed report to the patient | web | n/a | web | web | Ready-to-sign and signed-not-released lists are shown. Releasing needs a delivery channel the patient consented to. NEEDS_HUMAN LAB-REL-1: which channels staff may choose on a phone |
| Critical values: list, read-back acknowledgement | present | present | n/a | present | |
| QC status, blocks, Levey-Jennings (read) | present | present | n/a | present | Configuration stays web |
| TAT board, reagents low stock and expiry | present | present | partial (TAT only) | partial (TAT only) | |
| Commission rate and settlement statement | present | n/a | n/a | n/a | Roles `OWNER`, `LAB_DIRECTOR`, `BRANCH_MANAGER`, `FINANCE`; read only |
| Growth links, QR, share | present | n/a | partial (read) | partial (read) | |
| Notifications, safety alerts | present | present | present | present | |
| Instruments, analyzers, catalogue, pricing, staff, billing, exports, microbiology, histopathology | web | web | web | web | |

## 4. Cross-cutting (all three modules)

| Capability | State |
|---|---|
| Sign-in with Kiorex Passport (phone OTP), password for Clinic and Pharmacy, dev sign-in never in a shipped build | present |
| Friendly `MFA_REQUIRED` (two-step verification needed) and 403 role states, 401 session expiry, 409 conflict, 5xx and network error states with retry | present (every screen goes through `ErrorState` or a product error mapper; Jest and Playwright cover them) |
| "Not connected to Kiorex" states (commission cards, statements) | present |
| EN and AR with RTL, dark mode, 44 px targets, accessibility labels | present |
| No localhost hosts in a shipped build (hosts come from the URL registry profile) | present (guarded by `env-profiles.test.ts`, the kx-test bundle test and `check-no-dev-test-users.mjs`) |
| Push permission sheet and mock token registration | present |
| Deep links (`kiorly://`, `kiorly-test://`) and push-tap routing | present |
| Offline reads (24 h cache) | present; writes online only except vitals, notes, collect, count lines (R-OFF-1 covers the full outage and sync work and is OUT of scope here) |
| Real push delivery, store builds, universal link verification | NEEDS_HUMAN (credentials, Apple and Google accounts) |

## 5. What this pass built (NEW rows above)

1. **Lab result entry and second entry** (`app/(tabs)/(more)/lab/results/[specimenId].tsx`, `src/modules/lab/entry.ts`). Needs a Lab API that understands `GET /worklist?specimenId=` (additive, `kiorly-lab` commit `5548b72`): the plain list is capped at the oldest 200 processing specimens, so a busy bench could not open a recent one. An older API ignores the parameter and the screen still works for specimens inside the first 200.
2. **Clinic Kiorex commission** (rate and settlement statement) reusing the Pharmacy and Lab cards, link from Revenue.
3. **Clinic no-show** from the schedule.
4. **Role matrix tests** for every role of the three products.

## 6. Decisions needed (nothing was invented)

| Id | Question |
|---|---|
| CLN-PAY-1 | May staff collect payments on the phone (invoices, visit balance, cash close)? If yes: which methods, receipts for transfers, tender kinds for commission (LG-COM-20), who approves refunds. |
| CLN-BOOK-1 | Mobile booking, cancel and reschedule: yes or no (deposit and credit consequences). |
| LAB-REL-1 | Which release channels may the receptionist or reviewer choose on a phone, and does the app show the consent state first. |
| LAB-BOOK-1 | Create a lab order or booking from the phone? |
| PH-XFER-1 | Branch transfers on the phone for Chain and Enterprise (matrix Q9). |
| API-MOBILE-1 | Ask the Clinic API owner to publish `clinic.billing` and `clinic.commission` in `/mobile/bootstrap` so those tiles are server-driven like the others (today the commission screen is reached from Revenue and asks the Clinic's own access probe). |
