# KX-30 — Attribution, Referrals, Rewards and Commission Architecture

Revision: Rev 2.4 · Growth Edition, as-built verified 24 November 2026 (new volume; owner: Chief Software Architect with the CEO for money policy; supersedes: Rev 2.4 draft 1 of this volume)

Subtitle: The rules that decide where a patient came from, whether Kiorex charges its fee, how a provider can verify it, and how referral rewards would work if counsel clears them.

Tags: Attribution · Commission · Evidence · Disputes · Referrals · Rewards ledger · Fraud · Versioned policy · ADR-042 · ADR-046

> **Note** How to read this volume. Rev 2.4 re-checked every rule against the decision function (`kiorex-platform/apps/api/src/growth/attribution/decide.ts`), the commission gate (`clinics-management/apps/api/src/kiorex/commission-decision.ts`), the defaults (`growth-defaults.ts`) and their tests. Sections 02 to 08 now say As-built where code and a passing test exist and Proposed where the design is not built. Referral and rewards (sections 09 and 10) are Roadmap and blocked on a legal assessment. The money promise is simple: evidence can remove a fee, it can never add one.

| Field | Value |
|---|---|
| DOCUMENT | KX-30 |
| REVISION | Rev 2.4 · Growth Edition (24 November 2026) |
| STATUS | Engine and commission integration As-built locally; defaults are `PROPOSED_DEFAULT` until the CEO signs (ADR-042 stays Proposed); rewards blocked on legal assessment (ADR-046) |
| OWNER ROLE | Chief Software Architect; CEO for any commission policy |
| AUDIENCE | Engineering, finance, provider success, counsel |
| RELATED | KX-12 (monetisation); KX-09 (money flows); KX-13; KX-27; KX-28; KX-32; ADR-007 |

## Revision history
| Revision | Date | Change | Author |
|---|---|---|---|
| Rev 2.4 draft 1 | 24 Nov 2026 | First issue from architecture decisions sections 6, 9, 10 and 16 | Documentation agent |
| Rev 2.4 | 24 Nov 2026 | Re-verified against code: token lifetimes (72 h provider-link token, 30 min in-session token), inclusive windows, `FIRST_TOUCH` refusal, reason codes of the commission gate, link revocation behaviour, evidence and dispute path, fraud rules actually built; status labels moved to As-built | Documentation agent |

## Contents
01 Summary · 02 As-built commission engine · 03 Concepts · 04 Identity and consent · 05 Windows and policy · 06 Decision algorithm · 07 Chargeability and the charge · 08 Evidence, disputes and audit · 09 Patient referral · 10 Rewards, ledger and configuration · 11 Fraud · 12 Worked examples and tests · 13 Acceptance, KPIs, risks, dependencies, open decisions

## Key numbers
<!-- kpis -->
- **EGP 40** flat fee per attended new patient (ADR-007, unchanged)
- **24 months** new-patient lookback (As-built)
- **3** origins: `PROVIDER_LED`, `MARKETPLACE`, `UNATTRIBUTED`
- **30 / 30 / 7 days** windows (provider, referral, campaign), built as `PROPOSED_DEFAULT` and editable only through two-person config versions
- **7 days** minimum notice before a money policy takes effect

## Status legend (read first)
Every statement in this volume carries one of these labels, in a column, a prefix or a callout. Phase 1 is now built locally; the labels separate what runs from what is only designed.

| Label | Meaning | Rule for readers |
|---|---|---|
| **As-built** | Exists in code with a passing test in the workspace, verified by reading the repositories and re-running the suites on 24 Nov 2026 (Rev 2.4). Local only: not deployed, not run against a real provider | Safe to rely on for behaviour in the local stack |
| **Approved target** | Accepted by the founder as an ADR or founder decision (FD) | Binding. No growth ADR (ADR-041 to ADR-047) has been accepted, so this label marks only rules inherited from existing Accepted ADRs |
| **Proposed** | Designed in the Growth reports of 24 Nov 2026 and written up here, not yet signed (ADR-041 to ADR-047) | Build only after sign-off, or inside a work package the founder released |
| **Roadmap** | Phase 2 to 4 capability, scoped coarsely | Do not build; estimates are ranges |
| **Open decision** | A founder or CEO choice with a stated default | Use the default, never decide silently |
| **Regulatory dependency** | Needs counsel, DPO, a regulator position or a partner approval (NEEDS_HUMAN) | Flag stays OFF in production until evidence is recorded; never mark a gate satisfied |

