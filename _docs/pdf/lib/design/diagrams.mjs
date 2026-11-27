// Kiorex document design system: diagram library. Every diagram is derived from the current documents and runbooks
// (KX-09, KX-24, KX-28, KX-30, KX-33, Docs/PAYMENTS_UNIFIED_LAYER.md, the payments and messaging runbooks, SUB-01, COM-1).
// Use from Markdown with:  <!-- kx-diagram: money-flow -->
import { Dia, COL, esc } from './svg.mjs';

const W = 760;
const reg = {};
const def = (name, title, caption, build) => { reg[name] = { title, caption, build }; };

/* ------------------------------------------------------------------ 1. system context */
def('system-context', 'Ecosystem context', 'Two brands, five products and the outside services they use. Products never share a database or import each other’s code: they talk over HMAC REST commands and outbox webhooks (KX-09). Every external service runs mock by default.', () => {
  const d = new Dia(W, 540, 'System context of Kiorex and Kiorly');
  // people row
  d.lane(14, 10, 732, 82, 'People');
  d.box(30, 36, 210, 44, { t: 'Patients', s: 'web, iOS, Android', tone: 'indigo' });
  d.box(275, 36, 210, 44, { t: 'Providers and staff', s: 'Kiorly web and the Kiorly app', tone: 'ocean' });
  d.box(520, 36, 210, 44, { t: 'Kiorex operations', s: 'ops console, super admin, flags', tone: 'indigo' });
  // product groups
  d.lane(14, 112, 352, 250, 'Kiorex (patients and marketplace)', { tone: 'indigo' });
  d.box(30, 138, 158, 54, { t: 'Marketplace and booking', s: 'search, holds, reviews', tone: 'indigo' });
  d.box(196, 138, 158, 54, { t: 'Kiorex Passport', s: 'OIDC identity, phone OTP', tone: 'indigo' });
  d.box(30, 202, 158, 54, { t: 'Kiorex Pay', s: 'deposits, held ledger, payouts', tone: 'indigo' });
  d.box(196, 202, 158, 54, { t: 'Growth engine', s: 'attribution, referral, SEO', tone: 'indigo' });
  d.box(30, 266, 158, 54, { t: 'Notification layer', s: '@kiorex/contracts/notify', tone: 'indigo' });
  d.box(196, 266, 158, 54, { t: 'Ops console', s: 'flags, finance, Growth', tone: 'indigo' });
  d.text(190, 342, 'kiorex-platform · kiorex-account', { size: 9, fill: COL.n600, anchor: 'middle' });
  d.lane(394, 112, 352, 250, 'Kiorly (provider SaaS by Kiorex)', { tone: 'ocean' });
  d.box(410, 138, 158, 54, { t: 'Kiorly Clinic', s: 'appointments; Nurse is an edition', tone: 'ocean', ss: 9.4 });
  d.box(576, 138, 154, 54, { t: 'Kiorly Pharmacy', s: 'each works without Kiorex', tone: 'ocean' });
  d.box(410, 202, 158, 54, { t: 'Kiorly Lab', s: 'orders, results, subscription', tone: 'ocean' });
  d.box(576, 202, 154, 54, { t: 'Kiorly (staff app)', s: 'Clinic, Nurse, Pharmacy, Lab modules', tone: 'ocean', ss: 9.4 });
  d.box(410, 266, 320, 54, { t: 'Kiorly billing and commission collection', s: 'subscription, auto-renew, dunning, Lite; Kiorex fee decisions', tone: 'ocean' });
  d.text(570, 342, 'clinics-management · kiorly-pharmacy · kiorly-lab · kiorly', { size: 9, fill: COL.n600, anchor: 'middle' });
  // contract band
  d.box(14, 376, 732, 40, { tone: 'dark', t: 'kiorex-contracts  +  kiorex-pay-contract', s: 'OpenAPI and event JSON Schemas, signed HMAC commands, outbox webhooks (at-least-once, idempotent), vendored tarballs', align: 'center', ts: 11.5, ss: 9.6 });
  d.arrow([[190, 354], [190, 376]], { tone: 'indigo', both: true });
  d.arrow([[570, 354], [570, 376]], { tone: 'ocean', both: true });
  d.arrow([[135, 92], [135, 112]], { tone: 'indigo' });
  d.arrow([[380, 92], [380, 112]], { tone: 'ocean' });
  d.arrow([[625, 92], [625, 112]], { tone: 'indigo' });
  // external
  d.lane(14, 430, 732, 100, 'External services (mock by default, real only after approval)');
  d.box(30, 458, 170, 56, { t: 'Payment partners', s: 'Paymob, Fawry, InstaPay, bank IPN', tone: 'neutral', ss: 9.6 });
  d.box(214, 458, 170, 56, { t: 'Messaging vendors', s: 'WhatsApp (Meta), SMS, e-mail, push', tone: 'neutral', ss: 9.6 });
  d.box(398, 458, 170, 56, { t: 'AI providers', s: 'behind the AI gateway, launch-locked', tone: 'neutral', ss: 9.6 });
  d.box(582, 458, 150, 56, { t: 'AWS', s: 'SES, S3, KMS, maps', tone: 'neutral', ss: 9.6 });
  return d;
});

/* ------------------------------------------------------------------ 2. repository map */
def('repo-map', 'Repository map and contract distribution', 'Each product is its own repository and deployable. Shared contracts are published as versioned tarballs and vendored into each consumer, so a consumer builds without a network dependency on the producer (FD-20).', () => {
  const d = new Dia(W, 450, 'Repository map');
  d.box(14, 14, 360, 70, { tone: 'dark', t: 'kiorex-contracts', s: 'OpenAPI, event schemas, flag catalogue, TypeScript SDK, contract tests. Published as @kiorex/contracts', ts: 12.5, ss: 9.6 });
  d.box(386, 14, 360, 70, { tone: 'dark', t: 'kiorex-pay-contract', s: 'Neutral Pay adapter, event and status types, IPN, matching, links, routing, fraud. @kiorex/pay-contract 0.1.0', ts: 12.5, ss: 9.6 });
  d.line(194, 84, 194, 104, { stroke: COL.indigo, w: 1.8 }); d.line(566, 84, 566, 104, { stroke: COL.indigo, w: 1.8 });
  d.line(100, 104, 660, 104, { stroke: COL.indigo, w: 1.8 });
  d.chip(380, 104, 'vendored tarball in each consumer (contracts everywhere; Pay contract in Kiorex and Clinic)', { stroke: COL.indigo, size: 9.2 });
  const cons = [['kiorex-platform', 'Kiorex API, patient web, Expo app, ops console, Kiorex Pay, AI gateway', 'indigo', '+ pay-contract'], ['clinics-management', 'Kiorly Clinic (+ Nurse edition), branch kiorex. HMAC marketplace API and outbox', 'ocean', '+ pay-contract'], ['kiorly-pharmacy', 'Kiorly Pharmacy: subscription built, rest scaffold until its milestone', 'ocean'], ['kiorly-lab', 'Kiorly Lab: subscription built, rest scaffold until its milestone', 'ocean']];
  cons.forEach((c, i) => { const x = 14 + i * 184; d.arrow([[x + 86, 104], [x + 86, 132]], { tone: 'indigo' }); d.box(x, 132, 172, 92, { t: c[0], s: c[1], tone: c[2], ss: 9.2, bar: true }); if (c[3]) d.tag(x + 164, 125, c[3], { tone: 'dark', anchor: 'end', size: 8 }); });
  d.lane(14, 246, 732, 112, 'Other directories (not contract consumers)', { dash: true });
  const oth = [['kiorex-account', 'Kiorex Passport: IdP config as code, dev OIDC provider, OTP, back-channel logout'], ['kiorly', 'The Kiorly staff app (Expo); backends are /mobile/* in the three product APIs'], ['e2e', 'Cross-product suites on a private stack (Playwright, vitest)'], ['_docs and _brand', 'Reference set, PDF toolchain, runbooks; logo system v2 (Kiorly marks byte-identical)']];
  oth.forEach((c, i) => d.box(30 + i * 178, 276, 166, 70, { t: c[0], s: c[1], tone: 'neutral', ss: 8.8, ts: 11 }));
  d.box(14, 378, 732, 56, { tone: 'ground', t: 'Rules', s: 'No shared database. No source imports between products. Clinic is the only system of record for appointments and keeps working when Kiorex fails.', ss: 9.8, dash: true });
  return d;
});

/* ------------------------------------------------------------------ 3. money flow */
def('money-flow', 'Money flow: patient, payment partner, provider', 'Funds move through licensed payment partners. Kiorex Pay is software and a ledger of records: it orchestrates, routes and reconciles. Kiorly never holds funds in the design. The funds-flow, licensing and settlement-account questions are for counsel and are open (NEEDS_HUMAN).', () => {
  const d = new Dia(W, 524, 'Money flow');
  d.box(14, 12, 732, 66, { tone: 'dark', t: 'Kiorly provides software. Licensed payment partners process and settle funds.', s: 'Orchestration, routing, reconciliation and reporting only. Kiorly never holds funds in the design.', ts: 13, ss: 10.4, align: 'center' });
  d.tag(738, 4, 'NEEDS_HUMAN: funds flow and licensing, counsel (CBE)', { tone: 'warn', anchor: 'end', solid: false });
  d.box(14, 100, 170, 84, { t: 'Patient', s: 'Books on Kiorex and pays the deposit or prepayment: card, wallet or bank', tone: 'indigo', ss: 9.6 });
  d.box(250, 100, 170, 84, { t: 'Payment partner (PSP)', s: 'Paymob, Fawry, InstaPay, bank. Captures, holds and settles the funds', tone: 'neutral', ss: 9.6 });
  d.box(586, 100, 160, 84, { t: 'Provider', s: 'Clinic, doctor, physio, nurse agency, lab, pharmacy', tone: 'ocean', ss: 9.6 });
  d.arrow([[184, 142], [250, 142]], { tone: 'indigo', label: '1 pays', lx: 217, ly: 124 });
  d.arrow([[420, 142], [586, 142]], { tone: 'ocean', label: '5 payout after the visit', lx: 503, ly: 124 });
  d.box(440, 214, 126, 62, { t: 'Kiorex fee', s: 'flat per attended new patient', tone: 'coral', ss: 9.4 });
  d.line(503, 142, 503, 214, { stroke: COL.coral, w: 2, dash: true });
  d.text(503, 296, 'netted from the payout, or charged, or invoiced', { size: 9, fill: COL.n600, anchor: 'middle' });
  d.box(250, 306, 170, 84, { t: 'Kiorex Pay ledger', s: 'records only: HELD until the visit completes, then PAYABLE. Append-only, idempotent', tone: 'indigo', ss: 9.4 });
  d.box(586, 306, 160, 84, { t: 'Kiorly Clinic', s: 'system of record: check-in and completion events', tone: 'ocean', ss: 9.6 });
  d.box(14, 306, 170, 84, { t: 'Refund or credit', s: 'Original method by default; credit only if the patient chooses it', tone: 'indigo', ss: 9.4 });
  d.arrow([[300, 184], [300, 306]], { tone: 'indigo', label: '2 captured', lx: 300, ly: 245 });
  d.arrow([[372, 306], [372, 184]], { tone: 'ocean', label: '4 release', lx: 372, ly: 215 });
  d.arrow([[586, 348], [420, 348]], { tone: 'ocean', label: '3 visit completed', lx: 503, ly: 330 });
  d.arrow([[250, 348], [184, 348]], { tone: 'grey', dash: true, label: 'refund', lx: 217, ly: 330 });
  d.lane(14, 414, 732, 98, 'Three ledgers, never commingled', { dash: true });
  d.box(30, 440, 220, 60, { t: 'Kiorly SaaS billing', s: 'Subscription invoices; the saved token is charged through the PSP', tone: 'ocean', ss: 9.4 });
  d.box(270, 440, 220, 60, { t: 'Provider patient revenue', s: 'The provider’s own books. Kiorex never takes it', tone: 'neutral', ss: 9.4 });
  d.box(510, 440, 220, 60, { t: 'Kiorex Pay', s: 'Deposits held, payouts and Kiorex fees', tone: 'indigo', ss: 9.4 });
  return d;
});

