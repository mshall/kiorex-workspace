# Launch preparation guide (build this out after development is done)

Status: LIVING DOCUMENT, started 24 Nov 2026, re-verified for Rev 2.4 on 24 Nov 2026 (sections 1 to 12 are all present, in order). When the founder asks for "the launch preparation guide", read this file, bring every row up to date against the repos, and present it. Add new items here whenever a decision or a human-only step appears.

Rules that apply to every row: nothing is deployed to AWS until the founder says so; `tofu apply` is the founder's decision; production credentials, store accounts, domains and legal sign-offs are human-only; no launch gate is ever recorded by code.

Legend: **Owner** F = founder, C = counsel, A = AWS/org admin, D = dev team (Claude agents), V = vendor/provider.

## 1. AWS accounts and infrastructure

| # | Item | Owner | Notes |
|---|---|---|---|
| 1.1 | **Decide the production AWS account.** Recommended: a separate production account under an AWS Organization that the existing account belongs to. Then replace `REPLACE_WITH_PROD_ACCOUNT_ID` (12-digit account id, not a secret) in the prod `terraform.tfvars` of every stack. | F, A | The staging account is `599243104052` (profile `aws-kiorex-profile`, eu-central-1). Find an id with `aws sts get-caller-identity --profile <profile>`. |
| 1.2 | Loosen the organization service-control policies that block planning (CloudFormation, App Runner, RDS and S3 reads) for the new account. | A | Needed before `tofu plan` can read the account. |
| 1.3 | Create the OpenTofu state backend in each account (the KMS alias `alias/kiorex-tofu-state` did not exist in staging, so `tofu plan` failed). | A, D | Per `infra/tofu` bootstrap docs. |
| 1.4 | `tofu apply` per stack, staging first, then production. Review the plan summary each time. | F | Never applied by an agent. Production is applied through the CI pipeline. |
| 1.5 | Align the Lambda/seed base images (Node 24 vs 26) and the RDS TLS root-cert support noted in the upgrade report. | D | See `_docs/UPGRADE_2026-11_REPORT.md`. |
| 1.6 | WAF in front of the public endpoints for a global rate cap (intake, leads, handoff, public sign-in config). In-app limiters are shared via Postgres but fixed-window. | A, D | Also needed for the CDN `/idp/*` behaviour used by Kiorly Home. |
| 1.7 | Backups, Multi-AZ, alarms, budgets, log retention checked per `KX-21`. | A, D | |

## 2. Domains, DNS and certificates (founder owns kiorly.com)

| # | Item | Owner | Notes |
|---|---|---|---|
| 2.1 | Delegate `kiorly.com` DNS to Route 53 (or add the records at the registrar). | F | |
| 2.2 | Hosts: `www.kiorly.com` (Kiorly Home sign-in), `clinic.`, `nurse.`, `pharmacy.`, `lab.kiorly.com` (+ `app.kiorly.com` alias of clinic), `api.clinic|pharmacy|lab.kiorly.com` (proposed, confirm), Passport on `account.kiorex.com`, staging equivalents. Single source: `kiorex-account/config/domains.json`. | F, D | |
| 2.3 | ACM certificate validation, CloudFront and App Runner custom-domain mappings, HSTS, apex redirect to `www`. | A | Module `infra/tofu/modules/kiorly-domains` (validated, never applied). |
| 2.4 | CDN behaviour `/idp/*` proxying Passport for Kiorly Home (the token endpoint has no CORS). | A, D | |
| 2.5 | Universal Links / App Links (GRW-P1-H). **Two associations:** Kiorly staff app on `www.kiorly.com` (`/open/*` only: `/signin/*` was removed from `domains.json` and the AASA template on 24 Nov 2026 so a Passport redirect to the web callback is never captured by the app) and the Kiorex patient app on `kiorex.com` (`/ar|en/<cc>/doctor|clinic/*`, `/r/*`, `/q/*`, `/appointment/*`, `/a/*`). Needs the Apple Developer Team ID and the Play **app-signing** key SHA-256 (Play Console, App signing; not the upload key) for each app id (`com.kiorly.app`, `com.kiorex.app`). Templates: `kiorex-account/config/app-links/*.json` (`*.kiorex.json` for the patient app). The Kiorex API renders the patient files from `APPLE_TEAM_ID` and `ANDROID_SHA256_CERT_FINGERPRINTS` at `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`; the CDN must route `/.well-known/*`, `/r/*`, `/q/*`, `/a/*` and `/appointment/*` of `kiorex.com` to the API (or the public-site role), with **no redirect** and `Content-Type: application/json` for the two files. Set `APP_LINK_HOST`/`STAFF_LINK_HOST` only for staging builds. The associated-domains entitlement and the intent filters are native config: **a new native build (EAS) is required**, they cannot ship over the air. Verify on device: iOS `swcd` diagnostics or tapping a link in Notes; Android `adb shell pm get-app-links com.kiorex.app` shows `verified`. Also set `IOS_APP_STORE_URL` and `ANDROID_PLAY_STORE_URL` for the fallback pages once the listings exist (store accounts are NEEDS_HUMAN, KX-19 section 04), `REGIONAL_API_ENDPOINTS` (JSON per market) and `MIN_APP_VERSION` for `GET /api/v1/bootstrap`. | F | Not production-verifiable without the Team ID and fingerprints |
| 2.6 | Product CORS allow-lists, OIDC redirect URIs, `PUBLIC_BASE_URL` and `KIORLY_HOME_ORIGINS` per product from the domain table. Production without `KIORLY_HOME_ORIGINS` refuses every handoff. | D | Production config test fails on localhost or unlisted hosts. |

