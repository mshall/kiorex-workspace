Source: 1KmhUM-11TEpgqAQfD-loqUbv0s3YUnCm
Revision: Rev 2.3 · Reference Edition · first issued 20 November 2026, updated 23 November 2026 for the unified Kiorly staff app · Status: Approved reference · Document KX-23 (new volume; owner: Head of Home Care Product; supersedes: none, introduced in Rev 2.3 with ADR-029..032)

# KX-23 Kiorly Nurse PRD

Kiorly Clinic, tailored for nurses — one edition for the solo home nurse on a phone and for the agency running 5 to 200 nurses, with care plans, nursing records, medication administration, dispatch and safety at the door.
Audience: founders, product, engineering, clinical advisors, sales.
What changed in Rev 2.3: first edition of this volume, created with ADR-029..032. Requirements reuse Kiorly Clinic capabilities (KX-05) and home visits (HV) and add the KN set.
(Extraction note: the PDF text layer dropped many symbols such as ≥, ·, →, ×; those are restored below only where unambiguous.)

## 01 Product summary
Kiorly Nurse is Kiorly Clinic with edition = NURSE (ADR-031): same code, database, commerce kernel and Kiorex connector, presented to nurses under its own name, navigation, terminology and plans.
- Editions sharing one codebase: 2 (Clinic, Nurse). Tenant types: 2 (solo nurse, agency). Navigation tabs: 7 (+ Team, Dispatch for agencies). Plans (proposed): 4 (Nurse Lite, Pro, Agency, Enterprise).
- Why an edition, not a product: an estimated ~80% already exists in Kiorly Clinic (scheduling and slot engine, patients, packages and instalments, payments cash/InstaPay/Fawry/card, WhatsApp messaging and consent, revenue share and statements, reports, MFA, tenant export). Nurse adds what is specific to nursing at home and hides what nurses must not use.
- Market context: home nursing in Egypt is delivered by companies (e.g. 7keema, Tabibi 24/7) and freelance nurses. Nurses must hold a Ministry of Health licence and be members of the Nursing Professions Syndicate (KX-15). Kiorly Nurse serves companies and individuals as software; Kiorex lists agencies after the home-visit gates and individual nurses only after gate GKN2 (ADR-032).

## 02 Who it is for
| Persona | Job to be done | Pain today | Edition setup |
|---|---|---|---|
| Mona, 31, solo home nurse, Nasr City | Fill her week with home visits close together, record care properly, get paid without chasing | Bookings by phone; no records; cash chasing; feels unsafe at unknown addresses | Organization of one; Nurse Lite → Nurse Pro; PWA on her phone |
| Agency owner, 40 nurses, Giza | Assign the right nurse by zone and skill, keep families informed, pay nurses accurately | Dispatch on WhatsApp groups; missed visits; disputes over hours | Nurse Agency; dispatcher and nurse roles |
| Agency nurse | See only her visits, record them quickly, get to the next one | Paper sheets, double entry | Member of an agency organization |
| Caregiver (Kiorex side) | Book a trusted nurse for a parent; see each visit was done | No verification; no proof of visits | Kiorex app; family contacts (KX-03) |

## 03 What the nurse sees
- Navigation (7 tabs): Today · Visits · Patients · Care plans · Payments · Reports · Settings — agencies add Team and Dispatch. Today = route of the day's home visits with On my way · Arrived · Finished buttons.
- Terminology: "Clinic" → "Practice" (solo) or "Agency"; "Encounter" → "Visit record"; "Doctor" → "Nurse". Hidden: drug prescribing, SOAP specialty templates, lab ordering, OR, payers/TPA. Scope of practice (PRSOP) enforces this server-side, not only in the UI.

## 04 Requirements
Stable IDs (KN*). Kiorly Nurse also inherits every applicable Kiorly Clinic requirement (KX-05) and all home-visit requirements (HV*), including the safety controls that are never flags.