/* ------------------------------------------------------------------ 4. Kiorly Pay unified layer */
def('pay-unified', 'Kiorly Pay unified layer', 'One adapter contract serves Kiorex Pay, the Clinic subscription billing and the Clinic patient channels. Routing, matching and fraud scoring sit above the vendors. Numbers on the boxes are the five phases of the layer (all built locally and mocked; nothing calls a vendor).', () => {
  const d = new Dia(W, 570, 'Kiorly Pay unified layer');
  d.text(14, 18, 'Consumers', { size: 9.5, weight: 700, fill: COL.n600, spacing: 1.4, upper: true });
  d.text(214, 18, 'Contract and decisions', { size: 9.5, weight: 700, fill: COL.n600, spacing: 1.4, upper: true });
  d.text(512, 18, 'Adapters (mock by default)', { size: 9.5, weight: 700, fill: COL.n600, spacing: 1.4, upper: true });
  d.box(14, 30, 170, 74, { t: 'Kiorex Pay', s: 'deposits, payouts, commission collection', tone: 'indigo', ss: 9.6 });
  d.box(14, 118, 170, 74, { t: 'Clinic SaaS billing', s: 'renewals through the saved token', tone: 'ocean', ss: 9.6 });
  d.box(14, 206, 170, 74, { t: 'Clinic patient channels', s: 'invoices, home visits, front desk', tone: 'ocean', ss: 9.6 });
  d.box(214, 30, 270, 74, { t: '@kiorex/pay-contract 0.1.0', s: 'One neutral adapter, event, status and capability contract. Pure TypeScript, no network. Vendored tarball.', tone: 'solid', ss: 9.4 });
  d.box(214, 118, 270, 74, { t: 'Routing', s: 'Per-organisation order and block list; strategy preference, success or cost; Wilson lower bound over 30 days; unset fees never rank cheap', tone: 'indigo', ss: 9 });
  d.box(214, 206, 270, 74, { t: 'Links and QR', s: 'HMAC-signed, expiring (60 s to 7 days), amount-locked, single-use. QR carries our hosted link, never a bank-app QR', tone: 'indigo', ss: 9 });
  d.box(512, 30, 234, 52, { t: 'Paymob', s: 'cards and wallets (integration ids)', tone: 'neutral', ss: 9.4 });
  d.box(512, 92, 234, 52, { t: 'Fawry', s: 'reference payments', tone: 'neutral', ss: 9.4 });
  d.box(512, 154, 234, 66, { t: 'InstaPay and bank IPN', s: 'signed webhook with replay window, CSV or JSON file ingest, reversals, dedupe, masked payer', tone: 'neutral', ss: 9 });
  d.box(512, 230, 234, 50, { t: 'POS and terminals', s: 'interface only, no vendor chosen', tone: 'ground', dash: true, ss: 9.4 });
  [[67], [155], [243]].forEach(([y]) => d.arrow([[184, y], [214, y]], { tone: 'indigo' }));
  d.arrow([[484, 67], [512, 56]], { tone: 'indigo', both: true });
  d.arrow([[484, 155], [512, 118]], { tone: 'indigo', both: true });
  d.arrow([[484, 190], [512, 186]], { tone: 'indigo', both: true });
  d.arrow([[484, 243], [512, 255]], { tone: 'grey', dash: true });
  d.num(214, 30, 1, 'dark'); d.num(214, 118, 4, 'dark'); d.num(214, 206, 3, 'dark');
  // neutral events
  d.arrow([[629, 280], [629, 322]], { tone: 'ocean', label: ['neutral events:', 'captured, failed, refund.settled, dispute.*'], lx: 629, ly: 298, ls: 8.4 });
  d.lane(14, 322, 732, 236, 'Above the vendors: records, matching, risk', { dash: true });
  d.box(30, 352, 168, 196, { t: 'Reconciliation', s: ['Settlement import and ledger match.', 'IPN rows matched to Kiorex payments and Clinic invoices with a confidence score.', 'AUTO only if reference AND remaining amount are exact (confidence 0.9, margin 0.1, config kind PAY_MATCHING_POLICY).', 'Else a finance-only review queue.'], tone: 'indigo', ss: 8.8, valign: 'top' });
  d.box(210, 352, 168, 196, { t: 'Disputes and refunds', s: ['Chargeback and dispute events drive the same ledger.', 'Refund allocation is pro rata over the patient-paid parts.', 'Idempotent, audited, append-only.'], tone: 'indigo', ss: 8.8, valign: 'top' });
  d.box(390, 352, 168, 196, { t: 'Fraud scorer (SHADOW)', s: ['Velocity, card testing, amount anomaly against the account median, repeated failures, fingerprint reuse.', 'Modes SHADOW and FLAG only: no ban, no block.', 'Thresholds in maker-checker kind PAY_FRAUD_THRESHOLDS.'], tone: 'warn', ss: 8.8, valign: 'top' });
  d.box(570, 352, 160, 196, { t: 'Reporting', s: ['Platform, organisation, PSP and day roll-ups.', 'Finance roles only; JSON, CSV, PDF.', 'Clinic PDFs are Arabic and English; the Kiorex PDF is Latin only (CSV carries Arabic).', 'Clinic adds branch roll-ups.'], tone: 'ocean', ss: 8.8, valign: 'top' });
  d.num(30, 352, 2, 'dark'); d.num(390, 352, 5, 'dark'); d.num(570, 352, 5, 'dark');
  return d;
});

/* ------------------------------------------------------------------ 5. commission collection modes */
def('commission-modes', 'Commission collection modes', 'The Clinic decides and charges; Kiorex mirrors the claim and collects through the provider’s chosen payment partner in one of three modes. The mode is configuration (market default, organisation override), approved by a second person. Counsel decides the funds flow (LG-COM-3).', () => {
  const d = new Dia(W, 560, 'Commission collection modes');
  d.box(14, 16, 210, 92, { t: 'Kiorly Clinic decides', s: 'Charge at check-in, amount and rate snapshotted, dispute window. System of record.', tone: 'ocean', ss: 9.4 });
  d.box(275, 16, 210, 92, { t: 'Kiorex claim ledger', s: 'COMMISSION_CHARGE_CREATED, _REVERSED, _STATUS_CHANGED mirrored as CommissionClaim, idempotent and time-ordered', tone: 'indigo', ss: 9.2 });
  d.box(536, 16, 210, 92, { t: 'Collection run', s: 'One per organisation and period. Takes CONFIRMED, undisputed, past-window, uncollected claims; older ones carry over', tone: 'indigo', ss: 9.2 });
  d.arrow([[224, 62], [275, 62]], { tone: 'ocean', label: 'HMAC, outbox', lx: 250, ly: 82, ls: 8.6 });
  d.arrow([[485, 62], [536, 62]], { tone: 'indigo' });
  const modes = [
    ['A', 'NET_FROM_PAYOUT', 'The weekly payout run keeps the commission out of the cash: payout amount is the cash, commission deducted is the commission, gross is both. A shortfall at the end of the window becomes an invoice (NET_SHORTFALL).', 'Ledger PAYABLE to COMMISSION_FEES'],
    ['B', 'AUTO_CHARGE_SAVED_METHOD', 'One idempotent charge through the saved token of the organisation’s chosen provider. A retryable decline retries on the configured days. A hard decline, no provider, no saved method or an unapproved real rail becomes an invoice at once.', 'Ledger PSP_CLEARING to COMMISSION_FEES'],
    ['C', 'INVOICE_AND_COLLECT', 'An invoice KXC-<cutoff>-<org> with a due date. Finance records the payment, idempotent on the provider reference; partial payments allowed. Automatic receipt matching belongs to the unified Pay layer.', 'Recorded by finance, audited'],
  ];
  modes.forEach((m, i) => {
    const x = 14 + i * 248;
    d.arrow([[641, 108], [641, 122], [x + 112, 122], [x + 112, 192]], { tone: 'indigo', r: 6 });
    d.box(x, 192, 236, 160, { tone: i === 0 ? 'indigo' : i === 1 ? 'ocean' : 'neutral', t: m[1], s: [m[2], m[3]], ts: 10.6, ss: 9, valign: 'top', bar: true });
    d.num(x + 14, 192, m[0], i === 1 ? 'ocean' : 'dark');
  });
  d.box(14, 132, 732, 40, { tone: 'ground', t: 'Mode: market default, organisation override; both maker-checker (proposer and approver differ)', ts: 10.4, align: 'center', dash: true, fill: '#fff' });
  d.box(14, 380, 732, 70, { tone: 'ground', t: 'Reconciliation', s: 'Charged = decision amount. Run claims = collected + deducted + invoiced. Each total = its succeeded attempts. Payout cash + deduction = released deposits. Reversals after collection become CREDIT_DUE. Findings show on the ops console; CSV per view.', ss: 9.6 });
  d.arrow([[130, 352], [130, 380]], { tone: 'grey' }); d.arrow([[378, 352], [378, 380]], { tone: 'grey' }); d.arrow([[626, 352], [626, 380]], { tone: 'grey' });
  d.box(14, 468, 732, 70, { tone: 'coral', t: 'Safety', s: 'No pause of listing, booking, plan or care exists in this module (a unit test scans the sources). Failure ends as an open invoice that ages on the console. Every step is an append-only timeline row. Mock collector is the default; real mode needs the per-provider approval.', ss: 9.6, bar: true });
  return d;
});

