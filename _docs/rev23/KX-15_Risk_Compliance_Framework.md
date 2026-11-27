# KX-15 Risk & Compliance Framework

Source: 189VvrWvsSTnBwRpDHdGVuXSYkjx7YXZU
Revision: Rev 2.8 · Reference Edition, updated 27 November 2026 (previous: Rev 2.7; ADR-059 accepted; new risk rows for real data in kx-test, Huawei Cloud verification, counsel gate; deployment status)

WHAT CHANGED IN REV 2.8: ADR-059 accepted. Risk register adds: Clinic on AWS with a real organisation in kx-test, Huawei Cloud region and residency verification, counsel sign-off NOT_REVIEWED blocking real-money modes, production IdP. Deployment status corrected (only the Clinic is deployed).

> Extraction note: text from Drive read_file_content; multi-column obligations table partly scrambled — rows reconstructed best-effort.

The obligations the ecosystem must meet in Egypt and beyond, how they map to controls already in the product, and the risks we manage actively.

- Authored in the role of Chief Risk & Compliance Officer. Owns the obligations register, risk register, policies and audit readiness.
- Tags: Obligations register · Control mapping · 18 key risks · Heatmap · Audit readiness
- DOCUMENT: KX15 | REVISION: Rev 2.4 · Reference Edition | DATE: 24 November 2026 | STATUS: Approved reference
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

## 07 Medical document retention and legal hold (Proposed, 23 Nov 2026)
Deleting a medical document currently hard-deletes it. Proposed control: soft delete with a mandatory reason, retention floor per market and document class (proposal: clinical 10 years from last clinical activity, financial proofs 7 years; NEEDS_HUMAN: DPO to confirm), legal hold that blocks purge, a nightly purge job that keeps only an anonymous audit record (ids, size, hash, actor, reason), and erasure requests that create a DPO task and never delete inside the retention period. EXIF and GPS data are stripped from uploaded photos. Detail: KX-25 §07.

## Growth Engine update (24 Nov 2026)
Labels: **As-built** (in code today), **Approved target** (Accepted ADR or FD), **Proposed** (ADR-041 to ADR-047, unsigned), **Roadmap**, **Open decision**, **Regulatory dependency**. Full legend in KX-27. Source: `_docs/growth/` reports of 24 Nov 2026. Nothing here is implemented unless marked As-built. Rev 2.4: where this section differs from the Rev 2.4 as-built update at the end of the volume, the end section wins.

**Regulatory facts checked (secondary sources only; counsel must confirm).** Egypt PDPL Law 151 of 2020: direct electronic marketing needs the data subject's consent and sender identity; a registry of approvals must be kept; commentary reports a licence for direct electronic marketing (reported as Article 28); executive regulations were reported issued in 2025 with a one-year compliance period (the decision number differs between sources). All of this is a Regulatory dependency.

| # | Obligation or risk | Treatment (Proposed) | Owner |
|---|---|---|---|
| 1 | Analytics cookies and visitor keys | Consent-gated; no visitor key before consent; `growth.analytics_visitor` launch-locked | Counsel, DPO |
| 2 | Direct electronic marketing consent and licence | `growth.marketing_messaging` launch-locked OFF in production; mock mode until counsel signs | Counsel |
| 3 | Consent wording AR and EN, versioned (`TODO_NEEDS_HUMAN_v0` today) | Placeholder keys; no marketing send until approved | Counsel, CMO |
| 4 | Advertising rules: no health-condition targeting, no patient-list audiences, no remarketing, no patient identifiers to ad platforms | Company policy; `no-health-targeting` guard test; `AnonymizedConversion` only | Counsel, CMO |
| 5 | Children and dependants | Excluded from growth tables and marketing | DPO |
| 6 | Cross-border and processors | Growth data stays in the Frankfurt cell; only aggregates to external platforms | DPO |
| 7 | Reward credits (stored value, e-money, vouchers, consumer protection, tax and accounting) | Not built until assessed; coupon fallback | Counsel, finance |
| 8 | Provider content licence for public SEO pages; provider terms for attribution and evidence | Terms update before go-live | Counsel, CEO |
| 9 | Retention, subject rights and the decision-anonymisation approach | DPO to confirm defaults (13 and 25 months for touches, 12 for fraud signals) | DPO |
| 10 | Review markup eligibility | Omit `aggregateRating` until verified | SEO lead |
| 11 | WhatsApp templates, quality rating, assistant safety review | Gate before `kiorex.whatsapp_ai_assistant` | CMO, clinical safety |
| 12 | Complete record of processing and formal PIA | DPO deliverable; summary in KX-28 section 10 | DPO |