> **Warning** Nothing in this volume has run in production, against a real ad platform, search engine, WhatsApp number or payment provider. Messaging and provider integrations stay MOCKED until the pre-launch pass (FD-04). Numbers marked ASSUMPTION are starting hypotheses, not forecasts.

## 01 Summary
Three promises, in order of importance. (1) A provider is never charged for a patient they brought through their own link, QR or widget. (2) Every charge and every non-charge can be explained from stored facts, and the explanation can be replayed. (3) Kiorex cannot quietly change the rules: policy is versioned data, approved by two people, effective-dated, and each decision cites the version that applied.

## 02 As-built commission engine
The first nine rows are the engine as it was before Phase 1 and are unchanged; the last row is what Phase 1 added.
| Fact | Detail | Label |
|---|---|---|
| Booking source | Enum `FRONT_DESK, PHONE, WALK_IN, CLINIC_LINK, KIOREX_MARKETPLACE, KIOREX_WHATSAPP, INTEGRATION, IMPORT` stamped on the appointment | As-built |
| New patient | `isNewPatientAtBooking` frozen at booking, 24-month lookback on E.164 phone and national id; `newPatientCheckedAt` | As-built |
| Chargeability | `isCommissionChargeableBooking(source, isNew)` is false for `CLINIC_LINK` and for non-new patients; true for `KIOREX_MARKETPLACE`, `KIOREX_WHATSAPP`, `INTEGRATION` | As-built |
| Charge | `KiorexCommissionCharge`, one per appointment (`appointmentId` unique), states PENDING, CONFIRMED, DISPUTED, REVERSED, WAIVED, BILLED; `disputeDeadline`; effective-dated rate table with narrowing by profession, service location and specialty | As-built |
| Disputes | `CommissionDispute`; auto-dispute rules; events `COMMISSION_CHARGE_CREATED` and `COMMISSION_CHARGE_REVERSED` | As-built |
| Billing | Monthly: the higher of subscription S and commission C, never both (KX-12) | As-built (design rule) |
| WhatsApp channel | `KIOREX_WHATSAPP` is sent only when `KIORLY_ACCEPTS_WHATSAPP_CHANNEL` is on, else mapped to `KIOREX_MARKETPLACE` | As-built (debt C8) |
| Evidence layer (added by Phase 1) | Touchpoints, decisions, link tokens, the signed `acquisition` block, the append-only `KiorexCommissionDecision`, the `PROVIDER_LED_EVIDENCE` dispute path and `CommissionAdjusted` now exist; `attributionJson` stays a display bag. See section 07 and KX-28 section 02 | As-built (Rev 2.4) |

## 03 Concepts
| Term | Meaning | Label |
|---|---|---|
| AcquisitionSource | A stable label `(sourceKind, sourceRef)` such as `PROVIDER_LINK:<code>`, `PROVIDER_QR:<code>`, `WIDGET:<id>`, `ORGANIC_SEARCH:google`, `DIRECT`, `REFERRAL:<code>`, `CAMPAIGN:<code>`, `WHATSAPP:<entry>`, `OFFLINE:<by>`; taxonomy is configuration | As-built (`GrowthAcquisitionSource`, `GrowthTouchpoint`, `GrowthAttributionDecision`) |
| Touchpoint | One immutable observation: visitor or subject, source, time, landing kind, normalised UTM, referrer host, provider organisation if provider-owned | As-built (`GrowthAcquisitionSource`, `GrowthTouchpoint`, `GrowthAttributionDecision`) |
| Attribution decision | One immutable result per booking and policy version, with reason code and inputs hash | As-built (`GrowthAcquisitionSource`, `GrowthTouchpoint`, `GrowthAttributionDecision`) |
| Origin (`acquisitionOrigin`) | The commission-relevant class: `PROVIDER_LED`, `MARKETPLACE`, `UNATTRIBUTED` | As-built (`GrowthAcquisitionSource`, `GrowthTouchpoint`, `GrowthAttributionDecision`) |
| Reporting attribution | First touch, last touch, last non-direct touch pointers kept on the decision for analytics only, never for commission | As-built (`GrowthAcquisitionSource`, `GrowthTouchpoint`, `GrowthAttributionDecision`) |

