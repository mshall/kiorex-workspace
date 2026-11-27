# KX18 · 36-Month Roadmap & Operating Model
Source: 1MVZrqh6hAUWyX6CkBWDTfbFzJUwKk_F1

> Extraction note: comparison/arrow symbols (≥, ≤, →, +, ×, ~) and some chart/scorecard numeric values were lost in the PDF text layer. Obvious symbols are restored by inference; missing numeric values are marked "(not extracted)".

Section 07 of the Kiorex v2 ecosystem reference — ROADMAP & DELIVERY.

Quarter-by-quarter delivery across five products, the team that delivers it, and the operating rhythm that keeps a part-time founding team in control.

- Authored in the role of Chief Operating Officer. Owns delivery sequencing, team design, operating cadence and KPIs.
- Topics: 12 quarters · Critical path · Team plan · Operating cadence · Scorecard

| Field | Value |
|---|---|
| DOCUMENT | KX18 |
| REVISION | Rev 2.2 · Reference Edition |
| DATE | 19 November 2026 |
| STATUS | Approved reference |
| AUDIENCE | Founders, team leads, investors |
| OWNER ROLE | Chief Operating Officer |
| SUPERSEDES | Kiorex v2 draft volumes 19 Nov 2026, 00000106 |

## Contents
01 Roadmap at a glance (month 1 = January 2027)
02 Quarter-by-quarter deliverables
03 Team plan
04 Team topology
05 Operating cadence
06 Company scorecard
07 Build method for new repositories

## 01 Roadmap at a glance (month 1 = January 2027)

Gantt chart across Q1–Q12. Lanes (as extracted):

- Kiorly Clinic: pilot → GA (pilot · GA)
- Kiorly Clinic: Phase 1b — KX11 · CL06/07 · MS06 · RP04
- Commerce kernel package extract
- Kiorex patient MVP build · beta M4
- Kiorex public + growth clusters 1–6
- Kiorex Account (patients)
- Provider SSO (Kiorly)
- Kiorly Pharmacy: disc · build · pilot M13 · GA M16
- Kiorex pharmacy orders
- Kiorly Lab: build · pilot M19 · GA M21
- Kiorex lab bookings
- Enterprise programme
- Market 2 pack & launch pack · pilot M25
- Series A raise
- Markers: GA, Kiorex, Y1, Y2

Figure 1 — 36-month portfolio.

**DECISION:** Deploy = live. Every module ships to production enabled by default the day it is deployed; the Kiorex super admin can switch it off at global, market or organization scope (ADR-023). The dates below are therefore go-live dates. Launch-locked capabilities go live when their gate is recorded.

## 02 Quarter-by-quarter deliverables

| Q | Months | Product deliverables | Exit criteria |
|---|---|---|---|
| Q1 | Jan–Mar 2027 | Kiorly pilot (≈20 clinics); STOP items closed; Kiorex MVP build; IdP selected | GA gate G2 passed |
| Q2 | Apr–Jun 2027 | Kiorly GA; Kiorex closed beta (M4) → public Egypt (M6); patient accounts | ≥300 LIVE doctors; ≥95% booking concordance |
| Q3 | Jul–Sep 2027 | Phase 1b (record share, lab orders, AI receptionist pilot); kernel extraction; clusters 3–4; pharmacy discovery | Founding trials converting ≥50% |
| Q4 | Oct–Dec 2027 | Provider SSO; Kiorly Pharmacy build; specialty packs; RP04 | ≥850 active tenants; ≥12 Kiorex patients/doctor |
| Q5 | Jan–Mar 2028 | Pharmacy pilot (M13); scribe GA with production STT; enterprise programme design | ≥20 pharmacies live |
| Q6 | Apr–Jun 2028 | Pharmacy GA (M16); Kiorex pharmacy orders; first enterprise contract; Series A raise | Series A gates met |
| Q7 | Jul–Sep 2028 | Kiorly Lab build; Market-2 pack design; no-show ML model | Pharmacy NRR ≥100% |
| Q8 | Oct–Dec 2028 | Lab pilot (M19) → GA (M21); Kiorex lab bookings + home collection | ≥8 pilot labs; zero QC stop-ships |
| Q9 | Jan–Mar 2029 | Market 2 pilot (M25); self-hosted AI evaluation | Market pack certified |
| Q10 | Apr–Jun 2029 | Market 2 GA; insurer/TPA interfaces; telehealth (if approved) | Market-2 unit economics positive at contribution |
| Q11 | Jul–Sep 2029 | Care continuity across products (Rx → pharmacy, orders → lab → clinic) | Cross-product journeys ≥10% of patients |
| Q12 | Oct–Dec 2029 | Scale: capacity planning, advanced automation, next-market readiness | EBITDA trajectory to break-even |

## 03 Team plan

Headcount plan (base) — stacked chart over months 0–35, y-axis 0–60; series: Engineering, Product & design, Operations & support, Sales & marketing (excl. commissioned reps). (Chart values not extracted.)

| Hire | When | Why |
|---|---|---|
| Head of Engineering / CTO | By M6 | Remove key-person risk R10; own architecture and on-call |
| Kiorex product lead + 2 mobile engineers | M1–M3 | Patient MVP |
| Customer success lead + 4 onboarding specialists | M1–M4 | Pilot and founding cohort activation |
| Field sales lead + 6 reps (commissioned) | M2–M6 | Supply acquisition |
| Security lead (part-time → full) | M6 / M18 | Pen tests, audits, enterprise asks |
| Pharmacy product lead + clinical pharmacist advisor | M8 | KX06 discovery and build |
| Lab product lead + pathologist advisor | M14 | KX07 |
| Market-2 country manager | M21 | Market pack and launch |
| Finance manager | M9 | Monthly close, Series A data room |

