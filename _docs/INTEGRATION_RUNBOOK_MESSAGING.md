# Messaging integrations: step-by-step real-provider runbook

Audience: the founder, testing each real provider the moment credentials exist. Status of the code: **built and tested against fakes only; no vendor has ever been called** (no credentials existed). Fixtures under `apps/api/test/fixtures/messaging/` are written from the vendors' published documentation, not recorded from a live account: record real ones in step "Record a fixture" of each section and replace them. Everything marked VERIFY must be checked against the vendor's current console and docs on the day.

Order of the master go-live: see `INTEGRATION_GO_LIVE_RUNBOOK.md`. Use staging first. Never put a secret value in a chat, a ticket, git or the configuration console.

## 0. Rules that apply to every channel

**Three switches must all be on before a real message leaves, and they are deliberately in three different places:**

1. **Environment (deploy time):** `<KIND>_MODE=real` (`SMS_MODE`, `EMAIL_MODE`, `WHATSAPP_MODE`, `PUSH_MODE`). Configuration can never switch a channel to real.
2. **Approval (maker-checker):** the Integrations Control Center (`/integrations` in ops) proposes `INTEGRATION_MODES`; a second super admin approves. Keys: `SMS`, `EMAIL`, `WHATSAPP_CLOUD`, `PUSH_FCM`, `PUSH_APNS`, `PUSH_EXPO`. Without it every real adapter answers `NEEDS_HUMAN_REAL_MODE_NOT_APPROVED:<KEY>`, sends nothing and calls no vendor. Mock is always allowed. Dev and test may exempt themselves only with `INTEGRATION_MODE_GATE_BYPASS=true`, which is **ignored in production** (the status screen reports it as a problem).
3. **Credentials:** secrets by reference. Secrets Manager path `/{product}/{env}/{purpose}` (for example `/kiorex/staging/whatsapp_token`), injected by ECS as the environment variable of the same name upper-cased with non-alphanumerics as `_` (`_KIOREX_STAGING_WHATSAPP_TOKEN`). The legacy `<KIND>_API_KEY` variables also work; in the maker-checker config only the *path* is ever written.

**Behaviour that is configuration, not code** (maker-checker kind `MESSAGING_CHANNELS`, ops console > Growth > Configuration, announcement text required; GLOBAL payload with `markets.<CC>` overrides): provider order per channel (first = primary, the rest are tried on a provider-level failure), sender id / from address / phone-number id per market, secretRefs, retry and backoff (`retry.maxRetries/baseDelayMs/maxDelayMs`), rate budgets (`rateBudget.perSecond/perMinute/perDay`), cross-channel failover order per message class (`failoverOrder`, marketing never fails over), quiet hours per market (whole hours, listed channels), WhatsApp template names / categories / on-off, push Android channels, deep-link schemes, badge and TTL. An empty configuration means "environment contract plus defaults" (`Docs/PROVIDERS.md`).

Example payload (secrets are paths only; the console refuses anything that looks like a value):

```json
{
  "channels": {
    "WHATSAPP": { "providers": ["meta"], "secretRefs": { "meta": "/kiorex/prod/whatsapp_token", "verifyToken": "/kiorex/prod/whatsapp_verify" }, "senderId": "<phone-number-id>", "wabaId": "<waba id>", "rateBudget": { "perSecond": 40, "perDay": 1000 } },
    "SMS": { "providers": ["aggregator", "twilio"], "secretRefs": { "aggregator": "/kiorex/prod/sms_aggregator", "twilio": "/kiorex/prod/sms_twilio" }, "senderId": "Kiorex" },
    "EMAIL": { "providers": ["ses"], "senderId": "Kiorex <no-reply@kiorex.com>", "unsubscribe": { "mailto": "unsubscribe@kiorex.com" } },
    "PUSH": { "providers": ["fcm", "apns", "expo"] }
  },
  "failoverOrder": { "TRANSACTIONAL": ["WHATSAPP", "SMS", "EMAIL"], "SECURITY": ["SMS", "WHATSAPP"], "REMINDER": ["WHATSAPP", "SMS"], "MARKETING": [] },
  "quietHours": { "start": "21:00", "end": "09:00", "timezone": "Africa/Cairo", "channels": ["WHATSAPP", "SMS", "PUSH"] },
  "markets": { "SA": { "channels": { "SMS": { "senderId": "KiorexSA" } }, "quietHours": { "start": "22:00", "end": "08:00", "timezone": "Asia/Riyadh" } } }
}
```