`BookingSource` values are not added or renamed. The new `acquisitionOrigin` is orthogonal (it fixes debt C8: provider-led but booked through the marketplace has no enum value). Reporting pointers (first, last, last non-direct) are stored on the decision and never used for commission (As-built).

## 04 Identity and consent
| Situation | Identity used | Handling | Label |
|---|---|---|---|
| Visitor opens a provider link and books in the same session | Signed `lt` token, no cookie, no storage before consent; stored on the booking intent only. Two formats are verified: the Clinic's provider-link token `kx-lt1` (valid **72 hours**, shared Clinic secret, clock skew tolerance 5 minutes) and the in-session `kxl1.` token minted by Kiorex tooling (default **30 minutes**, `ltTokenTtlMinutes`, HMAC key `GROWTH_LINK_TOKEN_SECRET`; no key at all in production when unset) | Contractual necessity: the patient asked to book with that provider (counsel to confirm) | As-built, Regulatory dependency |
| Visitor returns later within the window | Host-only `kxv` cookie (Secure, SameSite=Lax, 180 days maximum) created only after analytics and attribution consent | PDPL consent for non-essential identification (counsel) | As-built but locked: the flag `growth.analytics_visitor` is launch-locked and no gate evidence is recorded, so no visitor key is issued; Regulatory dependency |
| Logged-in patient | Passport `sub`, linked to earlier visitor touches only with consent | | Proposed (not built) |
| No consent | Only the in-session `lt` and the booking channel; fall back to the explicit channel rule | Accepted loss of cross-session provider credit | As-built |

Never stored (As-built, enforced by `growth-no-phi.unit.spec.ts`, the touch sanitiser and the event guard): IP address (a keyed hash with a daily-rotating salt for rate limiting and fraud, kept 24 hours), full user agent, full referrer URL, unknown query parameters, device fingerprints, any health information, search text.

> **Note** Honest limits. (1) An `lt` token is not bound to a person: anyone holding a provider link token inside its 72 hour window books fee-free (edge-case report, risk 2); revocation and the window bound it, a per-session binding is a product decision. (2) The patient mobile app never receives `lt` (app links carry the public code only). (3) Cross-session provider credit depends on consent and on the same browser or account. Most volume therefore rides the explicit channel rule: a provider link that opens the widget and books in that flow. The product should steer providers toward links that book directly, not "find us on Kiorex" mentions.

## 05 Windows and policy
All values below are the built defaults (`growth-defaults.ts`, marked `PROPOSED_DEFAULT`), read from `GrowthConfigVersion kind=ATTRIBUTION_POLICY` per market with a materialised default when no version is ACTIVE. Windows are inclusive at the edge (a touch exactly 30 days old still counts). Classes without their own window (organic, direct) use the provider window. As-built.

| Parameter | Default | Meaning |
|---|---|---|
| `providerTouchWindowDays` | 30 | Provider link, QR, desk, widget, provider-owned deep link |
| `patientReferralWindowDays` | 30 | Referral click to registration or booking |
| `campaignClickWindowDays` | 7 | Paid or owned campaign click |
| `campaignViewWindowHours` | 0 | View-through off |
| `visitorKeyMaxDays` | 180 | Cookie lifetime cap |
| `newPatientLookbackMonths` | 24 | As-built (market pack `featureDefaults.newPatient.lookbackMonths`) |
| `touchEvidenceRetentionMonths` | 25 | Touches that a decision considered are anonymised on erasure and kept 25 months; touches never used by a decision are deleted at 13 months (`unlinkedTouchRetentionMonths`) |
| `ltTokenTtlMinutes` | 30 | Lifetime of the in-session `kxl1.` token; the Clinic provider-link token is fixed at 72 hours in code |
| `minDwellMsForProviderTouch` | 1000 | A provider touch counts only if the page actually rendered |
| `precedence` | `PROVIDER_FIRST` | Alternatives `LAST_NON_DIRECT`. `FIRST_TOUCH` is reporting only: `decide()` throws for it and the policy loader falls back to `PROVIDER_FIRST` rather than failing a booking |
| `allowOfflineEvidence` | false | Printed card or desk-entered source counts only if ON, before check-in, by a staff user |

