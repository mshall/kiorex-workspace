# KX-15 Risk & Compliance Framework

Source: 189VvrWvsSTnBwRpDHdGVuXSYkjx7YXZU
Revision: Rev 2.3 · Reference Edition (20 November 2026; supersedes KX15 Rev 2.1, 19 Nov 2026)

> Extraction note: text from Drive read_file_content; multi-column obligations table partly scrambled — rows reconstructed best-effort.

The obligations the ecosystem must meet in Egypt and beyond, how they map to controls already in the product, and the risks we manage actively.

- Authored in the role of Chief Risk & Compliance Officer. Owns the obligations register, risk register, policies and audit readiness.
- Tags: Obligations register · Control mapping · 18 key risks · Heatmap · Audit readiness
- DOCUMENT: KX15 | REVISION: Rev 2.3 · Reference Edition | DATE: 20 November 2026 | STATUS: Approved reference
- AUDIENCE: Founders, counsel, auditors, investors, enterprise customers | OWNER ROLE: Chief Risk & Compliance Officer | SUPERSEDES: KX15 Rev 2.1 19 Nov 2026

## WHAT CHANGED IN REV 2.3 (as printed)
Obligations add physiotherapy licensing (Law 3 of 1985), nursing syndicate membership, home-visit liability and location data under PDPL. Medical-licensing obligation widened from doctors to all professions; new launch gates GHV1, GHV2, GPR1, GKN1, GKN2. Risks R15–R18 added; heatmap and policies updated.

## Contents
01 Compliance posture · 02 Obligations register (Egypt first) · 03 Control mapping · 04 Risk register · 05 Policies to maintain · 06 Audit readiness checklist

## 01 Compliance posture
Compliance is engineered into the product, then evidenced. Legal filings and counsel memos remain human tasks with named owners.
Tiles: EGYPT LAW 151/2020 (PDPL, personal data protection); RECORDS OF PROCESSING (ROPA) shipped; REGULATOR BREACH NOTICE 72 h (runbook); TAX-AUTHORITY INTEGRATIONS 0 (ADR011).

## 02 Obligations register (Egypt first)

| Obligation | Applies to | How we comply | Evidence | Status |
|---|---|---|---|---|
| Personal data protection (PDPL): DPO, PDPC registration, controller/processor licences | Kiorex, Kiorly | DPO appointment; filings registry (platform/pdpc-egypt-filings.json); paid-launch gate until filed | SC02 registry | Human: filings |
| Cross-border transfer approval for hosting cell | All products | Recorded approval per data cell; tenants validated against cell registry | SC01, DATA_RESIDENCY_DECISION | Human: approval |
| Health data consent (processing, marketplace, messaging, AI, visit-status sharing) | All | Consent enforced in code; check-in capture; withdrawal | SC03, MS03 | Shipped (visit sharing: design) |
| Patient privacy notice (Arabic) | Kiorly, Kiorex | Legal pack v-controlled; adds home-visit address and location processing | GT02 | Counsel review |
| Breach notification | All | Runbook: 72 h regulator, 3 days subjects | PDPC_DATA_BREACH.md | Ready |
| Licensing of listed providers — physicians and dentists | Kiorex | Syndicate number + MoH licence verification before LIVE; re-verify on change | ON03 | Shipped |
| Physiotherapy licensing (Law 3 of 1985); unlicensed assistants only under supervision | Kiorly, Kiorex | PRVER with Physical Therapy Syndicate; assistants never listed (BR50) | PRVER, PRSOP03; gate GPR1 | Design |
| Nursing licensing; syndicate membership required to practise | Kiorly Nurse, Kiorex | PRVER with Nursing Syndicate + MoH licence; solo nurse extra checks | PRVER04; gate GKN2 | Design |
| Home visits: platform liability, patient and provider terms | Kiorex, Kiorly | Counsel memo; terms updated; CMO-signed safety protocol | Gates GHV1, GHV2 | Gate |
| Nursing agencies: establishment licensing (Law 51 of 1981) | Kiorex | Verification of commercial registration and MoH licence where one exists | Q11 | Ops SOP / Open question |
| Location data (geostamps) under PDPL | Kiorly | Coarse location, purpose-limited to safety and attendance, 12-month retention then district only; in ROPA | KX08 §07 | DPO to confirm |
| Advertising of medical services | Kiorex | No outcome claims; sponsored labels; CMO approval | KX14 rules | Policy |
| Tax: VAT on SaaS vs medical services | Kiorly billing | Market pack rates; adviser confirmation | NH001 | Human |
| Fiscal receipts for clinics | Clinics | Clinics issue their own; Kiorly prints payment records only | FD02 | Decided |
| Pharmacy dispensing & controlled medicines (EDA) | Kiorly Pharmacy | Pharmacist sign-off, controlled log, recall blocks | KX06 | Design |
| Online medicine sales rules | Kiorex pharmacy vertical | No launch until counsel memo and merchant-of-record decision | Q5 | Gate |
| Lab licensing & quality | Kiorly Lab customers | QC enforcement, signatures, corrected reports | KX07 | Design |
| App store health-app rules | Apps | Organization developer accounts; account deletion in-app; health declarations | KX19 | Setup |
| Consumer protection & refunds | Kiorex Pay | Published refund policy; automated refunds; deposit hold on unsafe abort | Legal pack | Counsel review |

## 03 Control mapping
Controls in the Kiorly codebase that already satisfy obligations — reused by every product and edition.

