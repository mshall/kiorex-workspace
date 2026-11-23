# Kiorly app: risks, open questions, legal sign-offs

> Companion to [MOBILE_APP_DESIGN.md](./MOBILE_APP_DESIGN.md), [FEATURE_TIER_MATRIX.md](./FEATURE_TIER_MATRIX.md), [ADR-033](./ADR-033_One_Kiorly_App_Tiered_Mobile.md). Store-policy specifics: [STORE_POLICY_NOTE.md](./STORE_POLICY_NOTE.md). Date 20 Nov 2026.

## 1. Risks and mitigations

Likelihood / impact: L low, M medium, H high.

| # | Risk | L | I | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | **KX-19 says "PWA remains primary at launch"** for the Kiorly app and lists no pharmacy/lab audience; the brief makes the native app the vehicle for all three modules. Plans, store copy and support runbooks could contradict each other. | H | M | Founder ruling (Q1); update KX-19 §04 after ADR-033 sign-off; ship native beside PWA, with `mobile.*` flags able to switch modules off per market | Founder |
| R2 | **Device toolchain**: **Update 22 Nov 2026: Xcode 27.2 is now installed and local development builds run on the iOS simulator and the Android emulator (`expo run:ios` / `expo run:android`, CocoaPods user-level).** Still open: `eas-cli` login, no store accounts. iOS physical-device dev builds need an Apple Developer Program account. | H | H | EAS cloud builds (no Xcode), Android device first (no account needed), Apple org account request as first human task (Q3); device-build gate before feature work (design §13) | Founder / build agent |
| R3 | **Store review** (health app, AI scribe, location, controlled-drug content, B2B login with no public sign-up, no payment on iOS). One rejection blocks every module because it is one binary. | M | H | Neutral locked UX, no prices, demo accounts per module/tier, "documentation assistance a clinician reviews" wording, health declaration, staged TestFlight/Play internal first; split option when review risk trigger fires (design §11) | Founder + build agent |
| R4 | **Offline conflicts** corrupt stock counts, custody chains or notes. | M | H | Explicit per-action policy (design §8.2): server-side count reconcile, append-only custody, notes to the user, sign-offs never queued; idempotency key + client time + device + user on every action; visible sync state and retry; chaos tests (duplicate, reorder, expired session, downgrade) | Build agent |
| R5 | **PHI on the device** (cache, queue, screenshots, push, logs, backups). | M | H | Minimal encrypted org-namespaced cache, wipe on sign-out/org removal/remote wipe, screen capture block + blurred switcher, generic push bodies, no analytics SDK, exclude app data from iCloud/Android backup, no PHI in logs (CI scan) | Build agent |
| R6 | **Entitlement staleness**: user keeps a feature after downgrade, or loses one wrongly; offline grace is abused. | M | M | Server authoritative on every call (403); refresh on login/switch/push/foreground/403; `validUntil` + `offlineGraceHours`; queued actions re-checked at replay (`409 ENTITLEMENT_CHANGED`) and retained | Build agent |
| R7 | **A safety capability gets paywalled by accident** (new alert kind added under a paid key, plan matrix edit, override). | L | H | Registry + failing CI test in 3 repos + contract parity (design §6.3); forced `mobile.safety=true` in `resolve()`; ADR-033 change rule | Build agent / CMO |
| R8 | **Safety notification not delivered** (iOS silent/standard push is best effort; user disabled notifications; device offline). A missed SOS or critical value is a patient-safety event. | M | H | In-app polling + foreground fetch, persistent Home banner, existing server escalation chains and SMS/dispatcher fallback (`SafetyAlertDispatcher`, PG-13), Apple Critical Alerts / Android max-priority channel request (store note), explicit "notifications off" warning in the app; never claim the app is the only channel | CMO / build agent |
| R9 | **Multi-org is blocked by Clinic's identity model** (C5: one subject links to one Clinic user; Users are per tenant). | H | H | Schema change (unique `(issuer, subject, userId)`), org discovery endpoint, tests for cross-org isolation; until done, ship single-org per Clinic login | Build agent |
| R10 | **Clinic does not yet accept Passport tokens from a public client**; a native Passport login would not reach Clinic. | H | M | `POST /auth/kiorex/exchange` with device binding and MFA step-up; interim: product login behind a review/dev flag | Build agent |
| R11 | **Cross-product contract drift**: three backends implement the same `/mobile/*` contract by hand (Pharmacy/Lab docs already disagree on refresh and auth). | M | M | Contract in `kiorex-contracts` (OpenAPI + JSON schemas + fixtures), contract tests in each repo, generated client (needs Clinic OpenAPI export, C9) | Build agent |
| R12 | **Support load**: org switching confusion, "why is X locked", lost devices, queue conflicts, Arabic copy. | M | M | Neutral locked text that names who to ask (owner), in-app diagnostics screen (versions, org, entitlements `etag`, queue), support can see entitlement checks and devices, runbook | Support |
| R13 | **Naming**: KX-19 names "Kiorly Lab Collect" and "Kiorly Pharmacy Rider" as later field apps; brief says product names singular (Kiorly Pharmacy, Kiorly Lab). Split builds could collide with, or be confused for, those field apps. | M | L | Reserve "Kiorly Clinic / Pharmacy / Lab" for split builds; keep "Lab Collect"/"Pharmacy Rider" for genuinely different courier/phlebotomy-only apps; update KX-19 (Q5) | Founder / brand |
| R14 | **Blast radius of one binary**: a bad release hits all modules; a regulated module cannot ship on its own cadence. | M | H | Staged rollout, per-module flags `mobile.clinic|pharmacy|lab`, remote kill by flag without a release, min-app-version policy, split triggers (design §11) | Build agent |
| R15 | **Legal gates not met** (home visits launch-locked GHV1/GHV2; physio GPR; nurse GKN1/2; critical-value list unsigned NH-LB-006). Mobile exposes these features to more people. | H | H | Mobile reuses the same launch-locked flags (`available = flag effective AND entitled`); code never records a gate; mock providers until go-live pass | Founder / counsel / CMO |
| R16 | **Sequencing vs ADR-017**: Pharmacy pilot M13, Lab pilot M19. A native app with those modules before their pilots invites premature exposure. | M | M | Launch with `mobile.pharmacy` / `mobile.lab` OFF globally (ON in staging and pilot orgs by org-scope flag) (Q6) | Founder |
| R17 | **Mock providers everywhere** (push, maps, AI, messaging). Real push and maps change behaviour (delivery, rate limits, payload size). | H | M | Staging go-live pass early for push; keep adapter `MODE=mock|real`; NEEDS_HUMAN list (PG-04, PG-10, PG-11, PG-13) | Build agent |
| R18 | **Fresh stack** (Expo SDK 58, RN 0.88, React 19, new architecture, Reanimated 4) in the existing app; native module compatibility (secure store, local-auth, notifications, screen-capture, camera, audio, SQLCipher). | M | M | Prove each native module in the P0 device build before feature work; pin versions; EAS preview build per PR | Build agent |
| R19 | **Conversion analytics vs privacy**: logging which locked features staff tap is profiling of identifiable staff. | L | M | Org-level aggregation, role only, no names/patients/free text, disclosed in privacy policy; internal use only until counsel confirms (Q12) | DPO |
| R20 | **Remote wipe vs unsynced clinical work** (security wipe can destroy queued notes/scans). | M | M | Heartbeat queue length so admins are warned; user sign-out blocked while queue non-empty; policy decision Q14 | Founder / DPO |
| R21 | **Demo/review accounts contain data**: seeded patients must be synthetic; accounts could leak into production. | L | M | Synthetic seeds only (`demo:reset`), accounts exist only on a review tenant, expiry, no PHI | Build agent |
| R22 | **Lite pharmacy limits** (`maxUsers: 2`, `maxBranches: 1`) make mobile core useful but small; a Lite lab or pharmacy may see little value and churn. | L | L | Core tier is chosen to deliver lookup + alerts value; track locked-feature taps (R19) | Product |

