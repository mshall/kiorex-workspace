# KX07 — Kiorly Lab PRD

Source: 1dkLq67AOZ4UR_qFFOxwiBSrxSNuAsFYd

Laboratory information management for independent labs and small chains: orders, barcode accession, chain of custody, analyzer interfaces, QC, authorized release — and Kiorex test bookings with home collection.

Authored in the role of Head of Diagnostics Product. Written with a clinical pathologist's quality lens.

Tags: LIMS · Chain of custody · QC & Westgard · Critical values · Home collection

| Field | Value |
|---|---|
| DOCUMENT | KX07 |
| REVISION | Rev 2.2 · Reference Edition |
| DATE | 19 November 2026 |
| STATUS | Approved reference |
| AUDIENCE | Founders, investors, engineering & operations leads |
| OWNER ROLE | Head of Diagnostics Product |
| SUPERSEDES | Kiorex v2 draft volumes 19 Nov 2026 |

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

Kiorly Lab does not target the top chains first — they run enterprise LIS. The beachhead is independent labs and 2–15-branch chains that need digital accession, analyzer connectivity, reliable result release to patients and doctors, and a source of new patients. Kiorly Clinic's lab orders (CL06) create a natural referral path.

## 02 Scope and editions

| Capability | Lite | Pro (per lab) | Chain |
|---|---|---|---|
| Orders, accession, barcode labels, results entry, authorized release, critical values, audit | ✓ | ✓ | ✓ |
| Internal QC (Levey-Jennings, Westgard rules) | Basic | ✓ | ✓ |
| Analyzer interfaces (ASTM/HL7) — 2 included | — | Per contract | Per contract |
| Home collection dispatch & phlebotomist app | — | ✓ | ✓ |
| Referral (send-out) lab management | — | ✓ | ✓ |
| Multi-branch, central reporting | — | — | ✓ |
| Kiorex test bookings | Fee per completed booking | Commission credited vs subscription | Negotiated |

## 03 Functional requirements

### Orders & collection (KLORD)

| ID | Requirement |
|---|---|
| KLORD01 | Test catalogue: code, name AR/EN, specimen type, container, volume, fasting/prep instructions, TAT, price. |
| KLORD02 | Order sources: walk-in, Kiorly Clinic order (CL06), Kiorex booking, referring doctor. |
| KLORD03 | Patient identification with two identifiers; consent for result sharing. |
| KLORD04 | Home collection: slot booking, address, phlebotomist assignment, route, collection confirmation with photo of labels. |

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
| KLCRIT02 | Release channels: printed report, patient link (OTP), Kiorly Clinic import, Kiorex vault — each by consent. |
| KLCRIT03 | LabResultReleased event carries signed report version and secure link, never raw values in notifications. |

### Business (KLBIZ)

| ID | Requirement |
|---|---|
| KLBIZ01 | Price lists, packages (check-ups), payer contracts, invoices, cash close (reuse commerce kernel). |
| KLBIZ02 | TAT dashboard and SLA alerts. |
| KLBIZ03 | Referring-doctor statements (where lawful) and send-out lab costs. |

NOTE: Kiorly Lab capabilities ship ON by default and can be switched off from the Kiorex super admin (`lab.module`, `lab.analyzer_interfaces`, `lab.home_collection`, `lab.kiorex_bookings`) — catalogue in KX08. QC blocks, authorized release and critical-value escalation are not flags.

EVIDENCE: Design input: the 2025 kiorex-backend lab-service (order, result, test entities, migrations and seeds) is reference material only — re-model with accession, chain of custody and QC; no code reuse (KX22, ADR-026).

## 04 Sample-to-result workflow

Seven steps:

1. Order — walk-in · clinic · Kiorex
2. Collect — barcode
3. Receive — custody
4. Analyze — analyzer
5. QC — Westgard
6. Validate — tech + medical
7. Release — consented channels (Patient · Kiorex · Kiorly Lab · Doctor (Kiorly Clinic))

Sequence: Lab booking via Kiorex with critical-value escalation.

1. Patient → Kiorex: book CBC + home collection
2. Kiorex → Kiorly Lab: create order + slot
3. Phlebotomist visit, labels
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
- Kiorex test bookings marketplace: M19 pilot, M21 GA

| Stop-ship condition | Test |
|---|---|
| Result released without QC pass or signature | QC violation injection |
| Critical value not acknowledged and not escalated | Timer test |
| Duplicate accession accepted | Replay test |
| Mislabelled sample processed | Label mismatch scan test |

## 06 Sources & evidence

Every external figure in this document traces to one of these sources; internal facts trace to the Kiorly repository (mshall/clinics-management, commit 6b24a79, 19 Nov 2026) or to founder decisions recorded in KX01.

- TechSci Research: Egypt diagnostic labs market USD 2,267.10M (2024), 7.50% CAGR to 2030.
- IDH corporate site: ~50% share of private chain market revenue (BCG).
- poidata.io: 1,218 laboratories in Egypt (Jul 2026), 259 Cairo, 200 Giza.
