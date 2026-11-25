import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { kiorex, opsLogin, waitFor, q } from '../src/clients.js';
import { pharmacy, pharmacyStaff, recordDevGate, releaseDevGate, setFlag, waitPartnerFlags, patientToken, payFake, rnd } from '../src/verticals.js';
import { kiorexWebhook } from '../src/hmac.js';
import { PH_PARTNER, PATIENT_2, KIOREX } from '../src/env.js';
import { patientLogin } from '../src/clients.js';

/** EDGE 44: pharmacy orders. Hostile carts, cancel vs accept race, out-of-order / duplicate / forged partner events, envelope hardening, cross-patient ids. */
let ops: string, p1: string, p2: string, owner: string, pharm: string, branchId: string;
const get = async (id: string, t = p1) => (await kiorex(t, 'GET', `/pharmacy/orders/${id}`)).body;
const waitOrder = (id: string, want: string | string[]) => waitFor(`order ${id} -> ${want}`, async () => { const b = await get(id); return (Array.isArray(want) ? want : [want]).includes(b.status) ? b : false; }, 30_000, 400);
const inboxOrder = async (kxId: string) => (await waitFor('pharmacy inbox order', async () => (await pharmacy(pharm, 'GET', '/kiorex-orders')).body.find((o: any) => o.externalOrderId === kxId) ?? false, 20_000, 400)) as any;
const phEvent = (type: string, data: Record<string, unknown>, over: Record<string, unknown> = {}, secret = PH_PARTNER.webhookSecret, key = PH_PARTNER.key) =>
  kiorexWebhook(secret, '/webhooks/pharmacy', { eventId: `edge-${randomUUID()}`, type, aggregateType: 'Order', aggregateId: String(data.orderId), occurredAt: new Date().toISOString(), data, ...over }, { 'x-kiorly-client-key': key });
const signoff = { pharmacistSignoff: { userId: 'edge_pharmacist', at: new Date().toISOString() } };

async function makeDrug(o: { price?: string; qty?: number; rx?: boolean } = {}) {
  const tag = rnd();
  const d = await pharmacy(owner, 'POST', '/catalogue/drugs', { brandName: `EDGE-Med-${tag}`, activeIngredient: `edge-ing-${tag}`, strength: '500 mg', dosageForm: 'tablet', packSize: '20', rxOnly: o.rx ?? false, price: o.price ?? '40.00' });
  expect(d.status, JSON.stringify(d.body)).toBe(201);
  const exp = new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10);
  const r = await pharmacy(owner, 'POST', '/inventory/receipts', { branchId, invoiceNo: `EDGE-${tag}`, lines: [{ drugId: d.body.id, lotNumber: `L-${tag}`, expiryDate: exp, quantity: o.qty ?? 20, unitCost: '20.00' }] });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return { id: d.body.id as string, name: d.body.brandName as string };
}
async function order(drug: { id: string; name: string }, qty: number, token = p1) {
  expect((await kiorex(token, 'PUT', '/pharmacy/cart', { pharmacyId: branchId, items: [{ sku: drug.id, qty }] })).status).toBe(200);
  expect((await kiorex(token, 'PUT', '/pharmacy/cart/delivery', { method: 'PICKUP' })).status).toBe(200);
  const o = await kiorex(token, 'POST', '/pharmacy/orders', {});
  expect(o.status, JSON.stringify(o.body)).toBe(201);
  await payFake(o.body.payment.paymentId);
  return o.body as { id: string; totalMinor: number; payment: { paymentId: string } };
}
const created: string[] = [];

