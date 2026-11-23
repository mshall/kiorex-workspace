# _docs: reference set and reports

Extracts of the Kiorex v2 reference documents (Rev 2.3, 26 volumes KX-00 to KX-25; updated 23 Nov 2026). Some numeric cells were lost in extraction; check the source PDF in Drive when exact numbers matter. Founder decisions win over document wording (see [FOUNDER_DECISIONS.md](FOUNDER_DECISIONS.md)). Back to the [workspace README](../README.md).

| Group | Documents |
|---|---|
| **Start here** | [KX-00 Master Blueprint](KX-00_Master_Blueprint.md) · [KX-01 Decision Log (ADRs)](KX-01_Decision_Log_ADRs.md) · [KX-22 Repo map and agent hand-off](KX-22_GitHub_Repo_Map_Build_Agent_Handoff.md) |
| **Product requirements** | [KX-02 Ecosystem BRD](KX-02_Ecosystem_Business_Requirements.md) · [KX-03 Kiorex Marketplace](KX-03_Kiorex_Marketplace_PRD.md) · [KX-04 Passport](KX-04_Kiorex_Account_Identity_PRD.md) · [KX-05 Kiorly Clinic](KX-05_Kiorly_Clinic_PRD.md) · [KX-06 Pharmacy](KX-06_Kiorly_Pharmacy_PRD.md) · [KX-07 Lab](KX-07_Kiorly_Lab_PRD.md) · [KX-23 Nurse](KX-23_Kiorly_Nurse_PRD.md) |
| **Architecture and platform** | [KX-08 Target architecture](KX-08_Target_Architecture_and_Repositories.md) · [KX-09 Contracts, events, money](KX-09_Integration_Contracts_Events_and_Money_Flows.md) · [KX-10 Platform, DevOps, security](KX-10_Platform_DevOps_Security.md) · [KX-21 AWS hosting](KX-21_AWS_Cloud_Hosting_Infrastructure.md) · [KX-24 Notifications and messaging](KX-24_Notifications_and_Messaging_Architecture.md) · [KX-25 Document storage growth](rev23/KX-25_Document_Storage_Growth_and_Retention.md) |
| **AI, safety, risk** | [KX-11 AI strategy](KX-11_AI_Strategy_Architecture_Governance.md) · [KX-15 Risk and compliance](KX-15_Risk_Compliance_Framework.md) · [KX-16 Clinical safety](KX-16_Clinical_Safety_Quality.md) |
| **Business** | [KX-12 Pricing](KX-12_Monetization_Pricing.md) · [KX-13 Financial model](KX-13_Financial_Model_Unit_Economics.md) · [KX-14 GTM](KX-14_GTM_Marketing_Plan.md) · [KX-18 Roadmap](KX-18_Roadmap_Operating_Model.md) · [KX-20 Investor brief](KX-20_Investor_Brief.md) |
| **Launch and brand** | [KX-17 Clinic launch readiness](KX-17_Kiorly_Clinic_Launch_Readiness.md) · [KX-19 Brand, domains, stores](KX-19_Brand_Domains_Store_Accounts.md) |
| **Rev 2.3 changes** | [CHANGES_2.2_to_2.3.md](CHANGES_2.2_to_2.3.md) (read its backlog before building) · current extracts in [rev23/](rev23) (the PDF generator reads `rev23/` first; the loose `KX-0x..KX-22` files in this folder are the Rev 2.2 extracts; KX-23 and KX-24 are identical in both places) |
| **Decisions** | [FOUNDER_DECISIONS.md](FOUNDER_DECISIONS.md) |
| **Provider go-live** | [PROVIDER_GO_LIVE.md](PROVIDER_GO_LIVE.md) · notification layer: [kiorex-contracts/docs/NOTIFICATION_LAYER.md](../kiorex-contracts/docs/NOTIFICATION_LAYER.md) |
| **Mobile** | [mobile/](mobile) design pack, ADR-033, device and staff-role reports |
| **Quality reports** | [COMPLETENESS_MATRIX.md](COMPLETENESS_MATRIX.md) · [FINAL_TEST_REPORT.md](FINAL_TEST_REPORT.md) · [FINAL_VERIFICATION_REPORT.md](FINAL_VERIFICATION_REPORT.md) · [UI_REVIEW.md](UI_REVIEW.md) · screenshots in [ui-review/](ui-review) |
| **Build queue notes** | [autopilot/](autopilot) |
| **PDF editions** | `node pdf/build.mjs --all` rebuilds every KX document as a designed PDF into `pdf/out/` (git-ignored); conventions and how to add a document in [pdf/README.md](pdf/README.md) |

## Update of 23 Nov 2026
Volumes updated in `rev23/` with a "What changed in this revision (23 Nov 2026)" section: KX-00, 01, 03, 04, 05, 06, 07, 08, 09, 10, 16, 17, 18, 20, 22, 23; new volumes KX-24 and KX-25; sections added in KX-05, 10, 12, 15, 21 for storage growth. Left untouched (founder's financials, GTM and brand, or no change needed): KX-02, 11, 12, 13, 14, 15, 19, 21. Markdown conventions for rich PDF rendering: blockquotes starting `> **Note**`, `> **Decision**`, `> **Risk**`, `> **Open question**`, `> **Warning**`; status tables use Done, Open, Planned, Blocked; diagrams are mermaid fences.