**Ops tools** (Kiorex ops, Messaging > "Channels and test send", API `/api/v1/admin/messaging/channels/*`): status with missing variable *names*, the webhook URL and verify token to register (secret part masked; "Reveal" is super admin and audited), **Test send** (only to an address in `MESSAGING_TEST_ALLOWLIST`, comma list of your own phone numbers and e-mail addresses; push needs a device registered to an account in `MESSAGING_TEST_ALLOWLIST_SUBS`; five per hour; always audited), **Connection check** (read-only vendor calls, never a message; mock mode makes no network call), WhatsApp template list, export and status sync.

**Webhook URLs** (public base = `PUBLIC_BASE_URL`, must be https and reachable by the vendor): WhatsApp `https://<api>/api/v1/messaging/webhooks/whatsapp`, SMS `.../webhooks/sms` (a secondary provider `.../webhooks/sms/<provider>`), e-mail `.../webhooks/email`, one-click unsubscribe `.../messaging/unsubscribe/<token>`.

**Rollback for any channel (fastest first):** (1) withdraw the approval (`INTEGRATION_MODES` back to mock, second super admin): real sending stops on the next message, no deploy; (2) set `<KIND>_MODE=mock` and redeploy; (3) remove the vendor-side webhook subscription. Revoking the vendor credential is the last resort.

**Record a fixture:** with the staging webhook live, copy the raw body of one real webhook per type from the vendor console's delivery log (or `MessageLog` error codes), scrub phone numbers, save as `apps/api/test/fixtures/messaging/<name>.json`, run `npm run test:unit -w apps/api`.

## WhatsApp

Meta WhatsApp Cloud API, adapter `WHATSAPP_PROVIDER=meta`. Approval key `WHATSAPP_CLOUD`.

**What you create (once, about half a day plus Meta review):**
1. Meta Business portfolio (business.facebook.com) and complete **Business verification** (needed for a real display name and higher limits; days).
2. A Meta developer app of type **Business**, add the **WhatsApp** product. Note the **App secret** (App settings > Basic).
3. A **WhatsApp Business Account (WABA)** and a **phone number** (a number that is not on personal WhatsApp). Note the **WABA id** and the **Phone number id** (WhatsApp > API setup). Set and get the display name approved. VERIFY the current flow in the console.
4. A **System user** (Business settings > Users > System users, Admin) with the app assigned, then **Generate token** with permissions `whatsapp_business_messaging` and `whatsapp_business_management`, no expiry. This is the API key.
5. During development use Meta's test number and add your own phone as an allowed recipient; a real number removes that limit.

**Environment and secrets (staging):**
| Variable | Value |
|---|---|
| `WHATSAPP_MODE` | `real` |
| `WHATSAPP_PROVIDER` | `meta` |
| `WHATSAPP_API_KEY` or secretRef `/kiorex/staging/whatsapp_token` | the system-user token |
| `WHATSAPP_SENDER_ID` (or config `channels.WHATSAPP.senderId`) | the phone-number id |
| `WHATSAPP_WEBHOOK_SECRET` | the Meta **App secret** (signs every POST, `X-Hub-Signature-256`) |
| `WHATSAPP_VERIFY_TOKEN` (or secretRef `verifyToken`) | a long random string you choose |
| `WHATSAPP_API_URL` | optional; default `https://graph.facebook.com/v21.0` |
| config `channels.WHATSAPP.wabaId` | the WABA id (template sync and submit, subscription check) |
| `MESSAGING_TEST_ALLOWLIST` | your own number in E.164, e.g. `+2010...` |

