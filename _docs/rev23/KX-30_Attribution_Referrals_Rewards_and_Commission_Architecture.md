# KX-30 — Attribution, Referrals, Rewards and Commission Architecture

Revision: Rev 2.4 draft 1 · Growth Edition, 24 November 2026 (new volume; owner: Chief Software Architect with the CEO for money policy; supersedes: none)

Subtitle: The rules that decide where a patient came from, whether Kiorex charges its fee, how a provider can verify it, and how referral rewards would work if counsel clears them.

Tags: Attribution · Commission · Evidence · Disputes · Referrals · Rewards ledger · Fraud · Versioned policy · ADR-042 · ADR-046

> **Note** How to read this volume. Sections 02 and 03 state what is built. Sections 04 to 08 are the Proposed design (ADR-042). Sections 09 and 10 cover referral and rewards, which are Roadmap and blocked on a legal assessment. The money promise is simple: evidence can remove a fee, it can never add one.

| Field | Value |
|---|---|
| DOCUMENT | KX-30 |
| REVISION | Rev 2.4 draft 1 · Growth Edition (24 November 2026) |
| STATUS | Proposed (ADR-042 needs a founder money decision; ADR-046 blocked on legal assessment) |
| OWNER ROLE | Chief Software Architect; CEO for any commission policy |
| AUDIENCE | Engineering, finance, provider success, counsel |
| RELATED | KX-12 (monetisation); KX-09 (money flows); KX-13; KX-27; KX-28; KX-32; ADR-007 |

## Revision history
| Revision | Date | Change | Author |
|---|---|---|---|
| Rev 2.4 draft 1 | 24 Nov 2026 | First issue from architecture decisions sections 6, 9, 10 and 16 | Documentation agent |

## Contents
01 Summary · 02 As-built commission engine · 03 Concepts · 04 Identity and consent · 05 Windows and policy · 06 Decision algorithm · 07 Chargeability and the charge · 08 Evidence, disputes and audit · 09 Patient referral · 10 Rewards, ledger and configuration · 11 Fraud · 12 Worked examples and tests · 13 Acceptance, KPIs, risks, dependencies, open decisions

## Key numbers
<!-- kpis -->
- **EGP 40** flat fee per attended new patient (ADR-007, unchanged)
- **24 months** new-patient lookback (As-built)
- **3** origins: `PROVIDER_LED`, `MARKETPLACE`, `UNATTRIBUTED`
- **30 / 30 / 7 days** proposed windows (provider, referral, campaign)
- **7 days** minimum notice before a money policy takes effect

## Status legend (read first)
Every statement in this volume carries one of these labels, in a column, a prefix or a callout. Growth Engine Phase 1 is being implemented by other agents while this volume is written, so the labels matter more than usual.

| Label | Meaning | Rule for readers |
|---|---|---|
| **As-built** | Exists in code and tests in the workspace, verified by reading the repositories on 24 Nov 2026 (discovery) and re-checked for the items named in KX-28 §02 | Safe to rely on. Everything not listed as As-built does not exist yet |
| **Approved target** | Accepted by the founder as an ADR or founder decision (FD) | Binding. As of this revision no growth ADR is Accepted, so this label marks only rules inherited from existing Accepted ADRs |
| **Proposed** | Designed in the Growth reports of 24 Nov 2026 and written up here, not yet signed (ADR-041 to ADR-047) | Build only after sign-off, or inside a work package the founder released |
| **Roadmap** | Phase 2 to 4 capability, scoped coarsely | Do not build; estimates are ranges |
| **Open decision** | A founder or CEO choice with a stated default | Use the default, never decide silently |
| **Regulatory dependency** | Needs counsel, DPO, a regulator position or a partner approval (NEEDS_HUMAN) | Flag stays OFF in production until evidence is recorded; never mark a gate satisfied |

> **Warning** Nothing in this volume has run in production, against a real ad platform, search engine, WhatsApp number or payment provider. Messaging and provider integrations stay MOCKED until the pre-launch pass (FD-04). Numbers marked ASSUMPTION are starting hypotheses, not forecasts.

## 01 Summary
Three promises, in order of importance. (1) A provider is never charged for a patient they brought through their own link, QR or widget. (2) Every charge and every non-charge can be explained from stored facts, and the explanation can be replayed. (3) Kiorex cannot quietly change the rules: policy is versioned data, approved by two people, effective-dated, and each decision cites the version that applied.

