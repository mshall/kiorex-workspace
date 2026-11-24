# KX09 — Integration Contracts, Events & Money Flows

Source: 1p5Hwgw5gCg7L3A6gsIVxYcN2p6WZKUl7
Revision: Rev 2.4 · Reference Edition, updated 24 November 2026 (previous: Rev 2.3, 23 November 2026; this update adds the Rev 2.4 as-built section at the end, status-labelled)

## What changed in Rev 2.3
Additive (minor) contract version: provider sync adds profession, edition, service locations and coverage districts; slots accept serviceLocation=HOME; holds carry visitAddress. New events HOME_VISIT_ASSIGNED / _EN_ROUTE / _ABORTED_UNSAFE, SAFETY_ALERT_RAISED, CARE_PLAN_*, ReferralIssued, MedicationOrderShared. Money flows: home surcharge, cash at home, agency nurse pay, deposit hold on unsafe abort.

Every cross-product call, event and money movement in the ecosystem — with guarantees, failure handling and reconciliation.

Authored in the role of Principal Integration Architect. Owns contracts between products and the correctness of money across them.

Tags: HMAC API · Outbox events · Idempotency · Kiorex Pay ledger · Home visits · Reconciliation

| Field | Value |
|---|---|
| DOCUMENT | KX09 (03 — Technical documents) |
| REVISION | Rev 2.4 · Reference Edition (updated 24 Nov 2026) |
| DATE | 23 November 2026 (first issued 20 November 2026) |
| STATUS | Approved reference |
| AUDIENCE | Engineering, finance operations, auditors |
| OWNER ROLE | Principal Integration Architect |
| SUPERSEDES | KX09 Rev 2.1 19 Nov 2026 |

## Contents

01 Integration principles · 02 Authentication between products · 03 Command catalogue (Kiorex → Kiorly Clinic) · 04 Event catalogue · 05 Booking consistency and failure handling · 06 Money flows · 07 Contract governance

## 01 Integration principles

- **Contract-first.** OpenAPI and event JSON Schemas live in kiorex-contracts; producers and consumers pin versions; breaking changes fail CI in both repos.
- **At-least-once, idempotent.** Every command carries an idempotency key; every event an eventId; consumers de-duplicate.
- **Outbox, not dual writes.** Events are written in the same DB transaction as the state change and dispatched with retries (5 s loop, exponential backoff, DEAD after 8).
- **Authority is explicit.** The producer of a fact is its system of record; consumers keep projections with source version. Home visits are Kiorly facts.

## 02 Authentication between products

Headers on every Kiorex → Kiorly call (scope MARKETPLACE):

```
X-Kiorly-Client-Key: <client key>
X-Kiorly-Client-Secret: <client secret>
X-Kiorly-Timestamp: <unix epoch milliseconds>   # rejected if |skew| > 5 min
X-Kiorly-Nonce: <uuid>                           # single-use within window
X-Kiorly-Signature: base64url(HMAC-SHA256(secret, TIMESTAMP \n NONCE \n METHOD \n PATH \n sha256hex(BODY)))
# source: apps/api/src/marketplace/marketplace-hmac.ts
```

Webhooks Kiorly → Kiorex: X-Kiorly-Event-Id, X-Kiorly-Signature over body {eventId,type,aggregateType,aggregateId,occurredAt,data}.

Optional IP allow-list per client. Secrets rotate every 90 days with overlap (two active secrets). Platform admin UI for client issuance is a Kiorly follow-up. The same client serves both Kiorly editions (Clinic and Nurse).

## 03 Command catalogue (Kiorex → Kiorly Clinic)