**Register the webhook:** Meta app > WhatsApp > Configuration > Webhook: Callback URL from ops (Webhook display) and the verify token ("Reveal"), click Verify and save (the platform answers the `hub.challenge`). Subscribe to the fields `messages`, `message_template_status_update`, `message_template_quality_update`, `phone_number_quality_update`, `account_update`. Also subscribe the app to the WABA (the connection check reports whether it is).

**Templates (needed for anything the business starts):** Ops > Channels > WhatsApp templates > Export for approval gives one Graph payload per template and language (names `kx_<kind>_v1`, parameters `{{1}}..{{n}}` numbered per language, `MSG_TEST` included). Either paste them in the Meta template manager or `POST /admin/messaging/channels/whatsapp/templates/submit` with `{"confirm":true}` (a dry run without `confirm`). Copy is `TODO_NEEDS_HUMAN` until the founder and counsel approve the wording; categories default to UTILITY (marketing templates are MARKETING). Statuses arrive by webhook or "Sync status from Meta". A REJECTED / PAUSED / DISABLED template fails fast with `WA_TEMPLATE_NOT_APPROVED` and no call. Authentication (OTP) templates belong to the Passport product.

**Approve real mode:** Control Center > WhatsApp Cloud API > propose real; a second super admin approves. Then deploy the environment above.

**First test, in this order, and the expected result:**
1. Ops > Channels > WhatsApp > Connection check. Expect OK for `phone number` (name, quality GREEN), `templates access`, `webhook subscription`, `verify token`. A 190 means the token is wrong or expired.
2. From your phone, send "hi" to the business number. Expect an inbound row in the message log (masked) and the 24 h window open (`GET .../channels` > WHATSAPP state, or the test below).
3. Test send to your number. Inside the window with no approved test template it goes as session text; with `kx_msg_test_v1` approved it goes as the template. Expected: you receive "Kiorex test message HH:MM UTC", the log shows SENT then DELIVERED then READ from the status webhooks. If you see `WA_NO_TEMPLATE`: open the window (step 2) or get `kx_msg_test_v1` approved.
4. **Buttons:** with `kiorex.whatsapp_ai_assistant` effective (mock model is enough) message the number "عايز احجز كشف", go through to the Confirm / Cancel message. Expect two interactive buttons. Tap Confirm: the inbound carries the exact payload `CONFIRM:<id>:<nonce>` (the button id is never edited or shortened; Meta limits: 3 buttons, id 256, title 20 characters). A typed "yes" must not confirm.
5. **Window:** wait 24 h (or lower `whatsapp.windowHours` in config for the test) and try the buttons again: expected refusal `WA_WINDOW_CLOSED`, nothing sent, never a downgrade to text.
6. Send a photo, a voice note and a location: expected the fixed "I can only read text" style reply and nothing stored or forwarded.
7. Send `STOP`: expected an opt-out (suppression row for WhatsApp, the existing confirmation reply) and no further marketing.

**Limits and quality (handled for you):** rate budget (default 40 per second, 1000 new people per day, tune to your messaging tier), tier from `phone_number_quality_update` caps new conversations per 24 h (`WA_TIER_LIMIT`), throttle errors 130429 / 131056 / 131048 / 80007 close the channel with a backoff ladder 30 s, 2 min, 10 min, 30 min (`THROTTLED`), error 131047 (outside the window) retries once as a template, 131026 (not on WhatsApp) is final, 190 raises an alert line and stops. Watch the status screen: quality FLAGGED or DOWNGRADE means stop marketing and check the opt-out rate.

**Rollback:** see section 0. Also remove the webhook subscription in Meta and rotate the system-user token if it leaked.

**Troubleshooting:** `WA_TEMPLATE_PARAM_MISSING` a placeholder had no value; `META_132001` template name or language does not exist at Meta (check `kx_..._v1` and language `ar`/`en`); `META_132012` parameter format (newlines are rewritten, 5+ spaces are shortened); `META_131030` recipient not on the test allow-list; 401 on the webhook = wrong App secret.

