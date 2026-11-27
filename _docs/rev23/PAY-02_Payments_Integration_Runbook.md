# PAY-02 — Payments integration runbook
Revision: Rev 2.8 · Reference Edition, 27 November 2026 (supplementary Pay volume; source `kiorex-platform/Docs/INTEGRATION_RUNBOOK_PAYMENTS.md`)

Authored in the role of Chief Software Architect. Also acting Head of Payments.

Tags: Runbook · Paymob · Fawry · InstaPay · Bank IPN · Go-live

| Field | Value |
|---|---|
| DOCUMENT | PAY-02 (03 — Technical documents, supplementary) |
| REVISION | Rev 2.8 · Reference Edition (27 Nov 2026) |
| DATE | 27 November 2026 |
| STATUS | As-built locally, mock providers, counsel-gated |
| AUDIENCE | Founder, finance, counsel, engineering |
| OWNER ROLE | Chief Software Architect |
| SUPERSEDES | The repository documents of the same name (kept as the editable source) |

## What changed in Rev 2.8

- First PDF volume for this document: the repository Markdown is now part of the numbered set.
- Adds the commission funds flow with cash, cash-transfer and online tenders, the recommended editable commission defaults and the counsel gate.

## 01 How to read this runbook

> **Warning** The platform makes no vendor call until real mode is set AND the real-mode switch is approved by a second super admin. Real-money collection and payout additionally need the counsel sign-off record, which is NOT_REVIEWED today.

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


## 11. Unified layer: bank IPN, wallets, matching, links, fraud (shadow), reports

