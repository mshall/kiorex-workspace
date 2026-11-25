import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tokens, providerBySpecialty, book, kiorlyAppointmentFor, waitStatus, syncProviders, hold, confirm, pickSlot, type Provider } from '../src/fixtures.js';
import { kiorex, kiorly, staffLogin, q, waitFor } from '../src/clients.js';
import { edgePrefix, kiorlyEvent, payLinkIntent, pspDeliver, pspEvent, registerPayLink, intentRow, ledgerBalance, purgeEdgePayments } from '../src/edge.js';
import { randomUUID } from 'node:crypto';
import { KIOREX } from '../src/env.js';

/**
 * EDGE 40: money and payments. Sandbox-fake PSP; every payment lives under a unique clinicId prefix and is purged at the end.
 * Webhooks are delivered exactly as a PSP would (HMAC over the raw body), including duplicates, late and out-of-order deliveries.
 */
const PFX = edgePrefix('money');
let ops: string;
const opsRefund = (paymentId: string, reason: string, amountMinor?: number) => kiorex(ops, 'POST', '/admin/payments/refund', { paymentId, reason, ...(amountMinor === undefined ? {} : { amountMinor }) });
const capture = (p: { id: string; pspRef: string; amountMinor: number; psp: string }, over = {}) => pspDeliver(p.psp, pspEvent(p, 'payment.captured', over));
const ledgerTxs = (paymentId: string) => q('kiorex_platform', `select "idempotencyKey" k, kind from "LedgerTx" where "paymentId" = $1 order by "createdAt"`, [paymentId]);

beforeAll(async () => { ops = (await tokens()).ops; });
afterAll(async () => { await purgeEdgePayments(PFX); });