## SMS

Two adapters behind one interface, selected by `SMS_PROVIDER`: `aggregator` (Egyptian bulk-SMS aggregator, wire format described by data) or `twilio`; `gateway` is the generic neutral contract. Approval key `SMS`. The order and a failover pair are configuration (`channels.SMS.providers`).

**What you create:**
- **Egyptian aggregator** (Vodafone / Orange / Etisalat / WE resellers such as SMS Misr, Victory Link, Door, Cequens: pick by price, delivery reports and support): an account, API credentials, a **registered sender name** (alphanumeric sender ids are registered per operator and take working days; ask the aggregator and VERIFY the rules and any Arabic-text registration), and their API document. Fill `channels.SMS.aggregator` (or `SMS_AGGREGATOR_CONFIG`) from it: `path`, `encoding` (json, form, query), `auth` (bearer, basic, body, query, header), `fields` (to, from, text, reference), `fixed` constants, `toFormat` (intl, e164, local), `unicode` (the value that switches Arabic), `response.idPath` / `okPath` / `okValues` (or `idFromReference`), `dlr` (idField, statusField, statusMap, verify token or hmac or basic). Two worked shapes are in `vendors/sms-aggregator.ts` tests.
- **Twilio** (international fallback; Egypt sender-id rules apply, VERIFY): Account SID and Auth Token, a sender (number, messaging service id `MG...` or alphanumeric id).

**Environment:** `SMS_MODE=real`, `SMS_PROVIDER=aggregator|twilio`, `SMS_API_URL` (aggregator base URL; Twilio default `https://api.twilio.com`), `SMS_API_KEY` or secretRef (aggregator `user:password` or token; Twilio `<AccountSid>:<AuthToken>`), `SMS_SENDER_ID` (or per market `channels.SMS.senderId`, e.g. `Kiorex`), `SMS_WEBHOOK_SECRET` (aggregator: the DLR token or HMAC secret; Twilio: derived from the auth token), `SMS_WEBHOOK_PUBLIC_URL` (Twilio: the exact URL it signs). A secondary provider reads `SMS_<PROVIDER>_API_URL`, `_SENDER_ID`, `_WEBHOOK_SECRET`, `_WEBHOOK_PUBLIC_URL` and its key from its secretRef.

**Delivery reports (DLR):** give the aggregator `https://<api>/api/v1/messaging/webhooks/sms?token=<SMS_WEBHOOK_SECRET>` (or the HMAC header you configured); unsigned callbacks are refused with 401. Twilio: set the status callback to the Twilio URL above (signature `X-Twilio-Signature`).

**First test:** connection check (Twilio reads the account status; an aggregator has no standard ping, the check says so), then Test send to your own number. Expected: SMS arrives with the registered sender, log SENT then DELIVERED (DLR). Arabic text goes as Unicode (70 characters per segment); `smsSegments` is used by the cost guard. Failover test: temporarily break the primary key (a wrong secret) and send again: expected the secondary provider sends (`via twilio` in the log line) and a bad recipient does **not** fail over.

**Rollback:** section 0; remove the DLR URL at the aggregator.

## Email

Amazon SES v2 over HTTPS (SigV4, no SDK), `EMAIL_PROVIDER=ses`. Approval key `EMAIL`. Bounce and complaint events arrive by SNS and feed the suppression list.

