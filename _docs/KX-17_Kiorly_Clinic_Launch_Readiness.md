# KX-17 Kiorly Clinic Launch Readiness & Go-Live Plan
Source: 1ROqQ-76Lto4cpbTFTxx8Kax7AqLxj9YD

> Extraction note: the PDF text layer dropped some symbols (>=, <=, arrows, ranges) and appears truncated at the end of section 06 (the source text ends after the Q1 list). Table columns reconstructed best-effort.

Part 06 — Kiorly. From build-ready to live in Egypt: what is done, what still needs a human, the pilot design, launch gates and the first 90 days.

- Authored in the role of Launch Director / VP Engineering. Owns the path from code-complete to paying customers.
- Tags: Readiness scorecard, 23 human items, Pilot design, Go/no-go gates, Hypercare
- DOCUMENT: KX17 | REVISION: Rev 2.2 · Reference Edition | DATE: 19 November 2026 | STATUS: Approved reference
- AUDIENCE: Founders, engineering, operations, sales | OWNER ROLE: Launch Director / VP Engineering | SUPERSEDES: Kiorex v2 draft volumes 19 Nov 2026, 00000106

## Contents
01 Readiness scorecard; 02 Needs-human register; 03 Pilot design; 04 Go / no-go gates; 05 Cutover and hypercare; 06 First 90 days after GA

## 01 Readiness scorecard
Engineering is ahead of operations. The remaining work is approvals, accounts, people and drills.

| Area | Status | Evidence | Remaining |
|---|---|---|---|
| Product scope | Done | Build sequence §5 tracker; capability map (Stages A-E) | GT06 Phase 1b items post-launch |
| Money engine | Done | CR01...11, SB01...06, QA02/03 | NH001 VAT confirmation |
| Kiorex connector | Done | KX01...10, QA04 | NH008, NH012, NH019 (Kiorex side) |
| Messaging | Templates pending | MS01...05 shipped | Meta approvals NH003...015; SES NH016 |
| Security & resilience | Drills pending | SC01...08 code shipped | Pen test NH017; restore drill NH018 |
| Privacy filings | Filings pending | SC02 ROPA, notice, breach runbook | DPO, PDPC filings, transfer approval |
| Clinical sign-off | Board pending | CL04 templates | NH010 |
| Support & content | Staffing | GT03/04 shipped | NH007, NH022, NH023 |
| Performance | Staging run | Engine/unit gates | NH020 |
| IaC migration | Before pilot | ADR028 (CDK -> OpenTofu) | Steps T1-T5 (KX21 §01) |
| AWS hardening | Backlog | KX21 hardening backlog | HB01, 02, 06, 07, 08 are GA blockers |
| Feature flags (v2) | To build | 3-layer flags shipped for 5 keys | FF01...06; Kiorex super admin flag page KXMOP07...11 |

Headline tiles: STOP ITEMS 4 (block GA, per source: "4 / 6 / 17" tile values garbled: STOP ITEMS 4; OTHER HUMAN ITEMS 17 [or as extracted "6 17"], parallelisable; PILOT LENGTH 4 wks, 20 clinics; TARGET MONTH GA Apr 2027). Extracted raw: "STOP ITEMS / OTHER HUMAN ITEMS / PILOT LENGTH / TARGET MONTH 4 6 17 4 wks GA block GA parallelisable 20 clinics Apr 2027".

## 02 Needs-human register
From Docs/KIORLY_NEEDS_HUMAN.md. STOP items must close before general availability.

