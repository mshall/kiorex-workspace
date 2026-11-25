# Kiorly Pay: the phased unified layer (status, honest)

Principle (founder, 25 Nov 2026): Kiorly provides software (orchestration, routing, reconciliation, reporting); **licensed payment partners process and settle funds; Kiorly never holds funds in the design**. Any funds-flow, licensing or settlement-account question is NEEDS_HUMAN for counsel (CBE rules): this document decides none of them.

| Phase | Asked | Delivered in this change (PAY-READY) | Not delivered |
|---|---|---|---|
| 1 One adapter contract | one shared contract for Kiorex Pay, the Clinic SaaS billing gateway interface and Clinic patient channels; Paymob (with wallets), Fawry, InstaPay, bank / IPN | Kiorex side: `pay/psp-types.ts` (`PspAdapter`: createCheckout, verifyWebhook, refund, capture, void, status, capabilities), vendor-neutral events and statuses (`common/providers/vendors/psp-event.ts`), Paymob, Fawry, InstaPay and a generic card gateway behind it, the neutral wire contract documented in `payment.mapping.ts`; wallets are Paymob payment methods (integration ids), no direct Vodafone Cash adapter | A shared PACKAGE consumed by the Clinic repository (`billing-platform/payment-gateways`, `TenantPaymentChannel`, front-desk collections): the contract is stable and typed here, but the Clinic repo has not been changed (separate repository, branch `kiorex`, founder approval needed before a push). Bank / IPN adapter: InstaPay rides the neutral contract; a bank-specific IPN file adapter waits for the bank's spec |
| 2 Reconciliation, disputes, invoice matching | settlement reconciliation, chargeback management, automated invoice matching, ops / finance pages | settlement import (CSV / JSON, per-PSP mapping), daily reconciliation, typed mismatch report and CSV, disputes (webhook, file, ops) with holds, ops pages *Reconciliation* and *Payments connection* | Automated matching of vendor receipts to **invoices** (Clinic invoices / SaaS invoices live in the Clinic; Kiorex has deposits and orders only); a finance-role-only view |
| 3 Links and QR | payment links and dynamic QR for clinic collections, home visits, invoices | Pay links exist (Kiorly registers, hosted checkout). The InstaPay / card gateway checkout URL can carry the vendor's QR page | Dynamic QR per provider (needs each vendor's QR API; config-only skeleton absent), invoice and home-visit links |
| 4 Routing | per market / provider / organisation preference, failover on outage, cost and success-rate ordering | per **market** order of preference and enable per PSP; failover when a PSP's circuit is open (tested); `PAYMENT_ROUTING=cost` ranks by configured fees (never assumed) | per-**organisation** preference (settings key is (psp, market) today), success-rate ordering |
| 5 Reporting and fraud | multi-branch / platform rollups; payment fraud (velocity, card testing, amount anomalies, repeated failures), shadow first | the card fingerprint reaches the existing referral fraud rules; dispute holds; mismatch reports | payment fraud scorer (velocity, card testing, anomalies), branch and platform rollup reports |
| POS / terminals | design note and adapter interface only | below | no vendor chosen, no code |
| B Commissions | automatic collection through the provider's chosen PSP, transparent ledger views for platform and provider (CSV / PDF, AR / EN), configurable collection mode (net-from-payout, auto-charge, invoice-and-collect), finance roles | the ledger primitives (append-only ledger, `PspSetting` per PSP and market, fee config as null-until-set) and the dispute flow already in the Clinic (CR-08) | the commission & payments ledger views, the three collection modes, per-organisation provider choice, finance-only roles in the ops console and the provider admins (Clinic / Pharmacy / Lab role matrices were not touched) |

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