## 3. Secrets and keys (Secrets Manager; values never in code, tfvars or state)

| # | Item | Owner | Notes |
|---|---|---|---|
| 3.1 | **Partner lead signing secret:** apply the empty containers, run `kiorex-platform/scripts/setup-partner-lead-secret.sh <env>` (production needs `--profile`), then set `lead_signing_secret_inject = true`, apply, redeploy, verify `/health/ready` `leadSigning`, send a "Talk to us" lead. Rotation: `--rotate`, redeploy, test, `--finish-rotation`. | F | `PARTNER_LEAD_SIGNING_SECRET` (Kiorex) and `KIOREX_LEAD_SIGNING_SECRET` (each product). Keep the order. |
| 3.2 | **Cloudflare TURN (Telehealth):** account-scoped token with "Calls Write", export `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in your own shell, run `clinics-management/scripts/setup-telehealth-turn.sh <env>`. Allow egress to `rtc.live.cloudflare.com`. | F | First 1,000 GB per month free, then 0.05 USD per GB. |
| 3.3 | Partner enrolment codes are created by ops in the console per partner (one time, hashed, expiring). Nothing to provision. | F (ops) | |
| 3.4 | JWT/session secrets for Pharmacy and Lab (`JWT_SECRET`/`AUTH_JWT_SECRET`) required in production. | D, F | |
| 3.5 | All provider keys below go into Secrets Manager under `/{product}/{env}/{purpose}`. | F | |
| 3.6 | **Growth link token secret:** apply the empty container `/kiorex-platform/<env>/growth-link-token` (`growth_link_token_secret`), write a random value of at least 16 characters, then set `growth_link_token_secret_inject = true`, apply and redeploy. Without it the in-session `kxl1.` token is invalid in production (the Clinic provider-link token still works through the shared Clinic secret). | F, D | GRW-P1-C; `growth-secrets.ts` |

## 4. Identity (Kiorex Passport)

| # | Item | Owner | Notes |
|---|---|---|---|
| 4.1 | Create the staging and production app clients: `kiorly` (mobile, `kiorly://auth/callback`, `kiorly://auth/logout`), `kiorly-home`, `kiorly-pharmacy-web`, `kiorly-lab-web`, Clinic web (+ nurse), with the redirect, post-logout and back-channel logout URIs from `config/idp.json`. Cognito generates the client ids: copy them into the products' `OIDC_ALLOWED_CLIENTS`. Steps S1 to S10 in `kiorex-account/Docs/NEEDS_HUMAN.md`. | F, A | Cognito has no native back-channel logout, so the account service must deliver it. Until then the 1 hour session max age is the only fallback. |
| 4.2 | Production sign-in defaults: `AUTH_MODE`, `OIDC_*`, `SIGNIN_DEFAULT_METHOD` (Password for standalone deployments, Passport for Kiorex-hosted), phone-linking opt-in in production. | F, D | Per-organisation `defaultSignInMethod` is set by org owners. |
| 4.3 | SMS/WhatsApp OTP senders live (see 5). Remove the demo OTP list and demo accounts in production. | D | |