| ID | Item | Owner | Needed by | Class |
|---|---|---|---|---|
| NH001 | Tax adviser: VAT on medical services 0% vs Kiorly SaaS 14% | Finance | Before first invoice | STOP |
| NH003 | Meta template: monthly statement EN/AR | Ops | Pilot | open |
| NH004 | Price-change notice wording + template; 30-day notice with counsel | Counsel/Ops | Before first price change | open |
| NH005 | Template: staff invitations | Ops | Pilot | open |
| NH006 | Template: rep owner OTP/welcome; rep commission % per market | Ops/CEO | Field launch | open |
| NH007 | Record five 60-s Arabic how-to videos | Marketing | Pilot | open |
| NH008 | Kiorex widget origin; register kiorly.link | Eng/Brand | Kiorex beta | open |
| NH009 | Template: prescription_ready with document header; APP_WEB_URL | Ops | Pilot | open |
| NH010 | CMO advisory board signs 11 specialty templates + fee factors | CMO | Before GA | STOP |
| NH011 | Templates: waitlist offers | Ops | GA | open |
| NH012 | Template: deposit link; Kiorex Pay checkout origin; deposit defaults | Ops/Eng | Kiorex beta | open |
| NH013 | Template: owner shift summary; variance threshold | Ops | Pilot | open |
| NH014 | Template: installment reminder | Ops | GA | open |
| NH015 | Templates: digests and Kiorex nudges | Ops | GA | open |
| NH016 | SES domain mail.kiorly.com: DKIM/SPF/DMARC | Eng | Pilot | STOP |
| NH017 | External penetration test; fix all High | Security | Before public launch | STOP |
| NH018 | Quarterly RDS restore drill in eu-central-1 | Eng | Before GA | STOP |
| NH019 | Kiorex CI pins Kiorly OpenAPI + consumer contract | Kiorex eng | Kiorex beta | STOP |
| NH020 | k6 + Lighthouse on staging with real HMAC fixtures | Eng | Before GA | open |
| NH021 | Web Push VAPID keys; PWA install tests iOS/Android | Eng | Pilot | open |
| NH022 | Native Egyptian Arabic copy review; RTL QA | Marketing | Before GA | open |
| NH023 | WhatsApp support number, webhook, staffing Sun-Thu 09-18 | Ops | Pilot | STOP |

(Class values for NH001, NH017, NH018, NH019, NH023 attached as best recoverable from the scrambled layout; the page tile says 4 STOP items, while the extracted table marks more rows STOP.)

## 03 Pilot design

| Element | Design |
|---|---|
| Clinics | 20 clinics in two clusters: 12 single-doctor (Lite/Pro), 6 polyclinics (Clinic), 2 dental/aesthetic |
| Duration | 4 weeks + 2-week stabilisation |
| Environment | Production stack with pilot flag; staging for rehearsal (demo:reset <60 s) |
| Support | Daily check-ins week 1; WhatsApp support line; on-site rep |
| What we measure | Activation (>=20 visits in 30 days), daily active staff, golden-flow completion, support tickets/clinic, payment success, NPS |
| Pricing tests | Pro 799 / 999 / 1,299 split across matched clinics; record willingness to pay |
| Flag drill | In week 4, switch off clinic.kiorex_listing, ai_assistant and kiorly_pay_deposits for one pilot org and confirm the OFF contract, then back ON |

Timeline: Week 0 rehearsal on staging; Week 1 onboard 20, import data; Week 2 full front desk use; Week 3 Kiorex test bookings; Week 4 billing dry-run; Week 5-6 fix & stabilise.

## 04 Go / no-go gates

| Gate | Criteria | Decision owner |
|---|---|---|
| G1 · Pilot start | Staging rehearsal green; support line live; consent and privacy notice live; backups verified | CEO |
| G2 · General availability | Flag snapshot live and every module verified with its OFF contract; launch-locked gates recorded or left locked; all STOP items closed; pilot activation >=60%; zero S1/S2 clinical incidents; payment success >=97%; golden flow green 14 days | CEO + CMO |
| G3 · Kiorex listing at scale | NH019 contract pinned; reconciliation <1% at 24 h; refunds reconcile | CEO |
| G4 · Paid conversion (founding trials end) | Billing dry-run reconciles; dunning notices approved; statements correct in AR/EN | CEO + Finance |

## 05 Cutover and hypercare
- Launch day: freeze non-critical merges 48 h; on-call rota; status page; daily incident review for 2 weeks.
- Monitor: signup funnel, outbox lag, WhatsApp delivery, payment webhooks, settlement dry-run.
- Rollback: redeploy previous image via tofu apply (CDK until migration T5); expand-contract migrations only; feature flags for new modules.
- Customer communications: launch WhatsApp + email in Arabic; help centre videos live.

## 06 First 90 days after GA
Q1 (list as extracted; text ends here in the source extraction):
- Founding cohort sales push
- Kiorex closed beta (clusters 1-2)
- Kiorex public launch
- Phase 1b: KX11, CL06, MS06
- Commerce-kernel package extraction
- Sign in with Kiorex (provider SSO design)
