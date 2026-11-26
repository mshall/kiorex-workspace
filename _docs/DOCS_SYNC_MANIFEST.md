# Docs sync manifest, addendum 27 Nov 2026 (environment, DNS and domain standard, ADR-059 Proposed)

Nothing was uploaded to Google Drive (Drive folder `1Pk__yq04TSGzWwAsiWQB--bVgu8WGd_L`, "Kiorex v2"). The markdown sources below changed and the matching Drive documents need a new version when the founder signs ADR-059 (PDF rebuild: `cd _docs/pdf && node build.mjs --doc KX-00,KX-01,KX-04,KX-10,KX-15,KX-17,KX-19,KX-21,KX-22,KX-26`; the new `_docs/environments/*.md`, `_docs/adr/` and `_docs/registry/` files have no PDF volume yet and can be added to the Drive folder as a new section "08 Environments and Domains" or as one combined PDF).

| Drive document | Source changed | What changed |
|---|---|---|
| KX-00 Master Blueprint (master index) | `rev23/KX-00_Master_Blueprint.md` | index entry for ADR-059 and the environment documents |
| KX-01 Decision Log and ADRs | `rev23/KX-01_Decision_Log_ADRs.md` | ADR-059 row and paragraph (Proposed) |
| KX-04 Passport PRD | `rev23/KX-04_Kiorex_Account_Identity_PRD.md` | passport hosts, pilot uses the production issuer, cookies |
| KX-10 Platform, DevOps and Security | `rev23/KX-10_Platform_DevOps_Security.md` | environments, certificates, non-production access control |
| KX-15 Risk and Compliance | `rev23/KX-15_Risk_Compliance_Framework.md` | real data on the production plane, kx-test exception |
| KX-17 Clinic Launch Readiness | `rev23/KX-17_Kiorly_Clinic_Launch_Readiness.md` | pilot to production URL transition |
| KX-19 Brand, Domains, Store Accounts | `rev23/KX-19_Brand_Domains_Store_Accounts.md` | host table superseded |
| KX-21 AWS Hosting and Infrastructure | `rev23/KX-21_AWS_Cloud_Hosting_Infrastructure.md` | Route 53 child-zone delegation, per-environment certificates |
| KX-22 Repo Map and Agent Handoff (repository mapping) | `rev23/KX-22_GitHub_Repo_Map_Build_Agent_Handoff.md` | workspace owns the registry |
| KX-26 System Architecture Reference | `rev23/KX-26_System_Architecture_Reference.md` | URL architecture and international routing |

Markdown-only (not a PDF volume): `LLM_HANDOFF.md` section 13, `LAUNCH_PREPARATION_GUIDE.md` (domain note in section 2), `AWS_DEV_ENV_PLAN.md` (banner), `README.md` and `_docs/README.md` (index), `AGENTS.md`.

---

# Docs sync manifest (Rev 2.7, wave 9 finishing pass, 25 November 2026)

**Upload approved by the founder (25 Nov 2026); the coordinator performs the upload.** The agent that rebuilt these files uploaded nothing to Google Drive. Folder with every PDF: `/Users/shall/Documents/Peraonal/Work/kiorex-v2/_docs/pdf/out/` (git-ignored; the five files below were overwritten there by the finishing pass, the other 30 files are the earlier Rev 2.7 and Rev 2.4 builds, unchanged).

## Rebuilt in the finishing pass (5 volumes, upload these on top of the earlier Rev 2.7 files)

Built on 25 Nov 2026 with `cd _docs/pdf && node build.mjs --doc KX-01,KX-27,KX-28,KX-32,KX-33` (5 built, 0 skipped, 0 failed, no warnings in `build-report.json`). Revision label stays Rev 2.7; each volume's revision history carries the finishing-pass row (KX-33) or the changed lines below.