## 5. Providers go-live (config only; mock until then)

Every provider runs behind a `MODE=mock|real` adapter. Full checklists: `kiorex-platform/Docs/NEEDS_HUMAN.md`, `Docs/PROVIDERS.md`, each repo's NEEDS_HUMAN. Real adapters are tested against faked HTTP only. Confirm each in the vendor sandbox first.

| # | Provider | Owner | Human steps |
|---|---|---|---|
| 5.1 | WhatsApp (Meta Cloud API) | F, V | Business verification, WABA, AR+EN templates (OTP as AUTHENTICATION), webhook secret, template map. |
| 5.2 | Email (SES) | F, A | Domain verification (DKIM, SPF, DMARC), leave the SES sandbox, SNS subscription. |
| 5.3 | SMS (Twilio or an Egypt aggregator) | F, V | Account, sender registration, local aggregator mapping file. |
| 5.4 | Push (Firebase + APNs) | F | Firebase project, FCM service account, Apple APNs key, EAS credentials. Expo push tokens are the default on iOS. |
| 5.5 | Payments: Paymob, Fawry, InstaPay | F, V | Merchant onboarding, callback URLs, settlement and payout rails; sandbox-verify wire formats (Paymob `transaction_inquiry` and `void_refund`, Fawry signature order and status v2). |
| 5.6 | Video | none | Own peer-to-peer WebRTC. No vendor. Only Cloudflare TURN relay traffic costs money (3.2). |
| 5.7 | Maps (Amazon Location) | F | Key or IAM access; district centroids (NH-040). Kiorex and Clinic. |
| 5.8 | OpenAI EU | F, C | Key, DPA, data-residency check, model choice. |

## 6. Launch-locked features and gates (human evidence only)

| # | Item | Owner | Notes |
|---|---|---|---|
| 6.1 | Record real gate evidence in the ops console for each launch-locked flag you want live: `kiorex.pharmacy_orders` (merchant-of-record memo, Q5), `kiorex.lab_bookings` (counsel memo), `kiorex.telemedicine` (clinical governance), `kiorex.home_visits` (GHV1, GHV2), `kiorex.category.physiotherapy` (GPR1), `nurse.care_plans` and `nurse.mar` (GKN1), `nurse.individual_kiorex_listing` (GKN2), `market.eg.live` (market pack certification and local counsel), AI navigation (KX11). | F, C | The `DEV-ONLY-NOT-A-REAL-GATE` rows seeded for local QA must NEVER exist in production (`SEED_DEV_GATES=false`, `NODE_ENV=production`). Verify none are present. |
| 6.2 | Telehealth: approved WhatsApp template names, video consent wording, clinical-governance gate, counsel review of Cloudflare as a sub-processor, WebView permissions in the Kiorex app. Also open the `kiorex-contracts` PR from `clinics-management/Docs/contracts/telehealth-contract-change.md` and remove `telehealth.video` from `PENDING_CONTRACT_FLAG_KEYS`. | F, C, D | PG-09 in `Docs/KIORLY_NEEDS_HUMAN.md`. |

## 7. Business and legal decisions