| Command | Endpoint | Idempotency | Errors to handle |
|---|---|---|---|
| Sync providers | GET /marketplace/v1/providers?updatedSince&page&pageSize — v2.3 adds profession, edition, serviceLocations[], coverageDistricts[], verification.register, assignsClinician (agencies) | Read | 429 → backoff |
| Get slots | GET /marketplace/v1/clinics/:clinicId/slots — v2.3 adds serviceLocation=HOME&district=<code>[&lat&lng] | Read (60 s cache) | 404 listing not LIVE; 422 OUT_OF_COVERAGE |
| Hold slot | POST /marketplace/v1/holds — v2.3 optional visitAddress {district, line1, building, floor, flat, landmark, lat, lng}, required for HOME types | externalRef unique | 409 SLOT_TAKEN (3 alternatives) |
| Release hold | DELETE /marketplace/v1/holds/:id | Natural | 404 already expired |
| Book | POST /marketplace/v1/bookings (address carried from hold) | Idempotency-Key = Kiorex booking ID | 409, 422, timeout → GET by ref |
| Get booking | GET /marketplace/v1/bookings/:externalRef | Read | 404 → not created |
| Cancel / reschedule | POST /bookings/:ref/cancel \| reschedule | Per ref + state | 422 *_WINDOW_CLOSED, RESCHEDULE_LIMIT_REACHED |
| Deposit paid | POST /bookings/:ref/deposit-paid | paymentRef | 409 duplicate |
| Payout | POST /marketplace/v1/payouts | payoutRef | 409 duplicate |
| Reviews | POST /marketplace/v1/reviews/aggregate | Upsert per appointment | rejected[]: NOT_A_COMPLETED_VISIT |
| Profile views | POST /marketplace/v1/analytics/profile-views | Replace per day | 400 items |
| Care-plan request (P3) | POST /marketplace/v1/care-plan-requests | requestRef | 422 provider does not offer care plans |

## 04 Event catalogue

| Event | Producer | Consumers | Key guarantee |
|---|---|---|---|
| APPOINTMENT_CONFIRMED / RESCHEDULED | Kiorly Clinic | Kiorex | Ordered per appointment aggregate |
| CANCELLED_BY_CLINIC / _BY_PATIENT | Kiorly Clinic | Kiorex | Carries reason and depositRefundable |
| CHECKED_IN / CHECK_IN_REVERTED / COMPLETED / NO_SHOW | Kiorly Clinic | Kiorex | Drives commission + review eligibility; home visits carry serviceLocation=HOME and arrival time |
| SLOTS_CHANGED / PROVIDER_PROFILE_UPDATED / LISTING_STATUS_CHANGED | Kiorly Clinic | Kiorex search | Cache invalidation |
| COMMISSION_CHARGE_CREATED / _REVERSED | Kiorly Clinic | Kiorex finance view | Unique per appointment |
| REVIEW_INVITATION_ELIGIBLE / REVIEW_REPLY_POSTED | Kiorly Clinic | Kiorex trust | Only completed Kiorex-channel visits |
| HOME_VISIT_ASSIGNED (v2.3) | Kiorly Clinic (Clinic or Nurse edition) | Kiorex | Assignee display name, photo URL, badge; never a phone number |
| HOME_VISIT_EN_ROUTE (v2.3) | Kiorly Clinic | Kiorex | Ordered per appointment; optional coarse ETA |
| HOME_VISIT_ABORTED_UNSAFE (v2.3) | Kiorly Clinic | Kiorex ops | Never triggers no-show or deposit forfeiture without review |
| SAFETY_ALERT_RAISED (v2.3) | Kiorly Clinic | Org safety contact; Kiorex ops (Kiorex bookings) | Delivered ≤ 60 s; on-call alarm if undelivered |
| CARE_PLAN_CONFIRMED / _ENDED (v2.3, P3) | Kiorly Clinic (Nurse edition) | Kiorex | Plan schedule with appointment IDs |
| ReferralIssued (v2.3) | Kiorly Clinic | Kiorly Clinic (another tenant, e.g. physio) via Kiorex consent | Patient consent token required |
| MedicationOrderShared (v2.3) | Kiorly Clinic | Kiorly Clinic (Nurse-edition tenant) via Kiorex consent | Signed order version; expiry |
| PrescriptionIssued (v2) | Kiorly Clinic | Kiorly Pharmacy via Kiorex | Patient consent token required |
| OrderReady / DispenseCompleted / OrderRejected (v2) | Kiorly Pharmacy | Kiorex | Pharmacist sign-off present |
| LabResultReleased (v2) | Kiorly Lab | Kiorex vault, Kiorly Clinic / Nurse | Signed version + secure link only |
| subject.deleted / session.revoked | Kiorex Account | All | Back-channel; products retain legal records |