beforeAll(async () => {
  ops = (await opsLogin()).accessToken; p1 = await patientToken(); p2 = (await patientLogin(PATIENT_2)).accessToken;
  owner = await pharmacyStaff('owner'); pharm = await pharmacyStaff('pharmacist');
  branchId = (await pharmacy(owner, 'GET', '/kiorex-orders/settings')).body.find((x: any) => x.optedIn)?.branchId;
  if (!branchId) throw new Error('no opted-in pharmacy branch (run up.sh --seed)');
  await setFlag(ops, 'kiorex.pharmacy_orders', 'ON').catch(() => undefined);
  await recordDevGate(ops, 'kiorex.pharmacy_orders'); await waitPartnerFlags();
  for (const ch of ['WHATSAPP', 'PUSH']) await kiorex(p1, 'PUT', `/me/notification-preferences/${ch}`, { quietStart: 0, quietEnd: 0 });
});
afterAll(async () => {
  for (const id of created) { // leave no open order behind: reject what is still in the pharmacy inbox
    const o = (await pharmacy(pharm, 'GET', '/kiorex-orders')).body.find?.((x: any) => x.externalOrderId === id);
    if (o && ['RECEIVED', 'ACCEPTED', 'PARTIALLY_ACCEPTED'].includes(o.status)) await pharmacy(pharm, 'POST', `/kiorex-orders/${o.id}/reject`, { reason: 'edge cleanup', reasonCode: 'DAMAGED' }).catch(() => undefined);
  }
  for (const ch of ['WHATSAPP', 'PUSH']) await kiorex(p1, 'PUT', `/me/notification-preferences/${ch}`, { quietStart: null, quietEnd: null }).catch(() => undefined);
  await releaseDevGate(ops, 'kiorex.pharmacy_orders');
});

describe('V. Hostile carts and cross-patient access', () => {
  it('V1 quantities 0, negative, fractional, huge, string, duplicated skus, an unknown sku and a foreign pharmacy are 4xx and create no order', async () => {
    const d = await makeDrug({ qty: 5 });
    const before = (await kiorex(p1, 'GET', '/pharmacy/orders')).body.length ?? 0;
    const bad: unknown[] = [
      [{ sku: d.id, qty: 0 }], [{ sku: d.id, qty: -3 }], [{ sku: d.id, qty: 1.5 }], [{ sku: d.id, qty: 1e9 }], [{ sku: d.id, qty: '2' }], [{ sku: d.id, qty: null }], [{ sku: d.id, qty: 99 }], // 99 > 5 in stock
      [{ sku: 'nope_unknown_sku', qty: 1 }], [], [{ sku: '', qty: 1 }], [{ qty: 1 }], 'not-an-array',
    ];
    for (const items of bad) {
      const r = await kiorex(p1, 'PUT', '/pharmacy/cart', { pharmacyId: branchId, items });
      expect(r.status, JSON.stringify(items)).toBeGreaterThanOrEqual(400); expect(r.status, JSON.stringify(items)).toBeLessThan(500);
    }
    expect((await kiorex(p1, 'PUT', '/pharmacy/cart', { pharmacyId: 'ph_not_a_branch', items: [{ sku: d.id, qty: 1 }] })).status).toBeGreaterThanOrEqual(400);
    // two lines of the same sku must never exceed stock in total
    const dup = await kiorex(p1, 'PUT', '/pharmacy/cart', { pharmacyId: branchId, items: [{ sku: d.id, qty: 4 }, { sku: d.id, qty: 4 }] });
    if (dup.status === 200) { const o = await kiorex(p1, 'POST', '/pharmacy/orders', {}); expect(o.status === 201 ? o.body.totalMinor : 0).toBeLessThanOrEqual(5 * 4000); }
    else expect(dup.status).toBeLessThan(500);
    expect(((await kiorex(p1, 'GET', '/pharmacy/orders')).body.length ?? 0) - before).toBeLessThanOrEqual(1); // at most the (valid) duplicate-clamped one
  });
  it('V2 a prescription-only medicine cannot be ordered without a prescription (4xx, nothing charged)', async () => {
    const d = await makeDrug({ qty: 5, rx: true });
    await kiorex(p1, 'PUT', '/pharmacy/cart', { pharmacyId: branchId, items: [{ sku: d.id, qty: 1 }] });
    await kiorex(p1, 'PUT', '/pharmacy/cart/delivery', { method: 'PICKUP' });
    const o = await kiorex(p1, 'POST', '/pharmacy/orders', {});
    expect(o.status, JSON.stringify(o.body)).toBeGreaterThanOrEqual(400); expect(o.status).toBeLessThan(500);
  });
  it('V3 another patient cannot read, cancel or pay my order (404) and the order id is not an oracle for existence', async () => {
    const d = await makeDrug({ qty: 5 }); const o = await order(d, 1); created.push(o.id);
    expect((await kiorex(p2, 'GET', `/pharmacy/orders/${o.id}`)).status).toBe(404);
    expect((await kiorex(p2, 'POST', `/pharmacy/orders/${o.id}/cancel`)).status).toBe(404);
    expect((await kiorex(p2, 'GET', `/pay/intents/${o.payment.paymentId}`)).status).toBe(404);
    expect((await kiorex(p2, 'GET', '/pharmacy/orders/does_not_exist')).status).toBe(404);
    expect((await kiorex(undefined, 'GET', `/pharmacy/orders/${o.id}`)).status).toBe(401);
    const list = (await kiorex(p2, 'GET', '/pharmacy/orders')).body as any[];
    expect(list.some((x) => x.id === o.id)).toBe(false);
  });
});