| # | Item | Owner | Notes |
|---|---|---|---|
| 7.1 | Counsel review of privacy policy and terms (EN/AR drafts in `kiorly/Docs/store-pages/`, marked DRAFT): controller/processor split, data-protection regulator or officer needs, cross-border transfer to Frankfurt under Egypt law 151/2020, retention periods, sub-processor list, AI-training statement, liability limits, governing law, safety-alert disclaimer. | C | |
| 7.2 | Fee schedule and fee wording (EGP 40 per attended new Kiorex patient is a market-rate row; confirm values and VAT/invoice wording). Marketing wording for the Kiorex tab and landing page (`kiorex-marketing-strings.ts`, `kiorexMarketing` locale namespace). | F, C | No tax-authority integration, by decision. |
| 7.3 | Confirm the delegated defaults (marked `PROPOSED_DEFAULT delegated by founder 23 Nov 2026`): partial refund policy for pharmacy orders, market deposit default (10 percent capped at 200 EGP), plan storage quotas, retention periods, `keepOriginalUploads`, doctor-absent telehealth rule. | F | Editable by super admin in the ops "Market policy" page. |
| 7.4 | **Card tokenisation (saved cards for subscription auto-renewal): product decision.** Recommended launch: pay link or invoice each period (card, Fawry reference, bank transfer). Decide auto-charge or not, failed-payment retries and grace, consent wording, and whether Paymob and Fawry support recurring saved cards in Egypt. Until decided it fails by design (`NH-PSP-01`). | F, C | |
| 7.5 | Clinical and Arabic reviews: dosage-form and specimen dictionaries (display translations), Arabic store copy, KX documents, the Arabic Nurse name (Q12), nurse plan prices. | F, C | |
| 7.6 | Nurse and other NEEDS_HUMAN sign-offs: gates GHV1/2, GPR1/2, GKN1/2, counsel and CMO. | F, C | |
| 7.7 | Credit systems and sponsored promotions (ADR-048, approved design, Proposed): counsel on patient credit, refund-as-credit and family sharing, provider credit terms and sponsored promotions; accounting and VAT for sponsored discounts and credit; advertising rules for promotions. Items 11.24 to 11.31. Patient CREDIT mode stays launch-locked; coupon mode is the default. | F, C | Detail in section 11 |

## 8. Apps, stores and builds

| # | Item | Owner | Notes |
|---|---|---|---|
| 8.1 | Apple Developer Program (needs a D-U-N-S number), register `com.kiorly.app` and `com.kiorex.app`, reserve the names, APNs key, App Store Connect records. | F | App Store check on 23 Nov 2026: no app named Kiorly. |
| 8.2 | Google Play organisation account, create the apps (`com.kiorly.app`, Kiorex package), Firebase/FCM. | F | |
| 8.3 | Company details: legal entity name, registration number, address, seller name. Support mailbox `support@kiorly.com` (SPF/DKIM/DMARC). Host `kiorly.com/privacy`, `/terms`, `/support`, write `/app`. Keep the DRAFT banner and `noindex` until counsel signs off. | F, C | Pages in `kiorly/Docs/store-pages/`. |
| 8.4 | Store declarations: Apple App Privacy, Google Data Safety, Health apps declaration, ratings (`kiorly/Docs/STORE_DECLARATIONS.md`), screenshots (shot list per device size, AR/EN captions) captured on a built app against a staging environment with demo data for reviewers. | F, D | Needs a staging API (8.6). |
| 8.5 | **Native builds are required, never OTA:** the WebView module and permission strings are native. Build development, preview and production (Release) with EAS. `expo prebuild --clean` before device builds (old `com.kiorly.team` bundle). Both apps use the `fingerprint` runtime version so OTA never reaches an incompatible binary. Android needs an SDK/emulator or EAS cloud build, which has not been run on this Mac. | D, F | |
| 8.6 | A staging environment with seeded demo data for store reviewers and QA. | A, D | |
| 8.7 | Notification icon assets reviewed by a designer (monochrome icons were generated, not eyeballed on device). Brand/icon final approval, Kiorly accent colour confirmation (Periwinkle `#818CF8`). | F | |

## 9. Data, cleanup and hardening before real users