## 02 As-built commission engine
| Fact | Detail | Label |
|---|---|---|
| Booking source | Enum `FRONT_DESK, PHONE, WALK_IN, CLINIC_LINK, KIOREX_MARKETPLACE, KIOREX_WHATSAPP, INTEGRATION, IMPORT` stamped on the appointment | As-built |
| New patient | `isNewPatientAtBooking` frozen at booking, 24-month lookback on E.164 phone and national id; `newPatientCheckedAt` | As-built |
| Chargeability | `isCommissionChargeableBooking(source, isNew)` is false for `CLINIC_LINK` and for non-new patients; true for `KIOREX_MARKETPLACE`, `KIOREX_WHATSAPP`, `INTEGRATION` | As-built |
| Charge | `KiorexCommissionCharge`, one per appointment (`appointmentId` unique), states PENDING, CONFIRMED, DISPUTED, REVERSED, WAIVED, BILLED; `disputeDeadline`; effective-dated rate table with narrowing by profession, service location and specialty | As-built |
| Disputes | `CommissionDispute`; auto-dispute rules; events `COMMISSION_CHARGE_CREATED` and `COMMISSION_CHARGE_REVERSED` | As-built |
| Billing | Monthly: the higher of subscription S and commission C, never both (KX-12) | As-built (design rule) |
| WhatsApp channel | `KIOREX_WHATSAPP` is sent only when `KIORLY_ACCEPTS_WHATSAPP_CHANNEL` is on, else mapped to `KIOREX_MARKETPLACE` | As-built (debt C8) |
| What is missing | Touchpoint evidence, UTM capture, visitor identity, link tracking, a decision record; `attributionJson` is a free-form bag | As-built gap |

## 03 Concepts
| Term | Meaning | Label |
|---|---|---|
| AcquisitionSource | A stable label `(sourceKind, sourceRef)` such as `PROVIDER_LINK:<code>`, `PROVIDER_QR:<code>`, `WIDGET:<id>`, `ORGANIC_SEARCH:google`, `DIRECT`, `REFERRAL:<code>`, `CAMPAIGN:<code>`, `WHATSAPP:<entry>`, `OFFLINE:<by>`; taxonomy is configuration | Proposed |
| Touchpoint | One immutable observation: visitor or subject, source, time, landing kind, normalised UTM, referrer host, provider organisation if provider-owned | Proposed |
| Attribution decision | One immutable result per booking and policy version, with reason code and inputs hash | Proposed |
| Origin (`acquisitionOrigin`) | The commission-relevant class: `PROVIDER_LED`, `MARKETPLACE`, `UNATTRIBUTED` | Proposed |
| Reporting attribution | First touch, last touch, last non-direct touch pointers kept on the decision for analytics only, never for commission | Proposed |

`BookingSource` values are not added or renamed. The new `acquisitionOrigin` is orthogonal (it fixes debt C8: provider-led but booked through the marketplace has no enum value).

## 04 Identity and consent
| Situation | Identity used | Handling | Label |
|---|---|---|---|
| Visitor opens a provider link and books in the same session | Signed `lt` token (at most 30 minutes), no cookie, no storage before consent; stored on the booking intent only | Contractual necessity: the patient asked to book with that provider (counsel to confirm) | Proposed, Regulatory dependency |
| Visitor returns later within the window | Host-only `kxv` cookie (Secure, SameSite=Lax, 180 days maximum) created only after analytics and attribution consent | PDPL consent for non-essential identification (counsel) | Proposed, Regulatory dependency |
| Logged-in patient | Passport `sub`, linked to earlier visitor touches only with consent | | Proposed |
| No consent | Only the in-session `lt` and the booking channel; fall back to the explicit channel rule | Accepted loss of cross-session provider credit | Proposed |

Never stored: IP address (a keyed hash with a daily-rotating salt for rate limiting and fraud, kept 24 hours), full user agent, full referrer URL, unknown query parameters, device fingerprints, any health information, search text.

> **Note** Honest limit. Cross-session provider credit depends on consent and on the same browser or account. Most volume therefore rides the explicit channel rule: a provider link that opens the widget and books in that flow. The product should steer providers toward links that book directly, not "find us on Kiorex" mentions.