Risk register additions: GR1 to GR10 in KX-27 section 09. The full list of 26 NEEDS_HUMAN items is in `_docs/growth/GROWTH_PHASE1_WORK_PACKAGES.md` section 7. No gate is recorded as satisfied here.

## Rev 2.4 as-built update (24 Nov 2026)
Rev 2.4 verification (24 Nov 2026): checked against the repositories, with the suites re-run the same day (counts in KX-33 section 04). As-built means in code with a passing test on the local stack; that verification deployed and pushed nothing, and every provider is mocked. This section wins over the Growth Engine update above wherever they differ.

- **Security findings summary.** The internal white-box penetration test of 24 Nov 2026 (`_docs/security/PENTEST_2026-11_REPORT.md`) found 14 issues: 1 Critical, 5 High, 7 Medium, 1 Low; all are fixed with regression tests and re-verified (28 security e2e tests, production-mode boots, clean `npm audit --omit=dev`). Residual Low and Info items are documented (per-instance Clinic limiters, unauthenticated `/health/ready`, 500 on a few ops payloads, credentials in the tenant SQL export, restore scope, build-tool advisories). The external penetration test (NH017) is still required and is not replaced.
- **Edge-case sweep.** 24 defects fixed (PSP capture idempotency, booking races, hostile input, contract sweeps). Remaining risks to register: untyped Clinic request bodies (115 parameters), `lt` tokens not bound to a person within 72 hours, a one-hour error on two Cairo DST nights in a quiet-hours helper, the Lab cancel race, no 410 tombstone for delisted profiles, a replayed authorization code leaves the first tokens valid.
- **Compliance as built (not as approved).** Consent is append-only with versioned wording keys; withdrawal and STOP write suppression; erasure is wired to the Passport deletion event and was fixed in Rev 2.4 work (growth rows anonymised: touches a decision used are kept anonymised for 25 months, others deleted at 13); no PHI in growth payloads is enforced by tests; dependants never enter growth tables; the visitor key and marketing messaging stay launch-locked. **None of this satisfies a legal gate**: the PDPL opinion, consent wording, marketing licence, provider terms and data-residency view remain Regulatory dependencies (KX-33 section 06) and no gate evidence is recorded.
- **Telehealth.** ADR-039 sends no media through our servers and records none; Cloudflare is a transport-only sub-processor for relayed calls (listed in the Clinic sub-processor note); video consent wording and the governance gate for `kiorex.telemedicine` are NEEDS_HUMAN.

## Rev 2.7 consent, licence and retention rows added by Phases 2 to 4 (25 Nov 2026)
| # | Item | Built default | Owner |
|---|---|---|---|
| 1 | Patient credit, refund-as-credit, family credit: stored-value and consumer-protection position | Coupon mode; flags locked; terms are placeholders | Counsel, CFO |
| 2 | Provider-sponsored promotions: advertising and price-reference rules, accounting and VAT | Locked OFF; placeholder content-guard list | Counsel, CFO, CMO |
| 3 | Cross-product continuity consent (`CROSS_PRODUCT_CONTINUITY`) and whether a shared prescription or lab order may seed a prompt | Off by default; draft wording marked | Counsel, DPO |
| 4 | Assistant: `AI_PROCESSING` consent, disclosure, retention (30 days turns, 12 months tool audit), real-model processor and cross-border | Mock model; redacted text; locked | Counsel, DPO, CMO |
| 5 | Fraud cases: legal basis and retention of a keyed-hash case, DPO-only identity lookup role | Shadow mode; role must be created | DPO, counsel |
| 6 | Corporate: HR-list matching window (30 days), 7-year ledger retention of an ended account, what an employer may see (aggregates of 10 or more) | Locked; defaults need confirmation | Counsel, DPO |
| 7 | Experiments: consent dependency of the `kxe` cookie | Consent-gated; experiments need the locked visitor-analytics flag | Counsel |
| 8 | New market: direct-marketing licence, consent regime, health-advertising rules, data residency per country | Wizard stores ids and booleans only; ZY synthetic | Counsel, CTO |
| 9 | Retention periods for new growth tables (assistant, lifecycle decisions, ledgers, fraud, experiments, cohorts) and the record of processing and PIA update | PROPOSED_DEFAULT | DPO |
Nothing here records a gate; gate evidence is entered only by a human in the Super Admin (ADR-024).

## Rev 2.7 finishing update: payment, messaging and integration controls (25 Nov 2026)

Status: **As-built locally** (code plus passing tests, mock providers; only the Clinic is deployed, on AWS). This update records controls that now exist; it does not decide any legal question.

<!-- kx-diagram: money-flow -->

