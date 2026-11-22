# Provider go-live: SMS, Email, WhatsApp, payments, consent, AI, storage (22 Nov 2026)

> **Status.** Every product runs these providers in `mock` mode by default (dev inbox, fake checkout, local disk). Each one also has a `real` HTTP implementation, tested against a local fake server only. Nothing has run against a live vendor. **Going live = set `<KIND>_MODE=real` plus the URL and credentials below and, where the vendor's wire format differs from the neutral one, edit that kind's single mapping file.** No deploy, `tofu apply` or secret has been created.

## Shared design (identical in every repo)
* Port + `mock` + `real` per kind; helper kit with timeouts, retries with backoff on network/timeout/429/5xx (never 4xx), the same `Idempotency-Key` on every retry, error mapping, no secrets in logs.
* Webhooks (delivery receipts, payment status, consent revoke) verified with HMAC-SHA256 over the raw body, 5 min timestamp tolerance, deduplicated, statuses only move forward.
* Startup check: `MODE=real` with a missing URL/credential refuses to start and names the variable (never the value). Mock in production starts with a warning.
* Dev-only tools (inbox, sample sends, webhook simulation, demo runs) answer 404 in production and in real mode.
* One mapping file per kind is the only vendor-specific code.

## Env contract
| Kind | Variables |
|---|---|
| SMS | `SMS_MODE`, `SMS_API_URL`, `SMS_API_KEY`, `SMS_SENDER_ID`, `SMS_WEBHOOK_SECRET` |
| Email | `EMAIL_MODE`, `EMAIL_API_URL`, `EMAIL_API_KEY`, `EMAIL_FROM` (clinic: `EMAIL_FROM_ADDRESS`, `EMAIL_TRANSPORT=ses\|http`), `EMAIL_WEBHOOK_SECRET` |
| WhatsApp | `WHATSAPP_MODE`, `WHATSAPP_API_URL`, `WHATSAPP_API_KEY` (clinic: `WHATSAPP_API_TOKEN`, `WHATSAPP_PROVIDER=meta_cloud\|http`), `WHATSAPP_SENDER_ID`, `WHATSAPP_WEBHOOK_SECRET`, optional `WHATSAPP_TEMPLATE_MAP` (platform/Passport) |
| Payments | `PAYMENT_MODE`, `PAYMENT_API_URL`, `PAYMENT_API_KEY`, `PAYMENT_WEBHOOK_SECRET` (clinic uses `PSP_MODE`, `PSP_API_URL`, `PSP_API_KEY`, `PSP_MERCHANT_ID`, `PSP_WEBHOOK_SECRET`, `PSP_CALLBACK_URL`; pharmacy adds `PAYMENT_CURRENCY`) |
| Push (lab, pharmacy) | `PUSH_MODE`, `PUSH_API_URL` (Expo-compatible), optional `PUSH_API_KEY` |
| Storage (lab, pharmacy) | `STORAGE_MODE`, `STORAGE_API_URL`, `STORAGE_API_KEY` (pharmacy also `STORAGE_DIR`, `STORAGE_MAX_BYTES`, `STORAGE_URL_TTL_SEC`, `STORAGE_SIGNING_SECRET`) |
| Consent (pharmacy) | `CONSENT_MODE`, `CONSENT_API_URL`, `CONSENT_API_KEY`, `CONSENT_WEBHOOK_SECRET` |
| AI (pharmacy) | `AI_MODE`, `AI_API_URL`, `AI_API_KEY`, `AI_MODEL`, guards `AI_MAX_INPUT_TOKENS`, `AI_MAX_OUTPUT_TOKENS`, `AI_DAILY_TOKEN_BUDGET`, `AI_COST_PER_1K_TOKENS_USD` |
| Tuning (any kind) | `<KIND>_TIMEOUT_MS` (8000/10000), `<KIND>_MAX_RETRIES` (2), `<KIND>_BACKOFF_MS` / `_RETRY_BACKOFF_MS` (300) |