## 05 Windows and policy
All values are ASSUMPTION defaults in `GrowthConfigVersion kind=ATTRIBUTION_POLICY`, per market.

| Parameter | Default | Meaning |
|---|---|---|
| `providerTouchWindowDays` | 30 | Provider link, QR, desk, widget, provider-owned deep link |
| `patientReferralWindowDays` | 30 | Referral click to registration or booking |
| `campaignClickWindowDays` | 7 | Paid or owned campaign click |
| `campaignViewWindowHours` | 0 | View-through off |
| `visitorKeyMaxDays` | 180 | Cookie lifetime cap |
| `newPatientLookbackMonths` | 24 | As-built (market pack `featureDefaults.newPatient.lookbackMonths`) |
| `touchEvidenceRetentionMonths` | 25 | Touches linked to a decision; unlinked touches 13 months |
| `minDwellMsForProviderTouch` | 1000 | A provider touch counts only if the page actually rendered |
| `precedence` | `PROVIDER_FIRST` | Alternatives `LAST_NON_DIRECT`, `FIRST_TOUCH` (reporting only) |
| `allowOfflineEvidence` | false | Printed card or desk-entered source counts only if ON, before check-in, by a staff user |

Versioning (ADR-047, Proposed): `GrowthConfigVersion(kind, scope, version, status, payload, effectiveFrom, effectiveTo, createdBy, approvedBy, checksum, supersedesId)`. States DRAFT, PENDING_APPROVAL, APPROVED, ACTIVE, SUPERSEDED, REJECTED, ROLLED_BACK. A rollback creates a new version copying an older payload; old rows are never edited. Approver differs from creator and both are super admins. For `ATTRIBUTION_POLICY` and commission kinds, `effectiveFrom` must be at least 7 days after approval and an announcement text goes to providers (wording is NEEDS_HUMAN). `resolve(kind, scope, at)` returns the one ACTIVE version whose window contains `at`.

## 06 Decision algorithm
A pure function with no input or output side effects. Input: booking `{id, orgId, clinicId, doctorId, createdAt, channel, sub?, visitorKey?, ltToken?}`, touches that occurred before booking creation for the same visitor key or subject within the window, and policy version V.

Flow: explicit provider channel → prior provider touch → patient referral → any marketplace touch → no evidence

1. If `channel = CLINIC_LINK` or a valid `lt` for the same organisation: `PROVIDER_LED`, reason `EXPLICIT_PROVIDER_CHANNEL`. Today's `CLINIC_LINK` rule is the special case.
2. Else if provider-owned touches for the same organisation exist inside `providerTouchWindowDays` with dwell at or above the minimum: under `PROVIDER_FIRST`, `PROVIDER_LED`, reason `PRIOR_PROVIDER_TOUCH`, evidence the latest such touch. Under `LAST_NON_DIRECT`, provider-led only when the latest non-direct touch is provider-owned.
3. Else if a patient-referral touch exists in the window: `MARKETPLACE`, reason `PATIENT_REFERRAL`.
4. Else if any marketplace touch exists (search, SEO, campaign, direct app): `MARKETPLACE`, reason `MARKETPLACE_TOUCH`.
5. Else `UNATTRIBUTED`, treated as `MARKETPLACE` for chargeability, reason `NO_PROVIDER_EVIDENCE`.

Ties inside a class: the greatest `occurredAt`, then the smallest id. The decision stores `policyVersionId`, `inputsHash = sha256(canonical JSON of the booking subset and ordered touch ids with timestamps)` and `reasonCode`. Replaying the function on stored inputs must reproduce the stored result. The decision is persisted before the call to the clinic so a retry reuses it; it is idempotent on booking id.

## 07 Chargeability and the charge
```
chargeable = origin != PROVIDER_LED
          && isNewPatientAtBooking == true          // 24-month rule, frozen at booking
          && bookingSource in {KIOREX_MARKETPLACE, KIOREX_WHATSAPP, INTEGRATION}
          && bookingSource != CLINIC_LINK           // unchanged
```
Provider-led protection is an extra way to be non-chargeable, never a way to charge more. Any rule that charges more than today is a provider-terms change and an Open decision for the CEO; it is not proposed.