Versioning (ADR-047 is Proposed; the mechanism is As-built in `GrowthConfigService`; five kinds have contract schemas and are editable: `ATTRIBUTION_POLICY`, `SEO`, `WIDGET_POLICY`, `CONSENT_DEFAULTS`, `MARKET_GROWTH`): `GrowthConfigVersion(kind, scope, version, status, payload, effectiveFrom, effectiveTo, createdBy, approvedBy, checksum, supersedesId)`. States DRAFT, PENDING_APPROVAL, APPROVED, ACTIVE, SUPERSEDED, REJECTED, ROLLED_BACK. A rollback creates a new version copying an older payload; old rows are never edited. Approver differs from creator and both are super admins (service, API and a database CHECK). Guardrails refuse a window change of more than x2 or /2 per version. An approved version dated in the future cannot be withdrawn, only superseded (known gap). For `ATTRIBUTION_POLICY` and commission kinds, `effectiveFrom` must be at least 7 days after approval and an announcement text goes to providers (wording is NEEDS_HUMAN). `resolve(kind, scope, at)` returns the one ACTIVE version whose window contains `at`.

## 06 Decision algorithm
A pure function with no input or output side effects (As-built: `decide.ts`; 65 table cases, a 1,000-scenario property test of determinism, order independence, replay and monotonicity, and `attribution.int.spec.ts` for one row under 12 parallel calls). Input: booking `{id, orgId, clinicId, doctorId, createdAt, channel, sub?, visitorKey?, ltToken?}`, touches that occurred before booking creation for the same visitor key or subject within the window, and policy version V.

Flow: explicit provider channel → prior provider touch → patient referral → any marketplace touch → no evidence

1. If `channel = CLINIC_LINK` or a valid `lt` for the same organisation: `PROVIDER_LED`, reason `EXPLICIT_PROVIDER_CHANNEL`. Today's `CLINIC_LINK` rule is the special case.
2. Else if provider-owned touches (`PROVIDER_LINK`, `PROVIDER_QR`, `WIDGET`, and `OFFLINE` only when `allowOfflineEvidence`) for the same organisation exist inside `providerTouchWindowDays` and were rendered (dwell at or above `minDwellMsForProviderTouch`; offline evidence is exempt from dwell): under `PROVIDER_FIRST`, `PROVIDER_LED`, reason `PRIOR_PROVIDER_TOUCH`, evidence the latest such touch. Under `LAST_NON_DIRECT`, provider-led only when the latest non-direct touch is provider-owned.
3. Else if a patient-referral touch exists in the window: `MARKETPLACE`, reason `PATIENT_REFERRAL`.
4. Else if any marketplace touch exists (search, SEO, campaign, direct app): `MARKETPLACE`, reason `MARKETPLACE_TOUCH`.
5. Else `UNATTRIBUTED`, treated as `MARKETPLACE` for chargeability, reason `NO_PROVIDER_EVIDENCE`.

Only touches strictly before the booking intent count. Ties inside a class: the greatest `occurredAt`, then the smallest id. The decision stores `policyVersionId`, `inputsHash = sha256(canonical JSON of the booking subset and ordered touch ids with timestamps)` and `reasonCode`. Replaying the function on stored inputs must reproduce the stored result. The decision is persisted before the call to the clinic so a retry reuses it; it is idempotent on (booking, policy version) and a correction creates one superseding row (never turning `PROVIDER_LED` into a chargeable origin).

## 07 Chargeability and the charge
```
chargeable = origin != PROVIDER_LED
          && isNewPatientAtBooking == true          // 24-month rule, frozen at booking
          && bookingSource in {KIOREX_MARKETPLACE, KIOREX_WHATSAPP, INTEGRATION}
          && bookingSource != CLINIC_LINK           // unchanged
          && !followUpVisit                          // BR55, existing rule, now named in the decision
```
The function is `isCommissionChargeableBooking` plus `decideCommissionGate` (As-built; matrix tests in the Clinic unit and integration suites).
Provider-led protection is an extra way to be non-chargeable, never a way to charge more. Any rule that charges more than today is a provider-terms change and an Open decision for the CEO; it is not proposed.