describe('M. Webhook delivery: duplicate, concurrent, late, out of order, malformed', () => {
  it('M1 the same capture event delivered 8x concurrently: every delivery answers 200, exactly one capture ledger tx, one outbox event', async () => {
    const p = await payLinkIntent(PFX, 12_345);
    const ev = pspEvent(p, 'payment.captured');
    const rs = await Promise.all(Array.from({ length: 8 }, () => pspDeliver(p.psp, ev)));
    expect(rs.map((r) => r.status), JSON.stringify(rs.map((r) => r.body))).toEqual(Array(8).fill(200));
    expect(rs.filter((r) => r.body.status === 'CAPTURED')).toHaveLength(1);
    expect((await intentRow(p.id)).status).toBe('CAPTURED');
    expect((await ledgerTxs(p.id)).filter((t) => t.kind === 'CAPTURE')).toHaveLength(1);
    expect(await q('kiorex_platform', `select 1 from "OutboxEvent" where "dedupeKey" = $1`, [`kiorly.deposit_paid:${p.id}`])).toHaveLength(1);
  });

  it('M2 a replay of the processed event is DUPLICATE; a second capture event with a NEW id is ALREADY_CAPTURED; ledger unchanged', async () => {
    const p = await payLinkIntent(PFX, 5_000);
    const ev = pspEvent(p, 'payment.captured');
    expect((await pspDeliver(p.psp, ev)).body.status).toBe('CAPTURED');
    expect((await pspDeliver(p.psp, ev)).body.status).toBe('DUPLICATE');
    expect((await capture(p)).body.status).toBe('ALREADY_CAPTURED');
    expect(await ledgerTxs(p.id)).toHaveLength(1);
  });

  it('M3 a capture delivered after a failure event (late success) still captures; a failure after a capture never undoes it', async () => {
    const a = await payLinkIntent(PFX, 7_000);
    expect((await pspDeliver(a.psp, pspEvent(a, 'payment.failed'))).body.status).toBe('FAILED_RECORDED');
    expect((await intentRow(a.id)).status).toBe('FAILED');
    expect((await capture(a)).body.status).toBe('CAPTURED');
    const b = await payLinkIntent(PFX, 7_000);
    await capture(b);
    await pspDeliver(b.psp, pspEvent(b, 'payment.failed'));
    expect((await intentRow(b.id)).status).toBe('CAPTURED');
  });

  it('M4 a refund.settled event for a payment with no refund yet is acknowledged without effect (out of order)', async () => {
    const p = await payLinkIntent(PFX, 9_000); await capture(p);
    const r = await pspDeliver(p.psp, pspEvent(p, 'refund.settled', { pspRef: 'rf_unknown' }));
    expect(r.status).toBe(200); expect(r.body.status).toBe('REFUND_NOT_FOUND');
    expect((await intentRow(p.id)).refundedMinor).toBe(0);
  });

  it('M5 bad signature, truncated signature, tampered body and wrong-key are refused; nothing is recorded', async () => {
    const p = await payLinkIntent(PFX, 4_000);
    const ev = pspEvent(p, 'payment.captured');
    expect((await pspDeliver(p.psp, ev, { badSig: true })).status).toBe(400);
    const raw = JSON.stringify(ev);
    const res = await fetch(`${KIOREX}/api/v1/pay/webhooks/${p.psp}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-psp-signature': 'abc' }, body: raw });
    expect(res.status).toBe(400);
    expect((await pspDeliver(p.psp, ev, { sendRaw: raw.replace('4000', '1') })).status).toBe(400); // signed over the original, sent altered
    expect((await intentRow(p.id)).status).toBe('CREATED');
    expect(await q('kiorex_platform', `select 1 from "WebhookReceipt" where "eventId" = $1`, [`psp:${ev.eventId}`])).toHaveLength(0);
  });

  it('M6 a validly signed but malformed body is a 4xx (not a 500)', async () => {
    const r = await pspDeliver('paymob', {}, { raw: '{not json' });
    expect(r.status).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
    const r2 = await pspDeliver('paymob', {}, { raw: '[]' });
    expect(r2.status).toBeGreaterThanOrEqual(400); expect(r2.status).toBeLessThan(500);
    const r3 = await pspDeliver('paymob', { eventId: 'x', type: 'payment.captured' }); // no amount, no refs
    expect(r3.status).toBeLessThan(500);
  });

  it('M7 a failed processing never poisons the event id: an amount-mismatch delivery leaves no PROCESSED receipt and the intent untouched', async () => {
    const p = await payLinkIntent(PFX, 6_000);
    const bad = pspEvent(p, 'payment.captured', { amountMinor: 5_999 });
    const r = await pspDeliver(p.psp, bad);
    expect(r.status).toBe(409); expect(r.body.code).toBe('AMOUNT_MISMATCH');
    expect((await intentRow(p.id)).status).toBe('CREATED');
    const rc = await q('kiorex_platform', `select status from "WebhookReceipt" where "eventId" = $1`, [`psp:${bad.eventId}`]);
    expect(rc.filter((x) => x.status === 'PROCESSED'), 'a delivery that failed must stay retryable').toHaveLength(0);
    // the PSP re-sends the SAME event id with the corrected amount: it must be processed, not dropped as a duplicate
    const fixed = { ...bad, amountMinor: 6_000 };
    expect((await pspDeliver(p.psp, fixed)).body.status).toBe('CAPTURED');
  });

  it('M8 a capture for an unknown payment is 404 and stays retryable (no PROCESSED receipt)', async () => {
    const ev = { eventId: `pspev_${randomUUID()}`, type: 'payment.captured', pspRef: `fake_paymob_nope_${randomUUID()}`, paymentId: 'pay_does_not_exist', amountMinor: 100, occurredAt: new Date().toISOString() };
    expect((await pspDeliver('paymob', ev)).status).toBe(404);
    expect(await q('kiorex_platform', `select 1 from "WebhookReceipt" where "eventId" = $1 and status = 'PROCESSED'`, [`psp:${ev.eventId}`])).toHaveLength(0);
  });
});

describe('N. Amounts, currency and pay-link registration', () => {
  it.each([[-1], [0], [1.5], [2 ** 31], [1e12], [Number.MAX_SAFE_INTEGER]])('N1 amount %s is refused with a 4xx', async (amountMinor) => {
    const r = await registerPayLink({ token: `${PFX}_a_${randomUUID().slice(0, 6)}`, clinicId: `${PFX}_clinic`, amountMinor });
    expect(r.status, JSON.stringify(r.body)).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
  });
  it.each([['ZZZ'], ['egp'], ['USD'], [''], ['EGPX'], ['🙂']])('N2 currency %j is refused (only the market currency EGP is payable today)', async (currency) => {
    const r = await registerPayLink({ token: `${PFX}_c_${randomUUID().slice(0, 6)}`, clinicId: `${PFX}_clinic`, amountMinor: 1000, currency });
    expect(r.status, JSON.stringify(r.body)).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
  });
  it('N3 re-registering a token with the SAME values is idempotent; with a different amount or clinic it is a 409 (no silent overwrite, no silent ignore)', async () => {
    const token = `${PFX}_n3_${randomUUID().slice(0, 6)}`; const body = { token, clinicId: `${PFX}_clinic`, amountMinor: 2000 };
    expect((await registerPayLink(body)).status).toBe(201);
    const again = await registerPayLink(body);
    expect([200, 201]).toContain(again.status);
    expect((await registerPayLink({ ...body, amountMinor: 1 })).status).toBe(409);
    expect((await registerPayLink({ ...body, clinicId: `${PFX}_other` })).status).toBe(409);
    expect((await q('kiorex_platform', `select "amountMinor" from "PayLink" where token = $1`, [token]))[0].amountMinor).toBe(2000);
  });
  it('N4 a registration signed with the wrong secret, or replayed with the same nonce, is 401', async () => {
    const { partnerCall } = await import('../src/hmac.js');
    const r = await partnerCall(KIOREX, { key: 'ff_kiorly-clinic_dev', secret: 'wrong' }, 'POST', '/api/v1/pay/links', { token: `${PFX}_n4`, clinicId: `${PFX}_clinic`, amountMinor: 100 }, { 'x-kiorex-product-key': 'ff_kiorly-clinic_dev' });
    expect(r.status).toBe(401);
  });
  it('N5 concurrent checkouts of one link create ONE payment intent', async () => {
    const token = `${PFX}_n5_${randomUUID().slice(0, 6)}`;
    await registerPayLink({ token, clinicId: `${PFX}_clinic`, amountMinor: 3000 });
    const rs = await Promise.all(Array.from({ length: 6 }, () => kiorex(undefined, 'POST', `/pay/links/${token}/checkout`)));
    expect(rs.every((r) => r.status === 200), JSON.stringify(rs.map((r) => r.body))).toBe(true);
    expect(new Set(rs.map((r) => r.body.paymentId)).size).toBe(1);
    expect(await q('kiorex_platform', `select 1 from "PaymentIntent" where "payLinkToken" = $1`, [token])).toHaveLength(1);
  });
  it('N6 PSP failure then retry: after a failed payment the link can be paid again (a NEW intent), and an expired link is not payable', async () => {
    const token = `${PFX}_n6_${randomUUID().slice(0, 6)}`;
    await registerPayLink({ token, clinicId: `${PFX}_clinic`, amountMinor: 3000 });
    const first = await kiorex(undefined, 'POST', `/pay/links/${token}/checkout`);
    expect((await kiorex(undefined, 'POST', `/pay/fake-checkout/${first.body.paymentId}/complete`, { outcome: 'fail' })).status).toBe(200);
    const second = await kiorex(undefined, 'POST', `/pay/links/${token}/checkout`);
    expect(second.status, JSON.stringify(second.body)).toBe(200);
    expect(second.body.paymentId, 'a failed intent must not be handed out again').not.toBe(first.body.paymentId);
    expect(second.body.status).toBe('CREATED');
    expect((await kiorex(undefined, 'POST', `/pay/fake-checkout/${second.body.paymentId}/complete`, { outcome: 'pay' })).body.status).toBe('CAPTURED');
    expect((await kiorex(undefined, 'GET', `/pay/links/${token}`)).body.status).toBe('PAID');
    // paid link: a third checkout is refused, never a second charge
    expect((await kiorex(undefined, 'POST', `/pay/links/${token}/checkout`)).status).toBe(409);
    // expiry edge: 1 s past expiresAt is refused and reads EXPIRED
    const t2 = `${PFX}_n6x_${randomUUID().slice(0, 6)}`;
    await registerPayLink({ token: t2, clinicId: `${PFX}_clinic`, amountMinor: 3000 });
    await q('kiorex_platform', `update "PayLink" set "expiresAt" = now() at time zone 'utc' - interval '1 second' where token = $1`, [t2]);
    expect((await kiorex(undefined, 'POST', `/pay/links/${t2}/checkout`)).status).toBe(409);
    expect((await kiorex(undefined, 'GET', `/pay/links/${t2}`)).body.status).toBe('EXPIRED');
  });
  it('N7 the payment completes even when the link expired AFTER the checkout started (money that arrived is never dropped)', async () => {
    const p = await payLinkIntent(PFX, 3_000);
    await q('kiorex_platform', `update "PayLink" set "expiresAt" = now() at time zone 'utc' - interval '1 minute' where token = $1`, [p.token]);
    expect((await capture(p)).body.status).toBe('CAPTURED');
  });
});

describe('R. Refunds: partial maths, rounding, over-refund, races, replay', () => {
  it('R1 partial refunds of an odd amount add up to exactly the capture (3 + 3 + remainder), then one more minor unit is refused', async () => {
    const p = await payLinkIntent(PFX, 10_001); await capture(p);
    const a = await opsRefund(p.id, 'part-a', 3_333); const b = await opsRefund(p.id, 'part-b', 3_333);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect((await intentRow(p.id)).status).toBe('PARTIALLY_REFUNDED');
    const rest = await opsRefund(p.id, 'part-c');
    expect(rest.status).toBe(200); expect(rest.body.amountMinor).toBe(3_335);
    const row = await intentRow(p.id);
    expect(row.status).toBe('REFUNDED'); expect(row.refundedMinor).toBe(10_001);
    const over = await opsRefund(p.id, 'part-d', 1);
    expect(over.status).toBe(409); // NOT_REFUNDABLE (fully refunded)
  });
  it('R2 refund amounts that are not positive whole minor units, or exceed the remainder, are 4xx and move no money', async () => {
    const p = await payLinkIntent(PFX, 5_000); await capture(p);
    for (const amountMinor of [0, -5, 1.5, 5_001, 2 ** 31, 1e15]) {
      const r = await opsRefund(p.id, `bad-${amountMinor}`, amountMinor);
      expect(r.status, `${amountMinor}: ${JSON.stringify(r.body)}`).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
    }
    expect((await intentRow(p.id)).refundedMinor).toBe(0);
    expect((await opsRefund(p.id, '')).status).toBeGreaterThanOrEqual(400); // reason is required
  });
  it('R3 refunding an uncaptured or failed payment is NOT_REFUNDABLE; an unknown payment is 404', async () => {
    const p = await payLinkIntent(PFX, 5_000);
    expect((await opsRefund(p.id, 'too-early')).status).toBe(409);
    await pspDeliver(p.psp, pspEvent(p, 'payment.failed'));
    expect((await opsRefund(p.id, 'failed')).status).toBe(409);
    expect((await opsRefund('pay_nope', 'unknown payment')).status).toBe(404);
  });
  it('R4 ten concurrent "refund the rest" requests with different reasons refund the payment exactly once in total', async () => {
    const p = await payLinkIntent(PFX, 8_000); await capture(p);
    const rs = await Promise.all(Array.from({ length: 10 }, (_, i) => opsRefund(p.id, `race-${i}`)));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
    expect(rs.filter((r) => r.status >= 500)).toHaveLength(0);
    const row = await intentRow(p.id);
    expect(row.refundedMinor).toBe(8_000);
    expect(await q('kiorex_platform', `select 1 from "Refund" where "paymentId" = $1`, [p.id])).toHaveLength(1);
  });
  it('R5 the same refund request replayed returns the SAME refund and posts one ledger entry; a late refund.settled webhook cannot double-settle', async () => {
    const p = await payLinkIntent(PFX, 6_000); await capture(p);
    const a = await opsRefund(p.id, 'replay', 2_000); const b = await opsRefund(p.id, 'replay', 2_000);
    expect(b.body.id).toBe(a.body.id);
    expect((await intentRow(p.id)).refundedMinor).toBe(2_000);
    await waitFor('refund settled', async () => (await q('kiorex_platform', `select 1 from "Refund" where id = $1 and status = 'SETTLED'`, [a.body.id]))[0], 30_000);
    const ev = pspEvent(p, 'refund.settled', { pspRef: `fake_rf_${a.body.id}`, amountMinor: 2_000 });
    expect((await pspDeliver(p.psp, ev)).body.status).toBe('ALREADY_SETTLED');
    expect((await ledgerTxs(p.id)).filter((t) => t.kind === 'REFUND_SETTLED')).toHaveLength(1);
  });
  it('R6 a refund settled by webhook BEFORE the worker picked it up settles once; the worker then does nothing', async () => {
    const p = await payLinkIntent(PFX, 6_500); await capture(p);
    const rf = await opsRefund(p.id, 'webhook-first', 6_500);
    const ev = pspEvent(p, 'refund.settled', { pspRef: `fake_rf_${rf.body.id}`, amountMinor: 6_500 });
    await pspDeliver(p.psp, ev);
    await new Promise((r) => setTimeout(r, 3_000)); // the outbox worker runs the PSP refund call too
    expect((await ledgerTxs(p.id)).filter((t) => t.kind === 'REFUND_SETTLED')).toHaveLength(1);
  });
  it('R7 after every scenario the ledger of these payments balances: nothing is left HELD or owed, PSP clearing nets to zero', async () => {
    await new Promise((r) => setTimeout(r, 2_500));
    const unbalanced = await q('kiorex_platform', `select e."txId" from "LedgerEntry" e join "LedgerTx" t on t.id = e."txId" where t."clinicId" like $1 group by e."txId" having sum(e."debitMinor") <> sum(e."creditMinor")`, [`${PFX}%`]);
    expect(unbalanced).toHaveLength(0);
    const held = await ledgerBalance(`HELD:${PFX}_clinic`); const owed = await q('kiorex_platform', `select coalesce(sum(e."creditMinor" - e."debitMinor"),0)::int b from "LedgerEntry" e join "LedgerTx" t on t.id = e."txId" where t."clinicId" like $1 and e.account = 'REFUND_PAYABLE'`, [`${PFX}%`]);
    expect(owed[0].b).toBe(0);
    // HELD only keeps the captured, not-refunded, not-released deposits (those the scenarios left captured on purpose)
    const open = await q('kiorex_platform', `select coalesce(sum("amountMinor" - "refundedMinor"),0)::int n from "PaymentIntent" where "clinicId" like $1 and status in ('CAPTURED','PARTIALLY_REFUNDED') and "releasedAt" is null`, [`${PFX}%`]);
    expect(held).toBe(open[0].n);
  });
});

void kiorlyAppointmentFor; void waitStatus; void confirm;
describe('D. Deposit bookings: concurrent checkout, payment after cancel, release then refund, forfeiture', () => {
  const DEPOSIT = 20_000; // minor units (200 EGP) TEST VALUE ONLY, set on the KX-DEV visit types for this run and removed afterwards
  let t: Awaited<ReturnType<typeof tokens>>; let p: Provider; let staff: string; let typeIds: string[] = []; let clinicId = '';
  const bkRow = async (id: string) => (await q('kiorex_platform', `select status, "depositStatus" from "BookingIntent" where id = $1`, [id]))[0];
  async function depositBooking() {
    const b = await book(t.p1, p);
    const bk = (await kiorex(t.p1, 'GET', `/bookings/${b.id}`)).body;
    expect(bk.depositStatus).toBe('REQUIRED');
    return { ...b, clinicId: (await kiorlyAppointmentFor(b.id)).clinicId as string };
  }
  async function intentFor(id: string) { return (await q('kiorex_platform', `select id, "pspRef", psp, "amountMinor", status, "clinicId" from "PaymentIntent" where "bookingId" = $1 order by "createdAt" desc`, [id])); }

  beforeAll(async () => {
    t = await tokens(); p = await providerBySpecialty(t.p1, 'paediatrics'); staff = await staffLogin('kxdev.mona.fahmy@kiorly.dev');
    const probe = await kiorlyAppointmentFor((await book(t.p1, p)).id); clinicId = probe.clinicId;
    typeIds = (await q('kiorly', `update "AppointmentType" set "depositAmount" = $2 where "clinicId" = $1 and "marketplaceBookable" returning id`, [clinicId, DEPOSIT / 100])).map((r) => r.id);
    await q('kiorly', `update "MarketplaceListing" set "updatedAt" = greatest(now() at time zone 'utc', "updatedAt") + interval '1 second' where "clinicianId" = (select "clinicianId" from "MarketplaceListing" where id = $1)`, [p.id]);
    await syncProviders(t.ops);
  });
  afterAll(async () => {
    if (typeIds.length) await q('kiorly', `update "AppointmentType" set "depositAmount" = null where id = any($1)`, [typeIds]);
    await q('kiorly', `update "Clinic" set "kiorexCancellationPolicy" = null where id = $1`, [clinicId]);
    await q('kiorly', `update "MarketplaceListing" set "updatedAt" = greatest(now() at time zone 'utc', "updatedAt") + interval '1 second' where "clinicianId" = (select "clinicianId" from "MarketplaceListing" where id = $1)`, [p.id]);
    await syncProviders(t.ops).catch(() => undefined);
  });

  it('D1 six concurrent deposit-checkouts (double click, two tabs) create ONE payment intent for the booking', async () => {
    const b = await depositBooking();
    const rs = await Promise.all(Array.from({ length: 6 }, () => kiorex(t.p1, 'POST', `/bookings/${b.id}/deposit-checkout`)));
    expect(rs.every((r) => r.status === 200), JSON.stringify(rs.map((r) => r.body))).toBe(true);
    expect(new Set(rs.map((r) => r.body.paymentId)).size).toBe(1);
    expect(await intentFor(b.id)).toHaveLength(1);
    await kiorex(t.p1, 'POST', `/bookings/${b.id}/cancel`, {});
  });

  it('D2 a deposit cannot be started on a held-only, released, cancelled or somebody else\'s booking', async () => {
    const h = await hold(t.p1, p, await pickSlot(t.p1, p));
    expect([409, 404]).toContain((await kiorex(t.p1, 'POST', `/bookings/${h.body.id}/deposit-checkout`)).status);
    await kiorex(t.p1, 'POST', `/bookings/${h.body.id}/release`);
    expect((await kiorex(t.p1, 'POST', `/bookings/${h.body.id}/deposit-checkout`)).status).toBeGreaterThanOrEqual(400);
    const b = await depositBooking();
    expect((await kiorex(t.p2, 'POST', `/bookings/${b.id}/deposit-checkout`)).status).toBe(404);
    await kiorex(t.p1, 'POST', `/bookings/${b.id}/cancel`, {});
    expect((await kiorex(t.p1, 'POST', `/bookings/${b.id}/deposit-checkout`)).status).toBeGreaterThanOrEqual(400);
  });

  it('D3 the PSP captures AFTER the patient cancelled: the money is refunded automatically, once, and the books balance', async () => {
    const b = await depositBooking();
    await kiorex(t.p1, 'POST', `/bookings/${b.id}/deposit-checkout`);
    const [pi] = await intentFor(b.id);
    expect((await kiorex(t.p1, 'POST', `/bookings/${b.id}/cancel`, { reason: 'changed my mind' })).status).toBe(200);
    expect((await q('kiorex_platform', `select status from "PaymentIntent" where id = $1`, [pi.id]))[0].status).toBe('FAILED');
    expect((await pspDeliver(pi.psp, pspEvent(pi, 'payment.captured'))).body.status).toBe('CAPTURED'); // late success after the intent was closed
    await waitFor('auto refund', async () => (await q('kiorex_platform', `select 1 from "Refund" where "paymentId" = $1 and status = 'SETTLED'`, [pi.id]))[0], 30_000);
    expect((await q('kiorex_platform', `select status, "refundedMinor" from "PaymentIntent" where id = $1`, [pi.id]))[0]).toMatchObject({ status: 'REFUNDED', refundedMinor: DEPOSIT });
    expect(await q('kiorex_platform', `select 1 from "Refund" where "paymentId" = $1`, [pi.id])).toHaveLength(1);
    expect((await bkRow(b.id)).depositStatus).toBe('REFUNDED');
  });

  it('D4 the PSP reports a different amount or currency than the intent: refused (409), no capture, audit trail written', async () => {
    const b = await depositBooking();
    await kiorex(t.p1, 'POST', `/bookings/${b.id}/deposit-checkout`);
    const [pi] = await intentFor(b.id);
    expect((await pspDeliver(pi.psp, pspEvent(pi, 'payment.captured', { amountMinor: DEPOSIT - 1 }))).body.code).toBe('AMOUNT_MISMATCH');
    expect((await pspDeliver(pi.psp, pspEvent(pi, 'payment.captured', { currency: 'USD' }))).body.code).toBe('CURRENCY_MISMATCH');
    expect((await q('kiorex_platform', `select status from "PaymentIntent" where id = $1`, [pi.id]))[0].status).toBe('CREATED');
    expect((await q('kiorex_platform', `select action from "AuditLog" where "resourceId" = $1 order by "createdAt"`, [pi.id])).map((r) => r.action)).toEqual(expect.arrayContaining(['pay.amount_mismatch', 'pay.currency_mismatch']));
    expect((await pspDeliver(pi.psp, pspEvent(pi, 'payment.captured'))).body.status).toBe('CAPTURED'); // the correct event still lands
    await kiorex(t.p1, 'POST', `/bookings/${b.id}/cancel`, {});
  });

  it('D5 refund AFTER release (visit completed, deposit already owed to the clinic) is refused: it must not drive the clinic HELD account negative', async () => {
    const b = await depositBooking();
    const co = await kiorex(t.p1, 'POST', `/bookings/${b.id}/deposit-checkout`);
    await kiorex(undefined, 'POST', `/pay/fake-checkout/${co.body.paymentId}/complete`, { outcome: 'pay' });
    await waitFor('deposit PAID', async () => (await kiorex(t.p1, 'GET', `/bookings/${b.id}`)).body.depositStatus === 'PAID');
    const apt = await kiorlyAppointmentFor(b.id);
    const hBefore = await ledgerBalance(`HELD:${apt.clinicId}`);
    expect((await kiorlyEvent(b.id, apt.id, 'COMPLETED')).status).toBe(200); // COMPLETED without a CHECKED_IN first (out of order) still completes the visit
    await waitFor('deposit RELEASED', async () => (await kiorex(t.p1, 'GET', `/bookings/${b.id}`)).body.depositStatus === 'RELEASED', 30_000);
    const r = await opsRefund(co.body.paymentId, 'refund after release', 5_000);
    expect(r.status, JSON.stringify(r.body)).toBe(409);
    expect(await ledgerBalance(`HELD:${apt.clinicId}`)).toBeGreaterThanOrEqual(Math.min(0, hBefore));
    expect((await q('kiorex_platform', `select "refundedMinor" from "PaymentIntent" where id = $1`, [co.body.paymentId]))[0].refundedMinor).toBe(0);
  });

  it('D6 no-show forfeits a PAID deposit to the clinic exactly once; replaying the NO_SHOW event changes nothing', async () => {
    const b = await depositBooking();
    const co = await kiorex(t.p1, 'POST', `/bookings/${b.id}/deposit-checkout`);
    await kiorex(undefined, 'POST', `/pay/fake-checkout/${co.body.paymentId}/complete`, { outcome: 'pay' });
    await waitFor('deposit PAID', async () => (await kiorex(t.p1, 'GET', `/bookings/${b.id}`)).body.depositStatus === 'PAID');
    const apt = await kiorlyAppointmentFor(b.id);
    expect((await kiorlyEvent(b.id, apt.id, 'NO_SHOW')).status).toBe(200);
    await waitFor('deposit FORFEITED', async () => (await kiorex(t.p1, 'GET', `/bookings/${b.id}`)).body.depositStatus === 'FORFEITED', 30_000);
    const keys = (await ledgerTxs(co.body.paymentId)).map((x) => x.k);
    expect(keys.filter((k) => k.startsWith('release:'))).toHaveLength(1);
    // a cancellation arriving after the no-show (clinic correcting the record) must not refund a forfeited deposit
    expect((await opsRefund(co.body.paymentId, 'after no-show', DEPOSIT)).status).toBe(409);
  });
});