| Step | Behaviour | Label |
|---|---|---|
| Intake | Kiorex sends optional `acquisition { origin, decisionId, policyVersion, reason, evidenceHash, touch }` on the signed booking call; the clinic stores `acquisitionOrigin`, `acquisitionDecisionRef`, `acquisitionPolicyVersion` and keeps `attributionJson` for display. Absent block: origin `UNATTRIBUTED`, today's rules unchanged | Proposed (contracts 1.10.0) |
| At check-in | The charge service calls the extended chargeability function and writes an append-only `KiorexCommissionDecision` (`origin, isNewPatient, bookingSource, decision CHARGE|NO_CHARGE|WAIVED, reasonCodes, rateId, amount, inputsHash`), unique per appointment and policy version | Proposed |
| No charge | No `KiorexCommissionCharge` is created (as today) but the decision row exists | Proposed |
| Amount | Unchanged: effective-dated rate, EGP 40 placeholder | As-built |
| Lifecycle | PENDING to CONFIRMED on completion or after 24 hours (`AUTO_CONFIRM_MS`), billed monthly at max(S, C) | As-built |
| Provider view | "Booked through your links: N (no fee); through Kiorex: M (fee applies to new patients)" from decisions | Proposed |

## 08 Evidence, disputes and audit
- `growth_touchpoint` and `growth_attribution_decision` are append-only by database trigger; erasure and retention run through `SECURITY DEFINER` functions that write an audit row.
- Corrections create a new decision with `supersedesId`, actor and reason; old rows stay.
- Evidence export per booking: `GET /growth/v1/evidence/:bookingId` for ops and, on the clinic side, the provider's own organisation. It shows source kind, link label, times, reason code and policy version; never patient identity.
- New dispute reason `PROVIDER_LED_EVIDENCE` (enum addition). Auto-approval: if the provider disputes a charge and Kiorex evidence (signed partner call) shows a provider touch in the window that the original decision missed (for example consent granted later), the dispute is approved and `CommissionAdjusted` is emitted. `COMMISSION_CHARGE_REVERSED` stays for full reversal.
- Offline evidence (`allowOfflineEvidence`): lower weight, only before check-in, only with a staff user id, sampled in audit.
- Rules are published on a provider help page (deterministic and replayable) so the provider can read facts rather than ask for a recompute.
- Existing safeguards kept: `disputeDeadline` (30 days by market pack), `commission-dispute-auto.ts` rules.

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
| Click without render | Touch counts only above the dwell minimum |
| Burst per `ipHash` | Rate limit and `GrowthFraudSignal` |
| Provider-led share jump | Anomaly rule per organisation, review by ops |
| Forged or expired `lt` | Ignored; never creates provider-led |
| Clinic attempts to set origin | Not possible: only Kiorex creates `acquisitionOrigin` |
Phase 2 adds patient-level signals and a two-person review for reward reversal; Phase 3 adds scoring.

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
| 8 | Touch at 29 days 23 hours versus 30 days 1 second | yes | inside versus outside | Boundary tests |

Required tests (GRW-P1-B, D2): at least 40 decision-table cases covering every branch, ties, window edges, missing consent, other-organisation touches, short dwell and `LAST_NON_DIRECT`; a property test that replay equals stored output; a matrix `source x newPatient x origin` in the clinic where `PROVIDER_LED` never charges and an absent origin equals today's behaviour.

## 13 Acceptance criteria, KPIs, risks, dependencies, open decisions
- Acceptance: KX-27 section 07 and the GRW-P1-B, C, D2 criteria in KX-33.
- KPIs: decision determinism 100 percent; disputes attributable to attribution below 3 percent of charges; provider-led share; share of bookings with a decision row 100 percent.
- Risks: a provider games provider-led status (dwell, anomaly rules, audit sampling); Kiorex perceived as biased (public rules, evidence); policy error (rollback by new version, RB-G1 in KX-28); legal reading of "consent" for the `kxv` cookie (counsel).
- Dependencies: contracts 1.10.0; both Phase 1 migrations; provider terms update.
- Open decisions: `PROVIDER_FIRST` default; windows; no charge for provider-led-then-marketplace; patient-referral BR number; reward programme go or no-go.
- Cross-references: KX-12 (BR12, monetisation), KX-09 (money flows), KX-28 sections 06 to 09, KX-32 (revenue definitions).