* **Bank IPN** (`#bank-ipn`): secret `/kiorex/<env>/bank-ipn-webhook-secret` -> `BANK_IPN_WEBHOOK_SECRET` (16+ characters), `PAYMENT_ENABLED_PSPS=...,bank_ipn`, webhook `https://<api>/api/v1/pay/webhooks/bank_ipn` with `X-Webhook-Timestamp` and `X-Webhook-Signature: sha256=HMAC(secret, "<ts>.<body>")`; or upload the daily file in ops > *Pay matching and risk* (`POST /admin/payments/matching/ipn`, CSV / JSON). Layout override: `BANK_IPN_CONFIG_JSON` (columns, `amountUnit`, status words, signature). Real mode needs `BANK_IPN` approved in `INTEGRATION_MODES`.
* **Wallets**: `PAYMOB_WALLET_INTEGRATION_IDS=vodafone_cash:<id>`; a checkout with `rail: wallet` uses that integration id; without it the checkout is refused with NEEDS_HUMAN.
* **Matching**: exact reference + amount applies automatically; everything else is in the queue for `finance` / `super_admin` (confirm needs the payment id; the payment's amount and currency checks still apply). Tune with config kind `PAY_MATCHING_POLICY` (floors enforced).
* **Links**: `POST /admin/payments/links` (context, subject, org, amount, ttl 60 s to 7 days); needs `PAY_LINK_SECRET` (32+ characters, required in production). The payer opens `/pay/l/<token>`; checkout consumes the link atomically.
* **Organisation preference**: `PUT /admin/payments/organisations/<id>/provider-preference` `{ "preference": { "order": ["fawry","paymob"], "blocked": ["card"] } }`; ordering strategy in `PAY_ROUTING_POLICY`.
* **Fraud (shadow)**: nothing to switch on; scores appear in the queue. `PAY_FRAUD_THRESHOLDS` (maker-checker) tunes inside safety bounds; `FLAG` only adds items to the review queue.
* **Reports**: `GET /admin/payments/reports/rollup?level=organisation|psp|day|platform&format=json|csv|pdf&lang=en|ar` (finance). Branch rollups: Clinic `GET /billing/pay/reports/rollup`.


## Commission collection (COM-1)

Principle: Kiorex collects the commission it is owed through the provider each organisation chose; Kiorly never holds funds. Counsel decides the funds flow (`LG-COM-3`).

**Data flow.** The Clinic stays the system of record for the charge and the decision. It reports `COMMISSION_CHARGE_CREATED`, `COMMISSION_CHARGE_REVERSED` and (additive) `COMMISSION_CHARGE_STATUS_CHANGED` (confirmed, disputed, waived; with `tenantId`, `clinicId`, `decisionAmount`, `disputeDeadline`, `disputeStatus`, fee-basis fields). Kiorex mirrors each as a `CommissionClaim` (idempotent, time-ordered). A **run** (`CommissionRun`, unique per organisation and period, idempotency key `com:<org>:<cutoff>`) takes the CONFIRMED, undisputed, past-dispute-window, uncollected claims up to the cut-off; older uncollected claims carry over (never lost). Each step is a `CommissionAttempt` (idempotent key) and an append-only `CommissionTimeline` row (database trigger forbids update and delete). Run state is pushed to the product (`POST /commission-collections`, HMAC, outbox) so the provider sees the same figures.

**Modes** (per market default, per organisation override, both maker-checker: proposer and approver differ, enforced in code and by a database CHECK):
- `NET_FROM_PAYOUT`: the run waits; each weekly payout run keeps commission out of the cash (Pay's payout transaction calls the netting port; `Payout.amountMinor` is the cash, `commissionDeductedMinor` the commission, gross = both; ledger `PAYABLE:<clinic>` to `COMMISSION_FEES`). When the payout window (last retry day) ends with a shortfall the rest becomes an invoice (`NET_SHORTFALL`).
- `AUTO_CHARGE_SAVED_METHOD`: one idempotent charge through the saved token of the organisation's chosen provider. A retryable decline retries on the configured days; a hard decline, no provider, no saved method or an unapproved real rail falls back to an invoice at once. Ledger `PSP_CLEARING` to `COMMISSION_FEES`.
- `INVOICE_AND_COLLECT`: an invoice (`KXC-<cutoff>-<org>`) with a due date; payment is recorded by finance (`POST /admin/commissions/runs/:id/invoice-paid`, idempotent on the provider reference; partial payments allowed). Automatic matching of provider receipts to these invoices belongs to the unified Pay layer lane (not built here).

**Safety.** No pause of listing, booking, plan or care exists in this module (a unit test scans the sources). Failure ends as an open invoice that ages on the console. Mock collector is the default (`token` prefix `fail_retry`, `fail_once`, `fail_hard` drive outcomes); real mode uses `common/providers/mode-guard.ts` per provider key and the vendor API is not wired (`LG-COM-4`).

**Reconciliation** (`GET /admin/commissions/reconciliation`, and per run in the drill-down): charged = decision amount; run claims = collected + deducted + invoiced; each total = its succeeded attempts; payout cash + deduction = released deposits; reversals after collection (`CREDIT_DUE`). Runs with findings are shown in the console; CSV export per view.

**Console and API.** Ops console "Commissions" (ledger, collections, payout deductions, aging, disputes, reconciliation, organisations, configuration); API `/api/v1/admin/commissions/*`. Roles: `super_admin` and `finance` read, export (audited in `CommissionExportAudit` and `AuditLog`) and operate; only `super_admin` proposes or approves configuration and chooses a provider; `ops_admin` alone sees no money.

**Commission rates (COM-2, founder decision 25 Nov 2026): rates are set by default per organisation type and can be overridden per organisation by the super admin.**
- *Where.* Ops console > Commissions > **Rates** (default per type: Clinics, Pharmacies, Labs) and, with an organisation selected, the **rate panel** (default and override side by side, the effective rate, "use the default" / "set a custom rate", history). API: `GET /admin/commissions/rates/defaults`, `POST /admin/commissions/rates/defaults`, `GET /admin/commissions/rates/orgs/:orgRef`, `POST /admin/commissions/rates/orgs/:orgRef` (kind `RATE` or `INHERIT`, `reason` required), `POST /admin/commissions/rates/:id/decide`, `POST /admin/commissions/rates/resync`.
- *Rule.* A rate row is `PERCENT` (basis points of the fee basis) or `FLAT` (minor units per charge), with optional `minMinor` / `maxMinor` and an optional collection `mode`. Proposals and decisions are maker-checker (the database CHECK repeats it), append-only (a trigger refuses update and delete of decided rows), effective-dated (never in the past; an approval after the start moves the start to the approval time and keeps what was asked in `requestedFrom`) and audited (`commission.rate_proposed|approved|rejected`). The newest active row whose start has passed decides; an organisation row of kind `INHERIT` hands back to the default. **No number is shipped**: no default and no override = `NOT_SET`, no commission is charged, every screen says "Rate not set".
- *Inherit on creation.* An organisation is linked to its type default the first time it is seen (a claim, a pharmacy order, a lab booking, an override) in `CommissionOrgRateLink`, which records the default version it inherited; the inheritance stays live afterwards.
- *Past charges keep their rate.* `CommissionClaim.rateSource|ratePolicyId|rateSnapshot` (Clinic charges) and `PharmacyOrder|LabBooking.rateSnapshot` are written once at creation and never rewritten; a rate change only affects later charges.
- *Mode.* When the effective rate names a collection mode it wins over the market and organisation collection settings (COM-1); with none, the settings decide.
- *Provider side (read only).* After every approval the organisation's view (`CommissionRateView`: default and own rows with start, reason and spec, a monotonic version, no actor identity) is queued on the outbox and posted to its product: Clinic `POST /marketplace/v1/commission-rates`, Pharmacy `POST /marketplace/v1/commission-rates`, Lab `POST /api/v1/integration/v1/commission-rates` (signed, idempotent, newest version wins). `POST /admin/commissions/rates/resync` re-sends every linked organisation. Admin and finance roles of the organisation see the effective rate, the default, whether an override applies and the history; they cannot change it.
- *Clinic charge pricing.* The Clinic prices a charge at check-in from the view Kiorex pushed (when a rate is in force; otherwise its market rate table). Kiorex stores the rate in force at the time the claim is reported (`rateSnapshot`, with `expectedMinor` when the fee basis is known); the claim amount is what the Clinic charged.
- *Pharmacy and Lab.* The fee kept at order release uses the rate snapshotted when the order was created (percent of fulfilled goods or tests, or flat; floor and cap); with no rate set the legacy `PHARMACY_TAKE_RATE_BPS` / `LAB_TAKE_RATE_BPS` apply (0 while unset). The organisation reference for them is the partner registration id.
- *Roles.* `super_admin` proposes and decides (never the same person on one change); `finance` reads; `ops_admin` sees no money.

**Commission policy and counsel gate (COM-3, 26 Nov 2026).**
- *Where.* Ops console > **Commission policy** (`/commission-policy`): counsel sign-off per market, disclosure texts (AR and EN), the status of every real-money gate with its reason, history, and the settlement statement of one organisation. API `/api/v1/admin/commissions/policy/*` and `/settlement-statement/:orgRef` (CSV export).
- *Gate.* In REAL mode (`PAYMENT_MODE=real`) a collection mode or a payout / settlement route runs only when the market's counsel record is APPROVED or APPROVED_WITH_CONDITIONS and lists it. Default NOT_REVIEWED: blocked (`COUNSEL_BLOCKED` on the run, deposits held back with reason on the payout run). Mock is always allowed. A real payout route needs this record in addition to the vendor go-live items (`LG-INT-PAY-3..7`). **A human records the sign-off after counsel's review; nobody sets it APPROVED on counsel's behalf and the code ships no sign-off.**
- *Disclosure.* Texts are typed by the super admin or counsel; empty = "wording not set". The override reason is shown to the organisation only when `showOverrideReason` is true.
- *Cash visits and settlement (founder direction, business policy, not legal clearance).* Kiorex pays providers in Egypt by bank transfer to the provider bank account only and never holds or pays out cash. Commission on cash-paid visits is accrued (claim `tender` CASH), visible to both sides and netted in the next settlement or invoiced. The settlement statement shows online collections, cash-visit commission accrued and netted, deductions (commission, refunds, chargebacks; fees apply to Pharmacy and Lab only), net payable, payout bank reference and reconciliation status (matched, unmatched, disputed).

- *Partner statement route (LG-COM-19, 26 Nov 2026).* The Clinic, Pharmacy and Lab read their own settlement statement from `GET /api/v1/partner/commissions/settlement-statement?from&to` and `/export` (CSV), signed with the partner request HMAC (`X-Kiorly-Client-Key`, `-Timestamp` within 5 minutes, one-time `-Nonce`, `-Signature` over method, path without query and body hash). Pharmacy and Lab: client key and webhook secret of their registration (`/admin/partners`), organisation = the registration id. Clinic: the shared Clinic client key and webhook secret (`KIORLY_CLIENT_KEY`, `KIORLY_WEBHOOK_SECRET`), organisation = tenant id in `X-Kiorly-Org-Ref`. A partner can read only its own organisation: another `X-Kiorly-Org-Ref` or `orgRef` is 403 `PARTNER_ORG_MISMATCH` (audited as `commission.partner_statement_denied`); unsigned, unknown key, wrong secret, stale or replayed request is 401. Same figures and CSV as the ops route (`CommissionSettlementService`); nothing about counsel, reviewers, documents, conditions, notes or who proposed or approved a rate. Rate limit per organisation (`COMMISSION_STATEMENT_RATE_PER_MIN`, default 30) and per IP before authentication (`COMMISSION_STATEMENT_RATE_IP_PER_MIN`, default 120), 429 `PARTNER_RATE_LIMITED` with `Retry-After`. Reads and exports are audited (`commission.partner_statement_read` / `_export`, actor `partner:<client key>`). Check: Clinic API `KIOREX_STATEMENT_MODE=real` (Pharmacy, Lab `KIOREX_MODE=real`) with `KIOREX_API_BASE_URL` at the platform, then compare its statement with Ops > Commission policy > settlement statement of the same organisation; they must match.

**Go-live checklist.** `LG-COM-1..15` answered; market and organisation settings approved; provider choice per organisation; saved-method enrolment through the provider's hosted flow; real mode approved per provider; sandbox run with a real provider token; first live run watched by finance; reconciliation empty.


## 12 Rev 2.8 additions: tenders, defaults and the statement (27 Nov 2026)

- **Tender kinds.** ONLINE, CASH and CASH_TRANSFER (bank transfer, InstaPay or card terminal paid directly to the clinic). Payouts stay bank transfer only; cash and cash-transfer visits are accrued and netted at settlement.
- **Defaults.** Recommended percent rates with floor and cap ship as editable seeded defaults; change them in Ops, Commissions, Rates (a second super admin approves).
- **Statement.** The signed partner statement route serves each organisation its own settlement statement; credentials are per organisation and the query string can be signed.
- **Gate.** Counsel sign-off NOT_REVIEWED keeps every real-money mode blocked.

<!-- kx-diagram: funds-flow-tenders -->
