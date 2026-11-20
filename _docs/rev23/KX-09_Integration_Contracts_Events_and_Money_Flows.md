# KX09 — Integration Contracts, Events & Money Flows

Source: 1p5Hwgw5gCg7L3A6gsIVxYcN2p6WZKUl7
Revision: Rev 2.3 · Reference Edition · 20 November 2026 (supersedes KX09 Rev 2.1, 19 Nov 2026)

## What changed in Rev 2.3
Additive (minor) contract version: provider sync adds profession, edition, service locations and coverage districts; slots accept serviceLocation=HOME; holds carry visitAddress. New events HOME_VISIT_ASSIGNED / _EN_ROUTE / _ABORTED_UNSAFE, SAFETY_ALERT_RAISED, CARE_PLAN_*, ReferralIssued, MedicationOrderShared. Money flows: home surcharge, cash at home, agency nurse pay, deposit hold on unsafe abort.

Every cross-product call, event and money movement in the ecosystem — with guarantees, failure handling and reconciliation.

Authored in the role of Principal Integration Architect. Owns contracts between products and the correctness of money across them.

Tags: HMAC API · Outbox events · Idempotency · Kiorex Pay ledger · Home visits · Reconciliation

| Field | Value |
|---|---|
| DOCUMENT | KX09 (03 — Technical documents) |
| REVISION | Rev 2.3 · Reference Edition |
| DATE | 20 November 2026 |
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

Three separate ledgers, never commingled: Kiorly SaaS billing, provider patient revenue, Kiorex Pay.

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

Home surcharge is provider patient revenue; Kiorex never takes a share of it and it never enters S or C.

Cash at home is recorded to the clinician's cash drawer and reconciled at shift close; agencies see per-nurse cash owed. Agency nurse pay is calculated in Kiorly (MN02 revenue share) and paid by the agency; Kiorex Pay never pays individual agency nurses.

Unsafe abort: the deposit is held for ops review instead of auto-forfeit.

RULE: Commission charges are created by Kiorly, not Kiorex — the provider system sees the attendance (in clinic: check-in; at home: arrival geostamp). Kiorex receives COMMISSION_CHARGE_* events for reporting only. This removes any argument about who decides a patient attended.

## 07 Contract governance

- Semver per contract; additive changes are minor; removing/renaming fields is major and needs 90-day dual support. The v2.3 changes are all additive (minor).
- Consumer-driven contract tests: Kiorex's expectations file runs in Kiorly CI (already shipped: kiorex-consumer-contract.json) and Kiorly's spec in Kiorex CI (NH019).
- Event schema registry in kiorex-contracts/events/*.schema.json; payloads validated at dispatch in non-production.
- Deprecations announced in the Kiorly Docs hub and the ops console banner.
