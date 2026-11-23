# KX07 — Kiorly Lab PRD

Source: 1sPyClcmk-Yxo3TgKsYq7kE-Pzxv490Al
Revision: Rev 2.3 · Reference Edition, updated 23 November 2026 (first issued 20 November 2026; this update adds build status of 19-23 Nov 2026)

## What changed in Rev 2.3
Home collection (KLORD04) is built on the shared @kiorly/field-visit package (ADR-030): coverage zones, travel buffers, on-my-way/arrived geostamps, safety timer and SOS for phlebotomists.
Nurse-collected samples: a Kiorly Nurse visit can attach a lab order and hand the sample to a Kiorly Lab (KLORD05).

Laboratory information management for independent labs and small chains: orders, barcode accession, chain of custody, analyzer interfaces, QC, authorized release — and Kiorex test bookings with home collection.

Authored in the role of Head of Diagnostics Product. Written with a clinical pathologist's quality lens.

Tags: LIMS · Chain of custody · QC & Westgard · Critical values · Home collection

| Field | Value |
|---|---|
| DOCUMENT | KX07 |
| REVISION | Rev 2.3 · Reference Edition (updated 23 Nov 2026) |
| DATE | 23 November 2026 (first issued 20 November 2026) |
| STATUS | Approved reference |
| AUDIENCE | Founders, investors, engineering & operations leads |
| OWNER ROLE | Head of Diagnostics Product |
| SUPERSEDES | KX07 Rev 2.2 19 Nov 2026 |

## Contents

01 Opportunity and positioning · 02 Scope and editions · 03 Functional requirements · 04 Sample-to-result workflow · 05 Rollout and gates · 06 Sources & evidence

## 01 Opportunity and positioning

The private lab market is large and concentrated at the top; the long tail of independent labs runs on paper and basic LIS.

| Metric | Value | Source |
|---|---|---|
| Egypt diagnostic labs market 2024 | USD 2.27B | TechSci |
| CAGR to 2030 | 7.5% | TechSci |
| IDH share of private chain revenue | ~50% | Al Borg + Al Mokhtabar |
| Labs mapped in POI data | 1,200 (Cairo + Giza ≈ 38%) | |

Kiorly Lab does not target the top chains first — they run enterprise LIS. The beachhead is independent labs and 2–15-branch chains that need digital accession, analyzer connectivity, reliable result release to patients and doctors, and a source of new patients. Kiorly Clinic's lab orders (CL06) and Kiorly Nurse home visits create natural referral paths.

## 02 Scope and editions

| Capability | Lite | Pro (per lab) | Chain |
|---|---|---|---|
| Orders, accession, barcode labels, results entry, authorized release, critical values, audit | ✓ | ✓ | ✓ |
| Internal QC (Levey-Jennings, Westgard rules) | Basic | ✓ | ✓ |
| Analyzer interfaces (ASTM/HL7) — 2 included | — | Per contract | Per contract |
| Home collection dispatch & phlebotomist app (on @kiorly/field-visit) | — | ✓ | ✓ |
| Referral (send-out) lab management | — | ✓ | ✓ |
| Multi-branch, central reporting | — | — | ✓ |
| Kiorex test bookings | Fee per completed booking | Commission credited vs subscription | Negotiated |

## 03 Functional requirements

### Orders & collection (KLORD)

| ID | Requirement |
|---|---|
| KLORD01 | Test catalogue: code, name AR/EN, specimen type, container, volume, fasting/prep instructions, TAT, price. |
| KLORD02 | Order sources: walk-in, Kiorly Clinic order (CL06), Kiorex booking, referring doctor, Kiorly Nurse visit (KLORD05). |
| KLORD03 | Patient identification with two identifiers; consent for result sharing. |
| KLORD04 | Home collection: slot booking inside coverage zones, address, phlebotomist assignment, travel buffers, route, on-my-way/arrived/finished geostamps, collection confirmation with photo of labels — using @kiorly/field-visit. Phlebotomists get the same safety timer, SOS and unsafe-abort as Kiorly home visits (HVSAF), never switchable. |
| KLORD05 | Nurse-collected samples: a Kiorly Nurse visit may record a lab order and sample collection; the receiving Kiorly Lab accessions it with chain of custody starting at the nurse's collection time (consent required). |