Example payload:

```json
{
  "eventId": "01JF…",
  "type": "APPOINTMENT_CONFIRMED",
  "aggregateType": "Appointment",
  "aggregateId": "apt_…",
  "occurredAt": "2027-03-04T09:12:44Z",
  "data": {
    "externalReference": "kx_bk_…",
    "clinicId": "…",
    "clinicianId": "…",
    "startsAt": "…",
    "endsAt": "…",
    "bookingSource": "KIOREX_MARKETPLACE",
    "isNewPatientAtBooking": true,
    "serviceLocation": "HOME",
    "version": 3
  }
}
```

## 05 Booking consistency and failure handling

Sequence (Kiorex, Kiorly API, Kiorly DB, Outbox):

1. POST /holds (externalRef + address)
2. Insert hold, expires 5 min
3. 201 holdId
4. POST /bookings (Idempotency-Key)
5. tx: appointment + outbox row (stored HOME address)
6. Timeout ✕
7. GET /bookings/:ref (no retry)
8. 200 CONFIRMED
9. Webhook APPOINTMENT_CONFIRMED

Timeout path: query by reference before any retry; never mint a new key.

| Failure | Detection | Response |
|---|---|---|
| Hold expired before book | 422 / 404 on book | Re-fetch slots; offer alternatives |
| Double click / app retry | Same Idempotency-Key | Kiorly returns original result |
| Kiorly unavailable | 5xx / circuit open | Show 'provider system busy', keep intent PENDING, retry via GET; pause new holds for that provider |
| Webhook delivery fails | Outbox lag > 2 min alarm | Exponential retry; DEAD after 8 → ops replay (Admin → Outbox) |
| Kiorex missed events | Nightly reconciliation diff | Pull GET /bookings for intents in non-terminal states > 24 h |
| Payment captured, booking failed | Ledger vs booking state | Automatic refund; incident if > 0.1% of bookings |
| Address out of coverage after zone change | 422 OUT_OF_COVERAGE on book | Release hold; show in-zone alternatives |
| Safety alert not delivered | No ack from safety contact in 10 min | Escalate to Kiorex ops on-call (Kiorex bookings) and org owner |

## 06 Money flows

Three separate ledgers, never commingled: Kiorly SaaS billing, provider patient revenue, Kiorex Pay; the credit ledgers below are additional and separate (Proposed for the patient side).

Figure — Deposits flow through Kiorex Pay to providers; Kiorly's own revenue comes from the monthly higher-of invoice.

- Patient deposit (deposits · prepayments) → capture via PSP (Paymob · Fawry) → Kiorex Pay → payout (weekly) → Provider (Kiorly patient revenue; postRevenue)
- Pay at clinic → collected by Clinic
- Provider → monthly invoice → Kiorly billing (SaaS invoice max(S,C)) → Kiorex company account