| Step | Behaviour | Label |
|---|---|---|
| Intake | Kiorex sends optional `acquisition { origin, decisionId, policyVersion, reason, evidenceHash, touch }` on the signed booking call (covered by the request HMAC); the clinic stores `acquisitionOrigin`, `acquisitionDecisionRef`, `acquisitionPolicyVersion` and keeps `attributionJson` for display. Absent block: origin `UNATTRIBUTED`, today's rules unchanged. Flag `growth.attribution` OFF sends no block and no `lt` (request identical to before) | As-built (contracts 1.10.0, 1.11.0 adds optional `lt` on the booking body) |
| At check-in | The charge service calls the extended `isCommissionChargeableBooking(source, isNew, origin)` and writes an append-only `KiorexCommissionDecision` (`origin, isNewPatient, bookingSource, decision CHARGE, NO_CHARGE or WAIVED, reasonCodes, rateId, amount, inputsHash`) integrated in `onCheckIn`. Unique per appointment and policy version, where the commission policy version is `CP1@<validFrom of the rate in force>` (not the growth config version). Reason codes: `PROVIDER_LED`, `CLINIC_LINK_CHANNEL`, `FOLLOW_UP_VISIT` (BR55), `RETURNING_PATIENT`, `SOURCE_NOT_COMMISSIONABLE`, `NO_RATE_CONFIGURED`, `NO_MARKET`, `KIOREX_NEW_PATIENT`, `MARKETPLACE_ORIGIN`, `UNATTRIBUTED_TREATED_AS_MARKETPLACE`, `PROVIDER_LED_EVIDENCE`, `MANUAL_OVERRIDE`. The gate itself returns only CHARGE or NO_CHARGE; WAIVED exists in the enum for waiver outcomes | As-built |
| No charge | No `KiorexCommissionCharge` is created (as today) but the decision row exists; the monthly statement shows `providerLedBookings` and reconciles against charges | As-built |
| Amount | Unchanged: effective-dated rate, EGP 40 placeholder | As-built |
| Lifecycle | PENDING to CONFIRMED on completion or after 24 hours (`AUTO_CONFIRM_MS`), billed monthly at max(S, C) | As-built |
| Provider view | "Booked through your links: N (no fee); through Kiorex: M (fee applies to new patients)" from decisions: monthly statement counters, workspace and staff app fee card (equal to the statement in e2e 27) | As-built |

## 08 Evidence, disputes and audit
- `GrowthTouchpoint` and `GrowthAttributionDecision` (Kiorex) and `KiorexCommissionDecision` (Clinic) are append-only by database trigger (As-built). Erasure and retention run through `SECURITY DEFINER` functions that write an audit row. Honest limit: a database role that sets the maintenance marker itself could bypass the touchpoint trigger (decisions have no bypass); production role separation is NEEDS_HUMAN.
- Corrections create a new decision with `supersedesId`, actor, note and audit; old rows stay; one correction per decision (As-built, super admin only).
- Evidence per booking: `GET /growth/v1/evidence/:bookingId` for an ops session or a signed Clinic call with `X-Kiorly-Org-Ref`; the Clinic's `GrowthEvidence` client signs with the partner request HMAC (a live-mode defect was found and fixed in the gap-closure wave; the opt-in live test is `growth-evidence-live.integration.test.ts`). It shows source kind, link label, times, reason code and policy version, never patient identity. Gap: partner credentials per organisation are not issued, a shared Clinic secret is used and the organisation header is a claim (NEEDS_HUMAN). As-built
- Dispute reason `PROVIDER_LED_EVIDENCE` is built: if the provider disputes a charge and Kiorex evidence shows a provider touch in the window that the original decision missed, the dispute is auto-approved, the charge is reversed, a `+PLE` decision row is appended and `CommissionAdjusted` is emitted; a second dispute is refused; without evidence the dispute stays OPEN (e2e 27). `COMMISSION_CHARGE_REVERSED` stays for full reversal. As-built
- Offline evidence (`allowOfflineEvidence`, default false): the decision function honours `OFFLINE` touches, but no endpoint writes them yet (the touch service has no offline path). Proposed, not built
- A provider help page that publishes the rules is not built (Proposed). The provider already sees the reason code and policy version per booking. Platform override exists (`MANUAL_OVERRIDE`: platform only, closed reason list, note required, removal only, audited, emits `CommissionAdjusted`). As-built
- Existing safeguards kept: `disputeDeadline` (30 days by market pack), `commission-dispute-auto.ts` rules (As-built).
- **Link revocation (As-built, contracts 1.11.0).** The Clinic emits `ReferralLinkCreated` and `ReferralLinkRevoked` and serves the signed lookup `GET /referral-links/{code}`; Kiorex `LinkRegistryService` stores `linkStatus`, confirms unknown codes through the lookup and reconciles hourly. A revoked or paused code never decides `PROVIDER_LED` for a NEW booking (its touches are filtered and the `lt` is not forwarded). Decisions already written stay (append-only). A REVOKED code never returns to ACTIVE. Residual risk: a still-valid signed token the registry has not yet seen as revoked can keep deciding inside its 72 hours, and it can only remove a fee.