/* ------------------------------------------------------------------ 6. subscription lifecycle */
def('subscription-lifecycle', 'Subscription lifecycle: auto-renew, dunning and Lite', 'Founder rule: a paid plan renews automatically by default. Switching renewal off, or a lapse that dunning cannot fix, moves the organisation to the free Lite plan, never to lockout, and nothing is deleted. Day counts are market-pack defaults, set by maker-checker configuration.', () => {
  const d = new Dia(W, 560, 'Subscription lifecycle');
  d.box(14, 34, 110, 78, { t: 'Trial', s: 'activation keeps auto-renew ON', tone: 'neutral', ss: 9.2 });
  d.box(160, 34, 170, 78, { t: 'Paid plan, auto-renew ON', s: 'the default for every paid plan', tone: 'indigo', ss: 9.4 });
  d.box(380, 34, 164, 78, { t: 'Period end: renew', s: 'invoice, then charge the saved token; once per period even under concurrent runs', tone: 'ocean', ss: 9 });
  d.box(594, 34, 152, 78, { t: 'PAST_DUE', s: 'retries on day 1, 3 and 7; payment_failed notice; warning the day before', tone: 'warn', ss: 9 });
  d.arrow([[124, 73], [160, 73]], { tone: 'indigo' });
  d.arrow([[330, 73], [380, 73]], { tone: 'indigo' });
  d.arrow([[544, 73], [594, 73]], { tone: 'warn', label: 'charge fails', lx: 569, ly: 53, ls: 8.6 });
  d.arrow([[462, 112], [462, 136], [245, 136], [245, 112]], { tone: 'ok', label: 'charge ok: roll the period', lx: 353, ly: 136, ls: 8.8 });
  d.box(160, 196, 170, 78, { t: 'Auto-renew OFF', s: 'owner or admin only, after a confirmation that shows what will be lost', tone: 'neutral', ss: 9 });
  d.arrow([[210, 112], [210, 196]], { tone: 'grey', label: 'switched off', lx: 210, ly: 154, ls: 8.8 });
  d.box(594, 196, 152, 78, { t: 'Grace', s: 'full access with a banner until the downgrade day (default 15 after the due date)', tone: 'warn', ss: 8.9 });
  d.arrow([[670, 112], [670, 196]], { tone: 'warn', label: 'still unpaid', lx: 670, ly: 154, ls: 8.8 });
  d.box(160, 340, 586, 112, { t: 'Lite: the free plan. Never lockout. Nothing deleted.', s: ['Seats above the Lite cap become read-only; staff and branches are never removed.', 'Modules of the previous plan stay readable for a grace window (default 30 days); writes answer 402 until an upgrade. After the grace the module needs an upgrade; the data returns on upgrade.'], tone: 'ok', ss: 9.6, bar: true, valign: 'top', ts: 12.5 });
  d.arrow([[245, 274], [245, 340]], { tone: 'ok', label: 'at the period end', lx: 245, ly: 306, ls: 8.8 });
  d.arrow([[670, 274], [670, 340]], { tone: 'ok', label: 'after the grace', lx: 670, ly: 306, ls: 8.8 });
  d.box(14, 340, 110, 112, { t: 'Reactivate or upgrade', s: 'owner; previous plan by default; needs an active price', tone: 'indigo', ss: 9 });
  d.arrow([[160, 396], [124, 396]], { tone: 'indigo' });
  d.arrow([[76, 340], [76, 150], [180, 150], [180, 112]], { tone: 'indigo', r: 6 });
  d.box(14, 474, 732, 70, { tone: 'ground', t: 'Reminders and card', s: 'Renewal, renewal-off and payment-method reminders 7, 3 and 1 days before, one per offset and period, held outside owner quiet hours. Notices are account-holder transactional messages. The card is a PSP token and last four digits only: a card number is refused.', ss: 9.6, dash: true });
  return d;
});

/* ------------------------------------------------------------------ 7. growth engine event flow */
def('growth-engine-flow', 'Growth engine: from touch to commission', 'How a patient arrives, how the origin is decided once and stored, and how the Clinic’s check-in decision feeds fees, analytics, rewards and lifecycle. Consent gates every touch. Money, marketing, model and cross-product features are launch-locked (ADR-024); everything here is built locally and mocked.', () => {
  const d = new Dia(W, 560, 'Growth engine event flow');
  d.text(14, 18, 'Entry points', { size: 9.5, weight: 700, fill: COL.n600, spacing: 1.4, upper: true });
  const eps = ['Provider link and QR', 'Public SEO pages (SSR)', 'Booking widget and SDK', 'Referral and campaigns', 'WhatsApp assistant', 'Corporate and partner codes'];
  eps.forEach((t, i) => d.box(14, 28 + i * 56, 150, 46, { t, tone: i === 4 ? 'warn' : 'indigo', ts: 10.4, align: 'center' }));
  d.box(176, 28, 30, 322, { tone: 'dark', r: 8 }); d.add(`<text transform="translate(196 189) rotate(-90)" font-family="'Plus Jakarta Sans','Inter',sans-serif" font-size="11" font-weight="600" fill="#fff" text-anchor="middle" letter-spacing="3">CONSENT GATE</text>`);
  eps.forEach((_, i) => d.arrow([[164, 51 + i * 56], [176, 51 + i * 56]], { tone: 'indigo', noHead: true, w: 1.4 }));
  d.text(228, 18, 'Kiorex', { size: 9.5, weight: 700, fill: COL.indigo, spacing: 1.4, upper: true });
  d.box(222, 28, 140, 70, { t: 'Touch and events', s: 'POST /growth/v1/touch and /events, first-party, no visitor key before consent', tone: 'indigo', ss: 8.8 });
  d.box(222, 124, 140, 96, { t: 'Attribution decision', s: 'Versioned policy: origin, reason, evidence hash. Stored once, never recomputed from a join', tone: 'indigo', ss: 9 });
  d.box(222, 246, 140, 104, { t: 'Booking', s: 'Signed request with the acquisition block, idempotent hold and confirm', tone: 'indigo', ss: 9 });
  d.arrow([[292, 98], [292, 124]], { tone: 'indigo' }); d.arrow([[292, 220], [292, 246]], { tone: 'indigo' });
  d.arrow([[206, 63], [222, 63]], { tone: 'dark', noHead: true });
  d.text(444, 18, 'Kiorly Clinic', { size: 9.5, weight: 700, fill: COL.ocean, spacing: 1.4, upper: true });
  d.box(440, 28, 140, 70, { t: 'Appointment', s: 'System of record. Stamps isNewPatientAtBooking', tone: 'ocean', ss: 9 });
  d.box(440, 124, 140, 96, { t: 'Check-in decision', s: 'Writes the decision whether or not a fee applies; PROVIDER_LED means no fee', tone: 'ocean', ss: 9 });
  d.box(440, 246, 140, 104, { t: 'Outbox events', s: 'COMMISSION_CHARGE_CREATED, CommissionAdjusted, _REVERSED, appointment events', tone: 'ocean', ss: 8.8 });
  d.arrow([[510, 98], [510, 124]], { tone: 'ocean' }); d.arrow([[510, 220], [510, 246]], { tone: 'ocean' });
  d.arrow([[362, 298], [401, 298], [401, 63], [440, 63]], { tone: 'indigo', label: ['signed', 'booking'], lx: 401, ly: 180, ls: 8.8, r: 8 });
  d.text(628, 18, 'Kiorex consumers', { size: 9.5, weight: 700, fill: COL.indigo, spacing: 1.4, upper: true });
  const cons = ['Commission collection', 'Analytics (k at least 10)', 'Rewards and referral', 'Lifecycle and campaigns', 'Fraud (SHADOW)', 'Experiments'];
  cons.forEach((t, i) => d.box(620, 28 + i * 56, 126, 46, { t, tone: 'neutral', ts: 10, align: 'center' }));
  d.arrow([[580, 298], [600, 298], [600, 51], [620, 51]], { tone: 'ocean', r: 8 });
  [1, 2, 3, 4, 5].forEach((i) => d.arrow([[600, 51 + i * 56], [620, 51 + i * 56]], { tone: 'ocean', w: 1.4 }));
  d.line(600, 51, 600, 51 + 5 * 56, { stroke: COL.ocean, w: 1.6 });
  d.lane(14, 380, 732, 150, 'Controls that apply to the whole path', { dash: true });
  d.box(30, 406, 226, 106, { t: 'Launch locks', s: 'Every flag that moves money, sends marketing, calls a model or shares health-adjacent signals is launch-locked; only a human gate record opens it.', tone: 'coral', ss: 9, bar: true });
  d.box(268, 406, 226, 106, { t: 'Versioned configuration', s: 'Policies and rules are maker-checker kinds with an effective date; the decision stores the policy version it used.', tone: 'indigo', ss: 9, bar: true });
  d.box(506, 406, 224, 106, { t: 'Separation guards', s: 'Reporting models never read or write a decision. Experiments cannot reach safety, money or consent. Specialty never joins the visitor stream.', tone: 'neutral', ss: 9, bar: true });
  return d;
});