| Identifier | Name | Pages | Bytes | Exact output path | What changed |
|---|---|---|---|---|---|
| KX-01 | Decision Log and ADRs | 28 | 2,474,879 | `/Users/shall/Documents/Peraonal/Work/kiorex-v2/_docs/pdf/out/KX-01_Decision_Log_and_ADRs.pdf` | ADR numbering scheme A is decided (founder, 25 Nov 2026): ADR-051 everywhere, ADR-058 unused; ADRs still Proposed |
| KX-27 | Growth and Patient Acquisition Engine PRD | 23 | 1,388,196 | `/Users/shall/Documents/Peraonal/Work/kiorex-v2/_docs/pdf/out/KX-27_Growth_and_Patient_Acquisition_Engine_PRD.pdf` | Capability map: staff-app Growth tab for all four products, loyalty built locally and locked, loyalty regulatory row |
| KX-28 | Growth Engine System Architecture | 35 | 2,567,218 | `/Users/shall/Documents/Peraonal/Work/kiorex-v2/_docs/pdf/out/KX-28_Growth_Engine_System_Architecture.pdf` | Staff-app credit and promotion cards removed from the not-built list |
| KX-32 | Growth Analytics and Unit Economics Reference | 16 | 1,205,790 | `/Users/shall/Documents/Peraonal/Work/kiorex-v2/_docs/pdf/out/KX-32_Growth_Analytics_and_Unit_Economics_Reference.pdf` | Revenue confirmation basis (CLINIC_FACT or INFERRED_AT_COMPLETION, G-19) |
| KX-33 | Growth Engine Implementation Roadmap and Agent Handoff | 23 | 1,537,030 | `/Users/shall/Documents/Peraonal/Work/kiorex-v2/_docs/pdf/out/KX-33_Growth_Engine_Implementation_Roadmap_and_Agent_Handoff.pdf` | Section 05: P4-D, P4-B3 and GC-5 as-built, P3-H owned by lane A2; section 08 and 10: evidence, honest gaps, ADR decision |

Not rebuilt because their text did not change in this pass: the other eleven Rev 2.7 volumes (KX-03, 05, 09, 12, 13, 14, 15, 24, 29, 30, 31) keep their Rev 2.7 build from the previous pass. Markdown-only changes in this pass (no PDF volume): `LAUNCH_PREPARATION_GUIDE.md` (rows 11.128 to 11.147, ADR row decided), `TEST_GUIDE.md` and `_docs/test-flow/index.html` (flows G33 to G37, copied to the iCloud Test Flow folder), `COMPLETENESS_MATRIX.md`, `GROWTH_PHASE2_4_WORK_PACKAGES.md` (W9 A3 as-built), `GROWTH_ARCHITECTURE_DECISIONS.md`, `kiorex-platform/Docs/NEEDS_HUMAN.md`, `kiorex-platform/Docs/adr/ADR-051`, `CLAUDE.md`, `_docs/README.md`.

---

## Previous manifest (Rev 2.7, 25 November 2026, documentation lane A4), kept for the unchanged volumes


For the Drive upload step. **Not uploaded** (founder approval required; nothing was sent to Google Drive in this pass). The PDFs are in `_docs/pdf/out/` (git-ignored, rebuilt with `cd _docs/pdf && node build.mjs --doc KX-01,KX-03,...` or `--all`). The staging folder `/private/tmp/claude-501/kx-final-pdfs/` of the Rev 2.4 pass is NOT refreshed; copy from `_docs/pdf/out/` when approved.

## Rev 2.7: PDFs that changed since the Rev 2.4 set (16 volumes)

All 16 were rebuilt on 25 Nov 2026 with the existing pipeline (16 built, 0 skipped, 0 failed, no warnings in `build-report.json`); the Rev 2.7 label was confirmed in the generated HTML and the page counts and titles were read back with `pdf-lib`. No PDF viewer or text extractor was available on the build machine, so the pages were not eyeballed. Status meaning as below: updated = Markdown source changed.