| # | Item | Owner | Notes |
|---|---|---|---|
| 9.1 | Production runs no demo seeds: demo personas, `DEV ONLY` test-user panels (absent from production bundles, verified by bundle checks), OTP `000000`, dev IdP. Re-run the bundle checks on the release builds. | D | |
| 9.2 | Document storage: apply the ADR-036 plan decisions (lifecycle rules, quotas, retention, `keepOriginalUploads`), confirm 4 MB original-quality rule behaviour on real files, verify uploads bucket retention for Dr Ahmed Shall. | F, D | `_docs/rev23/KX-25`. |
| 9.3 | Import real tenants only through the onboarding import (two-person rule), never by hand-run SQL. | F | |
| 9.4 | Penetration test, load test, backup restore drill, disaster-recovery run, accessibility audit on release builds, Arabic proofreading. | F, D | |
| 9.5 | Monitoring and alerting: lead alerts, safety alerts, outbox lag, circuit breakers, 5xx and 503 (pool exhaustion) dashboards. | A, D | |
| 9.6 | Open technical follow-ups: Clinic route-matrix maps verified against live AWS, a per-partner stale session limit for Pharmacy/Lab webs, the Lambda Node 26 move, TS 7 blockers, lint warnings promoted to errors. | D | |
| 9.7 | Branches: `main` of `clinics-management` deploys to AWS on push (`deploy-aws.yml`). `kiorex` has no automatic deployment. Decide when pushes to `main` may deploy and drop `[skip ci]`. | F | |

## 10. Go-live runbook (order)

1. Decide and create the production AWS account (1.1, 1.2, 1.3). 2. Domains and certificates (section 2). 3. Apply infrastructure, staging first (1.4). 4. Secrets (section 3) and provider setup (section 5) in staging; sandbox-verify every provider. 5. Passport clients (section 4). 6. Staging soak with demo data, run all e2e suites and the HTML test guide. 7. Counsel and sign-offs (sections 6, 7). 8. Store accounts, builds, listings (section 8). 9. Record real gate evidence (6.1). 10. Production apply and deploy by the founder; smoke test with the live checklist; monitor.

## 11. Growth Engine human items (added 24 Nov 2026; the programme is built locally, none of these is done)

Context: `_docs/rev23/KX-27..KX-33` and `_docs/growth/`. None of these is done; all gate production use of growth features, not development. Rev 2.4 added 11.16 to 11.23. Owner letters as above (F founder, C counsel, A AWS/org admin, D dev team, V vendor).