/* ------------------------------------------------------------------ 8. messaging channels */
def('messaging-channels', 'Messaging: one decision point, five channels', 'A shared package decides whether a message may be sent, to whom, on which channel and in which words; adapters only call the vendor. Marketing never fails over to another channel. Every vendor runs mock by default; nothing has been sent to a real vendor.', () => {
  const d = new Dia(W, 560, 'Messaging channels');
  d.box(14, 20, 150, 90, { t: 'Product event', s: 'booking confirmed, reminder, OTP, campaign, lab critical', tone: 'ground', ss: 9 });
  d.box(14, 126, 150, 64, { t: 'NotificationIntent', s: 'type, recipient, params, severity, idempotency key', tone: 'ground', ss: 9 });
  d.arrow([[89, 110], [89, 126]], { tone: 'grey' });
  d.lane(190, 12, 340, 252, 'Notification layer (shared package)', { tone: 'indigo' });
  const st = [['1', 'Consent and PHI guard', 'opt-out, quiet hours, WhatsApp window; templates allow only listed params'], ['2', 'Template and language', 'Arabic and English, allowed params'], ['3', 'Routing and failover', 'per message class; provider order; rate budgets'], ['4', 'Idempotency and status', 'dedupe; six normalised statuses; audit shape']];
  st.forEach((s, i) => { d.box(206, 40 + i * 54, 308, 46, { t: s[1], s: s[2], tone: 'neutral', ss: 9, pad: 34 }); d.num(224, 63 + i * 54, s[0], 'dark', 9); });
  d.arrow([[164, 158], [206, 158]], { tone: 'indigo' });
  d.text(368, 258, '', {});
  const ch = [['WhatsApp', 'Meta Cloud API; templates, window'], ['SMS', 'aggregator, Twilio'], ['E-mail', 'SES; one-click unsubscribe'], ['Push', 'FCM, APNs, Expo'], ['In-app inbox', 'built into each product']];
  d.text(552, 22, 'Channel adapters', { size: 9.5, weight: 700, fill: COL.n600, spacing: 1.4, upper: true });
  ch.forEach((c, i) => { d.box(552, 32 + i * 46, 194, 40, { t: c[0], s: c[1], tone: 'ocean', ss: 8.8, ts: 11 }); d.arrow([[530, 52 + i * 46], [552, 52 + i * 46]], { tone: 'ocean', w: 1.4 }); });
  d.text(649, 282, 'MODE=mock by default; real needs three switches', { size: 9, fill: COL.n600, anchor: 'middle' });
  d.box(14, 292, 732, 52, { tone: 'ground', t: 'Delivery', s: 'Vendor webhook (signature checked) → adapter → normalised status: QUEUED, SENT, DELIVERED, READ, FAILED, SKIPPED. Severities: ROUTINE, IMPORTANT, CRITICAL.', ss: 9.8 });
  d.lane(14, 360, 732, 190, 'Failover order per message class (maker-checker kind MESSAGING_CHANNELS)', { dash: true });
  const cls = [['TRANSACTIONAL', ['WhatsApp', 'SMS', 'E-mail']], ['SECURITY', ['SMS', 'WhatsApp']], ['REMINDER', ['WhatsApp', 'SMS']], ['MARKETING', []]];
  cls.forEach(([name, chain], i) => {
    const y = 386 + i * 38; d.box(30, y, 150, 30, { t: name, tone: i === 3 ? 'coral' : 'indigo', ts: 10, align: 'center' });
    if (!chain.length) { d.box(200, y, 340, 30, { t: 'none: marketing never fails over', tone: 'neutral', ts: 10, ss: 9 }); return; }
    chain.forEach((c, j) => { const x = 200 + j * 130; d.box(x, y, 104, 30, { t: c, tone: 'ocean', ts: 10, align: 'center' }); if (j) d.arrow([[x - 26, y + 15], [x, y + 15]], { tone: 'ocean', w: 1.4 }); });
  });
  d.box(566, 386, 164, 148, { t: 'Quiet hours and budgets', s: 'Quiet hours per market (default 21:00 to 09:00 Cairo). WhatsApp 40 per second and 1,000 new people a day, SMS 10 per second, e-mail 14 per second, push 200 per second.', tone: 'neutral', ss: 8.8, valign: 'top' });
  return d;
});

/* ------------------------------------------------------------------ 9. integration control center */
def('integration-control-center', 'Integrations Control Center: three switches', 'A real vendor call needs three things in three different places. Without the approval every real adapter answers NEEDS_HUMAN_REAL_MODE_NOT_APPROVED, sends nothing and calls no vendor. Rollback is a configuration change first, a redeploy second.', () => {
  const d = new Dia(W, 540, 'Integrations Control Center');
  const sw = [['1', 'Environment', 'Deploy time', '<KIND>_MODE=real (SMS_MODE, EMAIL_MODE, WHATSAPP_MODE, PUSH_MODE, ...). Configuration can never switch a channel to real.', 'indigo'], ['2', 'Approval', 'Maker-checker', 'The Control Center proposes INTEGRATION_MODES; a second super admin approves. Dev and test may exempt themselves only outside production.', 'ocean'], ['3', 'Credentials', 'By reference', 'Secrets Manager path /{product}/{env}/{purpose}, injected by the platform. Only the path is ever written in configuration, never a value.', 'indigo']];
  sw.forEach((s, i) => { const x = 14 + i * 248; d.box(x, 34, 236, 120, { t: s[1], s: s[3], tone: s[4], ss: 9.3, valign: 'top', bar: true, ts: 13 }); d.tag(x + 236, 12, s[2], { tone: s[4], anchor: 'end' }); d.num(x + 12, 20, s[0], 'dark', 11); });
  d.arrow([[126, 154], [126, 186], [380, 186]], { tone: 'indigo', r: 8, noHead: true });
  d.arrow([[374, 154], [374, 206]], { tone: 'ocean' });
  d.arrow([[622, 154], [622, 186], [380, 186]], { tone: 'indigo', r: 8, noHead: true });
  d.box(240, 206, 280, 56, { tone: 'dark', t: 'All three present?', s: 'checked on every call by the mode guard', ts: 12, align: 'center' });
  d.arrow([[240, 234], [130, 234], [130, 286]], { tone: 'grey', r: 8, label: 'no', lx: 200, ly: 234 });
  d.arrow([[520, 234], [630, 234], [630, 286]], { tone: 'ok', r: 8, label: 'yes', lx: 560, ly: 234 });
  d.box(14, 286, 232, 76, { t: 'Mock answers', s: 'NEEDS_HUMAN_REAL_MODE_NOT_APPROVED:<KEY>. No vendor call. Mock is always allowed.', tone: 'neutral', ss: 9.2, bar: true });
  d.box(514, 286, 232, 76, { t: 'Real adapter calls the vendor', s: 'Retries, circuit breaker and webhook signature checks apply.', tone: 'ok', ss: 9.2, bar: true });
  d.lane(14, 384, 732, 146, 'What the Control Center shows for every integration', { dash: true });
  ['Mode', 'Approved mode', 'Drift', 'Credentials set', 'Last check', 'Circuit', 'Webhook URL', 'Runbook'].forEach((c, i) => { const x = 30 + (i % 4) * 178, y = 412 + Math.floor(i / 4) * 40; d.box(x, y, 164, 30, { t: c, tone: 'neutral', ts: 10.4, align: 'center' }); });
  d.text(30, 512, 'Rollback, fastest first: withdraw the approval (no deploy), set <KIND>_MODE=mock and redeploy, remove the vendor webhook, revoke the credential last.', { size: 9.2, fill: COL.n700 });
  return d;
});

/* ------------------------------------------------------------------ 10. wave roadmap */
def('roadmap-waves', 'Growth roadmap by wave', 'Phase 1 (waves 0 to 4) is built; Phases 2 to 4 (waves 5 to 8) are built locally with every money, messaging and model feature launch-locked; wave 9 hardened and documented them. Nothing is deployed. Evidence figures are the recorded gate results (KX-33 section 10).', () => {
  const d = new Dia(W, 530, 'Growth waves');
  const waves = [['W0–W4', 'Phase 1', ['Contracts 1.10.0 and 1.11.0', 'Provider links and QR, attribution, commission integration', 'SSR pages, widget, consent, analytics, ops config', 'Staff-app Growth tab, end-to-end'], 'indigo'],
    ['W5–W6', 'Phase 2', ['Campaigns, referral and rewards', 'Patient and provider credit ledgers', 'Sponsored promotions', 'WhatsApp assistant (mock model), lifecycle'], 'indigo'],
    ['W7–W8', 'Phases 3–4', ['Experiments, attribution models, cohorts', 'Fraud v2 (shadow), SEO automation', 'Product ingest, cross-product, corporate', 'Exit gate: 87 suites, 1,142 tests, 3 runs'], 'ocean'],
    ['W9', 'Hardening', ['P3-H regression, performance, security', 'Loyalty, partner-app tabs, gap closure', 'Documentation and finishing pass', 'Final gate: 3 green ordered runs, 552 passed'], 'ok']];
  d.line(40, 74, 720, 74, { stroke: COL.coral, w: 2.2 });
  waves.forEach((w, i) => {
    const x = 14 + i * 186;
    d.add(`<circle cx="${x + 80}" cy="74" r="12" fill="${COL.white}" stroke="${w[4] === 'ok' ? COL.ok : w[4] === 'ocean' ? COL.ocean : COL.indigo}" stroke-width="3"/>`);
    d.text(x + 80, 36, w[0], { size: 15, weight: 700, fill: COL.ink, anchor: 'middle', head: true });
    d.text(x + 80, 54, w[1], { size: 10, fill: COL.n600, anchor: 'middle', weight: 600, spacing: 1, upper: true });
    d.box(x, 100, 172, 160, { tone: w[4], t: '', s: w[2].map((s) => '• ' + s), ss: 9.6, valign: 'top', pad: 12 });
  });
  d.lane(14, 282, 732, 230, 'Status of everything above', { dash: true });
  const chips = [['Built locally', 'ok'], ['Mocked providers', 'neutral'], ['Launch-locked', 'warn'], ['Not deployed', 'coral']];
  chips.forEach((c, i) => d.tag(36 + i * 150, 306, c[0], { tone: c[1] === 'neutral' ? 'ground' : c[1], solid: false, size: 9.4 }));
  d.box(30, 342, 336, 150, { t: 'What stays closed until humans act', s: ['Patient credit mode, refund-as-credit and family credit need counsel.', 'Real PSP, WhatsApp, search-console, ad and store adapters need accounts and approvals.', 'Contracts 1.12.1 to 1.14.0 are unpublished.', 'Loyalty is built locally and locked.'], tone: 'warn', ss: 9.2, valign: 'top', bar: true });
  d.box(382, 342, 348, 150, { t: 'How to read a status', s: ['Built locally: code plus passing tests on the local stack with mock providers.', 'Launch-locked: only a gate record in the Super Admin opens it (ADR-024).', 'Proposed: ADR-041 to ADR-057 carry no founder signature.', 'Nothing here is verified in production.'], tone: 'neutral', ss: 9.2, valign: 'top', bar: true });
  return d;
});