| Identifier | Name | Revision | Pages | Bytes | Status | File |
|---|---|---|---|---|---|---|
| KX-01 | Decision Log and ADRs | Rev 2.7 | 28 | 2,475,010 | updated | `KX-01_Decision_Log_and_ADRs.pdf` |
| KX-03 | Kiorex Marketplace PRD | Rev 2.7 | 20 | 1,329,833 | updated | `KX-03_Kiorex_Marketplace_PRD.pdf` |
| KX-05 | Kiorly Clinic PRD | Rev 2.7 | 25 | 1,745,007 | updated | `KX-05_Kiorly_Clinic_PRD.pdf` |
| KX-09 | Integration Contracts, Events and Money Flows | Rev 2.7 | 16 | 1,164,405 | updated | `KX-09_Integration_Contracts_Events_and_Money_Flows.pdf` |
| KX-12 | Monetization and Pricing Architecture | Rev 2.7 | 11 | 722,865 | updated | `KX-12_Monetization_and_Pricing_Architecture.pdf` |
| KX-13 | 36-Month Financial Model and Unit Economics | Rev 2.7 | 14 | 983,903 | updated | `KX-13_36_Month_Financial_Model_and_Unit_Economics.pdf` |
| KX-14 | Go-To-Market and Marketing Plan | Rev 2.7 | 12 | 670,571 | updated | `KX-14_Go_To_Market_and_Marketing_Plan.pdf` |
| KX-15 | Risk and Compliance Framework | Rev 2.7 | 12 | 781,395 | updated | `KX-15_Risk_and_Compliance_Framework.pdf` |
| KX-24 | Notifications and Messaging Architecture | Rev 2.7 | 21 | 1,345,048 | updated | `KX-24_Notifications_and_Messaging_Architecture.pdf` |
| KX-27 | Growth and Patient Acquisition Engine PRD | Rev 2.7 | 23 | 1,385,784 | updated | `KX-27_Growth_and_Patient_Acquisition_Engine_PRD.pdf` |
| KX-28 | Growth Engine System Architecture | Rev 2.7 | 35 | 2,568,760 | updated | `KX-28_Growth_Engine_System_Architecture.pdf` |
| KX-29 | Patient Acquisition and Go-to-Market Strategy for Egypt | Rev 2.7 | 14 | 1,145,160 | updated | `KX-29_Patient_Acquisition_and_GTM_Strategy_Egypt.pdf` |
| KX-30 | Attribution, Referrals, Rewards and Commission Architecture | Rev 2.7 | 24 | 1,577,552 | updated | `KX-30_Attribution_Referrals_Rewards_and_Commission_Architecture.pdf` |
| KX-31 | SEO, ASO and Organic Growth Strategy | Rev 2.7 | 17 | 1,202,794 | updated | `KX-31_SEO_ASO_and_Organic_Growth_Strategy.pdf` |
| KX-32 | Growth Analytics and Unit Economics Reference | Rev 2.7 | 16 | 1,200,391 | updated | `KX-32_Growth_Analytics_and_Unit_Economics_Reference.pdf` |
| KX-33 | Growth Engine Implementation Roadmap and Agent Handoff | Rev 2.7 | 23 | 1,484,211 | updated | `KX-33_Growth_Engine_Implementation_Roadmap_and_Agent_Handoff.pdf` |

Totals of the changed set: 16 volumes, 311 pages, 21,782,689 bytes. The other 18 volumes (KX-00, 02, 04, 06, 07, 08, 10, 11, 16, 17, 18, 19, 20, 21, 22, 23, 25, 26) are **unchanged** since the Rev 2.4 table below; upload only if the Drive copy is missing or older. KX-27 to KX-33 were never uploaded (status new in the Rev 2.4 pass), so on Drive they appear for the first time at Rev 2.7.

What each changed volume carries (all statuses are local and mocked, nothing deployed): KX-27 to KX-33 Phases 2 to 4 as-built (KX-33 section 05 is the package table); KX-01 ADR-049 to ADR-057 registered Proposed and the assistant decision numbered ADR-051 (scheme A, founder to confirm); KX-03, 05, 09, 12 credit notes updated from "not built" to "built locally, launch-locked"; KX-13, 14, 15, 24 short Rev 2.7 notes with facts only (no price, fee or legal wording invented).

## Other documents changed in the Rev 2.7 pass (Markdown only, not PDF volumes)

`_docs/growth/GROWTH_ARCHITECTURE_DECISIONS.md` (ADR-053 to ADR-057 sections 25 to 29, numbering note), `_docs/growth/GROWTH_PHASE2_4_WORK_PACKAGES.md` (ADR table), `kiorex-platform/Docs/adr/ADR-051` (numbering line) and `ADR-053` to `ADR-057` (new repository copies), `TEST_GUIDE.md` and `_docs/test-flow/index.html` (flows G23 to G32; the page is also copied to the iCloud Test Flow folder), `_docs/LAUNCH_PREPARATION_GUIDE.md` (section 11 restructured by owner with status and a legacy crosswalk), `_docs/COMPLETENESS_MATRIX.md`, `_docs/README.md`, `README.md`, `CLAUDE.md`.

---

## Previous manifest (Rev 2.4, 24 November 2026), kept for the unchanged volumes