## 04 Team topology

Teams aligned to repositories; one owner per repo (CODEOWNERS).

| Squad | Repo owner of | Scope |
|---|---|---|
| Kiorly Clinic squad | clinics-management | Phase 1b, kernel package; On-call for clinic API |
| Kiorex squad | kiorex-platform | Patient app, search, booking, Kiorex Pay; Ops console |
| Platform & identity | kiorex-account, kiorex-contracts | OpenTofu modules, CI, observability; Security controls |
| Pharmacy squad (M8) | kiorly-pharmacy | POS, inventory, Rx |
| Lab squad (M14) | kiorly-lab | LIMS, analyzers, collection |
| Growth & ops | business | Onboarding, support, reps; Liquidity dashboards |

## 05 Operating cadence

| Rhythm | Forum | Inputs | Outputs |
|---|---|---|---|
| Daily | Squad stand-ups (async allowed) | Board, alerts | Blockers cleared |
| Weekly | Founders' review (60 min) | Scorecard, incidents, pipeline | Decisions, priorities |
| Bi-weekly | Release review | Changelog, test evidence | Go/no-go |
| Monthly | Business review + model refresh + flag review | Cohorts, burn, gates, flags OFF >30 days | Updated KX13, board pack, flag decisions |
| Quarterly | Roadmap re-score | Evidence vs plan | Re-prioritised portfolio |

## 06 Company scorecard

| Metric | Owner | M? target | M? target | M? target |
|---|---|---|---|---|
| Active clinic tenants | Growth | (not extracted) | (not extracted) | (not extracted) |
| Paying clinics | Growth | — | (not extracted) | (not extracted) |
| Attended Kiorex visits / month | Kiorex | (not extracted) | (not extracted) | (not extracted) |
| Monthly revenue (EGP k) | CEO | (not extracted) | (not extracted) | (not extracted) |
| Booking concordance | Eng | ≥ _% | ≥ _% | ≥ _% (values not extracted) |
| S1/S2 clinical incidents | CMO | (not extracted) | (not extracted) | (not extracted) |
| Months of runway | CFO | (not extracted) | (not extracted) | (not extracted; "post-A" noted for last column) |

(Month headers and numeric targets were lost in extraction.)

## 07 Build method for new repositories

Repository map, migration order and the build-agent brief: KX22.

- Every step that adds a capability also adds its flag key, OFF behaviour and per-flag OFF contract test (definition of done).
- Each new repo gets a `Docs/<product>-cursor-build-sequence.md` modelled on Kiorly's: stages, numbered steps with IDs, acceptance tests, 'stop and ask the human' rules, progress tracker.
- Steps cite PRD requirement IDs (KXM-*, KP-*, KL-*, KA-*).
- Definition of done per step: migration + API + UI + tests + doc status row updated in the same change (GT06 convention).
- Human-only items go to a `NEEDS_HUMAN.md` register with STOP flags, as in Kiorly.

## 08 Added roadmap items (founder decision, 27 Nov 2026)

Both items apply to the Kiorly modules (Clinic, Pharmacy, Lab, staff app) when they run standalone, without Kiorex. They are not scheduled yet: the founder decides month and owner. Neither changes anything that is built today.

### R-OFF-1 Outage mode (standalone modules, internet lost for some time)

Status: PLANNED, unscheduled. The module keeps working during an internet outage and syncs when the connection returns. The server stays the single source of truth.

- Local store in web and staff apps (IndexedDB or SQLite), service worker caching so the app opens without a network.
- Queue of pending actions replayed in order; every action carries a unique id and the API is idempotent so a retry never applies twice.
- Visible "offline, N changes waiting" state and a sync-status screen.
- Conflict rules; offline actions keep their real time and user for the audit log, and the server records both client and server time.
- Sign-in survives an outage: cached session for a limited window, refreshed on reconnect.
- Security: encrypted cache at rest, short cache window, screen lock, remote wipe on next connection, data-age indicator on cached clinical records.
- Staging (recommended): (1) Clinic reception and visit notes, read-mostly (cached schedule and records; notes and walk-in registration queued; no offline money or stock changes); (2) Pharmacy counter; (3) Lab; (4) offline dispensing and payments only with strict rules and review on sync. One shared sync layer, not one per module.
- Known limits: double booking across devices (pending-confirmation state or per-device slot assignment), messaging and card payments queue or stay off, Kiorex online bookings reach the clinic only after reconnect, controlled-item dispensing needs flagging.
- Open decisions (founder): which module and actions first, allowed offline duration (hours or days), acceptance of delayed Kiorex bookings.

### R-AIR-1 Fully air-gapped edition (standalone modules, no internet at the site)

Status: FUTURE, a separate product, not a switch on the cloud product. Build only after outage mode and after validating demand with two or three real customers.

- Single-machine package with no external software to install (bundled embedded database, API, jobs, file storage, local web server), one module first (probably Clinic).
- Local accounts and local MFA; Passport, OTP and messaging channels, payments and Kiorex sync are off.
- Licence: signed token with expiry; a once-a-month connection to AWS renews the subscription and verifies the package. Day-31 behaviour should be a read-only grace period, not a lock-out; handle clock tampering and lost machines.
- Encrypted local backups to a second disk or USB with a tested restore (mandatory: single machine holding patient records).
- Offline to online migration is a one-way export and import at first, not a merge.
- Update, migration and support process for machines we cannot see; counsel review of Egyptian health-data and licensing rules (not asserted here).
- Open decisions (founder): target customer, first module, whether a phone hotspot once a month is acceptable for the renewal check-in, whether offline data may ever merge back.

Related: a standalone module can be online (hosted by us, optionally connected to Kiorex through configuration) with no new work beyond packaging and billing.
