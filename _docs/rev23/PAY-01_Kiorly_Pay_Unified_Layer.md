# PAY-01 — Kiorly Pay: the phased unified layer
Revision: Rev 2.8 · Reference Edition, 27 November 2026 (supplementary Pay volume; source `kiorex-platform/Docs/PAYMENTS_UNIFIED_LAYER.md`)

Authored in the role of Chief Software Architect. Also acting Head of Payments.

Tags: Kiorly Pay · PSP adapters · Reconciliation · Commissions · Funds flow

| Field | Value |
|---|---|
| DOCUMENT | PAY-01 (03 — Technical documents, supplementary) |
| REVISION | Rev 2.8 · Reference Edition (27 Nov 2026) |
| DATE | 27 November 2026 |
| STATUS | As-built locally, mock providers, counsel-gated |
| AUDIENCE | Founder, finance, counsel, engineering |
| OWNER ROLE | Chief Software Architect |
| SUPERSEDES | The repository documents of the same name (kept as the editable source) |

## What changed in Rev 2.8

- First PDF volume for this document: the repository Markdown is now part of the numbered set.
- Adds the commission funds flow with cash, cash-transfer and online tenders, the recommended editable commission defaults and the counsel gate.

## 01 Status and principle

> **Status** Deployment, 27 Nov 2026. Only Kiorly Clinic is deployed (AWS, kx-test). The Pay layer, the commission engine and every payment adapter run locally with mock providers; no payment vendor has ever been called.

Principle (founder, 25 Nov 2026): Kiorly provides software (orchestration, routing, reconciliation, reporting); **licensed payment partners process and settle funds; Kiorly never holds funds in the design**. Any funds-flow, licensing or settlement-account question is NEEDS_HUMAN for counsel (CBE rules): this document decides none of them.