## 09 Patient referral (Roadmap, Regulatory dependency)
Naming: `PatientReferral*` and `ProviderReferralLink*` only. `ReferralIssued` is a clinical event (a doctor refers a patient to a physio, contracts 1.9.0) and the clinic `Referral` and `ReferralCode` models are the supply-side doctor-to-doctor programme (CR-09, "1 month free both sides"); neither is reused.

| Rule | Detail |
|---|---|
| Qualification | Reward issues only after the referee's first attended visit, after the refund and dispute window, referee phone verified through Passport OTP, referee not an existing patient of that provider network within the lookback |
| Anti-fraud by construction | Referrer and referee do not share phone, payment fingerprint or Passport device sessions (shape of the existing supply-side `referral-fraud.ts`); velocity cap per referrer per 30 days; scored cases go to a review queue |
| Privacy | The referrer never sees who the referee is, which provider or any health detail, only "a friend you invited completed their first visit" |
| Attribution | A referral touch makes the booking `MARKETPLACE` (Kiorex-acquired); reward qualification continues separately |
| Document gap | BR12 in KX-02 and KX-12 covers provider referral only; the patient programme needs its own business rule number (Open decision) |

## 10 Rewards, ledger and configuration (Roadmap)
Properties (Proposed, counsel-gated, ADR-046): closed loop (usable only against Kiorex bookings: deposits or the patient share of a Kiorex-collected fee), non-transferable, non-cashable, no top-up, no interest, expiry (default 12 months, mirroring the SaaS credit expiry in BR12), capped per person per year, discount only.

> **Risk** Whether any Egyptian central-bank, fintech or consumer-protection rule treats such credit as stored value or e-money is unknown to this volume and must be assessed before any build. Fallback if a wallet is regulated: a plain coupon code applied at checkout with no balance object, using the same ledger as audit. Accounting treatment (marketing expense versus liability) needs finance.

`RewardLedgerEntry(id, lotId, type ISSUE|REDEEM|REVERSE|EXPIRE, amountMinor, currency, idempotencyKey unique, ruleVersionId, subRef, bookingId?, relationshipId?, createdAt, createdBy)` is append-only; balance is a sum and nothing is edited. It is a **fourth ledger**, separate from Kiorex Pay (`LedgerTx`), held deposits and the clinic SaaS `CreditLedgerEntry`; the three As-built ledgers are never commingled and the fourth joins them with the same rule.

Feature switches (flags control plane, ADR-023; defaults per catalogue conventions; launch-locked where noted): `growth.provider_links`, `growth.attribution`, `growth.ssr_public_pages`, `growth.seo_landing_pages`, `growth.widgets`, `growth.deep_links`, `growth.analytics_visitor` (launch-locked until counsel), `growth.marketing_messaging` (launch-locked), `growth.campaigns`, `growth.patient_referral` (launch-locked), `growth.rewards` (launch-locked), `kiorex.whatsapp_ai_assistant` (launch-locked until the safety review), `growth.experiments`, `growth.integrations.<kind>`. Config kinds: `ATTRIBUTION_POLICY`, `SEO`, `WIDGET_POLICY`, `CONSENT_DEFAULTS`, `COMMS_CAPS`, `INTEGRATIONS`, `MARKET_GROWTH` (Phase 1); `CAMPAIGN_GUARDRAILS`, `REWARDS` (Phase 2); `EXPERIMENT_GUARDRAILS` (Phase 3). Switches stay in flags, values in config versions.