### Edition and onboarding (KNED)
| ID | Requirement | Plan |
|---|---|---|
| KNED01 | Sign-up at nurse.kiorly.com (or the Kiorly app with "I'm a nurse") sets edition = NURSE; choose Solo or Agency; phone OTP (ON01). | All |
| KNED02 | Edition branding: "Kiorly Nurse" name, Nurse Rose accent, Arabic name (glyphs scrambled in extraction; final per Q12), edition-specific help and onboarding copy. | All |
| KNED03 | Onboarding wizard: profession verification (PRVER01; solo nurses also PRVER04 ID selfie match and criminal-record certificate), coverage zones, services offered, prices, availability, safety contact. | All |
| KNED04 | Edition is changeable only by the Kiorex super admin; a clinic that employs nurses stays in the Clinic edition and gets nurse clinicians there. | All |

### Services and care plans (KNSVC, KNCP)
| ID | Requirement | Plan |
|---|---|---|
| KNSVC01 | Service catalogue seeded from the market pack: injection, IV cannula/infusion, wound dressing, catheter care, vitals monitoring, post-operative care, elderly-care visit, newborn and mother care, private-duty shift (8/12/24 h). Nurse edits prices and durations. | All |
| KNSVC02 | Each service is a HOME visit type (ADR-030) with travel buffers, coverage zones and an optional home surcharge. | All |
| KNCP01 | Care plan: services × frequency × duration (e.g. dressing daily × 14 days), start date, assigned nurse(s); generates recurring home visits through the slot engine. | All |
| KNCP02 | Care plan priced as a package (MN01) with deposit, instalments or pay-per-visit; remaining-visit counter. | All |
| KNCP03 | Pause, extend or end a plan; discharge note on end; record shared to the patient's Kiorex vault by consent. | All |

### Clinical record (KNREC, KNMAR, KNESC, KNLAB)
| ID | Requirement | Plan |
|---|---|---|
| KNREC01 | Visit record: tasks checklist from the plan, nursing note (assessment, intervention, evaluation), free text, wound photos with consent. Signed and auto-locked like encounters (CL05). | All |
| KNREC02 | Vitals: BP, pulse, temperature, SpO₂, respiratory rate, blood glucose, pain score; trend charts; out-of-range values highlighted (thresholds per market pack, CMO-signed). | All |
| KNMAR01 | Medication administration record: medicine (Egyptian drug database), dose, route, time, nurse — always against a doctor's order (BR57). Allergy and duplicate checks on every entry (CL02 reused; never a flag). | All |
| KNMAR02 | Doctor's-order sources: shared from Kiorly Clinic by patient consent (MedicationOrderShared), or photo upload confirmed by the nurse with prescriber name and date. Order expiry enforced. | All |
| KNMAR03 | Controlled medicines: recorded only against an order marked controlled, with a witness field; never sold or supplied through Kiorex (BR35). | All |
| KNESC01 | Escalation: vitals beyond critical thresholds prompt "call the doctor / call 123" guidance and log the action taken; nurses never receive AI clinical advice beyond labelled reminders. | All |
| KNLAB01 | Optional sample collection against a lab order, handed to a Kiorly Lab (KLORD05) with chain of custody from collection time. | Pro+ |

### Family, shifts and agency operations (KNFAM, KNSH, KNAG)
| ID | Requirement | Plan |
|---|---|---|
| KNFAM01 | Family updates: after each visit, a WhatsApp template (no PHI in the body) links to a summary page for consented family contacts. | Pro+ |
| KNSH01 | Private-duty shifts: book 8/12/24 h shifts, handover note between nurses, shift check-in/out with geostamp. | Pro+ |
| KNAG01 | Nurse roster with skills, gender, languages and zones; dispatcher assigns visits; a nurse sees only her assigned patients. | Agency |
| KNAG02 | Auto-suggest nurse by zone, skill and continuity (same nurse for the same patient). | Agency |
| KNAG03 | Nurse pay per visit or per shift; statements (MN02 revenue share reused); per-nurse cash owed from home payments. | Agency |
| KNAG04 | Agency may assign only nurses verified under PRVER; unverified staff can be rostered as nursing aides (PRSOP03 / Agency SOP, exact reference garbled in extraction) but never sent alone or listed. | Agency |