describe('R. Cancel versus accept race and partner event ordering', () => {
  it('R1 the patient cancels while the pharmacist accepts, four rounds: exactly one side wins and the money matches (cancelled = refunded in full, accepted = kept captured)', async () => {
    for (let round = 0; round < 4; round++) {
      const d = await makeDrug({ qty: 5 }); const o = await order(d, 1); created.push(o.id);
      await waitOrder(o.id, 'SUBMITTED'); const inbox = await inboxOrder(o.id);
      const [c, a] = await Promise.all([kiorex(p1, 'POST', `/pharmacy/orders/${o.id}/cancel`), pharmacy(pharm, 'POST', `/kiorex-orders/${inbox.id}/accept`, {})]);
      expect(c.status).toBeLessThan(500); expect(a.status).toBeLessThan(500);
      await new Promise((r) => setTimeout(r, 1500));
      const kx = await get(o.id); const ph = (await pharmacy(pharm, 'GET', `/kiorex-orders/${inbox.id}`)).body;
      const refunds = await q('kiorex_platform', `select "amountMinor" from "Refund" where "paymentId" = $1`, [o.payment.paymentId]);
      if (kx.status === 'CANCELLED') {
        expect(refunds.map((r: any) => r.amountMinor), `round ${round} cancelled`).toEqual([o.totalMinor]);
        expect(['CANCELLED', 'REJECTED'], `round ${round}: the pharmacy must end cancelled too, not accepted`).toContain(ph.status);
      } else {
        expect(refunds, `round ${round} not cancelled`).toHaveLength(0);
        expect(['ACCEPTED', 'SUBMITTED', 'RECEIVED']).toContain(kx.status === 'SUBMITTED' ? 'SUBMITTED' : ph.status);
        await pharmacy(pharm, 'POST', `/kiorex-orders/${inbox.id}/reject`, { reason: 'edge cleanup', reasonCode: 'DAMAGED' }).catch(() => undefined);
      }
    }
  });

  it('R2 partner events out of order, duplicated, forged or for unknown orders never corrupt an order: sign-off is mandatory, a final order ignores later events, pickup orders cannot go out for delivery, forged signatures and keys are 401', async () => {
    const d = await makeDrug({ qty: 5 }); const o = await order(d, 1); created.push(o.id);
    await waitOrder(o.id, 'SUBMITTED');
    // DispenseCompleted / OrderReady WITHOUT a pharmacist sign-off: ignored (safety control)
    expect((await phEvent('DispenseCompleted', { orderId: o.id })).body.status).toBe('IGNORED');
    expect((await phEvent('OrderReady', { orderId: o.id })).body.status).toBe('IGNORED');
    expect((await get(o.id)).status).toBe('SUBMITTED');
    // a pickup order cannot be sent out for delivery
    expect((await phEvent('OrderOutForDelivery', { orderId: o.id, ...signoff })).body.status).toBe('IGNORED');
    // the same event id twice is a duplicate
    const ev = { eventId: `edge-dup-${randomUUID()}` };
    expect((await phEvent('OrderReady', { orderId: o.id, ...signoff }, ev)).body.status).toBe('APPLIED');
    expect((await phEvent('OrderReady', { orderId: o.id, ...signoff }, ev)).body.status).toBe('DUPLICATE');
    expect((await waitOrder(o.id, 'READY')).status).toBe('READY');
    // dispensed skipping nothing, then a late OrderReady / OrderRejected must not move a final order
    expect((await phEvent('DispenseCompleted', { orderId: o.id, ...signoff })).body.status).toBe('APPLIED');
    expect((await waitOrder(o.id, 'DISPENSED')).status).toBe('DISPENSED');
    expect((await phEvent('OrderReady', { orderId: o.id, ...signoff })).body.status).toBe('IGNORED');
    expect((await phEvent('OrderRejected', { orderId: o.id, reasonCode: 'LATE' })).body.status).toBe('IGNORED');
    expect((await get(o.id)).status).toBe('DISPENSED');
    expect((await q('kiorex_platform', `select count(*)::int c from "Refund" where "paymentId" = $1`, [o.payment.paymentId]))[0].c).toBe(0); // a late rejection never refunds a released order
    // unknown order: acknowledged, no state
    expect((await phEvent('OrderReady', { orderId: `kx_po_unknown_${rnd()}`, ...signoff })).status).toBe(200);
    // forged: wrong secret, wrong client key, unsigned
    expect((await phEvent('OrderReady', { orderId: o.id, ...signoff }, {}, 'wrong-secret')).status).toBe(401);
    expect((await phEvent('OrderReady', { orderId: o.id, ...signoff }, {}, PH_PARTNER.webhookSecret, 'not_a_client_key')).status).toBe(401);
    const bare = await fetch(`${KIOREX}/api/v1/webhooks/pharmacy`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(bare.status).toBe(401);
  });

  it('R3 hostile partial lines: a DispenseCompleted with NaN / negative / oversized quantities never produces a refund above the paid amount or below zero', async () => {
    const d = await makeDrug({ qty: 10, price: '40.00' }); const o = await order(d, 3); created.push(o.id);
    await waitOrder(o.id, 'SUBMITTED');
    const r = await phEvent('DispenseCompleted', { orderId: o.id, partial: true, lines: [{ sku: d.id, quantityDispensed: 'abc' }, { sku: d.id, quantityDispensed: -4 }], ...signoff });
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(500);
    const b = await waitOrder(o.id, ['REJECTED', 'PARTIALLY_FULFILLED', 'PARTIAL_REVIEW', 'DISPENSED']);
    const refunds = await q('kiorex_platform', `select coalesce(sum("amountMinor"),0)::int s from "Refund" where "paymentId" = $1`, [o.payment.paymentId]);
    expect(refunds[0].s).toBeGreaterThanOrEqual(0); expect(refunds[0].s).toBeLessThanOrEqual(o.totalMinor);
    expect(b.status).not.toBe('DISPENSED');
  });
});

describe('W. Webhook envelope hardening (signed but malformed bodies)', () => {
  it('W1 a signed body that is not an object, has a non-string type/eventId, or an enormous eventId is answered 4xx and never 5xx', async () => {
    const sendRaw = async (raw: string) => {
      const { createHmac } = await import('node:crypto'); const ts = String(Math.floor(Date.now() / 1000));
      const sig = `sha256=${createHmac('sha256', PH_PARTNER.webhookSecret).update(`${ts}.${raw}`).digest('hex')}`;
      const res = await fetch(`${KIOREX}/api/v1/webhooks/pharmacy`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-kiorly-timestamp': ts, 'x-kiorly-signature': sig, 'x-kiorly-client-key': PH_PARTNER.key }, body: raw });
      return res.status;
    };
    for (const raw of ['null', '[]', '7', '"str"', '{}', '{"eventId":7,"type":"OrderReady"}', '{"eventId":"a","type":7}', '{"eventId":{"x":1},"type":"OrderReady"}', `{"eventId":"${'x'.repeat(5000)}","type":"OrderReady"}`, '{"eventId":"a","type":"OrderReady","data":"oops"}', '{"eventId":"a","type":"OrderReady","data":null}', '{"eventId":"edge-null-data","type":"OrderReady","data":{"orderId":null}}']) {
      const s = await sendRaw(raw);
      expect(s, raw.slice(0, 80)).toBeLessThan(500);
    }
  });
});