/* ------------------------------------------------------------------ 11. credits ledgers */
def('credits-ledgers', 'Two credit systems, one experience', 'Patient credit (Kiorex) and provider credit (Kiorly) share only the ledger pattern and a file of test vectors: no conversion, no shared balance row, no shared runtime code. A provider-sponsored promotion is a discount line, never a conversion of balances. Amounts shown are the worked example in KX-30.', () => {
  const d = new Dia(W, 580, 'Patient credit and provider credit');
  d.lane(14, 10, 346, 238, 'Patient credit: Kiorex, closed loop', { tone: 'indigo' });
  d.ledger(30, 36, 118, 96, { tone: 'indigo', t: 'Reward ledger', s: 'append-only, idempotent' });
  d.box(160, 36, 186, 96, { t: 'Holder: a patient (or a family owner)', s: 'Spent only on Kiorex bookings and amounts Kiorex collects. Expiring lots, first-expiring first. COUPON is the default mode; CREDIT mode is launch-locked and counsel-gated.', tone: 'indigo', ss: 8.6 });
  d.box(30, 160, 316, 76, { t: 'Sources', s: 'Referral and welcome rewards after the first completed visit and the hold; support goodwill; refund as credit (an option, never the default); campaign credit.', tone: 'neutral', ss: 9 });
  d.lane(400, 10, 346, 238, 'Provider credit: Kiorly, per organisation', { tone: 'ocean' });
  d.ledger(416, 36, 118, 96, { tone: 'ocean', t: 'Wallet ledger', s: 'append-only, idempotent' });
  d.box(546, 36, 186, 96, { t: 'Holder: a tenant', s: 'Spent on Kiorex fees (commission, subscription), usage packs and promotions. Fees draw from credit first, then the invoice.', tone: 'ocean', ss: 8.6 });
  d.box(416, 160, 316, 76, { t: 'Sources', s: 'Goodwill and waivers, dispute-win returns, onboarding and connect credit, provider referral (not yet wired), usage purchases (skeleton, off).', tone: 'neutral', ss: 9 });
  d.box(360, 100, 40, 100, { tone: 'dark', r: 8 });
  d.add(`<text transform="translate(385 150) rotate(-90)" font-family="'Plus Jakarta Sans','Inter',sans-serif" font-size="9.4" font-weight="600" fill="#fff" text-anchor="middle" letter-spacing="1.4">NO CONVERSION</text>`);
  d.box(14, 270, 732, 38, { tone: 'ground', t: 'Both: no withdrawal, no peer-to-peer transfer, no cash conversion, no top-up by the holder. Neither is a general-purpose money wallet.', ts: 10, align: 'center', dash: true });
  d.lane(14, 328, 732, 242, 'Checkout order and the worked example (deposit 500)', { dash: true });
  const steps = [['Sponsored discount', '100', 'funded by the clinic, a discount line', 'ocean'], ['Patient credit', '150', 'Kiorex closed-loop credit', 'indigo'], ['Held deposit', '0', 'already held, if any', 'neutral'], ['Card', '250', 'keeps at least one minor unit', 'neutral']];
  steps.forEach((s, i) => { const x = 30 + i * 178; d.box(x, 356, 162, 88, { t: s[0], tone: s[3], ts: 11.5, s: s[2], ss: 9 }); d.text(x + 150, 436, s[1], { size: 20, weight: 700, fill: COL.ink, anchor: 'end', head: true }); if (i) d.arrow([[x - 16, 400], [x, 400]], { tone: 'coral', w: 1.8 }); });
  d.box(30, 464, 340, 88, { t: 'What the patient and the clinic see', s: 'The patient pays 250. At completion Kiorex Pay pays the clinic 500; the clinic wallet is debited 100 as a promotion expense; the Kiorex fee (flat) is unchanged.', tone: 'neutral', ss: 9.2, bar: true });
  d.box(386, 464, 344, 88, { t: 'Revenue rule', s: 'A sponsored amount is provider-funded pass-through, neither Kiorex revenue nor a Kiorex expense. Patient credit is never Kiorex revenue. The sponsored share is voided, never paid out, on a refund.', tone: 'coral', ss: 9.2, bar: true });
  return d;
});

/* ------------------------------------------------------------------ 12. contract flow (outbox) */
def('contract-flow', 'Cross-product call and event path', 'Kiorex calls Kiorly with a signed command; Kiorly answers the call and later reports the outcome as an event written in the same transaction as the state change. Every command carries an idempotency key; every event an event id that consumers de-duplicate on.', () => {
  const d = new Dia(W, 440, 'Contract flow');
  d.lane(14, 10, 732, 190, 'Command path: Kiorex to Kiorly (scope MARKETPLACE)', { tone: 'indigo' });
  d.box(30, 44, 150, 134, { t: 'Kiorex', s: 'Booking service builds the call. Idempotency-Key per command', tone: 'indigo', ss: 9.2 });
  d.box(300, 44, 200, 134, { t: 'Signed request', s: ['X-Kiorly-Client-Key, -Timestamp, -Nonce, -Signature', 'HMAC-SHA256 over timestamp, nonce, method, path and the body hash.', 'Skew over 5 minutes is rejected; the nonce is single-use.'], tone: 'neutral', ss: 8.8, valign: 'top' });
  d.box(620, 44, 112, 134, { t: 'Kiorly Clinic', s: 'Holds, confirms, cancels. The only system of record for appointments', tone: 'ocean', ss: 9 });
  d.arrow([[180, 111], [300, 111]], { tone: 'indigo' }); d.arrow([[500, 111], [620, 111]], { tone: 'indigo' });
  d.lane(14, 222, 732, 200, 'Event path: Kiorly to Kiorex (transactional outbox)', { tone: 'ocean' });
  d.box(30, 256, 150, 142, { t: 'State change + outbox row', s: 'One database transaction. No dual writes', tone: 'ocean', ss: 9.2 });
  d.box(214, 256, 150, 142, { t: 'Dispatcher', s: '5 second loop, exponential backoff, status DEAD after 8 attempts', tone: 'neutral', ss: 9.2 });
  d.box(398, 256, 170, 142, { t: 'Webhook', s: ['X-Kiorly-Event-Id, X-Kiorly-Signature over the body', '{ eventId, type, aggregateType, aggregateId, occurredAt, data }'], tone: 'neutral', ss: 8.8, valign: 'top' });
  d.box(602, 256, 130, 142, { t: 'Kiorex consumer', s: 'Verifies the signature, de-duplicates on eventId, keeps a projection with source version', tone: 'indigo', ss: 8.8 });
  d.arrow([[180, 327], [214, 327]], { tone: 'ocean' }); d.arrow([[364, 327], [398, 327]], { tone: 'ocean' }); d.arrow([[568, 327], [602, 327]], { tone: 'ocean' });
  return d;
});

/* ------------------------------------------------------------------ 13. revenue engines (higher-of) */
def('revenue-engines', 'The higher-of rule', 'A provider pays the higher of its subscription and the Kiorex commission. Below the crossover Kiorly is a normal subscription; above it the subscription is covered and Kiorex is the only cost. The curve is the KX-12 illustration (Pro plan EGP 999 annual-equivalent, fee EGP 40, about 25 attended new patients); prices remain proposals.', () => {
  const d = new Dia(W, 400, 'Higher-of rule');
  const X0 = 90, X1 = 700, Y0 = 330, Y1 = 40; const px = (n) => X0 + (n / 60) * (X1 - X0); const py = (v) => Y0 - (v / 3500) * (Y0 - Y1);
  [0, 500, 1000, 1500, 2000, 2500, 3000, 3500].forEach((v) => { d.line(X0, py(v), X1, py(v), { stroke: COL.n100, w: 1 }); d.text(X0 - 8, py(v) + 3.5, String(v), { size: 9, fill: COL.n500, anchor: 'end' }); });
  [0, 10, 20, 30, 40, 50, 60].forEach((n) => d.text(px(n), Y0 + 16, String(n), { size: 9, fill: COL.n500, anchor: 'middle' }));
  d.text((X0 + X1) / 2, Y0 + 36, 'Attended new Kiorex patients per month', { size: 10, fill: COL.n700, anchor: 'middle', weight: 600 });
  d.text(18, 24, 'EGP per month', { size: 10, fill: COL.n700, weight: 600 });
  d.add(`<polygon points="${px(0)},${py(999)} ${px(24.975)},${py(999)} ${px(60)},${py(2400)} ${px(60)},${Y0} ${px(0)},${Y0}" fill="${COL.indigoSoft}" opacity=".9"/>`);
  d.add(`<polyline points="${px(0)},${py(999)} ${px(60)},${py(999)}" fill="none" stroke="${COL.ocean}" stroke-width="2.2" stroke-dasharray="6 4"/>`);
  d.add(`<polyline points="${px(0)},${py(0)} ${px(60)},${py(2400)}" fill="none" stroke="${COL.n500}" stroke-width="2.2" stroke-dasharray="2 5"/>`);
  d.add(`<polyline points="${px(0)},${py(999)} ${px(24.975)},${py(999)} ${px(60)},${py(2400)}" fill="none" stroke="${COL.indigo}" stroke-width="3.4" stroke-linejoin="round"/>`);
  d.add(`<circle cx="${px(24.975)}" cy="${py(999)}" r="6" fill="#fff" stroke="${COL.coral}" stroke-width="3"/>`);
  d.line(px(24.975), py(999) + 8, px(24.975), Y0, { stroke: COL.coral, w: 1.6, dash: true });
  d.chip(px(24.975), py(999) - 30, ['Crossover about 25 patients', 'above it the subscription is covered'], { stroke: COL.coral, size: 9.4 });
  d.text(px(2), py(999) - 8, 'Subscription S (flat)', { size: 9.8, fill: COL.ocean, weight: 600 });
  d.text(px(41), py(41 * 40) + 20, 'Commission C = fee x patients', { size: 9.8, fill: COL.n700, weight: 600 });
  d.text(px(46), py(2400) - 14, 'Provider pays max(S, C)', { size: 10.5, fill: COL.indigo, weight: 700, head: true });
  return d;
});

/* ------------------------------------------------------------------ 14. GTM sequence (KX-14) */
def('gtm-sequence', 'Supply first, density second, demand third', 'The marketplace is liquid one neighbourhood at a time. A cluster opens the next one only when the liquidity thresholds in section 03 are met.', () => {
  const d = new Dia(W, 340, 'GTM sequence');
  const st = [['1 Supply', 'Win clinics, physiotherapists and nurses with Kiorly: anchors first (30 respected clinics), then the top eight specialties.', 'indigo', 150], ['2 Density', 'Fill two Cairo and Giza micro-clusters until they are liquid: doctors, next-available slot, conversion.', 'ocean', 100], ['3 Demand', 'Drive local SEO, Maps and social once supply is dense; open the Kiorex closed beta; add home care.', 'indigo', 50]];
  st.forEach((s, i) => { const x = 14 + i * 248, top = s[3]; d.add(`<rect x="${x}" y="${top}" width="236" height="${270 - top}" rx="12" fill="${s[2] === 'ocean' ? COL.oceanSoft : COL.indigoSoft}" stroke="${s[2] === 'ocean' ? COL.ocean : COL.indigo}" stroke-width="1.3"/>`); d.text(x + 16, top + 32, s[0], { size: 18, weight: 700, fill: COL.ink, head: true }); d.text(x + 16, top + 58, wrapLines(s[1], 204, 10.2), { size: 10.2, fill: COL.n700, lh: 14 }); });
  d.line(30, 296, 726, 296, { stroke: COL.coral, w: 2.4 }); d.add(`<path d="M718 290 L732 296 L718 302 Z" fill="${COL.coral}"/>`);
  d.text(380, 322, 'Liquidity thresholds gate each step: 150 live doctors, median next slot within 48 h, 8 percent search-to-booking, 12 attended patients per provider a month', { size: 9, fill: COL.n600, anchor: 'middle' });
  return d;
});
function wrapLines(s, px, size) { const words = s.split(' '); const out = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (t.length * size * 0.535 > px && cur) { out.push(cur); cur = w; } else cur = t; } if (cur) out.push(cur); return out; }