## 2. Open questions for the founder (numbered, in rough priority)

| # | Question | Why it matters | Default if unanswered |
|---|---|---|---|
| Q1 | KX-19 says the PWA stays primary at launch. Does the native Kiorly app ship **beside** the PWA at launch, replace it for staff, or wait? And is the audience extended to pharmacy and lab staff? | Store submission, support, KX-19 text | Native app ships beside the PWA; audience extended |
| Q2 | **Closed 23 Nov 2026 (founder), final name Kiorly (ADR-037).** The staff app is named plain **Kiorly**; bundle id `com.kiorly.app`, scheme `kiorly://`, header `X-Kiorly-Client: kiorly/<v>` (legacy `kiorly-team/*`, `kiorly-work/*` accepted), Arabic كيورلي; repo `mshall/kiorly-work` became `mshall/kiorly-team` and is being renamed to `kiorly`. Store accounts and the Passport client registration must use the new ids (NEEDS_HUMAN); old simulator installs of `com.kiorly.work` and `com.kiorly.app` should be uninstalled | Names are hard to change after store registration | Decided (ids remain placeholders until the store accounts exist) |
| Q3 | Apple Developer Program organization account (needs DUNS) and Google Play organization account: who creates them and when? iOS physical-device dev builds cannot start without the Apple account. | Blocks the "dev builds on physical devices first" gate for iOS | Android-first until Apple account exists |
| Q4 | Which legal entity is the seller name on the stores (KX-19: "ideally 'Kiorex ...'")? | Apple 5.1.1(ix) | Same entity as the company account |
| Q5 | KX-19 reserves "Kiorly Lab Collect" and "Kiorly Pharmacy Rider" as possible later field apps. Keep them for courier/phlebotomy-only apps and use "Kiorly Clinic / Pharmacy / Lab" for any future split builds? | Naming collision (R13) | Yes |
| Q6 | Should the Pharmacy and Lab **modules** ship OFF (flag `mobile.pharmacy|lab`) until their pilots (ADR-017: Pharmacy M13, Lab M19), or ON for early customers? | Premature exposure of unfinished products | OFF globally, ON per org in staging/pilot |
| Q7 | Rev 2.3 P5 says home-visit booking, **execution** and safety are in every tier. The brief puts "home visits" in Clinic Pro. Confirm: safety actions (SOS, I'm OK, leave-unsafe) always Safety tier; are **depart / arrive / finish** Core (recommended, matches P5) or Pro? | Lite nurse on the road without a way to mark arrival | Core for depart/arrive/finish; Pro for route view, note, samples |
| Q8 | "Sign docs" under Clinic Pro: which documents (referral letter, medical certificate, sick note, lab/radiology order, discharge summary)? Today only encounter finalize and uploads exist. | Scope of new backend work (P4) | Only encounter finalize + results approval in v1 |
| Q9 | Pharmacy: `transfers` is Chain/Enterprise-only on web but the brief lists branch transfers under Pharmacy Pro. Keep Chain/Ent-only on mobile, or change the web plan? Also: keep the read-only cash **shift summary** (not POS) on mobile? | C6; plan integrity | Chain/Ent only; keep shift summary read-only |
| Q10 | Mapping choices: `NURSE_AGENCY` = Pro-level (not Enterprise)? Lab `CHAIN` gets Enterprise controls by override only (Lab has no Enterprise)? Is `mobile.enterprise` an added key (the brief lists none)? Pharmacy/Lab `CHAIN` treated as Pro-equivalent + multi-branch? | Defaults ship with the migration | As in design §5.2 |
| Q11 | Where are per-market plan-to-mobile policies and per-org overrides edited: extend the **Kiorex control-plane snapshot** (one super admin, same signed channel) or keep them **per product** (each owns its plans)? | Cost L vs M; single place for ops | Control-plane `entitlementPolicy`, product-local overrides for support |
| Q12 | May locked-feature tap counts feed sales/CRM (org-level), or stay in internal analytics only? Needed in the privacy policy. | R19 | Internal ops report only |
| Q13 | AI scribe on phone: recording consent wording, audio retention (delete after draft approved?), and whether audio may leave the device before the clinician consents. | Legal and store privacy labels | No retention beyond the session; consent step before recording |
| Q14 | Remote wipe vs unsynced work: admin warning then wipe (recommended), or hold the encrypted queue for N days after wipe? | R20 | Wipe wins; warn admin first |
| Q15 | App lock: biometric with device-passcode fallback only (recommended), or also a custom app PIN? Default idle timeout 5 min, Enterprise min/max. | Security UX, support load | Biometric + device passcode, 5 min |
| Q16 | In-app **account deletion** for staff: Apple requires initiating deletion in the app. Confirm "deletion request" (identity deactivated, org records retained per retention law) and approve the wording (counsel/DPO). | Store requirement; legal | Request flow, counsel wording TODO |
| Q17 | OTA (EAS Update) policy: JS-only OTA allowed for non-safety fixes; any change to safety flows requires a store build? | Safety change control | Yes |
| Q18 | Which markets and languages at launch (AR default, EN; Gulf later)? Does the Egyptian-Arabic review (NH-022) cover the app? | RTL QA, copy | Egypt, AR default |
| Q19 | Safety-capability list sign-off: confirm the initial registry in design §6.1 (notably: allergy banner on the patient summary, controlled-drug countersign, QC_FAILURE and routine-vs-critical TAT split) with the CMO/pharmacist/pathologist advisors before it is frozen. | The list can only grow without a new ADR | As in design §6.1 |
| Q20 | Real push providers and keys (Expo/APNs/FCM) and the go-live pass in staging: when? | R8, R17 | Staging pass before pilot |

## 3. Legal and clinical sign-offs that apply to mobile

IDs are from each repo's NEEDS_HUMAN file (read 20 Nov 2026). **None is recorded as satisfied here; code names gates only** (CLAUDE.md). Status "open" unless the file says otherwise.

### Clinic (`clinics-management/Docs/KIORLY_NEEDS_HUMAN.md`)
| ID | Subject | Why it bites mobile |
|---|---|---|
| NH-033 (GHV1 / GHV2) | Counsel memo on home visits and platform liability; CMO-signed home-visit safety protocol incl. safety drill | Home visits, geostamp, SOS on phones; `clinic.home_visits` stays launch-locked |
| NH-038 (HVSAF01 / GHV2) | Safety on-call rota, alarm destinations, safety-contact consent copy, staging safety drill with a real channel | Safety alert delivery to phones and organisation safety contact |
| NH-034 (GKN1 / KNMAR / KNESC) | CMO + nursing advisor sign-off: nurse visit record, **vitals thresholds**, MAR design | Nurse vitals, critical-vitals alerts, visit notes on mobile |
| NH-039 (KNFAM01 / KNED03) | Family-contact consent wording, nurse templates, solo-nurse certificate | Nurse edition on the app |
| NH-KNLAB01 | Counsel/DPO: patient data in `LabOrderPlaced` sent under LAB_RESULTS consent; consent verification mocked | Nurse-collected samples on phones |
| NH-010 / NH-028 | CMO sign-off of specialty templates / physio template (GPR2) | Visit-note templates on mobile |
| NH-017 | External penetration test before public launch | Mobile app and `/mobile/*` must be in scope |
| NH-021 | Web push VAPID keys and installability | Superseded for native by APNs/FCM/Expo keys: new human task |
| NH-022 | Native Egyptian Arabic review, RTL QA on launch screens | App strings and RTL |
| NH-024 | Privacy notice still mentions tax-authority sharing (contradicts ADR-011) | Mobile privacy policy and store privacy labels must not inherit it |
| NH-026 | Pharmacy/Lab consumers of `PrescriptionIssued` / `LabOrderPlaced` and consent token | Prescription/lab hand-off visible on mobile |
| PG-04, PG-10, PG-11, PG-13 | Real push, maps, OpenAI (scribe), safety-alert dispatcher | Provider go-live items the mobile features depend on |

### Pharmacy (`kiorly-pharmacy/Docs/NEEDS_HUMAN.md`)
| ID | Subject | Why it bites mobile |
|---|---|---|
| NH-PH-004 | Counsel memo: pharmacy software, **controlled-medicine logging (EDA)**, e-Rx acceptance, online ordering | Controlled discrepancy alerts, countersign, Rx verification on phones |
| NH-PH-005 | Clinical pharmacist sign-off of dispensing and substitution hazard log (STOP) | Rx verification queue |
| NH-PH-009 | Interaction/allergy/duplicate dataset licence and rule sign-off | Warnings shown to pharmacists on mobile |
| NH-PH-011 | Cold-chain thresholds and excursion handling | `COLD_CHAIN_EXCURSION` alerts |
| NH-PH-012 | Alert templates (expiry, shift variance, PO) | Push wording for expiry/low-stock |
| NH-PH-008, NH-PH-013 | Substitution consent wording; consent-token format (STOP) | Rx flows |
| NH-PH-027 | Controlled-schedule seed placeholders; national-ID capture format | Mobile must not capture or display national ID until resolved |
| NH-PH-020 | Store/PWA publishing and AWS stack are production items | No store publication without founder go |

### Lab (`kiorly-lab/Docs/NEEDS_HUMAN.md`)
| ID | Subject | Why it bites mobile |
|---|---|---|
| NH-LB-006 | Critical-value list per test, acknowledgement window, escalation chain (STOP) | Critical-value alerts and acknowledge on phones |
| NH-LB-005 | Westgard / QC block-clear sign-off (STOP) | `QC_FAILURE` alerts, QC status view |
| NH-LB-011 | Home-collection policy: **phlebotomist app, label-photo privacy handling**, routing | Phlebotomy round and label photos |
| NH-LB-021 | Phlebotomist app distribution (no deploys until founder says so) | Distribution path for the Lab module |
| NH-LB-032 | Specimen label content (PHI minimisation) | What the scanner/label screen may show |
| NH-LB-007, NH-LB-043 | Result-sharing consent wording; delivery templates | Result release and sharing from mobile |
| NH-LB-034 | Nurse-sample consent verification (mocked) | Nurse-collected samples |
| NH-LB-042 | Retention defaults | Specimen/photo retention on device and server |

### Cross-cutting (CLAUDE.md "stop and ask")
Prices and plan composition (NH-PH-006 / NH-LB-004 / Nurse prices Q13), store accounts and production credentials, counsel/CMO sign-offs, launch gates GHV1/2, GPR1/2, GKN1/2. This design sets none of them.
