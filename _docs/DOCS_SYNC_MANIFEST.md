# Docs sync manifest (Rev 2.4, 24 November 2026)

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