/* ------------------------------------------------------------------ 15. acquisition ladder (KX-29) */
def('acquisition-ladder', 'Patient acquisition ladder (hypothesis)', 'Provider-led first, organic second, referral and WhatsApp third, paid last. The 50 / 25 / 15 / 10 split is the founder’s figure; its interpretation (patient mix or budget) is open and needs the founder’s confirmation (NEEDS_HUMAN).', () => {
  const d = new Dia(W, 360, 'Acquisition ladder');
  const st = [['50', 'Provider-led', 'links, QR in clinics, widgets, Business Profile booking links', 'indigo'], ['25', 'Organic', 'SEO pages, maps, link previews', 'ocean'], ['15', 'Referral and WhatsApp', 'patient referral, WhatsApp entry, community', 'indigo'], ['10', 'Paid and partners', 'social, employers, insurers, discharge cards', 'ocean']];
  st.forEach((s, i) => { const h = 250 - i * 44, x = 14 + i * 186, y = 300 - h; d.add(`<rect x="${x}" y="${y}" width="172" height="${h}" rx="12" fill="${s[3] === 'ocean' ? COL.oceanSoft : COL.indigoSoft}" stroke="${s[3] === 'ocean' ? COL.ocean : COL.indigo}" stroke-width="1.3"/>`); d.text(x + 16, y + 44, s[0] + '%', { size: 30, weight: 700, fill: COL.ink, head: true }); d.text(x + 16, y + 68, wrapLines(s[1], 146, 12), { size: 12, weight: 700, fill: COL.ink, head: true }); d.text(x + 16, y + 96, wrapLines(s[2], 146, 9.6), { size: 9.6, fill: COL.n700, lh: 13 }); });
  d.line(14, 322, 746, 322, { stroke: COL.coral, w: 2 });
  d.text(380, 345, 'A provider-led patient is real usage but not fee revenue; fee-bearing patients come from the other groups', { size: 9.4, fill: COL.n600, anchor: 'middle' });
  return d;
});

/* ------------------------------------------------------------------ 16. SEO rendering path (KX-31) */
def('seo-path', 'Public page path: from request to index', 'A crawler or a patient requests a doctor page; the CDN serves cached server-rendered HTML; a quality gate keeps thin pages out of the sitemap. Automatic noindex is OFF by default. Built locally; the CDN rules are designed, not applied.', () => {
  const d = new Dia(W, 330, 'SEO path');
  const s = [['Crawler or patient', 'asks /{ar,en}/…', 'ground'], ['CDN', 'HTML cached; purge on listing or profile events', 'neutral'], ['Site role (SSR)', 'Vite SSR bundle in the Kiorex API image; one route table', 'indigo'], ['Page', 'Arabic and English, hreflang, JSON-LD, indicative slots', 'ocean']];
  s.forEach((b, i) => { const x = 14 + i * 186; d.box(x, 24, 160, 100, { t: b[0], s: b[1], tone: b[2], ss: 9.2 }); if (i) d.arrow([[x - 26, 74], [x, 74]], { tone: 'indigo' }); });
  d.lane(14, 150, 732, 170, 'Beside the request path', { dash: true });
  d.box(30, 178, 166, 128, { t: 'Thin-page guard', s: 'Quality gate decides if a page may be indexed and listed in the sitemap', tone: 'warn', ss: 9.2, bar: true });
  d.box(210, 178, 166, 128, { t: 'Sitemaps and robots', s: 'Generated from LIVE listings only; robots.txt always served', tone: 'neutral', ss: 9.2, bar: true });
  d.box(390, 178, 166, 128, { t: 'Vitals and snapshots', s: 'Indexation snapshots and web vitals recorded; targets are not yet measured', tone: 'neutral', ss: 9.2, bar: true });
  d.box(570, 178, 160, 128, { t: 'Fallback', s: 'Flag growth.ssr_public_pages OFF serves the SPA shell; automatic noindex is OFF by default', tone: 'coral', ss: 9, bar: true });
  return d;
});

/* ------------------------------------------------------------------ 17. revenue vs GBV (KX-32) */
def('revenue-vs-gbv', 'Revenue is not booking value', 'KX-32 fixes one definition per growth number. Gross booking value, held deposits and credits are volume or cash-flow items; Kiorex revenue is confirmed or billed commission, net of reversals and waivers.', () => {
  const d = new Dia(W, 360, 'Revenue versus GBV');
  d.box(14, 20, 232, 96, { t: 'Gross booking value', s: 'Sum of visit fees of CONFIRMED bookings. Informational: never revenue', tone: 'neutral', ss: 9.4 });
  d.box(14, 132, 232, 96, { t: 'Held funds and deposits', s: 'Patient money in the Kiorex Pay held ledger: a cash-flow item', tone: 'neutral', ss: 9.4 });
  d.box(14, 244, 232, 96, { t: 'Credits and sponsored amounts', s: 'Patient, refund and provider credit; provider-sponsored discounts: never Kiorex revenue (ADR-048, Proposed)', tone: 'neutral', ss: 9 });
  d.box(300, 70, 210, 200, { t: 'Kiorex revenue', s: 'Commission charges in CONFIRMED or BILLED (flat EGP 40 today), net of reversals and waivers, plus later sponsored fees and Pay margin. Provider SaaS revenue is a separate line in KX-13.', tone: 'solid', ss: 9.4, ts: 14 });
  d.arrow([[246, 164], [300, 164]], { tone: 'grey', dash: true, label: 'not counted', lx: 273, ly: 146, ls: 8.8 });
  d.box(564, 20, 182, 96, { t: 'Revenue per attended new patient', s: 'numerator, denominator, period and filter always stated', tone: 'indigo', ss: 9.2 });
  d.box(564, 132, 182, 96, { t: 'Provider-led share', s: 'PROVIDER_LED over all attributed; fee-bearing patients are the rest', tone: 'indigo', ss: 9.2 });
  d.box(564, 244, 182, 96, { t: 'Aggregates only', s: 'k of at least 10; no cell identifies a person', tone: 'ocean', ss: 9.2 });
  d.arrow([[510, 150], [564, 68]], { tone: 'indigo' }); d.arrow([[510, 170], [564, 180]], { tone: 'indigo' }); d.arrow([[510, 190], [564, 292]], { tone: 'indigo' });
  return d;
});

/* ------------------------------------------------------------------ 18. ADR lifecycle (KX-01) */
def('adr-lifecycle', 'How a decision becomes binding', 'ADR numbering scheme A was decided by the founder on 25 Nov 2026: the assistant decision is ADR-051 everywhere and ADR-058 is unused. ADR-041 to ADR-057 are Proposed: nothing binds code until the founder signs.', () => {
  const d = new Dia(W, 300, 'ADR lifecycle');
  d.box(14, 40, 150, 84, { t: 'Proposed', s: 'drafted with its rationale and cost; unsigned', tone: 'warn', ss: 9.4 });
  d.box(222, 40, 150, 84, { t: 'Accepted', s: 'founder decision recorded; binds code and tests', tone: 'ok', ss: 9.4 });
  d.box(430, 40, 150, 84, { t: 'Superseded', s: 'replaced by a later ADR; kept for history', tone: 'neutral', ss: 9.4 });
  d.arrow([[164, 82], [222, 82]], { tone: 'ok', label: 'founder signs', lx: 193, ly: 62, ls: 8.8 });
  d.arrow([[372, 82], [430, 82]], { tone: 'grey', label: 'a later ADR', lx: 401, ly: 62, ls: 8.8 });
  d.box(14, 164, 366, 108, { t: 'Numbering scheme A (decided 25 Nov 2026)', s: ['ADR-049 to ADR-057 are registered as Proposed.', 'The assistant decision is ADR-051 everywhere; ADR-058 is unused.', 'ADR-041 to ADR-057 are all Proposed: 17 growth decisions, none signed.'], tone: 'indigo', ss: 9.6, bar: true, valign: 'top' });
  d.box(396, 164, 350, 108, { t: 'Rule for builders', s: 'Implementation may exist locally for a Proposed ADR (marked as such) and stays launch-locked where it moves money, sends marketing or calls a model. A human gate record opens it.', tone: 'coral', ss: 9.4, bar: true });
  return d;
});

/* ------------------------------------------------------------------ 19. environment and domain map (ADR-059, KX-34) */
def('env-domain-map', 'Environments, domains and cloud providers', 'Three provisioned environments, one host pattern and one provider switch. kx-test runs on AWS today (account 990597228737, eu-central-1) and includes the live Clinic. kx-pilot is hostnames and a tenant cohort on the production plane. kx-pro is the major release for Egypt; the founder’s initial hosting decision is Huawei Cloud, with region availability, Egypt data residency and CBE rules still to be verified by the founder and counsel. Every environment can run on either cloud: one variable, provider_name = aws | huawei.', () => {
  const d = new Dia(W, 560, 'Environment and domain map');
  d.box(14, 12, 732, 50, { tone: 'dark', t: 'Host pattern:  <service>.<environment>.<domain>', s: 'Production omits the environment label. kiorex.com = patients, identity, platform. kiorly.com = providers and the marketing apex. One wildcard level always covers an environment.', ts: 12.5, ss: 9.6, align: 'center' });
  const cols = [
    { x: 14, tone: 'ocean', tag: 'kx-test', id: 'test', head: 'passport.test.kiorex.com', plane: 'test plane', cloud: 'AWS now', note: ['Real data at small scale: the real organisation Dr Ahmed Shall on the AWS Clinic, plus tagged dummy data.', 'Live Clinic cloudfront.net host stays valid.', 'Single cost-minimal host, private database, daily backups.'] },
    { x: 266, tone: 'indigo', tag: 'kx-pilot', id: 'pilot', head: 'clinics.pilot.kiorly.com', plane: 'production plane', cloud: 'AWS or Huawei', note: ['Controlled production release: invitation-only tenant cohort.', 'Same databases, same IdP as prod; uses issuer passport.kiorex.com.', 'Moves to prod URLs with no data migration.'] },
    { x: 518, tone: 'coral', tag: 'kx-pro', id: 'prod', head: 'passport.kiorex.com', plane: 'production plane', cloud: 'Huawei Cloud', note: ['Major release for Egypt, HA-capable.', 'Region, Egypt residency and CBE position: founder and counsel to verify.', 'Indexable once public.'] },
  ];
  cols.forEach((c) => {
    const w = 228;
    d.lane(c.x, 82, w, 326, '', { tone: c.tone === 'coral' ? 'ground' : c.tone });
    d.tag(c.x + 14, 92, c.tag, { tone: c.tone === 'ocean' ? 'ocean' : 'indigo' });
    d.text(c.x + w - 14, 103, 'id: ' + c.id, { size: 9.5, weight: 700, fill: COL.n600, anchor: 'end', head: true });
    d.box(c.x + 12, 124, w - 24, 44, { t: c.head, s: c.plane, tone: 'neutral', ts: 10.4, ss: 9.2, bar: true });
    d.box(c.x + 12, 178, w - 24, 46, { t: c.cloud, s: c.id === 'prod' ? 'initial decision, switchable' : 'provider_name switch', tone: c.tone === 'ocean' ? 'solidOcean' : c.tone === 'indigo' ? 'solid' : 'dark', ts: 11, ss: 9, align: 'center' });
    d.box(c.x + 12, 236, w - 24, 140, { tone: 'neutral', s: c.note, ss: 9.2, valign: 'top', fill: '#fff' });
  });
  d.text(130, 400, 'REAL data, small', { size: 9, weight: 700, fill: COL.n600, anchor: 'middle', upper: true, spacing: 1 });
  d.text(380, 400, 'REAL data, larger', { size: 9, weight: 700, fill: COL.n600, anchor: 'middle', upper: true, spacing: 1 });
  d.text(632, 400, 'REAL data, public', { size: 9, weight: 700, fill: COL.n600, anchor: 'middle', upper: true, spacing: 1 });
  d.box(14, 420, 354, 66, { tone: 'ground', t: 'Reserved names (no cost)', s: 'dev and staging follow the same pattern and are not provisioned. Egypt is the only live market; country is configuration, never a host.', ss: 9.2, dash: true });
  d.box(380, 420, 366, 66, { tone: 'warn', t: 'Promotion rule (founder)', s: 'Before moving to the next environment, ask: carry the previous one over, or keep the two separate? Never promote data without the answer.', ss: 9.2 });
  d.box(14, 496, 732, 56, { tone: 'coral', t: 'Not asserted here', s: 'Huawei Cloud region availability for Egypt, data residency and Central Bank of Egypt rules are for the founder to verify. The Huawei region variable is a deliberate placeholder so a plan cannot run by accident.', ss: 9.4 });
  return d;
});