| Ledger | Owner | Entries | Reconciled against |
|---|---|---|---|
| Kiorex Pay | kiorex-platform | deposit captured, refund, forfeiture, hold-for-review (unsafe abort), payout, PSP fee, held balance | PSP settlement reports (daily) + Kiorly deposit records |
| Provider patient revenue | Kiorly Clinic (both editions) | revenue (incl. home surcharge), refunds, credit notes, deposits → BillingPayment at check-in, cash at home per clinician drawer | Cash close / Z-report; bank |
| Kiorly SaaS | Kiorly billing (kernel) | subscription, seats, add-ons, commission, offset, prepaid, credits, VAT | PSP + bank; settlement summary JSON |
| Credit wallet | Kernel | grant, consume FIFO, expire, late-reversal credit | Σ ledger = balance invariant |
| Patient credit ledger (Proposed, not built) | kiorex-platform (`growth/rewards`) | issue, reserve, redeem, reverse, expire, hold; refund-credit issue; checkout line snapshot | Σ lot ledger = balance; Σ checkout lines = price; refund allocation invariant; no entry names a provider wallet (RC-1 to RC-7) |
| Provider credit wallet (As-built CR-05, extended by P2-W, Proposed) | Kiorly Clinic (`credits`) | grant (onboarding, connect, referral, dispute win, goodwill), consume (fees, subscription, usage, sponsored promotion), expire, reverse | Σ ledger = balance, per category; daily balance check; no patient identifier (W-1 to W-8) |
| Sponsored discount flow (Proposed, not built) | Kiorly Clinic (`promotions`) with the Kiorex booking line | RESERVE at booking, DEBIT at completion, RELEASE on cancel, REVERSE_DEBIT on refund | budget entries = wallet entries for the promotion; each DEBIT has one Kiorex booking line in state DEBITED (RC-S1 to RC-S5) |

Home surcharge is provider patient revenue; Kiorex never takes a share of it and it never enters S or C.

**Credit and sponsored discount money flows (Proposed, ADR-048; Rev 2.5 amendment).** Two credit systems, never commingled with each other, with Kiorex Pay, or with held deposits: **patient credit** (Kiorex, closed loop, spendable only on Kiorex bookings) and **provider credit** (Kiorly, the CR-05 wallet). No conversion, no transfer, no cash-out, no patient top-up. Patient deposits remain in the Kiorex Pay held ledger until the visit and are never provider credit.

| Tender at checkout (order: sponsored price reduction, credit, held deposit, card) | Who funds it | Ledger that records it | Reaches the clinic as |
|---|---|---|---|
| Sponsored discount | the clinic, from its credit wallet, debited at visit completion (budget reserved at booking) | Clinic `PromotionBudgetEntry` and wallet entry; Kiorex booking line `PROVIDER_SPONSORED_DISCOUNT` | part of the gross payout, funded by the wallet debit |
| Patient credit | Kiorex (marketing cost) or the patient's own refunded money (refund credit) | Kiorex patient credit ledger; booking line `PATIENT_CREDIT` | part of the gross payout; the clinic's income is not reduced by Kiorex-funded credit |
| Card | the patient | Kiorex Pay | the deposit, as today |
Example: deposit 500, sponsored 100, credit 150, card 250: the patient pays 250, Kiorex Pay pays the clinic the gross 500 after completion, the clinic wallet is debited 100, the fee is unchanged. A refund returns credit to credit and card to the chosen destination (original method by default), and a sponsored share is voided. Contract additions (1.12.0, additive): optional `sponsoredDiscount` block on the booking call, `feeBasisMinor`, `sponsoredDiscountMinor` and `basisPolicyVersion` on `COMMISSION_CHARGE_CREATED`, optional `tender` on deposit events (no patient identity), promotion events and the reserve and release commands. Posting of these funding lines into the Kiorex Pay ledger is off by default until finance decides (H-25). Status: Proposed, nothing built except the CR-05 wallet.

Cash at home is recorded to the clinician's cash drawer and reconciled at shift close; agencies see per-nurse cash owed. Agency nurse pay is calculated in Kiorly (MN02 revenue share) and paid by the agency; Kiorex Pay never pays individual agency nurses.

Unsafe abort: the deposit is held for ops review instead of auto-forfeit.

RULE: Commission charges are created by Kiorly, not Kiorex — the provider system sees the attendance (in clinic: check-in; at home: arrival geostamp). Kiorex receives COMMISSION_CHARGE_* events for reporting only. This removes any argument about who decides a patient attended.

## 07 Contract governance

