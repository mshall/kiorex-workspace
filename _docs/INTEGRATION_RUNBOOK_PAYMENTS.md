# Payments integration runbook (PAY-READY)

Audience: the founder, with sandbox credentials in hand. Everything here is exact; nothing needs a code change. The platform makes **no vendor call** until you set real mode AND the real-mode switch has been approved by a second super admin (section 3). Cards never touch Kiorex servers: every card is typed on the vendor's hosted page (PCI SAQ-A scope); Kiorex stores only a vendor reference, brand, last four digits, 3-D Secure result and an HMAC-hashed fingerprint.

Status vocabulary: **As-built** (tested here with recorded-shape fixtures and an injected fetch, no network) vs **Needs your sandbox** (cannot be proven without credentials; the first run closes it).

## 1. What is built

| Area | As-built | Needs your sandbox |
|---|---|---|
| Paymob | Intention API checkout (hosted page), HMAC-SHA512 callback verification, 3DS flag, authorise / capture / void, status inquiry, full and partial refund (pre-checked, never auto-retried), refund and void callbacks | exact capture / void endpoint shapes, test-key behaviour, whether Paymob sends any dispute notice |
| Fawry | FawryPay redirect checkout, SHA-256 callback signature, status v2, refund (pre-checked), card-token charge body for hosted fields | callback fields for partial refunds, charge signature order, refund window |
| InstaPay | the neutral gateway contract (it has no public merchant API; it is reached through the acquirer's gateway) | the acquirer's actual payload and QR / address fields |
| Card gateway | generic acquirer on the same neutral contract: authorise / capture / void / status / refund, signed webhooks with replay window, dispute events, STRONG card fingerprint | the acquirer's mapping file (`common/providers/payment.mapping.ts` is the one place to adapt) |
| Security | forged / replayed / amount-tampered callbacks refused, unsigned Paymob `merchant_order_id` never trusted, refund amounts must match, double refund and refund-during-dispute blocked | |
| Disputes | open / won / lost from a gateway webhook, a settlement-file CHARGEBACK line, or an ops entry; payout frozen, reward lots and referral decision held, lost = ledger posting | |
| Settlement | CSV / JSON import (idempotent), column mapping per PSP without a deploy, daily reconciliation with typed mismatches, CSV export, ops page | the first real export (check the mapping) |
| Corporate benefit in Pay | tender order sponsored, corporate, credit, card; refund / cancel / forfeit allocation; own ledger; reconciliation | |
| Config | enabled PSPs and order per market, fees (null until you set them), 3DS, capture mode, refund window, timeouts, retries, webhook tolerance, sandbox / live, settlement format | |

## 2. Accounts to create (you)

1. **Paymob** (accept.paymob.com): merchant account, then in the dashboard create a **card integration** (note its integration id; create a second, auth-only card integration if you want manual capture) and, if wanted, the wallet integrations (Vodafone Cash, Orange, Etisalat wallets are Paymob payment methods, no separate adapter). Copy: secret key (`egy_sk_test_...`), public key (`egy_pk_test_...`), HMAC secret (Settings > HMAC).
2. **Fawry** (merchant portal): merchant code and secure key; ask Fawry for the **staging** host and a test merchant.
3. **InstaPay** and the **card gateway**: through your acquiring bank / PSP. Ask for a sandbox base URL, an API key, a webhook signing secret, and the payload documentation. Send us the documentation: the mapping is one file.
4. Ask every vendor in writing: refund window, partial refund support, authorisation expiry, settlement report format and schedule, **whether a dispute / chargeback notification exists and its payload**, fee schedule (these become `LG-INT-PAY-3, -4, -5`).

## 3. Secrets, environment, approval

Secrets live in Secrets Manager under `/{product}/{env}/{purpose}` (OpenTofu creates empty containers; **you write the values**; never paste a value into a file, ticket or chat). The ops page *Payments connection* lists each reference and whether it is present.

| Purpose (secret reference, env `staging`) | Environment variable |
|---|---|
| `/kiorex/staging/paymob-secret-key` | `PAYMOB_SECRET_KEY` |
| `/kiorex/staging/paymob-public-key` | `PAYMOB_PUBLIC_KEY` |
| `/kiorex/staging/paymob-hmac-secret` | `PAYMOB_HMAC_SECRET` |
| `/kiorex/staging/paymob-integration-ids` | `PAYMOB_INTEGRATION_IDS` (comma list), optional `PAYMOB_AUTH_INTEGRATION_IDS` |
| `/kiorex/staging/fawry-merchant-code`, `/kiorex/staging/fawry-secure-key` | `FAWRY_MERCHANT_CODE`, `FAWRY_SECURE_KEY` |
| `/kiorex/staging/instapay-api-key`, `/kiorex/staging/instapay-webhook-secret` | `INSTAPAY_API_KEY`, `INSTAPAY_WEBHOOK_SECRET` (plus URL `INSTAPAY_API_URL`) |
| `/kiorex/staging/cardgw-api-key`, `/kiorex/staging/cardgw-webhook-secret` | `CARDGW_API_KEY`, `CARDGW_WEBHOOK_SECRET` (plus URL `CARDGW_API_URL`) |
| `/kiorex/staging/payment-fingerprint-pepper` | `PAYMENT_FINGERPRINT_PEPPER` (any long random value; without it no card fingerprint reaches the fraud signals) |

Plain variables: `PAYMENT_MODE=real`, `PAYMENT_PROVIDER=vendor`, `PAYMENT_ENABLED_PSPS=paymob,fawry,instapay,card` (order = preference), `PAYMENT_ENVIRONMENT=sandbox` (or `live`: **required explicitly in production**), `PUBLIC_BASE_URL=https://<api host>`, `WEB_BASE_URL=https://<patient web>`. Optional: `PAYMENT_ROUTING=cost` (rank PSPs by configured fee), `PAYMENT_CORPORATE_FORFEIT=reverse|keep`, `PAYMENT_ALLOW_LIVE=true` (non-production only), `PAYMENT_RECORD_FIXTURES_DIR=/tmp/rec` (non-production only).

**Real-mode approval (fail closed).** Even with every variable set, the adapter refuses to run in real mode (NEEDS_HUMAN error, no webhook accepted) until `INTEGRATION_MODES` approves `real` for that integration (`PAYMOB`, `FAWRY`, `INSTAPAY`, `CARD_GATEWAY`): ops console > Integrations Control Center > propose, then a **second** super admin approves in the config console. A dev or test stack may set `INTEGRATION_MODES_EXEMPT=true`; in production the flag is ignored and startup refuses it.

Per-PSP behaviour (3DS mode, capture mode, fees, refund window, timeouts, retries, webhook tolerance, sandbox / live, settlement column mapping) is changed through `PUT /api/v1/admin/payments/settings/:psp` (ops console API) and takes effect within seconds; every change is audited with the actor.

## 4. Webhook URLs to register

| PSP | URL | Signature |
|---|---|---|
| Paymob | `https://<api>/api/v1/pay/webhooks/paymob` | HMAC-SHA512 in the `hmac` query parameter; register as **Transaction processed callback** on each card integration |
| Fawry | `https://<api>/api/v1/pay/webhooks/fawry` | SHA-256 `messageSignature` in the body |
| InstaPay | `https://<api>/api/v1/pay/webhooks/instapay` | `X-Webhook-Timestamp` + `X-Webhook-Signature: sha256=HMAC(secret, "<ts>.<body>")`, replay window 300 s |
| Card gateway | `https://<api>/api/v1/pay/webhooks/card` | same as InstaPay |

The patient is returned to `https://<web>/pay/return?payment=<id>`; the page reads the payment status from Kiorex (never from the redirect parameters).

## 5. Check the connection (no money)

Ops > **Payments connection**: every enabled PSP shows its secret references with Present / Missing, its webhook URL, and a **signature self-test** (a canned payload is signed with your configured secret and verified through the real adapter; a forged one must fail). `Run live probe` makes one read-only authenticated call per PSP (a status inquiry for a reference that does not exist): "authenticated" is the pass.

## 6. First payment (sandbox)

1. Approve real mode (section 3), deploy / restart with the variables, open *Payments connection*: Overall must read **Ready**.
2. Set `PAYMENT_RECORD_FIXTURES_DIR` on the **staging** API for the first run: every vendor exchange is saved with credentials redacted; commit the files to `apps/api/test/fixtures/pay/` afterwards (they replace the documentation-based samples; a mismatch is a test to fix).
3. Book a visit with a deposit, open the deposit checkout, pay with the vendor sandbox instrument (see the test matrix in section 9). Expected: payment `CAPTURED`, booking deposit PAID, one ledger transaction `capture:<id>`, one `PSP_FEES` entry only if the vendor reports a fee or you configured one.
4. Repeat the vendor callback (replay): the answer is `DUPLICATE` and nothing changes.

## 7. Refund, dispute, reconciliation

* **Refund**: cancel the booking (full) or ops > refund with an amount (partial; twice to test the second). The refund settles through the vendor API; the vendor callback afterwards is a no-op. A refund that fails shows `FAILED` in reconciliation; ops > retry.
* **Dispute**: card gateway: the acquirer's dispute webhook. Paymob / Fawry: record it from the dashboard (`POST /admin/payments/:id/dispute`, state OPEN, then WON or LOST) or import the settlement file with a CHARGEBACK row. While OPEN: payout frozen, refund refused (`DISPUTE_OPEN`), reward credit and the referral decision held. LOST: the money leaves the ledger (from HELD, from the provider's payable, or `CHARGEBACK_LOSS` after payout). **Who bears a lost chargeback is a finance decision** (`LG-INT-PAY-7`).
* **Reconciliation**: ops > *Reconciliation*: import the vendor's settlement / transactions file (CSV or JSON), run reconciliation, read the mismatches, download the CSV for the vendor. The first real file may need a column mapping: `PUT /admin/payments/settings/<psp>` with `{"settings":{"settlement":{"columns":{"pspRef":"<header>","amount":"<header>","kind":"<header>","date":"<header>"},"amountUnit":"major","kindMap":{"<vendor word>":"CAPTURE"}}}}`.
* **No callback arrived**: ops > *Check pending payments* (also runs every 5 minutes in real mode); the PSP's own answer is applied through the same idempotent path.