### Marketplace and reporting (KNKX, KNRPT)
| ID | Requirement | Plan |
|---|---|---|
| KNKX01 | Kiorex listing: agencies (after GHV1/GHV2) list services; patients book the agency and the agency assigns a nurse (HOME_VISIT_ASSIGNED; nurse's name, photo and badge shown before arrival). | All |
| KNKX02 | Solo nurses are listed only after gate GKN2 and PRVER04 checks (nurse.individual_kiorex_listing). | All |
| KNKX03 | Commission: one Kiorex fee per attended new patient (first visit); care-plan follow-ups never commissionable (BR55); higher-of settlement (ADR-008). | All |
| KNRPT01 | Reports: visits done, hours, revenue, travel time, plan completion, missed-visit rate, safety alerts. | All |

## 05 Plans (Proposed)
Validate with ≥15 willingness-to-pay interviews (nurses and agencies) before publishing. Detail and governance in KX-12.
| Plan | Price (Egypt, test point) | Who | Includes |
|---|---|---|---|
| Nurse Lite | EGP 0 + Kiorex fees (EGP 100 minimum invoice) | Solo nurse starting out | Visits, records, vitals, MAR, safety, Kiorex listing (when allowed) |
| Nurse Pro | EGP 399 / nurse / month · 299 annual-equivalent | Busy solo nurse | + family updates, private-duty shifts, WhatsApp reminders, card/InstaPay/Fawry, reports, sample collection |
| Nurse Agency | EGP 1,999 / month incl. 10 nurses · 149 per extra nurse | Agencies, home-care companies | + team, dispatch, nurse pay, multi-branch |
| Enterprise | Custom / negotiated | Large home-care operators | — |
Higher-of settlement, the founding trial (activation: ≥15 visits recorded in 30 days) and referral rules apply unchanged. Home-visit safety is in every plan, including Nurse Lite (P5).

## 06 Visit flow
Booked (Kiorex · phone · care plan) → Assigned (agency dispatch) → On my way (address revealed) → Arrived (geostamp = check-in) → Record (tasks · vitals · MAR) → Finished (family update; address masked 24 h) (arrow order reconstructed from the diagram text; layout lossy).
RULE — Never flags in Kiorly Nurse: scope of practice (no prescribing), profession verification, safety timer, SOS, unsafe-abort with no penalty, address masking, MAR allergy/duplicate checks and the doctor-order requirement (ADR-025).

## 07 Feature flags
| Key | Scopes | Class | When OFF | Depends on / gate |
|---|---|---|---|---|
| nurse.edition | G M | Module | No new Nurse sign-ups; existing tenants read-only with export | — |
| nurse.individual_tenants | G M | Commercial | Solo plans hidden at sign-up; existing solos keep working | nurse.edition |
| nurse.care_plans | G M O | Launch-locked | Single visits only; active plans complete | gate: GKN1 |
| nurse.mar | G M O | Launch-locked | Medication recorded as free text in the visit record | gate: GKN1 |
| nurse.private_duty_shifts | G M O | Module | Shift booking hidden | nurse.edition |
| nurse.family_updates | G M O | Integration | No family messages | whatsapp_reminders |
| nurse.individual_kiorex_listing | G M | Launch-locked | Solo nurses not listed on Kiorex | kiorex.home_visits · gate: GKN2 |
| clinic.home_visits (shared) | G M O | Launch-locked | Home visit types hidden for new bookings; booked visits honoured | gate: GHV1 + GHV2 |

## 08 Rollout and gates
Timeline (quarters Q1..Q6 / months): Discovery 15 nurses + 5 agencies; Field-visit package + home visits (M7-9, shared with Clinic); Build Nurse edition (M10-15); Pilot: 10 solo nurses, 3 agencies (M13-15); GA Egypt (M16-18); Kiorex home nursing (agencies). (Exact month-to-bar mapping is garbled in the extraction.)
| Gate | Unlocks | Evidence | Owner |
|---|---|---|---|
| GHV1 | Home visits (all professions) | Counsel memo: home visits, platform liability, patient terms | CEO + counsel |
| GHV2 | Home visits (all professions) | CMO-signed home-visit safety protocol; safety drill green | CMO |
| GKN1 | Care plans, MAR | CMO + nursing advisor sign-off on visit record, vitals thresholds, MAR | CMO |
| GKN2 | Individual nurse listing on Kiorex | Counsel memo on independent home nursing and platform duty of care (Q7) | CEO + counsel |

Stop-ship conditions:
| Condition | Test |
|---|---|
| Nurse can reach any prescribing endpoint | Scope-of-practice contract test (403 SCOPE_NOT_ALLOWED) |
| Medication recorded without an order (when nurse.mar effective) | MAR negative-path test |
| Safety alert not delivered within 60 s | Field-visit safety drill |
| Address visible to an unassigned nurse or after 24 h | Address-masking test |
| Unverified nurse assignable by an agency dispatcher | Dispatch guard test |

## 09 Success metrics (all Proposed until the pilot produces observed cohorts)
- Activation ≥50% (≥15 visits recorded in 30 days)
- Missed scheduled visits ≤3% (comparator symbols lost; read as ≤3%)
- Safety alerts resolved ≤15 min: 100%
- Care plans completed as planned: ≥80% (symbol lost)
- Medication entries with a valid order: 100%
- Agency dispatch time per visit: ≤2 min
(Mapping of numbers to labels is ambiguous in the extraction.)

## 10 Open questions
| # | Question | Owner | Default until answered |
|---|---|---|---|
| Q7 | May individual nurses be listed for home bookings; platform duty of care? | CEO + counsel | Software only for solo nurses; Kiorex lists agencies |
| Q8 | Criminal-record certificate for solo nurses — lawful and practical? | Counsel + DPO | Required for solo nurses only |
| Q10 | Accepted forms of a doctor's order for nurse-administered medication | CMO + nursing advisor | Shared Kiorly order or photo upload with prescriber name and date |
| Q11 | Agency establishment licensing (Law 51 of 1981) and what we verify | Counsel | Commercial registration + MoH licence where one exists |
| Q12 | Final Arabic product name | CEO + brand | (Arabic name, scrambled in extraction) |
| Q13 | Nurse plan prices and home-visit commission override | CEO | As §05; EGP 40 flat |

## 11 Mobile: Nurse in the Kiorly app (23 Nov 2026)
The nurse edition runs on the phone in the single staff app **Kiorly** (ADR-033, Proposed): sign-in shows four entries (Clinic, **Nurse**, Pharmacy, Lab). **There is no separate nurse app.** The Nurse entry is the front door for nurses, aides and dispatchers: they have Kiorly Clinic accounts, so it signs in through the Clinic API and lands on today's home-visit rounds. The PWA remains the web surface (nurse.kiorly.com alias, KNED01).

| Capability | Status | Evidence and caveat |
|---|---|---|
| Today's rounds, depart, arrive, finish; SOS and unsafe abort; nursing note (finish needs a finalized note) | Done (dev) | e2e suite 16; solo nurse and agency nurses exercised with seeded demo data |
| Critical vitals alert to nurse, manager and owner; idempotent offline replay of vitals | Done | |
| **Nurse sees no Lab results** (the physician's result-review queue): server returns 403 for role NURSE and for NURSE and ASSISTANT professions; sample collection stays under home visits (KNLAB01) | Done (server-enforced) | Changed 22 Nov; web unchanged. Rationale: scope of practice (PRSOP) and KX16 H17 |
| Dispatcher: home-visit module and the organization's home-visit safety alerts; no clinical record access | Done | Founder decision 21 Nov |
| Arrival distance recorded (500 m default threshold), never blocks, shown to dispatchers and owners only | Done | Supports H13 and dispatch review |
| Lite nurse plans (Nurse Lite) | Done (slice) | Safety alerts on every plan, upgrade request; full app is Pro and Agency today (single `mobile_staff_app` entitlement). Whether depart, arrive and finish should be Core on Lite follows the P5 question Q7 in the mobile design pack: Open |
| Push for SOS and safety alerts | Done (simulator, mock token) | Real delivery unverified; do not rely on push alone (KX16 H19) |

> **Note** Seeded demo nurses (solo nurse, agency nurses, aide, dispatcher, agency owner) are synthetic and DEV ONLY; their logins are in `TEST_DATA.md` and `kiorly-team/DEMO_DATA.md`.

## What changed in this revision (23 Nov 2026)
- Added §11 describing the nurse experience inside the unified Kiorly app, the Lab-results restriction for nurses, dispatcher rights and arrival distance. Requirements KN*, plans and gates are unchanged.
- This volume previously existed only under `rev23/`; a copy now also sits next to the other volumes in `_docs/`.
- Not verified: nurse flows on a physical device, real push.