Legacy switches still work as defaults (`MESSAGING_MODE`, `PSP_MODE`, `MOBILE_PUSH_MODE`, `KIORLY_PROVIDER_MODE_<KIND>`).

## Where each repo documents it
| Repo | Guide | Dev tools (mock mode only) |
|---|---|---|
| clinics-management (`kiorex`) | `Docs/PROVIDER_INTEGRATION.md`, `Docs/PROVIDER_INFRA_NOTE.md`, `Docs/MOCK_PROVIDERS.md`, DEMO_DATA.md section 8 | `POST /dev/inbox/send-test`, `POST /dev/inbox/psp/refund`; webhooks `POST /api/v1/webhooks/providers/{sms\|whatsapp\|email}`, `/webhooks/payments/:provider` |
| kiorex-platform | `Docs/PROVIDERS.md`, DEMO_DATA.md section 8 | `POST /dev/messaging/samples`, `/dev/messaging/webhook-simulate`, `GET /dev/payments`, `POST /dev/payments/:id/simulate`; webhooks `/api/v1/messaging/webhooks/{sms\|email\|whatsapp}`, `/api/v1/pay/webhooks/{psp}` |
| kiorex-account (Passport) | `Docs/PROVIDERS.md`, DEMO_DATA.md section 8 | `GET /dev/inbox`, `GET /dev/delivery-status`, `POST /dev/webhooks/simulate`; webhooks `/webhooks/sms`, `/webhooks/whatsapp` |
| kiorly-pharmacy | `Docs/PROVIDERS.md`, DEMO_DATA.md section 8, `Docs/NEEDS_HUMAN.md` | `/api/v1/dev/providers/{status,messages,pay-links,simulate/webhook,demo/run,consent/demo,ai/sample,storage/roundtrip}`; webhook `POST /api/v1/webhooks/providers/{sms\|email\|whatsapp\|payment\|consent}` |
| kiorly-lab | `Docs/PROVIDERS.md`, DEMO_DATA.md section 8 | `/api/v1/dev/providers/{status,messages,pay-links,simulate/webhook,demo/run}`; webhook `POST /api/v1/webhooks/providers/{sms\|email\|whatsapp\|payment}` |

Passport OTP: both WhatsApp and SMS real = WhatsApp first with SMS fallback; the code is never logged in real mode and the dev inbox is off.

## Dummy-data flows to try in mock mode
Appointment confirmation/reminder/waitlist offer (platform), OTP (Passport), receipt email and pay-link success/failure/refund (clinic, lab, pharmacy), lab result-ready and critical-alert SMS (lab), pharmacy order-ready and refill reminder, consent grant/revoke blocking dispensing, redacted AI forecast text, signed storage download (pharmacy). Run the demo endpoints on a dev DB: they write rows.

## What is still not done
* **Passport Cognito Lambda** reads secrets from environment variables: a deploy-time injection mechanism and the AWS route for the status webhooks to `DeliveryStatus.handleWebhook` are missing.
* **tfvars** `PSP_MODE` / `MESSAGING_MODE` still hold `TODO_NEEDS_HUMAN` placeholders; map them to the `<KIND>_MODE` names when the stack is deployed. Secrets go in Secrets Manager / SSM (documented per repo, nothing created).
* **Business prerequisites:** WhatsApp template approval, PSP onboarding (Paymob/Fawry), SMS sender-id registration.
* **Consent registry wire format** is an assumption (`POST /consents`, `GET /consents`, `POST /consents/{id}/revoke`, `POST /consents/introspect`); adapt `mapping/consent.mapping.ts` to the real service.
* `AI_DAILY_TOKEN_BUDGET` is counted per API instance; use a shared counter before scaling out.
* Push has no HTTP provider in the clinic and platform repos (stays mock).
* Never run against a real vendor yet; first live test belongs in the pre-launch pass (`_docs/FOUNDER_DECISIONS.md`).