| Control family | Implemented controls | Reference |
|---|---|---|
| Access | Role grants, clinic privilege grants, money visibility, privileged MFA, session revoke; scope of practice per profession (v2.3) | RBAC_MULTI_ROLE, SC04, ON02, PRSOP |
| Audit | Billing/plan/credit audit catalogue; clinical sign-off and amendments; consent log; home-visit safety events | SC07, CL05, AUDIT_BILLING, HVSAF |
| Data lifecycle | Tenant export & offboarding; audio purge; retention per market; address masking after visits; geostamp reduction | SC05, AI02, HVPRV |
| Security operations | Rate limits, WAF, secrets hygiene, alerts + runbooks | SC06, QA05 |
| Resilience | PITR, restore drill | SC08, NH018 |
| Third parties | Sub-processors by market: AWS (incl. Location), Meta, OpenAI EU, PSPs, SES | SUB_PROCESSORS_BY_MARKET |

## 04 Risk register
L = likelihood (1–5), I = impact (1–5), Score = L x I.

| ID | Risk | L | I | Score | Mitigation | Owner |
|---|---|---|---|---|---|---|
| R1 | Marketplace fails to reach liquidity in launch clusters | 3 | 5 | 15 | Density-first playbook; cluster gates; clinic booking links seed demand | CMO |
| R2 | Founding trial conversion below 45% | 3 | 4 | 12 | Activation rule; onboarding wizard; owner nudges; 'Kiorly is free' meter | CEO |
| R3 | Incumbent price response (fee cuts, free software) | 4 | 3 | 12 | Higher-of rule is structurally hard to copy; workflow depth; no-show promise | CEO |
| R4 | Regulatory change on online medical services or e-pharmacy | 3 | 4 | 12 | Counsel monitoring; pharmacy marketplace only after Q5; no controlled medicines | Counsel |
| R5 | Personal-data breach | 2 | 5 | 10 | SC controls, MFA, pen test, breach runbook (72 h PDPC / 3 days subjects) | CEO + DPO |
| R6 | Booking double-commit or lost booking | 2 | 4 | 8 | Holds, idempotency, outbox, reconciliation job, contract tests | Eng lead |
| R7 | Commission disputes erode trust | 3 | 3 | 9 | Frozen snapshots, 7-day dispute, auto-approval rules, 3-day SLA | Ops |
| R8 | Payment provider outage or settlement errors | 2 | 4 | 8 | Multiple rails (card, Fawry, InstaPay, bank); idempotent webhooks; QA03 invariants | Finance |
| R9 | AI output causes clinical harm | 2 | 5 | 10 | Human approval, Rx safety checks, labels, kill switch (KX11/16) | CMO |
| R10 | Key-person dependency (founders part-time) | 4 | 4 | 16 | Hire CTO/eng lead by M6; documented runbooks; Cursor build sequences | CEO |
| R11 | EGP devaluation hurts USD-denominated costs | 3 | 3 | 9 | Egypt-based team; annual indexation; FX review monthly | CFO |
| R12 | Meta template approvals delay messaging | 3 | 2 | 6 | Submit early (NH003…015); print/manual fallback | Ops |
| R13 | Pharmacy/lab adoption slower than modelled | 3 | 3 | 9 | Discovery interviews before build; reuse kernel; pilot gates | CPO |
| R14 | Series A not raised in window | 3 | 5 | 15 | Milestone-gated raise; cost-down plan extends runway 4–6 months | CEO/CFO |
| R15 | Safety incident on a home visit damages trust | 2 | 5 | 10 | H13…H16 controls; safety timer, SOS, ops on-call; incident runbook | CMO |
| R16 | Individual nurse listing found non-compliant | 3 | 4 | 12 | Gate GKN2; agencies first; stricter verification | Counsel |
| R17 | Team capacity: Kiorly Nurse competes with Pharmacy/Lab build | 4 | 3 | 12 | Edition reuses Clinic code; strict scope; Nurse GA moves before Pharmacy GA | COO |
| R18 | Home-care operators undercut on price | 3 | 3 | 9 | Higher-of rule; agencies as customers, not competitors | CEO |

Heatmap (L × I, axes 1–5): I5: R5 R9 R15 at L2, R1 R14 at L3; I4: R6 R8 at L2, R2 R4 R16 at L3, R10 at L4; I3: R7 R11 R13 R18 at L3, R3 R17 at L4; I2: R12 at L3. Top risks: key-person dependency R10, liquidity R1, funding R14, regulatory change R4, individual nurse listing R16 and capacity R17.

## 05 Policies to maintain

| Policy | Owner | Review |
|---|---|---|
| Information security policy | CEO / security lead | Annual |
| Privacy policy & patient notice AR/EN | DPO + counsel | On change |
| Acceptable use & provider terms (incl. home-visit terms) | Counsel | Annual |
| Clinical safety policy | CMO | Annual |
| Home-visit safety protocol (providers and phlebotomists) | CMO | Annual + after any S1/S2 |
| Provider verification SOP (per profession) | Ops lead + counsel | Semi-annual |
| AI use policy | CMO + CEO | Semi-annual |
| Incident response & breach | CEO | Annual + drill |
| Vendor & sub-processor management | CEO | Annual |

## 06 Audit readiness checklist
- ROPA current (incl. home-visit addresses and geostamps); DPO named; filings referenced in registry.
- Pen test report with remediation evidence (NH017). Restore drill report with RPO/RTO (NH018).
- Access reviews quarterly for privileged roles.
- Sub-processor list and DPAs signed.
- Consent and audit exports demonstrable per tenant.
- Gate evidence recorded for every launch-locked flag that is effective (GHV1, GHV2, GPR1, GKN1, GKN2 and earlier gates).
- Provider verification sample audit: 20 random LIVE providers per profession per quarter.