### Specimens (KLSPC)

| ID | Requirement |
|---|---|
| KLSPC01 | Accession number unique per lab; duplicates rejected. |
| KLSPC02 | Barcode labels per container; aliquots linked to parent. |
| KLSPC03 | Chain of custody append-only: collected → transported (time, temperature) → received → processed → stored/disposed. |
| KLSPC04 | Rejection reasons (haemolysed, insufficient, mislabelled) trigger re-collection workflow and patient notice. |

### Analysis & QC (KLQC)

| ID | Requirement |
|---|---|
| KLQC01 | Analyzer connectivity via ASTM E1394 / HL7 v2; manual entry with dual control. |
| KLQC02 | Internal QC runs per analyte/level; Levey-Jennings charts; Westgard rules (1₃s, 2₂s, R₄s, 4₁s, 10x) block patient release on violation. |
| KLQC03 | Reference intervals by age/sex with versioning; delta checks against prior results. |
| KLQC04 | Technical validation by technologist; medical validation by authorized signatory. |
| KLQC05 | Corrected reports create a new version with reason; recipients notified. |

### Release & critical values (KLCRIT)

| ID | Requirement |
|---|---|
| KLCRIT01 | Critical-value list per test; on result, alert ordering clinician and lab director; acknowledgement required within configured minutes or escalate. |
| KLCRIT02 | Release channels: printed report, patient link (OTP), Kiorly Clinic import, Kiorly Nurse import (for nurse-ordered samples), Kiorex vault — each by consent. |
| KLCRIT03 | LabResultReleased event carries signed report version and secure link, never raw values in notifications. |

### Business (KLBIZ)

| ID | Requirement |
|---|---|
| KLBIZ01 | Price lists, packages (check-ups), payer contracts, invoices, cash close (reuse commerce kernel). |
| KLBIZ02 | TAT dashboard and SLA alerts. |
| KLBIZ03 | Referring-doctor statements (where lawful) and send-out lab costs. |

NOTE: Kiorly Lab capabilities ship ON by default and can be switched off from the Kiorex super admin (`lab.module`, `lab.analyzer_interfaces`, `lab.home_collection`, `lab.kiorex_bookings`) — catalogue in KX08. QC blocks, authorized release, critical-value escalation and field-visit safety controls are not flags.

EVIDENCE: Design input: the 2025 kiorex-backend lab-service (order, result, test entities, migrations and seeds) is reference material only — re-model with accession, chain of custody and QC; no code reuse (KX22, ADR-026).

## 04 Sample-to-result workflow

Seven steps:

1. Order — walk-in · clinic · home via nurse · Kiorex
2. Collect — barcode · home via field-visit
3. Receive — custody
4. Analyze — analyzer
5. QC — Westgard
6. Validate — tech + medical
7. Release — consented channels (Patient · Kiorex · Kiorly Lab · Doctor (Kiorly Clinic))

Sequence: Lab booking via Kiorex with critical-value escalation.

1. Patient → Kiorex: book CBC + home collection
2. Kiorex → Kiorly Lab: create order + slot in zone
3. Phlebotomist visit: on my way → arrived, labels
4. Accession → analyze → QC pass
5. Medical validation + sign
6. LabResultReleased (secure link)
7. Result import (consent)
8. Critical value alert → ack ≤ 30 min

## 05 Rollout and gates

Timeline (Q1–Q12):

- Discovery: 15 labs, 2 chains
- Build MVP
- Pilot: 8 labs
- Egypt GA
- Kiorex test bookings marketplace: M19 pilot, M21 GA. Home collection reuses @kiorly/field-visit, extracted in M7–9 for Kiorly Clinic home visits.