/* ------------------------------------------------------------------ 20. URL registry layout (ADR-059) */
def('url-registry', 'URL registry: one source, many generated files', 'The registry is the only host list. Hostnames, CORS allow-lists, OIDC redirect and back-channel URIs, certificate names and DNS records are generated from it by the validator; application code never contains a domain. A CI job runs the validator in strict mode.', () => {
  const d = new Dia(W, 520, 'URL registry layout');
  d.box(14, 14, 250, 190, { tone: 'solid', t: 'service-url-registry.yaml', s: ['domains: kiorex, kiorly, link', 'environments[]: id, tag, label, plane, data_class', 'oidc.issuer_env: pilot uses prod', 'services[]: id, domain, label, kind, exposure, status', 'cors, oidc_clients, native_clients', 'app_links, legacy_hosts, code_scan'], ts: 12.5, ss: 9.6, valign: 'top' });
  d.box(14, 216, 250, 82, { tone: 'ground', t: '83 hosts, five environments', s: ['17 test, 17 pilot, 21 prod,', '14 dev, 14 staging'], ss: 9.4 });
  d.box(312, 70, 150, 92, { tone: 'dark', t: 'validate-registry.mjs', s: 'naming rules, cert coverage, no localhost, ai has no DNS', ts: 11.5, ss: 9.2, align: 'center' });
  d.arrow([[264, 116], [312, 116]], { tone: 'indigo' });
  d.chip(288, 94, 'read', { size: 8.6 });
  const outs = [['--emit cors', 'browser allow-list per service'], ['--emit redirects', 'OIDC redirect and back-channel URIs'], ['--emit env', 'KX_ENV, issuer, public URLs per app'], ['--emit certs', 'ACM names per environment and domain'], ['--emit dns', 'records per zone'], ['--scan', 'hard-coded host literals in code']];
  outs.forEach((o, i) => {
    const y = 14 + i * 52;
    d.box(520, y, 226, 44, { tone: i === 5 ? 'warn' : 'indigo', t: o[0], s: o[1], ts: 10.4, ss: 9.2 });
    d.arrow([[462, 116], [490, 116], [490, y + 22], [520, y + 22]], { tone: 'indigo', r: 5, w: 1.4 });
  });
  d.lane(14, 334, 732, 176, 'Consumers (never type a host)');
  const con = [['Passport', 'idp.json clients, domains.json, app-link files'], ['Platform, Clinic, Pharmacy, Lab', 'CORS, public base URL, OIDC issuer from env'], ['OpenTofu', 'modules/registry: zones, certificates, aliases'], ['CI', 'validate --strict, then deploy per environment']];
  con.forEach((c, i) => d.box(30 + i * 178, 364, 166, 78, { tone: 'neutral', t: c[0], s: c[1], ts: 11, ss: 9, bar: true }));
  d.box(30, 454, 700, 44, { tone: 'ground', t: 'Frozen identifiers: https://schemas.kiorex.com/event/... are never resolved or changed and need no DNS record', ss: 9.4, ts: 10.2, dash: true, align: 'center' });
  return d;
});

/* ------------------------------------------------------------------ 21. DNS delegation and certificate flow (ADR-059) */
def('dns-cert-flow', 'DNS delegation and certificate flow', 'Route 53 (or the Huawei DNS equivalent) is introduced by delegating only the test child zones: the founder adds one NS record set per registrar and nothing else at the registrars changes. Certificates are one per environment and domain, validated by CNAMEs that live in that environment’s own zone, so renewal is automatic. Apex delegation, DNSSEC DS and CAA come before pilot. No record, certificate or zone has been created yet.', () => {
  const d = new Dia(W, 560, 'DNS delegation and certificate flow');
  d.lane(14, 12, 732, 92, 'Registrars (founder edits records; agents never do)');
  d.box(30, 40, 330, 52, { tone: 'neutral', t: 'domain.com / namecheap.com', s: 'kiorex.com and kiorly.com; website, mail and verification records stay untouched', ss: 9.2 });
  d.box(380, 40, 350, 52, { tone: 'warn', t: 'Founder action: NS record set "test"', s: 'one per domain, four name servers each; apex NS, DNSSEC DS and CAA later, before pilot', ss: 9.2 });
  d.arrow([[545, 92], [545, 128]], { tone: 'warn', label: '1 NS delegation of test', lx: 545, ly: 112, ls: 8.8 });
  d.lane(14, 128, 732, 128, 'DNS hosting (one zone per environment and domain)');
  d.box(30, 156, 210, 88, { tone: 'indigo', t: 'test.kiorex.com', s: 'child zone: explicit records only, no wildcard record, TTL 300', ss: 9.2 });
  d.box(256, 156, 210, 88, { tone: 'ocean', t: 'test.kiorly.com', s: 'child zone, same rules; mail records never in a delegated child', ss: 9.2 });
  d.box(482, 156, 248, 88, { tone: 'ground', t: 'Apex zones before pilot', s: 'kiorex.com, kiorly.com with CAA and DNSSEC; NS for test kept', ss: 9.2, dash: true });
  d.arrow([[135, 244], [135, 296]], { tone: 'indigo', label: '2 CNAME validation', lx: 135, ly: 270, ls: 8.8 });
  d.arrow([[361, 244], [361, 296]], { tone: 'ocean' });
  d.lane(14, 296, 732, 112, 'Certificates (never one shared wildcard)');
  d.box(30, 324, 210, 70, { tone: 'ok', t: 'Cert for test.kiorex.com', s: 'and *.test.kiorex.com (us-east-1 for CloudFront)', ss: 9.2 });
  d.box(256, 324, 210, 70, { tone: 'ok', t: 'Cert for test.kiorly.com', s: 'and *.test.kiorly.com', ss: 9.2 });
  d.box(482, 324, 248, 70, { tone: 'neutral', t: 'Pilot has its own cert', s: 'pilot.<domain> + *.pilot.<domain>, so pilot names retire without touching prod', ss: 9.2 });
  d.arrow([[135, 394], [135, 440]], { tone: 'ok' }); d.arrow([[361, 394], [361, 440]], { tone: 'ok' });
  d.lane(14, 440, 732, 100, 'Serving');
  d.box(30, 466, 210, 60, { tone: 'neutral', t: 'CDN alias per host', s: 'CloudFront or Huawei CDN; HSTS, noindex in non-prod', ss: 9 });
  d.box(256, 466, 210, 60, { tone: 'neutral', t: 'Host :80 behind Caddy', s: 'origin reachable from the CDN only', ss: 9 });
  d.box(482, 466, 248, 60, { tone: 'neutral', t: 'Live Clinic keeps its host', s: 'custom name added to the same distribution, cloudfront.net kept', ss: 9 });
  d.arrow([[240, 496], [256, 496]], { tone: 'grey' });
  d.arrow([[466, 496], [482, 496]], { tone: 'grey', dash: true, noHead: true });
  return d;
});