## 8. Go-live checklist and rollback

Go-live: sandbox matrix (section 9) green; fees, refund windows, authorisation expiry and dispute process written down (`LG-INT-PAY-3..7`); `PAYMENT_ENVIRONMENT=live`, live keys in the live references (a test key in live mode is flagged by the check); `PUBLIC_BASE_URL` is https; live callback URLs registered; settlement report schedule agreed; real mode approved for the **live** record; one real small payment and refund by you; reconciliation clean the next day; `REWARD_RULES.postToPayLedger` decided by finance (H-25).

Rollback (no deploy needed): propose `mock` for the integration in the Integrations Control Center and approve it: the adapter refuses new checkouts at once; open payments settle through callbacks you can still replay from the vendor dashboard after re-approval. For one PSP only: set `enabled:false` in its settings (routing moves to the next PSP). Never delete ledger rows.

## 9. Sandbox scenario matrix

`GET /api/v1/admin/payments/test-scenarios` returns the 14 scenarios (T01 to T14: success with 3DS, decline, failed 3DS, missing callback, full and partial refund, replay, tampering, authorise-capture, authorise-void, dispute won, dispute lost, settlement import, InstaPay by reference) with the expected payment state, ledger result and ops view. Test instruments (card numbers, wallet numbers, OTPs) change and differ per vendor: take them from each vendor's sandbox documentation or dashboard at the time and write them next to the scenario here when you run it. They are deliberately not copied into the code.

## 10. Corporate benefit and the other tenders

Order: sponsored discount, then corporate benefit (a cover share of what is still payable, bounded by the account ceiling, the member cap and the per-visit maximum), then patient credit, then the card (never below one minor unit). The Clinic is told the gross deposit and the tender split (`tender.corporateBenefitMinor` is additive: contracts bump, `LG-INT-PAY-9`). A refund or cancel returns the corporate share pro rata (exactly all of it with the last refund); a forfeited deposit returns it too unless `PAYMENT_CORPORATE_FORFEIT=keep`. `postToPayLedger` is false by default; both paths are tested.
