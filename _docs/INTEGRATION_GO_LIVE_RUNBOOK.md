# Integration go-live runbook (master)

Status: written 25 Nov 2026. Nothing here has been run against a real account: every step is for the founder or a named human. Agents never push, deploy, `tofu apply`, enter production credentials or mark a gate satisfied. No secret value appears in this file; secrets are named by their Secrets Manager path.

Companion runbooks (written by other lanes): messaging `kiorex-platform/Docs/INTEGRATION_RUNBOOK_MESSAGING.md` (SMS, email, WhatsApp, push; anchors `#sms #email #whatsapp #push`) and payments `kiorex-platform/Docs/INTEGRATION_RUNBOOK_PAYMENTS.md` (anchors `#paymob #fawry #instapay`). This file covers everything else and the order. Where to look first: the **Integrations Control Center** (Kiorex ops, `/integrations`): mode, approved mode, drift, credential presence, last check, circuit, webhook URL, required variable names, runbook link. Mode changes are proposed there (maker-checker `INTEGRATION_MODES`, a second super admin approves); the environment is then changed by the deployment. Catalogue of every number: `_docs/CONFIGURATION_CATALOG.md`.

## Blocking human items (ids used by the Control Center)

| Id | Item | Owner | Blocks | Launch guide |
|---|---|---|---|---|
| NH-AWS | Production AWS account, SCP relaxation, state backend, `tofu apply` decisions | F, A | every deploy step (A1 to A4), observability, storage, maps | 1.1 to 1.4, 1.7 |
| NH-DNS | `kiorex.com` and `kiorly.com` DNS delegation, certificates, host names, Search Console and CrUX ownership | F | domains, TLS, Passport hosted domain, SEO and CrUX integrations | 2.1 to 2.6 |
| NH-IDP | Production IdP choice confirmed (Cognito default) and client registration | F, D | Passport go-live, every product sign-in, store review accounts | 4.1, 4.2 |
| NH-SMS | SMS sender registration (Egypt sender id or Twilio) | F, V | SMS real mode, OTP in production | 5.3 |
| NH-EMAIL | SES domain verification, DKIM, SPF, DMARC, leave sandbox | F, A | email real mode | 5.2 |
| NH-WA | Meta business verification, WABA, AR and EN templates, webhook secret | F, V | WhatsApp real mode, assistant | 5.1 |
| NH-PUSH | Firebase project and FCM service account, Apple APNs key, EAS credentials | F | push real mode | 5.4, 8.1, 8.2 |
| NH-PSP | Paymob, Fawry, InstaPay merchant onboarding, callback URLs, settlement rails; PSP fee and deposit amounts (KX-12) | F, V | payments real mode, any money path | 5.5, 7 |
| NH-ADS | Ad accounts (Google Ads, Meta, TikTok, GA4) and read-only credentials | F, CMO | marketing integrations real mode | 11 (CMO rows) |
| NH-LLM | LLM vendor, DPA, data-residency check, model choice; counsel and DPO sign-off for the assistant and recommendations | F, C, DPO | assistant real model, AI summaries | 5.8, 11 |
| NH-TURN | Cloudflare TURN token and key (Clinic) and a real two-device relay call | F | telehealth over relay | 3.2, 12.13 |
| NH-STORE | Apple Developer and Google Play accounts, store records, declarations | F | store registration, real store analytics, iOS push | 8.1 to 8.4 |

## Ordered go-live checklist

Do each phase in **staging first**, then production. Do not start a phase while the item it needs (right column) is open.

| # | Step | Needs | Done when |
|---|---|---|---|
| 1 | Production AWS account, SCPs, tofu state backend | NH-AWS | `tofu plan` reads the account (founder runs it) |
| 2 | Domains and DNS (section below), certificates | NH-DNS | certificates issued, records resolve |
| 3 | `tofu plan` per stack, review, founder applies | NH-AWS | stacks exist; plan summaries filed |
| 4 | Secrets created (section below), values set by humans only | step 3 | each path holds a value; Control Center shows credentials "Set" |
| 5 | Passport production IdP and clients | NH-IDP, step 2 | sign-in works end to end in staging |
| 6 | Messaging real in staging (messaging runbook) | NH-SMS, NH-EMAIL, NH-WA, NH-PUSH, step 4 | Control Center check OK, delivery webhooks seen |
| 7 | Payments real in staging, sandbox first (payments runbook) | NH-PSP, step 4 | sandbox payment, refund and webhook reconcile |
| 8 | Marketing and store integrations (read-only) | NH-ADS, NH-STORE | first real pull, circuit CLOSED |
| 9 | LLM vendors (assistant behind its flag, recommendations launch-locked) | NH-LLM | gates evidenced by humans, never by an agent |
| 10 | Observability, backups, alarms verified | step 3 | alarms fire in a drill, restore rehearsed |
| 11 | Load test against staging | step 3 | thresholds met, report filed |
| 12 | Store registration and builds | NH-STORE | apps in review |
| 13 | Staging soak with seeded data and every integration real in sandbox | steps 5 to 11 | a week without Sev-1 |
| 14 | Founder approves each mode in the Control Center (`INTEGRATION_MODES`), second super admin approves | step 13 | no REAL_NOT_APPROVED drift |
| 15 | Production apply by CI, set modes in the production environment, run Control Center check on every row | steps 1 to 14 | all rows Ready, drift 0 |

