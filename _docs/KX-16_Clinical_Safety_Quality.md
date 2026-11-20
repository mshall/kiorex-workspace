# KX-16 Clinical Safety & Quality Framework
Source: 1QsIlGXOGaJ1Zlvo7sB8T1ZYcB2W6phUj

> Extraction note: the PDF text layer dropped some symbols (<=, >=) and scrambled the "Controls by product" diagram; it is reconstructed best-effort.

Part 05 — Risk & Compliance. How clinical risk is identified, controlled and monitored across Kiorly Clinic, Kiorly Pharmacy, Kiorly Lab and the Kiorex marketplace.

- Authored in the role of Chief Medical Officer. Prof. Dr. Ahmed El Shall's office — accountable for clinical safety sign-off.
- Tags: Hazard log, Safety controls by product, Specialty board, Incident management, Quality measures
- DOCUMENT: KX16 | REVISION: Rev 2.1 · Reference Edition | DATE: 19 November 2026 | STATUS: Approved reference
- AUDIENCE: Clinical advisors, product, engineering, regulators | OWNER ROLE: Chief Medical Officer | SUPERSEDES: Kiorex v2 draft volumes 19 Nov 2026, 00000106

## Contents
01 Principles; 02 Safety governance; 03 Hazard log (top hazards); 04 Controls by product; 05 Incident management; 06 Quality measures

## 01 Principles
- Clinician in control: Software informs; licensed professionals decide and sign. No autonomous clinical action anywhere in the ecosystem.
- Safety is not a tier: Rx checks, allergy alerts, lab QC, recall blocks and audit are identical in free and paid editions.
- Make the safe path the fast path: Defaults, templates and one-tap actions steer to the safe choice; overrides require a reason.
- Learn from every incident: Blame-free reporting, root cause, and a tracked fix in the hazard log.

## 02 Safety governance
Small and real: the CMO signs, an advisory board reviews, engineering implements, incidents feed back.

Loop: 01 Identify hazard (design · incident · feedback) -> 02 Assess (severity x likelihood) -> 03 Control (design · test · training) -> 04 Sign-off (CMO / specialty lead) -> 05 Monitor (metrics · incidents) -> 06 Review (quarterly).

| Role | Responsibility |
|---|---|
| CMO (accountable) | Approves clinical features, templates, AI clinical use, safety incidents closure |
| Specialty advisory board | Reviews and signs launch specialty templates and fee factors (NH010): dermatology, paediatrics, OB/GYN, orthopaedics, ENT, internal medicine, cardiology, psychiatry, ophthalmology, urology, dentistry |
| Clinical pharmacist advisor | Signs pharmacy dispensing and substitution hazards (KX06) |
| Clinical pathologist advisor | Signs lab QC, critical values and release hazards (KX07) |
| Engineering lead | Implements controls, stop-ship tests, kill switches |

## 03 Hazard log (top hazards)

| ID | Hazard | Cause | Control | Residual |
|---|---|---|---|---|
| H01 | Wrong patient record opened | Similar names, merged charts | Two identifiers; patient 360 header; never auto-merge on conflicting national ID | Low |
| H02 | Dangerous drug interaction missed | Brand names hide ingredient | Egyptian drug DB maps brand -> active ingredient; CL02 checks | Medium |
| H03 | Allergy not shown at prescribing | Incomplete history | Allergy banner; required review at first Rx | Low |
| H04 | Encounter altered after sign-off | Edits without trace | Auto-lock; versioned amendments (CL05) | Low |
| H05 | Double-booked appointment | Race between channels | Single slot engine, holds, idempotency | Low |
| H06 | AI draft includes wrong dose | Model error | Clinician approval; Rx safety checks on drafts; AI labels | Medium |
| H07 | Emergency patient books routine slot | Search for urgent symptoms | Emergency keyword routing to 123 guidance | Medium |
| H08 | Expired or recalled medicine dispensed | Lot not tracked | Lot/expiry blocks; recall propagation <5 min | Low |
| H09 | Unvalidated lab result released | QC failure ignored | Westgard block; dual validation | Low |
| H10 | Critical lab value not acted on | Notification missed | Acknowledgement timer and escalation | Medium |
| H11 | Unverified doctor listed | Fake credentials | Syndicate + licence verification; re-verify on name/specialty change | Low |
| H12 | Misleading review harms patient choice | Fake reviews | Completed-visit-only reviews; moderation | Low |

## 04 Controls by product
- Kiorly Clinic (clinic): SOAP templates per specialty (board-signed); Rx safety by ingredient; Rx QR verification; Sign-off & auto-lock; amendments; Consent capture at check-in; No-show risk labelled rule-based; Two-identifier collection.
- Kiorly Pharmacy (pharmacy): Pharmacist sign-off on every dispense; Substitution consent; Controlled log, never via marketplace; Lot/expiry and recall blocks across branches; Cold-chain excursions quarantine.
- Kiorly Lab (lab): Chain of custody; Westgard QC blocks release; Critical value escalation; Versioned corrections; Patient complaint SLA.
- Kiorex marketplace: Verified-only listings; Emergency routing; Medical content approved by CMO; No symptom data in Kiorex analytics.

(Items above grouped by product as best recoverable from the scrambled diagram.)

## 05 Incident management

| Severity | Definition | Response time | Notification |
|---|---|---|---|
| S1 | Patient harm occurred or imminent | Immediate; kill switch if software-related | CMO + CEO within 1 h; regulator per law |
| S2 | Near miss with potential for harm | <=24 h | CMO within 24 h |
| S3 | Safety control degraded, no near miss | <=3 days | Weekly review |
| S4 | Usability concern | Backlog | Monthly review |

## 06 Quality measures
- Templates board-signed: 100% before specialty launch
- S1/S2 per encounters: <1 / 10k
- Lab: critical values acknowledged in time: >=95%
- Pharmacy: expired lot sales: 0