| Phase | Asked | Delivered in this change (PAY-READY) | Not delivered |
|---|---|---|---|
| Phase 1: One adapter contract | one shared contract for Kiorex Pay, the Clinic SaaS billing gateway interface and Clinic patient channels; Paymob (with wallets), Fawry, InstaPay, bank / IPN | **Shared package `@kiorex/pay-contract` 0.1.0** (repo `kiorex-pay-contract`, pure TypeScript, no network): neutral adapter, event, status and capability types (wire-compatible with `PspEvent`), bank / IPN adapter (signed webhook with replay window, CSV / JSON file ingest, reversals, dedupe, masked payer), config-only wallet skeleton on Paymob wallet methods (`PAYMOB_WALLET_INTEGRATION_IDS`, no direct Vodafone Cash adapter). **Vendored tarball** in both repos (`vendor/kiorex-pay-contract-0.1.0.tgz`, `file:` dependency, nothing published to any registry, same recipe as `@kiorex/contracts`). Kiorex: `bank_ipn` is a PSP (own integration key `BANK_IPN`, real-mode guard, settings, connection check, webhook `/pay/webhooks/bank_ipn`), Paymob honours `rail: wallet`. Clinic: every SaaS billing gateway is available as a contract adapter (`PaymentGatewayRegistry.getPayAdapter`), front-desk collections are prepared through the contract (`POST /billing/pay/collections/prepare`: rail, reference, tenant channel instructions) | The bank's real IPN layout and signature (the neutral layout is the default; `BANK_IPN_CONFIG_JSON` / `CLINIC_BANK_IPN_CONFIG_JSON` override it; **NEEDS_HUMAN LG-INT-PAY-14**); wallet integration ids (created at Paymob by the founder); the Clinic's `TenantPaymentChannel` stays the tenant's own manual channel (no schema change) |
| Phase 2: Reconciliation, disputes, invoice matching | settlement reconciliation, chargeback management, automated invoice matching, ops / finance pages | previous items plus **automated matching**: IPN rows are matched to Kiorex payments (`PayMatchSignal`) and to Clinic invoices (`ClinicPayMatch`) with a confidence score; AUTO only when reference AND remaining amount are exact and the runner-up is clearly behind (floors: confidence >= 0.9, margin >= 0.1, config kind `PAY_MATCHING_POLICY`), otherwise a **finance-role-only review queue** (Kiorex: `finance`, `super_admin`; Clinic: `FINANCE_OFFICER`, `GROUP_ADMIN`, `PLATFORM_SUPER_ADMIN`); confirm still passes the payment's own amount / currency checks, reversals never auto-apply, re-uploads change nothing, tenant isolated. Ops page *Pay matching and risk* (AR / EN, axe) | Matching of vendor **settlement lines** to invoices (the exact settlement reconciliation exists; the fuzzy queue is IPN only); receipts as a match source (the contract supports `RECEIPT`, no ingest endpoint yet); Clinic web screens (API only) |
| Phase 3: Links and QR | payment links and dynamic QR for clinic collections, home visits, invoices | signed (HMAC), **expiring (60 s to 7 days), amount-locked, single-use** links: Kiorex `POST /admin/payments/links` + public `/pay/l/:token` (atomic single use, concurrency tested, a failed checkout gives the link back); Clinic `POST /billing/pay/links` for invoices, home visits and front desk (consumed by the first payment of exactly the locked amount, cancel, expiry, public payer view). QR plan: `PROVIDER` only when an adapter says it supports a vendor QR, otherwise `LINK` (QR encodes our hosted link, never presented as a bank-app QR) | **No vendor QR adapter** (InstaPay / wallet QR need each vendor's QR API: config-only, capability `qr: PROVIDER` is false everywhere); QR image rendering is the web's job (`qrcode` is already a Clinic and web dependency); patient web / app pay-link screens |
| Phase 4: Routing | per market / provider / organisation preference, failover on outage, cost and success-rate ordering | previous items plus **per-organisation preference** (`PUT /admin/payments/organisations/:id/provider-preference`, ordered + blocked list, audited) and **success-rate-aware ordering** (Wilson lower bound over 30 days, `PAY_ROUTING_POLICY`: strategy `preference` / `success` / `cost`, floors on sample size); an organisation pin survives a mild dip and loses only below 50% lower-bound success; unset fees are never ranked cheap | Fee **values** (NEEDS_HUMAN LG-INT-PAY-3); wiring `orderedCandidates` into every deposit checkout (today the unified link checkout uses it; the booking deposit path still uses `PspConfigService.candidates`) |
| Phase 5: Reporting and fraud | multi-branch / platform rollups; payment fraud (velocity, card testing, amount anomalies, repeated failures), shadow first | previous items plus the **payment fraud scorer in SHADOW mode** (velocity, card testing, amount anomaly vs account median, repeated failures, fingerprint reuse across accounts) on every capture / failure, `PayFraudAssessment` review queue (support / super admin decide, finance reads), **no enforcement mode exists** (modes `SHADOW` / `FLAG` only, no ban, no block), thresholds in maker-checker kind `PAY_FRAUD_THRESHOLDS` clamped to safety bounds (at most one rule off). Rollups: Kiorex platform / organisation / provider / day (finance only, json, CSV with BOM, PDF), Clinic branch / organisation (json, CSV, Arabic and English PDF) | Arabic PDF on the Kiorex side (no Arabic font there; the Clinic has one: the Kiorex PDF is Latin only, CSV carries Arabic); Clinic payment fraud scorer (Kiorex payments only); Playwright run of the new ops page (component tests + axe only) |
| POS / terminals | design note and adapter interface only | below | no vendor chosen, no code |
| B Commissions | automatic collection through the provider's chosen PSP, transparent ledger views for platform and provider (CSV / PDF, AR / EN), configurable collection mode, finance roles | **COM-1 (branch `com-collect`)**: claim ledger mirrored from the Clinic, three modes (net-from-payout, saved-method charge, invoice) per market and per organisation with maker-checker config, per-organisation provider choice, idempotent runs, dunning with invoice fallback, reconciliation, audited CSV exports, ops console page *Commissions* (finance and super admin), Clinic page Admin > Billing > Kiorex commissions (finance-only by default, CSV, bilingual PDF). See `INTEGRATION_RUNBOOK_PAYMENTS.md` "Commission collection (COM-1)" and `LG-COM-1..10` | real saved-method charging through each provider (fails closed), automatic invoice matching (this lane), Pharmacy and Lab pages, staff-app cards, platform PDF statements, Playwright 320-2560 |

## POS / card terminal design note (no vendor chosen)

A terminal is a **payment channel**, not a PSP: the cardholder taps on certified hardware, the card never touches Kiorly (SAQ-A / P2PE stays with the terminal vendor). The interface a vendor must fit:

```ts
interface TerminalAdapter {
  name: string;
  /** Start a sale on a paired terminal; returns a reference and waits for the terminal's signed result (webhook or poll). */
  startSale(i: { terminalId: string; reference: string; amountMinor: number; currency: string }): Promise<{ pspRef: string }>;
  cancelSale(i: { pspRef: string }): Promise<void>;
  /** Same neutral event the PSP adapters produce (payment.captured / failed / refund.settled / dispute.*). */
  verifyWebhook(raw: string, headers: Record<string, unknown>): PspEvent | null;
  refund(i: { pspRef: string; refundId: string; amountMinor: number }): Promise<{ pspRefundRef: string }>;
  status(i: { pspRef: string }): Promise<PspStatus>;
}
```
Everything after the event (ledger, idempotency, disputes, settlement import) is the code that exists. Open for counsel and finance: merchant of record, terminal ownership, settlement account, receipts.


## Kiorly Pay unified layer: what was built after PAY-READY (LG-INT-PAY-14..19)

* Package: `kiorex-pay-contract` (git repo beside `kiorex-contracts`), `npm test` (34 tests: IPN, wallet, matching incl. property tests, links, routing, fraud incl. property tests, rollups). Release: `npm run pack:local`, then `scripts/vendor-into.sh <consumer> <package.json> <relative vendor path>` in each consumer; commit `vendor/`, `package.json`, lockfile together.
* Kiorex: migration `20270302090000_pay_unified_layer` (4 tables, no money, no card data); config kinds `PAY_FRAUD_THRESHOLDS`, `PAY_MATCHING_POLICY`, `PAY_ROUTING_POLICY` and `BANK_IPN` in `INTEGRATION_MODES`; tests `pay-unified.unit.spec.ts`, `test/pay-unified.int.spec.ts` (private database per run); ops page `/pay-ops`.
* Clinic (branch `kiorex`, local only): migration `20270303090000_pay_unified_collections`; `billing/pay/*`; tests `pay-collections.node.test.ts`, `pay-collections.integration.test.ts`.
* Everything uses the real-mode guard: the bank IPN PSP is `BANK_IPN` in `INTEGRATION_MODES`; links, matching and reports make no vendor call at all.
* Open for humans: LG-INT-PAY-14 (bank IPN spec, account and beneficiary label), -15 (wallet integration ids), -16 (QR vendor APIs), -17 (fraud thresholds calibration and who reviews), -18 (matching thresholds and who may confirm), -19 (funds-flow / licensing review of the whole layer: counsel, CBE). Commission ledger views, collection modes and finance roles belong to the commission lane and were not touched.


## Rev 2.8: commission funds flow with cash, cash transfer and online tenders

<!-- kx-diagram: pay-unified -->

<!-- kx-diagram: funds-flow-tenders -->

| Tender | Accrual | Collection |
|---|---|---|
| ONLINE | held in the Kiorex Pay ledger, payable after the visit | deducted from the bank payout |
| CASH | accrued from the claim | netted in the next payout, or invoiced |
| CASH_TRANSFER (bank, InstaPay, card terminal at the clinic) | own kind, accrued | same netting; own configurable treatment |

> **Decision** Payouts in Egypt are by bank transfer to the provider's bank account only; cash visits are included by accruing commission and netting it in settlement. Kiorex never holds or pays out cash (founder direction 26 Nov 2026; business policy, not legal clearance).

> **Warning** Recommended default commission values ship as editable seeded defaults (Clinic 3 %, Pharmacy 2 %, Lab 3 %, each with a floor and a cap; see KX-12). They are not legal or pricing advice. Counsel sign-off per market is NOT_REVIEWED, so every real-money collection mode and payout route stays blocked while mock runs.

> **Needs human** Counsel and CBE funds-flow review of the whole layer (LG-INT-PAY-19, LG-COM-18); the bank IPN real layout; vendor sandbox credentials; saved-method charging (LG-COM-4).