## 11 Fraud
| Signal (Phase 1) | Rule |
|---|---|
| Click without render | Touch counts only above the dwell minimum (As-built, `CLICK_WITHOUT_RENDER` signal) |
| Burst per `ipHash` | Rate limit and `GrowthFraudSignal` rule `BURST_PER_IP_HASH` (As-built) |
| Provider-led share jump | Rule `PROVIDER_LED_SHARE_JUMP`: last day versus 30-day baseline, jump of 0.35 or more with a minimum sample; review queue in the ops console. Signals never change a decision by themselves (As-built) |
| Forged or expired `lt` | Ignored; never creates provider-led (As-built; 22 forged shapes, 72 h and skew edges in e2e 42) |
| Clinic attempts to set origin | Not possible: only Kiorex creates `acquisitionOrigin`; the Clinic cannot turn a decision into a chargeable origin (As-built) |
Fraud thresholds are code constants or policy values, shown read-only in the ops console. Phase 2 adds patient-level signals and a two-person review for reward reversal; Phase 3 adds scoring.

## 12 Worked examples and tests
| Case | Source | New patient | Origin | Result |
|---|---|---|---|---|
| 1 | Patient opens provider QR, books in the widget | yes | `PROVIDER_LED`, `EXPLICIT_PROVIDER_CHANNEL` | No charge; decision row |
| 2 | Patient searches Kiorex, books, attended | yes | `MARKETPLACE`, `MARKETPLACE_TOUCH` | Charge at the current rate |
| 3 | Patient with history at this provider network within 24 months books via Kiorex | no | any | No charge (existing rule) |
| 4 | Patient clicked provider link 10 days ago (consent given), later booked from Kiorex search | yes | `PROVIDER_LED`, `PRIOR_PROVIDER_TOUCH` under `PROVIDER_FIRST` | No charge |
| 5 | Same as 4 without consent, no `lt` | yes | `MARKETPLACE` | Charge; provider can dispute with evidence if a later consent exposes the touch |
| 6 | Provider link of another organisation only | yes | `MARKETPLACE` | Other organisation's touch is ignored |
| 7 | Older Kiorex build sends no block | any | `UNATTRIBUTED` | Today's rules |
| 8 | Touch at exactly 30 days (inside, inclusive), 30 days 1 second (outside) | yes | inside versus outside | Boundary tests (As-built, `decide.unit.spec.ts`) |

Tests (As-built, GRW-P1-B, D2; the requirement was): at least 40 decision-table cases covering every branch, ties, window edges, missing consent, other-organisation touches, short dwell and `LAST_NON_DIRECT`; a property test that replay equals stored output; a matrix `source x newPatient x origin` in the clinic where `PROVIDER_LED` never charges and an absent origin equals today's behaviour.

## 13 Acceptance criteria, KPIs, risks, dependencies, open decisions
- Acceptance: KX-27 section 07 and the GRW-P1-B, C, D2 criteria in KX-33 (met locally; see KX-33 section 04 for gaps).
- KPIs: decision determinism 100 percent; disputes attributable to attribution below 3 percent of charges; provider-led share; share of bookings with a decision row 100 percent.
- Risks: a provider games provider-led status (dwell, anomaly rules, audit sampling); Kiorex perceived as biased (public rules, evidence); policy error (rollback by new version, RB-G1 in KX-28); legal reading of "consent" for the `kxv` cookie (counsel).
- Dependencies: contracts 1.10.0 and 1.11.0 (built); the Phase 1 migrations (applied locally); provider terms update (open).
- Open decisions: `PROVIDER_FIRST` default; windows; no charge for provider-led-then-marketplace; patient-referral BR number; reward programme go or no-go.
- Cross-references: KX-12 (BR12, monetisation), KX-09 (money flows), KX-28 sections 06 to 09, KX-32 (revenue definitions).
