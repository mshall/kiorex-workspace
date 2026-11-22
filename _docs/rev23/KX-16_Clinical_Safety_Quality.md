# KX-16 Clinical Safety & Quality Framework
Source: 1tK0CiOSRABzHtwlzT5D5eH4SXqWiWEb5
Revision: Rev 2.3 · Reference Edition, updated 23 November 2026 (first issued 20 November 2026; this update adds the nurse lab restriction, mobile safety delivery and the PHI guard)

> Extraction note: PDF text layer dropped symbols (<=, >=) and scrambled the principles and "Controls by product" diagrams; reconstructed best-effort.

Part 05 — Risk & Compliance. How clinical risk is identified, controlled and monitored across Kiorly Clinic, Kiorly Nurse, Kiorly Pharmacy, Kiorly Lab and the Kiorex marketplace — in the clinic and at home.
Authored in the role of Chief Medical Officer (Prof. Dr. Ahmed El Shall's office). Audience: clinical advisors, product, engineering, regulators. Owner: CMO.

WHAT CHANGED IN REV 2.3 (as printed): Hazards H13…H18 added (home-visit safety, impersonation, medication without order, deterioration at home, out-of-scope practice, address exposure); H11 widened to all professions. Governance adds a physiotherapist reviewer and a nursing advisor; CMO signs the home-visit safety protocol GHV2 and nursing templates GKN1. Controls by product add Kiorly Nurse; incident severities and quality measures extended.

## 01 Principles
- Clinician in control: Software informs; licensed professionals decide and sign — each within the scope of their profession. No autonomous clinical action anywhere in the ecosystem.
- Safety is not a tier: Rx checks, allergy alerts, lab QC, recall blocks, audit and home-visit safety are identical in free and paid editions.
- Make the safe path the fast path: Defaults, templates and one-tap actions steer to the safe choice; overrides require a reason.
- Learn from every incident: Blame-free reporting, root cause, and a tracked fix in the hazard log.

## 02 Safety governance
Loop: Identify hazard (design · incident · feedback) -> Assess (severity x likelihood) -> Control (design · test · training) -> Sign-off (CMO / specialty lead) -> Monitor (metrics · incidents) -> Review (quarterly).

| Role | Responsibility |
|---|---|
| CMO (accountable) | Approves clinical features, templates, AI clinical use, scope-of-practice matrix, home-visit safety protocol, safety incidents closure |
| Specialty advisory board | Reviews and signs launch specialty templates and fee factors (NH010): dermatology, paediatrics, OB/GYN, orthopaedics, ENT, internal medicine, cardiology, psychiatry, ophthalmology, urology, dentistry — plus a physiotherapist reviewer for the physio pack (GPR2) |
| Nursing advisor (new) | Signs nursing visit record, vitals thresholds, MAR and care-plan templates (GKN1, KX23) |
| Clinical pharmacist advisor | Signs pharmacy dispensing and substitution hazards (KX06) |
| Clinical pathologist advisor | Signs lab QC, critical values and release hazards (KX07) |
| Engineering lead | Implements controls, stop-ship tests, kill switches, safety drills |

## 03 Hazard log (top hazards)
| ID | Hazard | Cause | Control | Residual |
|---|---|---|---|---|
| H01 | Wrong patient record opened | Similar names, merged charts | Two identifiers; patient 360 header; never auto-merge on conflicting national ID | Low |
| H02 | Dangerous drug interaction missed | Brand names hide ingredient | Egyptian drug DB maps brand → active ingredient; CL02 checks | Medium |
| H03 | Allergy not shown at prescribing or administration | Incomplete history | Allergy banner; required review at first Rx and first MAR entry | Low |
| H04 | Encounter altered after sign-off | Edits without trace | Auto-lock; versioned amendments CL05 | Low |
| H05 | Double-booked appointment | Race between channels | Single slot engine, holds, idempotency | Low |
| H06 | AI draft includes wrong dose | Model error | Clinician approval; Rx safety checks on drafts; AI labels | Medium |
| H07 | Emergency patient books routine slot or home visit | Search for urgent symptoms | Emergency keyword routing to 123 guidance (incl. home-nursing search) | Medium |
| H08 | Expired or recalled medicine dispensed | Lot not tracked | Lot/expiry blocks; recall propagation <5 min | Low |
| H09 | Unvalidated lab result released | QC failure ignored | Westgard block; dual validation | Low |
| H10 | Critical lab value not acted on | Notification missed | Acknowledgement timer and escalation | Medium |
| H11 | Unverified provider listed | Fake credentials; wrong register for the profession | Profession-specific syndicate + licence verification; re-verify on name/profession/specialty change | Low |
| H12 | Misleading review harms patient choice | Fake reviews | Completed-visit-only reviews; moderation | Low |
| H13 | Provider harmed or threatened at a patient's home | Unknown address or patient; isolated setting | Verified phone + deposit for first visit; safety timer; SOS; unsafe-abort with no penalty | Medium |
| H14 | Patient harmed by an unverified or impersonating provider at home | Fake credentials; agency sends unlisted staff | Profession verification; assigned provider's photo and badge before arrival; agencies may assign only verified nurses | Low |
| H15 | Medication given without a valid order or to an allergic patient | Verbal orders; missing history | Doctor's order required BR57; MAR allergy/duplicate checks; order expiry | Medium |
| H16 | Deterioration at home not escalated | Nurse alone; no protocol | Critical vitals thresholds prompt escalation guidance KNESC01; 123 shown; action logged | Medium |
| H17 | Physiotherapist or nurse acts outside scope | No scope enforcement | Scope-of-practice matrix enforced server-side PRSOP | Low |
| H18 | Patient's address exposed | Address visible to wrong staff or after the visit | Shared only after CONFIRMED to the assignee; masked after 24 h; access audited | Low |
| H19 | Safety alert (SOS, critical lab value, controlled-drug discrepancy) not delivered to the phone | iOS push is best effort; notifications disabled by the user; device offline; real push never observed | Server escalation chains and SMS or dispatcher fallback remain; in-app polling and a persistent Home banner; critical alerts fan out to every channel at once in the notification layer (KX24); the app is never the only channel; Apple Critical Alerts and an Android max-priority channel to be requested. **Proposed, pending CMO sign-off** (mobile risk R8) | Medium until real delivery is verified |
| H20 | Clinical detail leaks through SMS, push or WhatsApp | A free-text parameter or a careless template | Declared parameters only; PHI pattern scan fails the attempt (`PHI_BLOCKED`); detail only in authenticated email or in-app; push says "open the app". **Proposed, pending CMO and DPO review of the pattern list** | Low |

## 04 Controls by product
- Kiorly Clinic (clinic): SOAP templates per specialty (board-signed); physio assessment and progress templates; Rx safety by ingredient; Rx QR verification; Sign-off & auto-lock; amendments; Scope of practice per profession; Home-visit safety: timer, SOS, unsafe-abort, address masking; Consent capture at check-in; no-show risk labelled rule-based.
- Kiorly Nurse (nurse): Nursing visit record, signed and locked; Vitals with CMO-signed thresholds and escalation guidance; MAR against a doctor's order; allergy/duplicate checks; No prescribing; controlled medicines only with order + witness; Home-visit safety controls (same as Clinic).
- Kiorly Pharmacy (pharmacy): Pharmacist sign-off on every Rx dispense; Substitution consent; Controlled log; never via Kiorex; Cold-chain excursions quarantine; Recall blocks across branches.
- Kiorly Lab (lab): Two-identifier collection; Chain of custody; Westgard QC blocks release; Critical value escalation; Versioned corrections; phlebotomist field-visit safety.
- Kiorex marketplace: Verified-only listings, badge naming the profession; Emergency routing; Medical content approved by CMO; No symptom data or addresses in analytics; Patient complaint SLA (home visits 1 h); safety console.

Additions of 23 Nov 2026 (Proposed until the CMO signs; none is a flag):
- Kiorly Team: safety capabilities (critical lab value, controlled-drug discrepancy, nurse SOS, missed safety check, unsafe abort, interaction and allergy warnings, recalls, cold chain) reach **every plan including Lite**; a Basic organization's app is a safety-alert slice (ADR-033, ADR-025).
- Nurses and aides have **no access to the physician's Lab results review queue**, enforced by the server (403); sample collection stays under home visits. This follows the scope-of-practice rule (H17).
- Lab critical-value read-back: the acknowledger's note is stored (500 characters), never copied into notifications or audit text; acknowledgement is idempotent.
- Home-visit arrival distance is recorded and shown to dispatchers and owners; it never blocks the nurse.
- Messages: PHI guard and consent gate sit in the notification layer; consent withdrawal is never behind a flag.

## 05 Incident management
| Severity | Definition | Response time | Notification |
|---|---|---|---|
| S1 | Patient or provider harm occurred or imminent; any SOS or unanswered home-visit safety timer until resolved | Immediate; kill switch if software-related | CMO + CEO within 1 h; regulator per law |
| S2 | Near miss with potential for harm; unsafe-aborted home visit | <=24 h | CMO within 24 h |
| S3 | Safety control degraded, no near miss | <=3 days | Weekly review |
| S4 | Usability concern | Backlog | Monthly review |

## 06 Quality measures
- Templates board-signed: 100% before specialty launch
- S1/S2 per encounters: <1 / 10k
- Lab: critical values acknowledged in time: >=95%
- Pharmacy: expired lot sales: 0
- Home visits: safety alerts resolved <=15 min: 100%
- Kiorly Nurse: medication entries with a valid order: 100%

## What changed in this revision (23 Nov 2026)
- Added hazards H19 and H20 (Proposed) and the 23 Nov control additions above; no existing hazard or control was removed.
- Safety alerts delivery (mobile risk R8): real push delivery to phones has not been observed; treat the hazard as Medium until a staging pass with real APNs and FCM keys.
- Not verified: CMO sign-off of H19, H20 and the vitals thresholds (NH-034).
