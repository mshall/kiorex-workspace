# Launch preparation guide (build this out after development is done)

Status: LIVING DOCUMENT, started 24 Nov 2026. When the founder asks for "the launch preparation guide", read this file, bring every row up to date against the repos, and present it. Add new items here whenever a decision or a human-only step appears.

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
| 2.5 | Universal Links / App Links files for `www.kiorly.com` (Apple team id, Android signing fingerprint). Templates in `kiorex-account/config/app-links/`. | F | |
| 2.6 | Product CORS allow-lists, OIDC redirect URIs, `PUBLIC_BASE_URL` and `KIORLY_HOME_ORIGINS` per product from the domain table. Production without `KIORLY_HOME_ORIGINS` refuses every handoff. | D | Production config test fails on localhost or unlisted hosts. |

## 3. Secrets and keys (Secrets Manager; values never in code, tfvars or state)

| # | Item | Owner | Notes |
|---|---|---|---|
| 3.1 | **Partner lead signing secret:** apply the empty containers, run `kiorex-platform/scripts/setup-partner-lead-secret.sh <env>` (production needs `--profile`), then set `lead_signing_secret_inject = true`, apply, redeploy, verify `/health/ready` `leadSigning`, send a "Talk to us" lead. Rotation: `--rotate`, redeploy, test, `--finish-rotation`. | F | `PARTNER_LEAD_SIGNING_SECRET` (Kiorex) and `KIOREX_LEAD_SIGNING_SECRET` (each product). Keep the order. |
| 3.2 | **Cloudflare TURN (Telehealth):** account-scoped token with "Calls Write", export `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in your own shell, run `clinics-management/scripts/setup-telehealth-turn.sh <env>`. Allow egress to `rtc.live.cloudflare.com`. | F | First 1,000 GB per month free, then 0.05 USD per GB. |
| 3.3 | Partner enrolment codes are created by ops in the console per partner (one time, hashed, expiring). Nothing to provision. | F (ops) | |
| 3.4 | JWT/session secrets for Pharmacy and Lab (`JWT_SECRET`/`AUTH_JWT_SECRET`) required in production. | D, F | |
| 3.5 | All provider keys below go into Secrets Manager under `/{product}/{env}/{purpose}`. | F | |

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

Cross-references: `_docs/COMPLETENESS_MATRIX.md`, `Docs/NEEDS_HUMAN.md` in each repo, `_docs/rev23/KX-17` (launch readiness), `_docs/rev23/KX-21` (AWS reference), `_docs/test-flow/index.html` (test guide).