/* ------------------------------------------------------------------ 22. Passport SSO across Kiorly modules (KX-04) */
def('passport-sso', 'Passport single sign-on across the Kiorly modules', 'Kiorex Passport is the only identity provider. Kiorly Home shows the product tiles; the chosen product (Clinic, Nurse edition, Pharmacy, Lab) completes its own silent authorization-code flow with PKCE, so the user types a password at most once. Passport tells every product about a logout by a signed back-channel call. The issuer is passport.test.kiorex.com in kx-test and passport.kiorex.com for pilot and prod. The production-capable IdP product is still an open decision; kx-test runs the hardened dev IdP.', () => {
  const d = new Dia(W, 560, 'Passport SSO flow');
  const cx = [82, 236, 390, 544, 688];
  const names = [['User', 'browser or Kiorly app', 'indigo'], ['Kiorly Home', 'app.<env>.kiorly.com', 'ocean'], ['Product', 'Clinic, Nurse, Pharmacy, Lab', 'ocean'], ['Kiorex Passport', 'OIDC issuer', 'solid'], ['Other products', 'back-channel receivers', 'neutral']];
  names.forEach((n, i) => { d.box(cx[i] - 66, 12, 132, 46, { tone: n[2], t: n[0], s: n[1], ts: 11, ss: 8.6, align: 'center' }); d.line(cx[i], 58, cx[i], 428, { stroke: COL.n300, w: 1.2, dash: true }); });
  const step = (n, y, a, b, label, tone = 'indigo', dash = false) => {
    d.arrow([[cx[a], y], [cx[b], y]], { tone, dash, w: 1.7 });
    d.chip((cx[a] + cx[b]) / 2, y - 12, `${n}  ${label}`, { stroke: tone === 'ocean' ? COL.ocean : COL.indigo, size: 8.8 });
  };
  step(1, 92, 0, 1, 'opens Kiorly Home, picks a product tile', 'ocean');
  step(2, 124, 1, 2, 'login?sso=passport&from=kiorly-home', 'ocean');
  step(3, 156, 2, 3, 'authorize (code + PKCE), silent', 'indigo');
  step(4, 188, 3, 0, 'no session: sign in once (OTP or password)', 'indigo');
  step(5, 220, 0, 3, 'credentials', 'indigo');
  step(6, 252, 3, 2, 'code to the registered redirect URI', 'indigo');
  step(7, 284, 2, 3, 'code exchange, tokens (aud = product)', 'indigo');
  step(8, 316, 2, 0, 'product session, host-only __Host- cookie', 'ocean');
  step(9, 372, 0, 3, 'sign out (any product)', 'indigo');
  d.arrow([[cx[3], 404], [cx[2], 404]], { tone: 'indigo', dash: true });
  d.arrow([[cx[3], 404], [cx[4], 404]], { tone: 'indigo', dash: true });
  d.chip((cx[2] + cx[3]) / 2, 392, '10  signed logout_token', { stroke: COL.indigo, size: 8.8 });
  d.chip((cx[3] + cx[4]) / 2, 416, 'back-channel to every product', { stroke: COL.indigo, size: 8.8 });
  d.box(14, 440, 560, 34, { tone: 'ground', t: 'Password route: single-use handoff code, 30 seconds, bound to the product', ts: 9.4, align: 'center', fill: '#fff', dash: true });
  d.box(14, 484, 236, 64, { tone: 'indigo', t: 'kx-test issuer', s: 'passport.test.kiorex.com', ss: 9.4 });
  d.box(262, 484, 236, 64, { tone: 'indigo', t: 'pilot and prod issuer', s: 'passport.kiorex.com; pilot adds no second account', ss: 9.2 });
  d.box(510, 484, 236, 64, { tone: 'warn', t: 'Open decision', s: 'production-capable IdP (Cognito default); kx-test identities may not carry over', ss: 9.2 });
  return d;
});

/* ------------------------------------------------------------------ 23. commission funds flow with cash and tenders (COM-1, LG-COM-17..20) */
def('funds-flow-tenders', 'Commission funds flow: online, cash and cash-transfer tenders', 'Kiorex may collect a commission and shows the same ledger to the provider’s ops and admin and to Kiorex ops and admin. Providers in Egypt are paid by bank transfer to their bank account only; cash visits are included by accruing commission and netting it in the next settlement. Kiorex never holds or pays out cash. Each tender kind can have its own configurable commission treatment (LG-COM-20); the recommended default values are editable seeded defaults. Counsel sign-off is NOT_REVIEWED, so every real-money mode stays blocked (mock runs).', () => {
  const d = new Dia(W, 604, 'Commission funds flow by tender');
  const rows = [
    { y: 14, tone: 'indigo', k: 'ONLINE', t: 'Patient pays online (card, wallet, bank) through a licensed payment partner', a: 'Deposit held in the Kiorex Pay ledger, PAYABLE after the visit', b: 'Commission deducted from the bank payout (NET_FROM_PAYOUT)' },
    { y: 140, tone: 'ocean', k: 'CASH', t: 'Patient pays the clinic cash at the visit', a: 'Kiorex never sees the money: commission is accrued from the claim', b: 'Netted in the next bank payout, or invoiced when no payout is due' },
    { y: 266, tone: 'warn', k: 'CASH_TRANSFER', t: 'Direct bank, InstaPay or card terminal at the clinic (own kind)', a: 'Recorded as its own tender kind with a detail (BANK_TRANSFER, INSTAPAY, CARD_TERMINAL)', b: 'Same netting as cash; own configurable rate, floor, cap, mode and grace' },
  ];
  rows.forEach((r) => {
    d.box(14, r.y, 118, 112, { tone: r.tone === 'warn' ? 'warn' : r.tone, t: r.k, s: 'tender', ts: 11, ss: 9, align: 'center' });
    d.box(150, r.y, 226, 112, { tone: 'neutral', t: r.t, ts: 10.6, bar: true });
    d.box(400, r.y, 170, 112, { tone: 'ground', t: 'Accrual', s: r.a, ss: 9, ts: 10 });
    d.box(594, r.y, 152, 112, { tone: 'ground', t: 'Collection', s: r.b, ss: 8.8, ts: 10 });
    d.arrow([[132, r.y + 56], [150, r.y + 56]], { tone: 'grey' });
    d.arrow([[376, r.y + 56], [400, r.y + 56]], { tone: 'grey' });
    d.arrow([[570, r.y + 56], [594, r.y + 56]], { tone: 'grey' });
  });
  d.box(14, 400, 732, 62, { tone: 'dark', t: 'Settlement statement: one ledger, two views (provider ops/admin and Kiorex ops/admin)', s: 'Rate in force, tender kind, dispute window, status timeline, exceptions (unknown tender is never guessed). CSV export. Payout to the provider = bank transfer only.', ts: 11.5, ss: 9.4, align: 'center' });
  d.box(14, 474, 354, 62, { tone: 'ok', t: 'Seeded defaults, editable in Ops', s: 'Percent rate per organisation type with floor and cap; maker-checker; no deploy to change', ss: 9.2 });
  d.box(380, 474, 366, 62, { tone: 'warn', t: 'Counsel sign-off: NOT_REVIEWED', s: 'Real-money collection and payout routes are blocked until a human records APPROVED. Never set on anyone’s behalf', ss: 9.2 });
  d.box(14, 548, 732, 42, { tone: 'coral', t: 'Collection never pauses listing, booking, plan or care (SB-05 resolved, 26 Nov 2026)', ts: 10.6, align: 'center' });
  return d;
});

/* ------------------------------------------------------------------ 24. CI/CD and OpenTofu provider switch (KX-10, KX-21, KX-34) */
def('cicd-provider-switch', 'CI/CD and the OpenTofu provider switch', 'One immutable image per commit is promoted test, then pilot, then prod; environments differ by configuration only, generated from the registry. Each environment root in OpenTofu has one switch, provider_name = aws | huawei, and the modules take identical inputs and return identical outputs on both clouds. Nothing here has been applied; every apply and deploy is the founder’s decision.', () => {
  const d = new Dia(W, 580, 'CI/CD and provider switch');
  d.box(14, 14, 150, 66, { tone: 'dark', t: 'Commit', s: 'GitHub, per repository', ts: 11.5, ss: 9.2, align: 'center' });
  d.box(194, 14, 170, 66, { tone: 'neutral', t: 'CI gates', s: 'lint, typecheck, tests, validate-registry --strict', ts: 11, ss: 8.8, bar: true });
  d.box(394, 14, 170, 66, { tone: 'neutral', t: 'Build once', s: 'one image digest, one web build', ts: 11, ss: 9, bar: true });
  d.box(594, 14, 152, 66, { tone: 'neutral', t: 'Registry', s: 'ECR or SWR', ts: 11, ss: 9, bar: true });
  d.arrow([[164, 47], [194, 47]], { tone: 'indigo' }); d.arrow([[364, 47], [394, 47]], { tone: 'indigo' }); d.arrow([[564, 47], [594, 47]], { tone: 'indigo' });
  const envs = [['kx-test', 'automatic after the founder presses deploy', 'ocean'], ['kx-pilot', 'required reviewers', 'indigo'], ['kx-pro', 'required reviewers', 'indigo']];
  envs.forEach((e, i) => { const x = 14 + i * 252; d.box(x, 112, 226, 52, { tone: e[2] === 'ocean' ? 'solidOcean' : 'solid', t: e[0], s: e[1], ts: 12, ss: 9, align: 'center' }); if (i) d.arrow([[x - 26, 138], [x, 138]], { tone: 'coral' }); });
  d.arrow([[670, 80], [670, 96], [127, 96], [127, 112]], { tone: 'indigo', r: 6, label: 'same digest promoted', lx: 400, ly: 96, ls: 8.8 });
  d.chip(253, 190, 'ask first: carry over or keep separate?', { stroke: COL.warn, size: 9 });
  d.chip(505, 190, 'ask first: carry over or keep separate?', { stroke: COL.warn, size: 9 });
  d.lane(14, 214, 732, 346, 'OpenTofu: envs/test, envs/pilot, envs/prod, one switch');
  d.box(30, 246, 700, 44, { tone: 'dark', t: 'provider_name = "aws"   |   "huawei"', s: 'thin env roots call modules/stack; the idle provider gets dummy settings, so a plan needs credentials for one cloud only', ts: 12, ss: 9.2, align: 'center' });
  const mods = [['registry', 'hosts, zones, cert names from the YAML'], ['network', 'VPC, subnets, security groups'], ['compute_host', 'one host, ARM, no SSH, docker compose'], ['database', 'private PostgreSQL, host volume or managed'], ['dns_zone', 'child zones, then apex'], ['certificate', 'per environment and domain'], ['static_site + cdn_api_edge', 'web and APIs behind the CDN'], ['secrets, budget, alarms', 'containers only, no values in state']];
  mods.forEach((m, i) => d.box(30 + (i % 4) * 177, 304 + Math.floor(i / 4) * 66, 166, 56, { tone: 'neutral', t: m[0], s: m[1], ts: 10, ss: 8.6, bar: true }));
  d.box(30, 444, 340, 98, { tone: 'ocean', t: 'AWS (kx-test now)', s: ['S3 + CloudFront, ECR, Secrets Manager, KMS', 'deploy: SSM Run Command', 'live Clinic is only read, never managed here'], ts: 11, ss: 9, valign: 'top' });
  d.box(390, 444, 340, 98, { tone: 'indigo', t: 'Huawei Cloud (kx-pro initial decision)', s: ['ECS, EVS, OBS, CDN, SWR, DNS, SCM, CSMS', 'deploy: the host polls object storage', 'validated only, never applied; region placeholder'], ts: 11, ss: 9, valign: 'top' });
  return d;
});

/* ------------------------------------------------------------------ public API */
export const hasDiagram = (n) => !!reg[n];
export const diagramNames = () => Object.keys(reg);
export function renderDiagram(name, n) {
  const r = reg[name]; const d = r.build();
  return `<figure class="kxfig" id="kxfig-${esc(name)}-${n}"><div class="kxfig-head"><span class="tag">Diagram ${n}</span><span class="kxfig-title">${esc(r.title)}</span></div><div class="kxfig-body">${d.svg(r.title)}</div><div class="kxfig-cap">${esc(r.caption)}</div></figure>`;
}
export function diagramSvg(name) { return reg[name].build().svg(reg[name].title); }
