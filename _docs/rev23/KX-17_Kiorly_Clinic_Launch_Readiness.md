# KX-17 Kiorly Clinic Launch Readiness & Go-Live Plan
Source: 1acyKWJ3OZS1XvlgzOnzMZq6eGVvdthKi
Revision: Rev 2.3 · Reference Edition, updated 23 November 2026 (first issued 20 November 2026; this update adds the done-versus-open status of 23 Nov 2026; Growth update 24 Nov 2026 added at the end, status-labelled)

> Extraction note: symbols (>=, <=, arrows, ranges) dropped; table columns reconstructed best-effort.

Part 06 — Kiorly. Owner: Launch Director / VP Engineering. Audience: founders, engineering, operations, sales.

WHAT CHANGED IN REV 2.3 (as printed): Egypt pilot scope and gates are unchanged: professions, home visits and Kiorly Nurse are post-GA (KX18). Readiness scorecard adds a v2.3 row; the profession migration PRSOP01 must run before Phase 1b, not before pilot. New post-GA gates G5 (home visits) and G6 (Kiorly Nurse pilot) listed for traceability.

## 01 Readiness scorecard
Engineering is ahead of operations. The remaining work is approvals, accounts, people and drills.

| Area | Status | Evidence | Remaining |
|---|---|---|---|
| Product scope | Done | Stages A-E; Build sequence §5 tracker; capability map | GT06; Phase 1b items post-launch |
| Money engine | Done | CR01…11, SB01…06, QA02/03 | NH001 VAT confirmation |
| Kiorex connector | Done | KX01…10, QA04 | NH008, NH012, NH019 (Kiorex side) |
| Messaging | Templates pending | MS01…05 shipped | Meta approvals NH003…015; SES NH016 |
| Security & resilience | Drills pending | SC01…08 code shipped | Pen test NH017; restore drill NH018 |
| Privacy filings | Filings pending | SC02 ROPA, notice, breach runbook | DPO, PDPC filings, transfer approval |
| Clinical sign-off | Board pending | CL04 templates | NH010 |
| Support & content | Staffing | GT03/04 shipped | NH007, NH022, NH023 |
| Performance | Staging run | Engine/unit gates | NH020 |
| IaC migration | Before pilot | ADR028 (CDK → OpenTofu) | Steps T1-T5 (KX21 §01) |
| AWS hardening | Backlog | KX21 hardening backlog | HB01, 02, 06, 07, 08 are GA blockers |
| Feature flags (v2) | To build | 3-layer flags shipped for 5 keys | FF01…06; Kiorex super admin flag page KXMOP07…11 |
| Professions, home visits, Kiorly Nurse (v2.3) | Specified, not in pilot | KX05 §06-08, KX23, ADR029…032 | Profession migration before Phase 1b; field-visit package (M7-9) |

Tiles: STOP ITEMS 6 (block GA); OTHER HUMAN ITEMS 17 (parallelisable); PILOT LENGTH 4 wks (20 clinics); TARGET GA Apr 2027 (month 4).

## 01a Done versus open, 23 Nov 2026
Engineering moved further ahead of operations. Everything below is observed in the repositories; nothing is deployed and no launch gate is recorded by code.

| Area | Status | Evidence | Remaining (needs a human unless noted) |
|---|---|---|---|
| Provider readiness (SMS, email, WhatsApp, payment, push, storage, consent, AI) | Done | Port, mock and real adapters in all five backends; tested against a local fake vendor | Real URLs and credentials only |
| Real vendor contact | Blocked | None made | Contracts, credentials, a staging pass (FD-04) |
| WhatsApp templates | Blocked | Placeholders `TODO_NEEDS_HUMAN_*` in template definitions | Meta approval (NH003 to NH015) |
| PSP onboarding (Paymob, Fawry, InstaPay) | Blocked | `sandbox-fake` mock | Merchant accounts; wire-format mapping |
| SMS sender id and vendor | Blocked | Neutral adapter | Vendor choice (KX24 OD-1), carrier registration |
| Notification layer | Done in platform; Planned in Passport, Lab, Pharmacy, Clinic | contracts 1.7.0, 60 tests | Engineering, in a fixed order (KX24 §11) |
| Staff app Kiorly | Done (dev) | iOS simulator and Android emulator dev builds; e2e 16/17/18; per-role web specs | Release build, physical device, store submission |
| Real push delivery | Blocked | Mock token; `simctl push` fixtures; foreground and cold-start taps verified on the iOS simulator | EAS project id (`eas init`), APNs key, FCM v1 service account, `PUSH_MODE=real`; background-state tap and badge count unverified; Android push unexercised |
| Patient app | Done (dev) | Jest 157, tsc; web and simulator checks | A patient dev build and device check |
| Demo data | Done | 36 specialties, 72 doctors, 12 patients, nurse and Lite tenants; seeds idempotent (`scripts/seed-all.sh`) | Re-run with `--reset` every few days (relative dates) |
| AWS | Blocked | Founder: do not deploy; Passport Lambda reads secrets from env; tfvars hold `TODO_NEEDS_HUMAN` | Secret injection route; seed Docker image (`Dockerfile.seed`) not yet built; HB07 egress mode (FD-17) |
| Store submissions | Blocked | Bundle id `com.kiorly.app` for the Kiorly staff app (final name, ADR-037, 23 Nov 2026; earlier `com.kiorly.work`, `com.kiorly.app`; register this one in the stores and Passport) and `com.kiorex.app` are placeholders | Apple and Google organization accounts (KX19); ADR-033 sign-off; app name decision |
| Staff-app Jest | Done | 167 of 167 pass on the 23 Nov re-run | Two tests had a fixed date that aged out of the upgrade-request window; fixtures now relative |

