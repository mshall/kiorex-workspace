# Kiorly mobile app: design pack (20 Nov 2026)

Design only. No feature code, no pushes, no deploys. One Expo app named **Kiorly** with **Clinic** (incl. Nurse edition), **Pharmacy** and **Lab** modules, tiered per organization, safety never paywalled.

| Doc | What it answers |
|---|---|
| [MOBILE_APP_DESIGN.md](./MOBILE_APP_DESIGN.md) | Architecture, org switching, entitlement model and API contract, safety-never-paywalled enforcement and test, flag vs entitlement, offline conflict table, security, locked-feature UX, split-build triggers, plan mapping, shared packages, CI/EAS, migration from `kiorly-work`. Section 0 lists conflicts found. |
| [ADR-033_One_Kiorly_App_Tiered_Mobile.md](./ADR-033_One_Kiorly_App_Tiered_Mobile.md) | The decision record: amends ADR-018's consequence, extends ADR-025 (safety never paywalled). Proposed until the founder signs. |
| [FEATURE_TIER_MATRIX.md](./FEATURE_TIER_MATRIX.md) | Every capability x product x tier, with audited backend status, effort and file/route evidence; gaps listed, not invented. |
| [RISKS_AND_OPEN_QUESTIONS.md](./RISKS_AND_OPEN_QUESTIONS.md) | Risks with mitigations, 20 numbered founder questions, NH-* legal sign-offs that apply to mobile. |
| [DEVICE_TEST_REPORT_2026-11-20.md](./DEVICE_TEST_REPORT_2026-11-20.md) | Both Expo apps run on an Android emulator (light/dark, ar/en): bugs found and fixed, open findings, how to reproduce. iOS not run (no Xcode). |
| [STORE_POLICY_NOTE.md](./STORE_POLICY_NOTE.md) | Apple/Google policy note (written separately). |

Read order: design section 0 -> ADR-033 -> matrix -> questions.