## Passport production identity provider {#passport}

Default: **Amazon Cognito** (scorecard `kiorex-account/Docs/IDP_SCORECARD.md`; the founder confirms, NH-IDP). The month-1 spike between Cognito and Keycloak on ECS has pass or fail checks (back-channel logout, key rotation, custom OTP sender); if Cognito fails them, switch to Keycloak on ECS or Zitadel Cloud (`config/idp.json` is the source). Steps for a human: create the pool or realm in staging, run the account repo's config-as-code, register the clients named in launch guide 4.1 (`kiorly`, `kiorly-home`, `kiorly-pharmacy-web`, `kiorly-lab-web`, Clinic web and nurse, `kiorex-ops`, `kiorex-api` audience) with exact redirect and post-logout URIs per environment, set `OIDC_ISSUER` and `OIDC_AUDIENCE` on every API, set the Clinic and platform `OIDC_*`, turn off the demo OTP list and demo accounts. The Control Center row `PASSPORT_IDP` reads `real` once the issuer is a non-local https URL; production boot refuses a non-https issuer.

## Domains, DNS, TLS, CDN, WAF

Hosts (founder confirms, launch guide 2.2): `kiorex.com` (patient web, `www`), `account.kiorex.com` (Passport), `api.kiorex.com` (proposed); `kiorly.com` with `www` (Kiorly Home sign-in), `clinic.`, `nurse.`, `pharmacy.`, `lab.`, `app.` (alias of clinic) and `api.clinic|pharmacy|lab.kiorly.com` (proposed). Steps: delegate DNS to Route 53 (or add records), apply `infra/tofu/modules/aws/dns-certs` (ACM DNS validation), CloudFront behaviours including `/idp/*` for Kiorly Home, HSTS, apex to `www`, Universal and App Links association files per the launch guide 2.5. WAF (`modules/aws/waf`): a global rate cap in front of intake, leads, handoff and public sign-in config, because in-app limiters are fixed-window. Then set `PUBLIC_BASE_URL`, CORS allow-lists, OIDC redirect URIs and `KIORLY_HOME_ORIGINS` per product (production refuses handoff without it). Webhook callback URLs shown in the Control Center are `PUBLIC_BASE_URL` plus the route; they must be the https public host before they are entered at any vendor.

## Secrets Manager paths

Convention `/{product}/{env}/{purpose}` (launch guide 3.5). Containers are created empty by OpenTofu; **humans write values**, then flip the matching `*_inject` variable and redeploy. Known paths: `/kiorex-platform/<env>/growth-link-token` (random, 16+ chars), the partner lead signing secret (`scripts/setup-partner-lead-secret.sh <env>`), Cloudflare TURN (`clinics-management/scripts/setup-telehealth-turn.sh <env>`, the Clinic reads the name from `TELEHEALTH_TURN_SECRET_NAME`). Per integration (names are the environment variables the API reads; the secret holds the value): payments `PAYMOB_SECRET_KEY PAYMOB_PUBLIC_KEY PAYMOB_HMAC_SECRET PAYMOB_INTEGRATION_IDS FAWRY_MERCHANT_CODE FAWRY_SECURE_KEY INSTAPAY_API_KEY INSTAPAY_WEBHOOK_SECRET`; messaging `SMS_API_KEY SMS_WEBHOOK_SECRET EMAIL_API_KEY EMAIL_WEBHOOK_SECRET WHATSAPP_API_KEY WHATSAPP_WEBHOOK_SECRET WHATSAPP_VERIFY_TOKEN PUSH_FCM_SERVICE_ACCOUNT_JSON PUSH_EXPO_ACCESS_TOKEN`; AI `OPENAI_EU_API_KEY ASSISTANT_API_KEY RECOMMENDATION_MODEL_API_KEY`; maps `MAPS_API_KEY`; marketing integrations are referenced by the `secretRef` name inside the `INTEGRATION` config (never the value). Never put a value in tfvars, state, code, a ticket or a chat. The Control Center shows only "Set" or "Not set".

## OpenTofu plan-only steps

Agents run `tofu fmt` and `tofu validate` locally only. For the founder or an AWS admin: `cd infra/tofu/live/staging/<stack>`; `tofu init` against the state backend (create it first, launch guide 1.3); `tofu plan -out=plan.bin` (read-only; needs the SCPs relaxed, 1.2); review the summary; **`tofu apply` is the founder's decision**, staging before production, production through the CI pipeline. File each plan summary with the release evidence. Modules available: `network`, `database`, `container-service`, `secrets`, `object-storage`, `observability`, `safety-alerts`, `email`, `location`, `dns-certs`, `cdn-edge`, `waf`, `ci-oidc`.

## Observability and backups {#observability}