For the Drive upload step. Not uploaded by the agent that wrote this file. The final PDFs are in `_docs/pdf/out/` (git-ignored, rebuilt with `cd _docs/pdf && node build.mjs --all`) and are copied with identical file names to the staging folder `/private/tmp/claude-501/kx-final-pdfs/`.

Status meaning: **new** = volume that has never been uploaded (KX-27 to KX-33, written 24 Nov 2026 as Rev 2.4 draft 1, now Rev 2.4 verified); **updated** = Markdown source changed since the previous commit (content and Rev 2.4 label); **unchanged** = no change to the source, upload only if the Drive copy is missing or older. Whether KX-24, KX-25 and KX-26 (created 23 Nov 2026) already exist on Drive was not checked.

Revision label: every changed volume carries `Rev 2.4`. KX-11 (Rev 2.2), KX-16 (Rev 2.3), KX-20 (Rev 2.3) and KX-25 (Rev 2.3) keep their earlier label because nothing in them changed. Page counts and byte sizes are of the PDFs in the staging folder.

| Identifier | Name | Revision | Pages | Bytes | Status | File |
|---|---|---|---|---|---|---|
| KX-00 | Master Blueprint and Reading Guide | Rev 2.4 | 18 | 1,180,661 | updated | `KX-00_Master_Blueprint_and_Reading_Guide.pdf` |
| KX-01 | Decision Log and ADRs | Rev 2.4 | 26 | 2,284,983 | updated | `KX-01_Decision_Log_and_ADRs.pdf` |
| KX-02 | Ecosystem Business Requirements | Rev 2.4 | 15 | 1,069,337 | updated | `KX-02_Ecosystem_Business_Requirements.pdf` |
| KX-03 | Kiorex Marketplace PRD | Rev 2.4 | 19 | 1,252,511 | updated | `KX-03_Kiorex_Marketplace_PRD.pdf` |
| KX-04 | Kiorex Account: Identity PRD | Rev 2.4 | 10 | 684,202 | updated | `KX-04_Kiorex_Account_Identity_PRD.pdf` |
| KX-05 | Kiorly Clinic PRD | Rev 2.4 | 24 | 1,684,059 | updated | `KX-05_Kiorly_Clinic_PRD.pdf` |
| KX-06 | Kiorly Pharmacy PRD | Rev 2.4 | 13 | 1,039,872 | updated | `KX-06_Kiorly_Pharmacy_PRD.pdf` |
| KX-07 | Kiorly Lab PRD | Rev 2.4 | 12 | 1,090,833 | updated | `KX-07_Kiorly_Lab_PRD.pdf` |
| KX-08 | Target Architecture and Repositories | Rev 2.4 | 28 | 1,770,742 | updated | `KX-08_Target_Architecture_and_Repositories.pdf` |
| KX-09 | Integration Contracts, Events and Money Flows | Rev 2.4 | 14 | 1,076,929 | updated | `KX-09_Integration_Contracts_Events_and_Money_Flows.pdf` |
| KX-10 | Platform, DevOps and Security Engineering | Rev 2.4 | 14 | 936,769 | updated | `KX-10_Platform_DevOps_and_Security_Engineering.pdf` |
| KX-11 | AI Strategy, Architecture and Governance | Rev 2.2 | 7 | 482,709 | unchanged | `KX-11_AI_Strategy_Architecture_and_Governance.pdf` |
| KX-12 | Monetization and Pricing Architecture | Rev 2.4 | 10 | 638,142 | updated | `KX-12_Monetization_and_Pricing_Architecture.pdf` |
| KX-13 | 36-Month Financial Model and Unit Economics | Rev 2.4 | 14 | 973,765 | updated | `KX-13_36_Month_Financial_Model_and_Unit_Economics.pdf` |
| KX-14 | Go-To-Market and Marketing Plan | Rev 2.4 | 11 | 661,154 | updated | `KX-14_Go_To_Market_and_Marketing_Plan.pdf` |
| KX-15 | Risk and Compliance Framework | Rev 2.4 | 11 | 710,839 | updated | `KX-15_Risk_and_Compliance_Framework.pdf` |
| KX-16 | Clinical Safety and Quality | Rev 2.3 | 8 | 515,377 | unchanged | `KX-16_Clinical_Safety_and_Quality.pdf` |
| KX-17 | Kiorly Clinic Launch Readiness and Go-Live | Rev 2.4 | 10 | 761,478 | updated | `KX-17_Kiorly_Clinic_Launch_Readiness_and_Go_Live.pdf` |
| KX-18 | 36-Month Roadmap and Operating Model | Rev 2.4 | 9 | 717,345 | updated | `KX-18_36_Month_Roadmap_and_Operating_Model.pdf` |
| KX-19 | Brand Architecture, Domains and Store Accounts | Rev 2.4 | 10 | 693,785 | updated | `KX-19_Brand_Architecture_Domains_and_Store_Accounts.pdf` |
| KX-20 | Investor Brief | Rev 2.3 | 7 | 579,426 | unchanged | `KX-20_Investor_Brief.pdf` |
| KX-21 | AWS Cloud Hosting and Infrastructure Reference | Rev 2.4 | 29 | 2,073,839 | updated | `KX-21_AWS_Cloud_Hosting_and_Infrastructure_Reference.pdf` |
| KX-22 | GitHub Repository Map and Build-Agent Handoff | Rev 2.4 | 20 | 1,369,556 | updated | `KX-22_GitHub_Repository_Map_and_Build_Agent_Handoff.pdf` |
| KX-23 | Kiorly Nurse PRD | Rev 2.4 | 13 | 941,626 | updated | `KX-23_Kiorly_Nurse_PRD.pdf` |
| KX-24 | Notifications and Messaging Architecture | Rev 2.4 | 21 | 1,332,567 | updated | `KX-24_Notifications_and_Messaging_Architecture.pdf` |
| KX-25 | Document Storage Growth and Retention | Rev 2.3 | 22 | 1,359,188 | unchanged | `KX-25_Document_Storage_Growth_and_Retention.pdf` |
| KX-26 | System Architecture Reference | Rev 2.4 | 28 | 1,936,941 | updated | `KX-26_System_Architecture_Reference.pdf` |
| KX-27 | Growth and Patient Acquisition Engine PRD | Rev 2.4 | 19 | 1,202,230 | new | `KX-27_Growth_and_Patient_Acquisition_Engine_PRD.pdf` |
| KX-28 | Growth Engine System Architecture | Rev 2.4 | 30 | 2,247,824 | new | `KX-28_Growth_Engine_System_Architecture.pdf` |
| KX-29 | Patient Acquisition and Go-to-Market Strategy for Egypt | Rev 2.4 | 13 | 1,098,830 | new | `KX-29_Patient_Acquisition_and_GTM_Strategy_Egypt.pdf` |
| KX-30 | Attribution, Referrals, Rewards and Commission Architecture | Rev 2.4 | 15 | 1,162,645 | new | `KX-30_Attribution_Referrals_Rewards_and_Commission_Architecture.pdf` |
| KX-31 | SEO, ASO and Organic Growth Strategy | Rev 2.4 | 16 | 1,084,417 | new | `KX-31_SEO_ASO_and_Organic_Growth_Strategy.pdf` |
| KX-32 | Growth Analytics and Unit Economics Reference | Rev 2.4 | 15 | 1,043,402 | new | `KX-32_Growth_Analytics_and_Unit_Economics_Reference.pdf` |
| KX-33 | Growth Engine Implementation Roadmap and Agent Handoff | Rev 2.4 | 16 | 1,221,981 | new | `KX-33_Growth_Engine_Implementation_Roadmap_and_Agent_Handoff.pdf` |

Totals: 34 volumes, 547 pages, 38,879,964 bytes. New 7, updated 23, unchanged 4.

Other documents changed in the same pass (Markdown only, not PDF volumes): `_docs/COMPLETENESS_MATRIX.md`, `_docs/growth/GROWTH_PHASE1_WORK_PACKAGES.md`, `_docs/LAUNCH_PREPARATION_GUIDE.md`, `_docs/README.md`, `README.md`, `CLAUDE.md`, `_docs/pdf/docs.manifest.json` (`revisionDefault` Rev 2.4).

Verification record (24 Nov 2026): contracts 276, Kiorex API unit 578, Clinic API unit 1,222, Passport 314, staff app 276, patient app 251, patient web 282, ops console 84 all passing; Kiorex growth integration 278 of 279 (the failing test, in `growth-analytics.int.spec.ts`, passes alone, 10 of 10); Clinic growth and kiorex integration 55 passing. Nothing deployed, nothing pushed, no Drive upload.