| # | Item | Owner | Notes |
|---|---|---|---|
| 11.1 | Sign, amend or reject ADR-041 to ADR-047 (still Proposed). ADR-039 is found and Accepted (Clinic repository, registered in KX-01 Rev 2.4), so numbering stands | F | KX-01 |
| 11.2 | Money policy: attribution precedence (`PROVIDER_FIRST`), windows (30, 30, 7 days), EGP 40 for provider-led-then-marketplace patients (proposed no charge), 7-day notice for money-policy changes | F | KX-30; FD-21, FD-22 |
| 11.3 | Hosts and DNS: `kiorex.com` patient host in the domain table, `kiorly.link` (NH-008, serve or redirect), widget host (`book.kiorex.com` proposed), staging hosts, certificates | F, A | KX-19 update; extends 2.1 to 2.3 |
| 11.4 | Counsel opinion on PDPL for analytics cookies, visitor keys, direct electronic marketing consent, the reported marketing licence, retention, dependants; DPO record of processing and formal PIA | C | `growth.analytics_visitor`, `growth.marketing_messaging` stay launch-locked OFF |
| 11.5 | Consent and preference wording AR and EN, versioned (`TODO_NEEDS_HUMAN_v0` today) | C, F | |
| 11.6 | Provider terms update: attribution rules, provider-led protection and evidence, dispute window, content licence for public pages | C, F | Before commission decisions go live |
| 11.7 | Apple Team ID, Play signing SHA-256, store accounts for the Kiorex patient app, so patient deep links and ASO can ship | F | Extends 2.5, 8.x |
| 11.8 | Google Search Console, Bing Webmaster and Google Business Profile ownership; review-markup eligibility check | F | KX-31 |
| 11.9 | Egypt market pack district list (NH-040, FD-14) for district pages and bootstrap | F | |
| 11.10 | Real providers for growth sends and measurement in the pre-launch pass: WhatsApp marketing templates and quality-rating policy, SMS, Search Console, Play Console and App Store Connect APIs, ad platforms (Phase 3) | F, V | FD-04; mock until then |
| 11.11 | Reward credits: legal and regulator assessment (stored value, e-money, vouchers, tax and accounting), go or no-go | C, F | Phase 2, KX-30 section 10 |
| 11.12 | Company advertising policy: no health-condition targeting, no patient-list audiences, no remarketing | C, F | Phase 3 |
| 11.13 | WhatsApp assistant safety review and launch gate | F, C | `kiorex.whatsapp_ai_assistant` |
| 11.14 | Confirm the 50/25/15/10 interpretation and approve or replace the illustrative EGP 150,000 monthly marketing budget; reconcile with KX-13 and KX-14 | F | KX-29, KX-13 section 13 |
| 11.15 | Decide SSR as a separate App Runner service from day one (cost) and the deploy plan | F, A | FD-17, FD-26 |
| 11.16 | **Lighthouse and field Web Vitals** on the three SSR templates (doctor, specialty+district, clinic) against `lighthouserc.json`; the CLI was never installed, so no lab score exists. Fix any budget miss before indexing is allowed | D | KX-31 section 05; `ssr-smoke.mjs --lighthouse` ready |
| 11.17 | **Universal and App Links on devices:** native rebuild of the patient and staff apps, real association files (Team ID and SHA-256), check on an iPhone and an Android phone; the simulator checklist is in TEST_GUIDE | F, D | GRW-P1-H; extends 11.7 |
| 11.18 | **Widget with the real Passport popup:** restart the dev or staging Passport so it loads the `kiorex-widget` client, run the booking from a provider site; confirm DNS, CDN and the `WIDGET_HOST` value | D, A | GRW-P1-G |
| 11.19 | Environment values for the public site and apps: `SITE_ENVIRONMENT=production` (only then are pages indexable), `SITE_GOOGLE_SITE_VERIFICATION`, `SITE_BING_SITE_VERIFICATION`, `WIDGET_HOST`, `APPLE_TEAM_ID`, `ANDROID_SHA256_CERT_FINGERPRINTS`, `IOS_APP_STORE_URL`, `ANDROID_PLAY_STORE_URL`, `REGIONAL_API_ENDPOINTS`, `GROWTH_CONFIG_*` | F, D | KX-31 |
| 11.20 | Per-organisation partner credentials for the evidence and link-lookup calls (today a shared Clinic secret plus an organisation header is used) | D, F | KX-30 section 08 |
| 11.21 | Decide whether `reviewMarkupEnabled` ships `false` until Google review-snippet eligibility is checked (default is `true`) | F | KX-31 section 07 |
| 11.22 | Product decisions from the edge-case report: bind `lt` to a session or accept the 72-hour window; 410 tombstone or 301 for delisted profiles; hour-early quiet-hours deferral on two DST nights | F, D | EDGE_CASE_REPORT risks 2, 3, 5 |
| 11.23 | Written provider-facing page of the attribution rules and the approval of the first ACTIVE attribution policy version by two super admins (none is seeded) | F, C | KX-30 sections 05 and 08 |
| 11.24 | **Counsel on patient credit (Regulatory dependency):** is a closed-loop, non-transferable credit balance, refund-as-credit (the patient's own refunded money kept as credit, remainder returned to the original method at expiry) and family sharing stored value or e-money under Egyptian central-bank, fintech or consumer-protection rules; maximum open balance, expiry and forfeiture, terms wording AR and EN. Patient CREDIT mode stays launch-locked; coupon mode is the default until this is cleared | C, F | KX-30 section 14; ADR-048; FD-29; flags `growth.patient_credit`, `growth.refund_as_credit`, `growth.family_credit` |
| 11.25 | **Counsel on provider credit terms:** forfeiture of promotional credit on closure, no cash-out wording, expiry, grant authority, VAT status of credit grants, terms update for fee draw-down and dispute-win credit | C, F | KX-05 section 15; `clinic.provider_credit_v2` |
| 11.26 | **Accounting and VAT treatment:** patient credit (marketing expense versus liability, breakage), refund credit as a customer liability, **sponsored discounts** (provider-funded price reduction, VAT base of the clinic's visit fee, invoice presentation, the settlement between the Kiorly wallet ledger and the Kiorex Pay held ledger, `postToPayLedger`), credit purchases of usage bundles | F, accountant | KX-09 section 06; KX-32 revenue definitions |
| 11.27 | **Counsel and accounting sign-off on provider-sponsored promotions** as a product (provider-funded discounts shown by a marketplace, consumer-protection and price-reference rules, no inducement for clinical decisions) | C, F | `growth.sponsored_promotions`; FD-30 |
| 11.28 | **Advertising rules for promotions:** Egyptian medical and consumer advertising limits, banned phrase list AR and EN, label wording "sponsored by", reviewer, reference-price proof | C | `content-guard` placeholder list |
| 11.29 | Super Admin procedure for promotion review and maker-checker (roles, SLA, high-value thresholds) and the support goodwill authority matrix (who may grant what, second-approver roster, limits) | F | `GRW-P2-S`, `GRW-P2-B2` |
| 11.30 | Confirm the design interpretations: order of use read as tender order after any price reduction (credit, then deposit held, then card), refund-credit expiry returns to the original method, no promotion stacking, maximum open balance, goodwill limits | F | KX-01 Q22; FD-28 to FD-31 |
| 11.31 | Amounts and prices: onboarding credit, connect bonus, provider referral reward, prepaid usage bundle prices (KX-12); with zero amounts nothing of value ships | F, CEO, CFO | KX-12 section 09 |

## 12. Security (added 24 Nov 2026 after the internal penetration test)

Source: `security/PENTEST_2026-11_REPORT.md` (findings, fixes, residual risk, honest gaps). Owner letters as above (F founder, C counsel, A AWS/org admin, D dev team, V vendor). Everything here is operator action or a human decision; the code fixes are already in.

| # | Item | Owner | Notes |
|---|---|---|---|
| 12.1 | **External penetration test** by an independent firm on staging, after 12.2 to 12.6 are applied: all four APIs, web apps, Kiorly Home, managed Passport, widget and public site, staff app (iOS, Android), AWS configuration, telehealth, a business-logic track on commission and attribution. Retest included, CVSS report, attestation letter. Fix all High before launch (KX-10). Repeat yearly and after major releases. | F, V | NH017; scope text in the report, section 6 |
| 12.2 | Set `TRUSTED_PROXY_HOPS` (CloudFront + App Runner = `2`) on every API; verify the real header chain in staging. Without it all clients share one IP bucket and per-IP limits protect nothing. Set `CORS_ORIGINS` for the Kiorex API and confirm the Clinic web origin (production CORS is an allow-list). | D, A | New environment variables in each service's env |
| 12.3 | **WAF**: attach the web ACL from each `platform/waf-rules.json` to the CloudFront distributions: managed groups (common, known bad inputs, SQLi, IP reputation, bot control), rate-based rules per path (`/auth/*`, OTP, `/partners/v1/*`, `/growth/v1/*`, `/q/*`, `/r/*`, `/b/*`), body size limit, allow-list for `/admin/*` and the ops console, block `/docs*`, `/dev/*` and `/api/docs*` at the edge, Origin-header and Host-header rules. Start in count mode, then block. | A, D | KX-21 HB01 |
| 12.4 | **Bug bounty / vulnerability disclosure**: publish `security.txt` (`/.well-known/security.txt`) and a disclosure policy with safe-harbour wording (counsel), a mailbox that reaches two people, a triage SLA (acknowledge in 2 working days). Start with a private programme after the external test; public only when someone owns triage. | F, C | Reward budget is a founder decision |
| 12.5 | **Key and secret rotation**: rotate every secret in section 3 at go-live (nothing from the dev stack is reused), then every 90 days (Secrets Manager rotation); rotate immediately on staff exit or suspected leak. Includes `JWT_SECRET` (>= 32 random characters), `FIELD_ENCRYPTION_KEY` (rotation needs a re-encryption job: plan it before real national IDs are stored), webhook and HMAC secrets (dual-secret window already supported for lead signing), integration client secrets, TURN and PSP keys. Production boots fail by design on missing or published dev secrets: if a service will not start, that is the control working. | A, D | Runbook per secret in `Docs/` of each repo |
| 12.6 | Remove staging bring-up flags when real values exist: `ALLOW_INSECURE_DEFAULT_SECRETS`, `SANDBOX_PAYMENTS_ALLOWED` (staging tfvars). Set `PSP_MODE` / `PAYMENT_MODE=real` before production traffic (production tfvars still say `TODO_NEEDS_HUMAN`; with a mock PSP the sandbox checkout would be the only payment path). Keep `SWAGGER_ENABLED` unset or `false` in production. | D, F | |
| 12.7 | **Incident response**: name the incident commander and a deputy, and a 24-hour contact list: founder, tech lead, AWS account admin, counsel / DPO, PSP and WhatsApp vendor security contacts, hosting support. Fill the table below. Breach clock: 72 h to the regulator and 3 days to subjects (runbook `PDPC_DATA_BREACH.md`). Practise once (tabletop) before launch. | F, C | `[NEEDS_HUMAN]` placeholders: no real names or numbers are recorded in this repo |
| 12.8 | Audit and detection: CloudTrail organisation trail to an immutable bucket, GuardDuty and Malware Protection for S3 on the uploads and import-staging buckets (the onboarding scanner is a mock until then), alarms on 401 / 403 / 429 spikes and on `auth.dev_login`-style audit actions, log review owner. | A, D | KX-21 |
| 12.9 | Open product decisions from the report: credentials inside the tenant SQL export (KX-PT-L4), platform-level restore of marketplace appointments (L5), Clinic role-matrix review with the product owner (L6), shared store for nonces and rate limits (L1). | F, D | |
| 12.10 | Re-run `cd e2e && npm run test:security` against every release candidate (production-mode boot, throw-away databases) and keep the report with the release evidence. | D | |
| 12.11 | Engineering follow-ups from the sweeps (no human needed, tracked here so they are not lost): DTO classes for the 115 untyped Clinic request bodies; revoke the first tokens when an authorization code is replayed; row lock for the Lab cancel versus specimen scan race; shared nonce store for the Clinic marketplace HMAC; scheduled daily decision replay job; fix the order-dependent growth-analytics k-anonymity integration test | D | EDGE_CASE_REPORT section 3; KX-33 section 04 |
| 12.12 | Phone linking of Passport accounts to staff rows is OFF by default in production (`OIDC_PHONE_LINK`, `KIOREX_OIDC_PHONE_LINK`): decide whether to opt in after verifying staff phone numbers | F | KX-04 Rev 2.4 section |
| 12.13 | Telehealth: Cloudflare TURN key (3.2), video consent wording and the clinical-governance gate for `kiorex.telemedicine`, a real call on two devices over a relay | F, C, D | ADR-039 |

Incident contacts (fill before launch; do not commit real phone numbers to the repo, keep them in the password manager and print the sheet):

| Role | Name | Primary contact | Backup |
|---|---|---|---|
| Incident commander | `[NEEDS_HUMAN]` | `[NEEDS_HUMAN]` | `[NEEDS_HUMAN]` |
| Deputy / technical lead | `[NEEDS_HUMAN]` | `[NEEDS_HUMAN]` | `[NEEDS_HUMAN]` |
| AWS account admin | `[NEEDS_HUMAN]` | `[NEEDS_HUMAN]` | `[NEEDS_HUMAN]` |
| Counsel / data-protection officer | `[NEEDS_HUMAN]` | `[NEEDS_HUMAN]` | `[NEEDS_HUMAN]` |
| PSP, WhatsApp and SMS vendor security desks | `[NEEDS_HUMAN]` | `[NEEDS_HUMAN]` | `[NEEDS_HUMAN]` |

Cross-references: `_docs/COMPLETENESS_MATRIX.md`, `Docs/NEEDS_HUMAN.md` in each repo, `_docs/rev23/KX-17` (launch readiness), `_docs/rev23/KX-21` (AWS reference), `_docs/test-flow/index.html` (test guide).