Alarms and dashboards from `modules/aws/observability` and `safety-alerts` (safety alert delivery must beat the 60 second SLO; on-call phones via `SAFETY_ONCALL_PHONES` with SMS real). The Clinic reads `SENTRY_DSN` and `OTEL_EXPORTER_OTLP_ENDPOINT` (error monitoring and tracing; the Kiorex API has neither, so the Control Center row `ERROR_MONITORING` says "verify in the Clinic deployment"). Verify: an induced error reaches Sentry with no PHI, logs carry request ids only, health endpoints `/health/ready` and `/health/providers` show the intended modes (a production boot logs a warning for every provider still mock). Backups: RDS automated backups and Multi-AZ, point-in-time restore rehearsed into a scratch instance, object storage versioning and the immutable audit bucket (launch guide 1.7 and 12.8). Record the restore time.

## Object storage {#storage}

Clinic documents and exports: local directory in development (`STORAGE_MODE=local`), the S3 bucket from `modules/aws/object-storage` in AWS, with the malware scan on the uploads and import-staging buckets (12.8). Not observable from the Kiorex API (Control Center says so).

## Maps {#maps}

Amazon Location (`modules/aws/location`): set `MAPS_MODE=real`, `MAPS_API_URL=https://places.geo.<region>.amazonaws.com`, and `MAPS_API_KEY` or the access key pair. District centroids are NEEDS_HUMAN (launch guide 5.7).

## LLM vendors {#llm}

Three separate switches, all off until humans finish the gates: the WhatsApp assistant (`ASSISTANT_POLICY.model.mode=real` **and** flag `growth.assistant_real_model` **and** `ASSISTANT_BASE_URL ASSISTANT_MODEL ASSISTANT_API_KEY`; otherwise the mock answers), recommendation summaries (`RECOMMENDATION_MODEL_MODE=real` plus three variables; aggregates only; flag `growth.ai_recommendations` is launch-locked), and the AI gateway (`AI_PROVIDER=openai-eu` with `OPENAI_EU_BASE_URL OPENAI_EU_API_KEY`). The vendor choice, DPA, data-residency check and the counsel, CMO and DPO sign-offs are human (NH-LLM). No patient data, health data or identifier ever reaches a model prompt in the assistant design; verify with the recorded fixtures before enabling.

## Video and TURN {#video-turn}

Kiorex uses no video vendor: `VIDEO_MODE=clinic-p2p` means the Clinic owns the call. Only Cloudflare STUN and TURN relay traffic costs money. Steps (NH-TURN): create the account-scoped token with Calls Write, run the Clinic setup script from your own shell, set `TELEHEALTH_TURN_SECRET_NAME` in the Clinic, then make a real call on two devices over a relay. Join window defaults 10 minutes before and 60 after the end (`CLINIC_TELEHEALTH_JOIN_*`).

## Marketing and store analytics (read-only) {#marketing-integrations}

Google Ads, GA4, Search Console, Meta Ads, TikTok, Play Console, App Store Connect and CrUX are read-only aggregate pulls (`Docs/GROWTH_INTEGRATIONS.md`). Configure through the `INTEGRATION` config kind (maker-checker): `mode`, `secretRef` (a name matching `^[a-z0-9/_-]+$`), `accountLabel`, `pullSchedule`, `rateBudgetPerHour`, `retentionDays`. Real mode without a resolvable secret fails closed (`NEEDS_HUMAN`, nothing stored, no network call). A real manual pull needs a second super admin. Play and App Store parsers wait for recorded samples (H-9). No conversion upload to any vendor and no health targeting, ever. Circuit breaker numbers are the `INTEGRATION_RUNTIME` kind.

## Load test

`clinics-management/perf/k6` (and `perf/lighthouse` for web vitals). Run against **staging** only, with synthetic data, from a machine the founder approves: ramp to the target concurrency from KX-21, watch p95 latency, error rate, database CPU and connection pool (`DB_POOL_MAX`), limiter behaviour (429s expected on abuse paths only). Thresholds are set by the founder; file the report. Never run against production or against a real vendor.

## Store registration

Apple Developer Program (needs a D-U-N-S number), bundle ids `com.kiorly.app` (staff app **Kiorly**) and the Kiorex patient app, APNs key uploaded to Expo, App Store Connect record; Google Play organisation account, Firebase and the FCM service account; declarations (App Privacy, Data Safety, health apps) per `kiorly/Docs/STORE_DECLARATIONS.md`; native builds through EAS only, never OTA for native changes; a staging environment with seeded demo data for reviewers. Launch guide section 8 has the full rows.

## Before you flip any row to real

1. Control Center check says CONFIG_OK for that row in staging. 2. The vendor sandbox exercise in the matching runbook is filed. 3. The founder has proposed the mode and a different super admin has approved it (drift shows APPROVED_NOT_DEPLOYED, then none). 4. The webhook URL is public https and entered at the vendor. 5. Rollback is known: set the mode back to mock in the environment and propose `mock`; payments and safety paths have their own rollback in their runbooks.