| Obligation or risk | Control now built | Status and owner |
|---|---|---|
| Funds flow, licensing and settlement accounts | **Kiorly never holds funds in the design.** Licensed payment partners process and settle; the Pay layer is orchestration, routing, reconciliation and reporting only | Design rule in force; legal review is NEEDS_HUMAN (counsel, Central Bank rules; LG-INT-PAY-19, LG-COM-3) |
| Card data | Every card is typed on the vendor's hosted page (PCI SAQ-A scope); Kiorex stores a vendor reference, brand, last four digits, the 3-D Secure result and an HMAC-hashed fingerprint; a card number is refused by the subscription endpoints | As-built |
| Forged, replayed or tampered callbacks | Signature checks with a replay window; amount-tampered callbacks refused; double refund and refund-during-dispute blocked | As-built, tested with recorded-shape fixtures |
| Payment fraud | Shadow scorer and review queue; no enforcement mode exists (no ban, no block); thresholds are maker-checker and clamped to safety bounds | Owner and calibration open (LG-INT-PAY-17) |
| Premature real vendor calls | Three switches in three places; every real adapter answers NEEDS_HUMAN_REAL_MODE_NOT_APPROVED without approval; the exemption flag is ignored in production and reported as a problem | In force |
| Secrets | By reference only (`/{product}/{env}/{purpose}`); never in chat, tickets, git or the console | In force |
| Commission collection harming providers | The collection module pauses no listing, booking, plan or care (a test scans the sources); failure ends as an open invoice | As-built; the Clinic SB-05 listing pause at D+30 was removed by decision on 26 Nov 2026 (collection never pauses listing; a test covers it) |
| Subscription lapse | Lite instead of lockout; clinical records never blocked; data never deleted | As-built |
| Messaging consent | Consent gate, quiet hours and STOP; marketing never fails over. Gap: unsubscribe adds a suppression but does not yet withdraw the marketing consent record | As-built; gap open |
| Tax authority reporting | None, by founder decision (ADR-011): products show tax lines and export data only | In force |

<!-- kx-diagram: integration-control-center -->

> **Needs human** Counsel and the DPO own the legal rows (funds flow, licensing, consent wording, credit position). No row above is a legal opinion.

> **Decision** Decided 26 Nov 2026 (launch guide row 13.16, resolved; the founder delegated the choice to the recommendation): collection never pauses listing. An unpaid Kiorex commission (Lite or any plan) is reminded, aged, escalated and can be disputed, but it never pauses or hides the Kiorex listing, and never blocks booking, plan or care. The Clinic code no longer pauses the listing at D+30 (SB-05 superseded; `Tenant.kiorexBillingPausedAt` is legacy, never set, and cleared by the daily dunning job where an old value remains). The listing still follows the subscription state (READ_ONLY or SUSPENDED for a non-commission subscription lapse) and verification. The rule is a code rule, not a feature flag: safety controls are never flags, so reversing it is a code change only (and a new founder decision).

## Rev 2.8: environment rule, hosting and open compliance gates (27 Nov 2026, ADR-059 Accepted)

> **Status** Deployment, 27 Nov 2026. Only Kiorly Clinic is deployed, on AWS (account 990597228737, eu-central-1, environment kx-test): it was deployed on 24 and 25 Nov 2026 and the deploy of `main` succeeded on 27 Nov 2026. Kiorex, Passport, Pharmacy and Lab are not deployed. Where this volume says "nothing is deployed", it describes the date it was written and those four products.

Environment rule and a declared exception: real patient data belongs only on the production plane (pilot and prod); kx-test holds one designated real organisation (Dr Ahmed Shall, Clinic only) as a declared exception pending counsel. Real identities must not sit in the public, shared test database. Sibling-subdomain cookie risk (non-production hosts share the registrable domain) is mitigated by host-only `__Host-` cookies and a CI check; a separate non-production domain is the documented fallback. No legal wording is written.

| Risk | Control | Status |
|---|---|---|
| Real organisation in kx-test before counsel has spoken | One organisation only, Clinic database with production-grade protection, trial visits only with people who know it | Open (counsel) |
| Production hosting on Huawei Cloud: region, Egypt data residency, CBE position | Founder and counsel verify; nothing asserted; region variable is a placeholder | Open |
| Real-money collection and payouts | Counsel sign-off NOT_REVIEWED blocks every real-money mode and route; mock runs | In force |
| Production identity provider undecided | Cognito default; kx-test identities may not carry over | Open |
| Cloud switch as a migration | Separate state, dump and restore, DNS repoint, old stack kept until healthy | Procedure written |
| Unpaid commission harming a provider | Never pauses listing, booking, plan or care (SB-05 resolved 26 Nov 2026) | In force |
| Demo data reaching real users | Removed from the user interfaces, tagged for removal | Done |

> **Risk** The pilot rule (real people on the production plane under a cohort gate) and the real organisation in kx-test have no counsel position yet. Nothing in this volume is a legal opinion.