**What you create (region `eu-central-1`, VERIFY):**
1. **Domain identity** `kiorex.com` in SES with **Easy DKIM** (3 CNAME records `<token>._domainkey.kiorex.com` pointing to `<token>.dkim.amazonses.com`), and a **custom MAIL FROM** domain (e.g. `mail.kiorex.com`, MX plus SPF TXT) so SPF aligns with the From domain.
2. DNS: **SPF** TXT on the sending domain and the MAIL FROM domain: `v=spf1 include:amazonses.com ~all` (one SPF record only, at most 10 lookups). **DMARC** TXT at `_dmarc.kiorex.com`: start `v=DMARC1; p=none; rua=mailto:dmarc@kiorex.com`, read the reports for 2 to 4 weeks, then `p=quarantine`, then `p=reject`. Ops > Channels > e-mail "domain check" (`POST .../email/domain-check`) reads SPF, DKIM and DMARC from DNS and says what is missing.
3. **Production access** (leave the SES sandbox; the sandbox only sends to verified addresses and 200 messages a day) and a sending-rate that suits you; Gmail and Yahoo require SPF, DKIM, DMARC alignment and one-click unsubscribe for bulk senders.
4. A **Configuration set** (e.g. `kiorex-events`) with an **SNS event destination** for Send, Delivery, Bounce, Complaint, Reject, and an SNS topic. Set `EMAIL_SES_CONFIGURATION_SET`.
5. An **IAM user** (no console access) with a policy limited to `ses:SendEmail`, `ses:GetAccount`, `ses:GetEmailIdentity` on the domain identity and configuration set; its access key id and secret go to Secrets Manager as `<ACCESS_KEY_ID>:<SECRET_ACCESS_KEY>`.

**Environment:** `EMAIL_MODE=real`, `EMAIL_PROVIDER=ses`, `EMAIL_API_URL=https://email.eu-central-1.amazonaws.com`, `EMAIL_API_KEY` or secretRef (`/kiorex/staging/ses_credentials`), `EMAIL_SENDER_ID` (`Kiorex <no-reply@kiorex.com>`, per market in config), `EMAIL_WEBHOOK_SECRET` (a long random string: the SNS basic-auth password), optional `EMAIL_SNS_VERIFY_SIGNATURE=true` and `EMAIL_SNS_TOPIC_ARNS=<topic arn>` (also verifies the AWS signature of every SNS message: recommended), config `channels.EMAIL.unsubscribe.mailto`.

**Register the events:** SNS topic > Create subscription > protocol HTTPS > endpoint = the subscription URL from ops ("Reveal" shows `https://sns:<EMAIL_WEBHOOK_SECRET>@<api>/api/v1/messaging/webhooks/email`). The platform confirms the subscription itself (only `https://sns.<region>.amazonaws.com`). SNS posts as `text/plain`; this is handled.