> **Warning** The pilot scope above is unchanged: professions, home visits and Kiorly Nurse are post-GA (KX18) even though they are built locally. Flags keep them launch-locked (GHV1, GHV2, GKN1, GKN2).

New human items since the register above was written (no NH numbers assigned yet; add them to the repositories' NEEDS_HUMAN files): real provider credentials per kind; SMS sender-id registration; PSP onboarding; APNs key, FCM service account and EAS project id; AWS secret injection design; Apple and Google store organization accounts and first submissions; founder sign-off of ADR-033 and the staff app name; counsel and DPO review of the PHI pattern list.

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
| NH010 | CMO advisory board signs 11 specialty templates + fee factors (physio template follows in Phase 1b, GPR2) | CMO | Before GA | STOP |
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
| NH023 | WhatsApp support number, webhook, staffing Sun–Thu 09-18 | Ops | Pilot | STOP |
(Class column attachment is best-effort from layout; tile says 6 STOP.)

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
| Out of pilot scope | Physiotherapists, home visits and Kiorly Nurse — specified in KX05/KX23, launched after GA (KX18) |

Timeline: Week 0 rehearsal on staging; Week 1 onboard 20, import data; Week 2 full front desk use; Week 3 Kiorex test bookings; Week 4 billing dry-run; Week 5-6 fix & stabilise.

## 04 Go / no-go gates
| Gate | Criteria | Decision owner |
|---|---|---|
| G1 · Pilot start | Staging rehearsal green; support line live; consent and privacy notice live; backups verified | CEO |
| G2 · General availability | Flag snapshot live and every module verified with its OFF contract; launch-locked gates recorded or left locked; all STOP items closed; pilot activation >=60%; zero S1/S2 clinical incidents; payment success >=97%; golden flow green 14 days | CEO + CMO |
| G3 · Kiorex listing at scale | NH019 contract pinned; reconciliation <1% at 24 h; refunds reconcile | CEO |
| G4 · Paid conversion (founding trials end) | Billing dry-run reconciles; dunning notices approved; statements correct in AR/EN | CEO + Finance |
| G5 · Home visits (post-GA, M10-12) | GHV1 counsel memo + GHV2 CMO safety protocol recorded; field-visit safety drill green in staging; >=50 home-enabled providers per cluster | CEO + CMO |
| G6 · Kiorly Nurse pilot (M13-15) | GKN1 nursing templates signed; 10 solo nurses + 3 agencies onboarded; missed visits <=3%; zero unresolved safety alerts | CEO + CMO |

## 05 Cutover and hypercare
Launch day: freeze non-critical merges 48 h; on-call rota; status page; daily incident review for 2 weeks. Monitor: signup funnel, outbox lag, WhatsApp delivery, payment webhooks, settlement dry-run.
Rollback: redeploy previous image via tofu apply (CDK until migration T5); expand-contract migrations only (the PRSOP01 profession backfill follows the same rule); feature flags for new modules. Customer communications: launch WhatsApp + email in Arabic; help centre videos live.

## 06 First 90 days after GA
Month 1: Founding cohort sales push; Kiorex closed beta (clusters 1-2).
Month 2: Kiorex public launch; Phase 1b: KX11, CL06, MS06.
Month 3: Commerce-kernel package extraction; Sign in with Kiorex (provider SSO design); Profession migration PRSOP01 and physio pack build start.

## What changed in this revision (23 Nov 2026)
- Added §01a (Done, Open, Blocked) and the list of new human items. Pilot design, gates, cutover and the first 90 days are unchanged.
- Not verified: everything marked Blocked (never run against a real vendor, device push or AWS); the 2 failing Jest tests.

## Growth Engine update (24 Nov 2026)
Labels: **As-built** (in code today), **Approved target** (Accepted ADR or FD), **Proposed** (ADR-041 to ADR-047, unsigned), **Roadmap**, **Open decision**, **Regulatory dependency**. Full legend in KX-27. Source: `_docs/growth/` reports of 24 Nov 2026. Nothing here is implemented unless marked As-built.

- **Pilot design (section 03)**: Proposed additions to the 20-clinic pilot: each pilot clinic gets a QR poster kit (A4/A5, AR/EN) and a link per doctor; success measures add link activation (at least 15 of 20 clinics with a booking through a link by day 60), provider-led share, dispute rate below 5 percent and attribution replay equality (KX-29 section 07).
- **Go / no-go gates (section 04)**: Proposed Growth gates, none recorded as satisfied: contracts 1.10.0 published; counsel opinion and consent wording approved for any production analytics or marketing; provider terms updated for attribution; hosts and DNS decided.
- **Needs-human register (section 02)**: new rows for `kiorex.com` and `kiorly.link` DNS, widget host, Search Console and Business Profile ownership, Apple Team ID and Play SHA-256, consent wording, marketing licence confirmation. Listed in `_docs/LAUNCH_PREPARATION_GUIDE.md` section 11.
- **Scorecard (section 01)**: growth readiness is Open: nothing built at 24 Nov 2026 beyond the commission engine and booking slug page (As-built).