- Semver per contract; additive changes are minor; removing/renaming fields is major and needs 90-day dual support. The v2.3 changes are all additive (minor).
- Consumer-driven contract tests: Kiorex's expectations file runs in Kiorly CI (already shipped: kiorex-consumer-contract.json) and Kiorly's spec in Kiorex CI (NH019).
- Event schema registry in kiorex-contracts/events/*.schema.json; payloads validated at dispatch in non-production.
- Deprecations announced in the Kiorly Docs hub and the ops console banner.

## 08 Contract versions and the notify entry (23 Nov 2026)
`@kiorex/contracts` is consumed by all products from a vendored tarball until publishing to GitHub Packages is approved (FD-20).

| Version | Date | Content | Status |
|---|---|---|---|
| 1.5.0 | 20 Nov | Home-visit OpenAPI additions (profession, edition, serviceLocation, coverage, `OUT_OF_COVERAGE`), Rev 2.3 events, 15 flag keys, never-a-flag safety controls | Done |
| 1.6.0 | 20 Nov | Nurse-collected lab hand-off (`nurseCollection`, `identifiersChecked`, source `KIORLY_NURSE`), custody read, Kiorex status push, `originEdition` | Done |
| 1.7.0 | 23 Nov | New subpath `@kiorex/contracts/notify`: intent, template registry, PHI guard, routing, consent gate, normalized statuses, audit record, `ChannelAdapter`, mock adapters | Done; additive minor, root entry point unchanged |

The notify entry is a library contract, not a wire contract: products do not call each other to notify. Webhook receipts from vendors use the neutral body `{ "events": [ { "id", "status", "error?", "occurredAt?" } ] }`, signed with HMAC-SHA256 over the raw body and a timestamp (5 min tolerance), de-duplicated and applied forward-only. Cross-product HMAC REST and outbox webhooks (sections 02 to 05) are unchanged.

| Item | Status |
|---|---|
| `/mobile/*` staff API contract (bootstrap, alerts, devices, upgrade request) | Open: implemented by hand in three backends, not in contracts; drift risk (mobile risk R11); generated client Planned |
| Kiorex flag key for `mobile_staff_app` | Open: not yet in the flag catalogue (cross-repo TODO) |
| `comms.*` flags and `comms/*` schemas (control plane, KX24 §10) | Planned (Proposed) |
| Pharmacy and Lab consumers pin the vendored tarball | Open: pharmacy and lab still reference `file:../kiorex-contracts` in places (FD-20) |

## What changed in this revision (23 Nov 2026)
- Added §08: contracts 1.5.0 to 1.7.0 history, the notify entry, the vendor webhook convention and open contract items.
- Command and event catalogues, booking consistency, money flows and governance rules are unchanged; all changes were additive minors.
- Not verified: the Pharmacy and Lab pin state beyond what FD-20 says.

## Growth Engine update (24 Nov 2026)
Labels: **As-built** (in code today), **Approved target** (Accepted ADR or FD), **Proposed** (ADR-041 to ADR-047, unsigned), **Roadmap**, **Open decision**, **Regulatory dependency**. Full legend in KX-27. Source: `_docs/growth/` reports of 24 Nov 2026. Nothing here is implemented unless marked As-built. Rev 2.4: where this section differs from the Rev 2.4 as-built update at the end of the volume, the end section wins.

**Contracts 1.10.0 (Proposed, additive minor; As-built is 1.9.0).** No event is renamed or removed; consumers that ignore unknown fields keep validating.

| Change | Status |
|---|---|
| Optional `acquisition { origin, decisionId, policyVersion, reason, evidenceHash, touch }` on `POST /marketplace/v1/bookings`; response unchanged | Proposed |
| `COMMISSION_CHARGE_CREATED`: additive `decisionRef`, `origin`, `policyVersion` | Proposed |
| `PROVIDER_PROFILE_UPDATED`: additive `widgetOrigins[]` | Proposed |
| New events `CommissionAdjusted`, `PatientConsentUpdated` | Proposed |
| New OpenAPI `kiorex-growth.v1`: `POST /growth/v1/touch`, `POST /growth/v1/events`, `GET /api/v1/bootstrap` | Proposed |
| Flag catalogue: `growth.*` keys; config JSON Schemas shared with the ops UI | Proposed |
| Naming rule: growth events are PascalCase; `ReferralIssued` stays clinical; patient referral uses `PatientReferral*` | Proposed |
| Internal Kiorex outbox events (not published): `AttributionAssigned`, `PatientAcquisitionRecorded`, `PatientRegistered`; Phase 2 reward and campaign events | Proposed, Roadmap |

Money flows (section 06): the reward ledger would be a **fourth** ledger, never commingled with Kiorex Pay, held deposits or the clinic SaaS credit ledger (Roadmap, counsel-gated). Fee amount and charge lifecycle are unchanged. Detail: KX-28 section 08 and KX-30.

## Rev 2.4 as-built update (24 Nov 2026)
Rev 2.4 verification (24 Nov 2026): checked against the repositories, with the suites re-run the same day (counts in KX-33 section 04). As-built means in code with a passing test on the local stack; nothing is deployed or pushed and every provider is mocked. This section wins over the Growth Engine update above wherever they differ.

- **Contracts 1.10.0 and 1.11.0 (As-built, both additive).** Marketplace OpenAPI 1.5.0 (30 paths): optional `acquisition` block and `attribution` on `POST /bookings` (400 `ACQUISITION_BLOCK_INVALID`, `ACQUISITION_EVIDENCE_HASH_INVALID`), optional `lt`, signed lookup `GET /referral-links/{code}` and feed `GET /referral-links`. New `kiorex-growth.v1` (1.0.0): `POST /growth/v1/touch`, `POST /growth/v1/events`, `GET /growth/v1/evidence/{bookingId}`, `GET /bootstrap`. Partner intake `kiorex-partner-intake.v1` (1.0.0): `connection-requests`; the lead and funnel endpoints are NOT published (follow-up). Webhooks `kiorex-webhooks.v1` 1.1.0 includes `/auth/backchannel-logout`. 56 event schemas.
- **Events (As-built).** `CommissionAdjusted` (clinic), `PatientConsentUpdated` (kiorex), `ReferralLinkCreated` (now with `orgRef` and `clinicRef`), `ReferralLinkRevoked` (new), internal `AttributionAssigned` and `PatientAcquisitionRecorded`; additive optional `decisionRef`, `origin`, `policyVersion` on `COMMISSION_CHARGE_CREATED` and `COMMISSION_CHARGE_REVERSED`, `widgetOrigins[]` on `PROVIDER_PROFILE_UPDATED`, `acquisitionOrigin` on appointment status events, and `isNewPatientAtBooking` on the Clinic's appointment events. The acquisition block is covered by the existing request HMAC; the evidence hash is canonical JSON v1.
- **Config schemas and flags (As-built).** Five JSON Schemas (`ATTRIBUTION_POLICY`, `SEO`, `WIDGET_POLICY`, `CONSENT_DEFAULTS`, `MARKET_GROWTH`); 71 flag keys (14 added by growth).
- **Distribution (As-built).** Vendored tarballs are refreshed in the platform, pharmacy and lab (`dist-pack/kiorex-contracts-1.11.0.tgz`, lockfile integrity fixed; Docker `npm ci` passes). A contracts test proves 1.11.0 is a superset of 1.10.0.
- **Telehealth (gap).** The additive `telehealth` block on Clinic events and the `VIDEO` location are consumed by Kiorex but are not in `@kiorex/contracts` 1.11.0; Kiorex tolerates missing and extra fields. Open: publish the schemas.
- **Money flows are unchanged.** Evidence can only remove a fee; the fee, the dispute window and the monthly billing rule are as in KX-12.
- Not verified: per-organisation partner credentials for evidence and lookup calls (a shared Clinic secret is used).