| Stop-ship condition | Test |
|---|---|
| Result released without QC pass or signature | QC violation injection |
| Critical value not acknowledged and not escalated | Timer test |
| Duplicate accession accepted | Replay test |
| Mislabelled sample processed | Label mismatch scan test |
| Phlebotomist safety alert not delivered within 60 s | Field-visit safety drill |

## 06 Sources & evidence

Every external figure in this document traces to one of these sources; internal facts trace to the Kiorly repository (mshall/clinics-management, commit 6b24a79, 19 Nov 2026) or to founder decisions recorded in KX01.

- TechSci Research: Egypt diagnostic labs market USD 2,267.10M (2024), 7.50% CAGR to 2030.
- IDH corporate site: ~50% share of private chain market revenue (BCG).
- poidata.io: 1,218 laboratories in Egypt (Jul 2026), 259 Cairo, 200 Giza.

## 07 Build status (23 Nov 2026)
Observed in `kiorly-lab` (69 commits since 19 Nov), contracts 1.6.0 and the e2e suite 18. Local development only; the lab pilot remains month 19 (ADR-017).

| Capability | Status | Evidence and caveat |
|---|---|---|
| Lab module in the Kiorly staff app: reception creates STAT orders, phlebotomist collects by scan (wrong tube refused), technician receives and runs QC, critical value entry with dual control, read-back acknowledgement, validation, sign-off, release, TAT breach alert (once) | Done (dev) | e2e suite 18: 34 tests on 21 Nov; Expo web per-role spec 20 tests; lab modules not run on simulators |
| Critical-value alert reaches director, signatory, technician and owner only; read-back note stored on web and app acknowledgements (500 chars, first acknowledger wins, never in notifications or audit text) | Done | Founder decision 21 Nov |
| Sign-off only for a signatory with a licence (owner refused); screen driven by the server `sign-off` response | Done | Fixed 21 Nov |
| Release queue returns `readyToSign`, `readyToRelease`, `signedNotReleased`; "today" counters use Cairo local midnight (`LAB_TIMEZONE`); QC failure blocks release | Done | |
| Nurse-collected sample hand-off (KLORD05, KNLAB01): contracts 1.6.0 adds `nurseCollection`, `identifiersChecked`, source `KIORLY_NURSE`, a custody read endpoint and a status push through Kiorex | Done (dev) | Counsel/DPO review of patient data in `LabOrderPlaced` (NH-KNLAB01) is Open; the nurse never sees the doctor's Lab results queue |
| Plan gate: Lite lab gets a safety-alert slice and an upgrade request (`mobile_staff_app` ON for Pro and Chain) | Done | Plan gate answers before RBAC errors |
| Provider adapters: SMS, email, WhatsApp, payment (pay-by-link), push (Expo-compatible HTTP), storage | Done (not live) | Mock by default; webhook `POST /api/v1/webhooks/providers/{sms,email,whatsapp,payment}`; dev tools `/api/v1/dev/providers/*` |
| Lab on the shared notification layer | Planned (step 3 of 5) | Critical lab alert becomes a CRITICAL intent (in-app, push, WhatsApp, SMS, email at once); result-ready is IMPORTANT with an app-only push |
| Critical-value list sign-off by the clinical pathologist (NH-LB-006) | Open | Human |

> **Risk** A critical value is a patient-safety event. Real push delivery has never been observed, so the existing server escalation chain and non-push channels must stay in place when push goes live (mobile risk R8, KX16 H19).

## What changed in this revision (23 Nov 2026)
- Added §07 build status: mobile lab module, critical-value read-back note, nurse sample hand-off, provider adapters and notification-layer migration step.
- Workflow, QC rules and rollout gates are unchanged.
- Not verified: lab modules on a device, real push, any real vendor.