**Unsubscribe:** marketing mail carries `List-Unsubscribe` (mailto and https) and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`; the https link is a signed token, `POST` suppresses the address (GET only checks). A marketing e-mail without it is refused (`EMAIL_UNSUBSCRIBE_MISSING`). Transactional mail never carries it.

**First test:** Connection check (expect `sending enabled`, `production access`, `identity` verified, `DKIM` SUCCESS), domain check, Test send to your own address. Then SES **mailbox simulator** addresses (they cost nothing and never reach a person): send a test to `success@simulator.amazonses.com` (expect DELIVERED), `bounce@simulator.amazonses.com` (expect FAILED `SES_BOUNCE_PERMANENT` and a suppression row; a later send to it fails `ADDRESS_SUPPRESSED`), `complaint@simulator.amazonses.com` (expect `SES_COMPLAINT` and suppression). They need an allow-list entry for the Test send, or use `POST /admin/messaging/channels/email/test-send` with them added to `MESSAGING_TEST_ALLOWLIST`.

**Rollback:** section 0; disable the SNS subscription; the IAM key can be deactivated in one click.

## Push

FCM HTTP v1 (Android), APNs token-based `.p8` (native iOS tokens) and Expo (Expo tokens), chosen by token shape. Approval keys `PUSH_FCM`, `PUSH_APNS`, `PUSH_EXPO` (checked per token type). Always one device token per request: no topics, no conditions, no segments, no health targeting; no silent or background pushes (an empty title or body is refused); the data payload is a closed allow-list of ids and a deep link; titles and bodies are PHI-scanned by the notification layer.

**What you create:**
- **Firebase:** a project, an Android app (`com.kiorex.app` for the patient app, the staff app's own id), a **service account** with the "Firebase Cloud Messaging API Admin" role and a JSON key. `PUSH_FCM_SERVICE_ACCOUNT_JSON` (raw JSON or base64; secretRef) and optional `PUSH_FCM_PROJECT_ID`.
- **Apple:** Apple Developer account, App ID with Push Notifications, an **APNs Auth Key (.p8)** (Certificates, Identifiers & Profiles > Keys). Note **Key ID** and **Team ID**. `PUSH_APNS_KEY_P8` (PEM, base64 or `\n` escaped; secretRef `/kiorex/prod/apns_p8`), `PUSH_APNS_KEY_ID`, `PUSH_APNS_TEAM_ID`, `PUSH_APNS_BUNDLE_ID` (the topic), `PUSH_APNS_PRODUCTION=false` for TestFlight/development builds. A token is valid only for its environment: sandbox tokens fail on production with `BadDeviceToken`.
- **Expo:** `PUSH_EXPO_ENABLED=true` and, if "enhanced push security" is on, `PUSH_EXPO_ACCESS_TOKEN`.

**Environment:** `PUSH_MODE=real` plus the above. Android channel ids by family (`bookings`, `reminders`, `orders`, `default`), badge, TTL and the deep-link schemes (`kiorex`, `kiorly`) are config `push.*`.

**First test:** install the staging app on a phone, sign in with an internal account, add that account's `sub` to `MESSAGING_TEST_ALLOWLIST_SUBS`, run Connection check (FCM: OAuth token and `validate_only` request; APNs: the key signs; Expo: receipts endpoint), then Test send with the device token. Expected: the notification shows with title and body, tapping it opens `kiorex://appointment/<id>` style routes (the app also routes on `bookingId`, `orderId`, `labBookingId`). **Invalid token:** uninstall the app, send again: FCM `UNREGISTERED`, APNs `Unregistered` (410) revoke the token at once; for Expo the revoke comes from the receipts sweep (every 15 minutes, `DeviceNotRegistered`).

**Quiet hours** per market are `quietHours` in config (default follows `QUIET_HOURS_*`); urgent templates (`bypassQuiet`) ignore them by design.

**Rollback:** section 0; revoke the APNs key or the Firebase service-account key.

## Failover, quiet hours and budgets in one place

| Setting | Where | Default |
|---|---|---|
| Provider order within a channel | `channels.<CH>.providers` | the single env provider |
| Cross-channel order per class | `failoverOrder` | transactional WhatsApp, SMS, e-mail; security SMS, WhatsApp; reminder WhatsApp, SMS; marketing none |
| Retry and backoff | `channels.<CH>.retry` | 2 retries, 250 ms to 5 s with jitter |
| Rate budget | `channels.<CH>.rateBudget` | WhatsApp 40/s and 1000 new people/day, SMS 10/s, e-mail 14/s, push 200/s |
| Quiet hours | `quietHours` (global and per market) | env `QUIET_HOURS_*`; marketing uses `CONSENT_DEFAULTS` |
| Sender ids, template names | `channels.<CH>.senderId`, `whatsapp.templates` | env |

Cross-channel failover is available to callers through `MessagingHub.sendWithFailover`; the engagement queue still dispatches one channel per message row (see gaps).

## Honest gaps

- No vendor was called. Meta, SES, SNS, Twilio, aggregator, FCM, APNs and Expo behaviour is implemented from documentation (error codes, field names, limits are VERIFY items) and proven against fakes and documentation-shaped fixtures.
- The Egyptian aggregator is a configurable shape, not a tested integration with a named vendor; its sender-name registration and Arabic rules are unconfirmed.
- Cross-channel failover is implemented in the hub but the engagement dispatcher does not call it yet (one channel per row).
- The WhatsApp tier cap and rate budgets are per process; several API instances each count on their own (throttle state is shared through the database).
- APNs opens one HTTP/2 connection per push (correct, not optimised).
- Unsubscribe adds a suppression; it does not yet withdraw the patient's marketing consent record.
- Authentication (OTP) WhatsApp templates and the Clinic product's own Meta number belong to their products (Clinic notes in `clinics-management`).
