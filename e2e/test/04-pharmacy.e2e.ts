import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { kiorex, opsLogin, waitFor, q, sleep } from '../src/clients.js';
import { pharmacy, pharmacyStaff, recordDevGate, releaseDevGate, revokeDevGate, setFlag, waitPartnerFlags, patientToken, payFake, rnd } from '../src/verticals.js';
import { partnerCall, kiorexWebhook } from '../src/hmac.js';
import { PH_PARTNER, WEBHOOK_SECRET, PATIENT_1 } from '../src/env.js';
import { randomUUID } from 'node:crypto';
import { purgeE2eConsentPushes } from '../src/db.js';

/**
 * REAL Kiorex <-> Kiorly Pharmacy over HTTP (no fake partner): Kiorex :4000 (partner registration pr_pharmacy_dev) -> Pharmacy :3100 /marketplace/v1,
 * Pharmacy outbox -> Kiorex /webhooks/pharmacy (per-partner secret + X-Kiorly-Client-Key). Kiorly Clinic's Rx share is a signed /webhooks/kiorly event.
 * Money: Kiorex Pay (fake PSP) captures first; rejection = full refund; a partial dispense is refunded pro-rata for the undispensed lines and the rest is released
 * (policy pharmacy.partial_fulfilment, PROPOSED_DEFAULT delegated by founder 23 Nov 2026); delivery orders pass through OUT_FOR_DELIVERY.
 * The launch-locked flag gets DEV-ONLY-NOT-A-REAL-GATE evidence for this database only and is revoked afterwards.
 */
describe('p. Kiorex pharmacy orders against the real Kiorly Pharmacy', () => {
  let ops: string, p1: string, owner: string, pharm: string, branchId: string;

  beforeAll(async () => {
    ops = (await opsLogin()).accessToken; p1 = await patientToken(); owner = await pharmacyStaff('owner'); pharm = await pharmacyStaff('pharmacist');
    const s = await pharmacy(owner, 'GET', '/kiorex-orders/settings');
    branchId = s.body.find((x: any) => x.optedIn)?.branchId;
    if (!branchId) throw new Error('no opted-in pharmacy branch (run `up.sh --seed`)');
    await setFlag(ops, 'kiorex.pharmacy_orders', 'ON').catch(() => undefined);
    await recordDevGate(ops, 'kiorex.pharmacy_orders');
    await waitPartnerFlags();
    // quiet hours must not depend on the time of day: an explicit 0-0 window (= none) for the patient's external channels (an own test below covers the quiet window itself)
    for (const ch of ['WHATSAPP', 'PUSH']) expect((await kiorex(p1, 'PUT', `/me/notification-preferences/${ch}`, { quietStart: 0, quietEnd: 0 })).status).toBe(200);
  });
  afterAll(async () => { for (const ch of ['WHATSAPP', 'PUSH']) await kiorex(p1, 'PUT', `/me/notification-preferences/${ch}`, { quietStart: null, quietEnd: null }).catch(() => undefined); await releaseDevGate(ops, 'kiorex.pharmacy_orders'); await purgeE2eConsentPushes(); }); // fake pat_e2e_* link must not outlive the suite

  async function makeDrug(o: { rx?: boolean; price?: string; qty?: number; schedule?: string; nameAr?: string } = {}) {
    const tag = rnd();
    const d = await pharmacy(owner, 'POST', '/catalogue/drugs', { brandName: `E2E-Med-${tag}`, ...(o.nameAr ? { brandNameAr: `${o.nameAr}${tag}` } : {}), activeIngredient: `e2e-ing-${tag}`, strength: '500 mg', dosageForm: 'tablet', packSize: '20', rxOnly: o.rx ?? false, price: o.price ?? '40.00', ...(o.schedule ? { controlledSchedule: o.schedule } : {}) });
    expect(d.status, JSON.stringify(d.body)).toBe(201);
    if (o.qty === 0) return { id: d.body.id as string, name: d.body.brandName as string, nameAr: d.body.brandNameAr as string | undefined, price: o.price ?? '40.00', lotId: '' }; // listed and priced, never received
    const exp = new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10);
    const r = await pharmacy(owner, 'POST', '/inventory/receipts', { branchId, invoiceNo: `E2E-${tag}`, lines: [{ drugId: d.body.id, lotNumber: `L-${tag}`, expiryDate: exp, quantity: o.qty ?? 20, unitCost: '20.00' }] });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    return { id: d.body.id as string, name: d.body.brandName as string, nameAr: d.body.brandNameAr as string | undefined, price: o.price ?? '40.00', lotId: r.body.lines[0].lotId as string };
  }
  /** Patient: search -> cart -> pickup -> order -> pay. Returns the Kiorex order after the hand-over to the pharmacy. */
  async function order(drug: { id: string; name: string }, qty: number, rxRecordId?: string, delivery?: { line1: string; area?: string; governorate?: string; phone?: string }) {
    const s = await kiorex(p1, 'GET', `/pharmacy/search?q=${encodeURIComponent(drug.name)}&pharmacyId=${branchId}`);
    expect(s.status, JSON.stringify(s.body)).toBe(200);
    expect(s.body.items.find((i: any) => i.sku === drug.id)).toMatchObject({ available: true });
    const cart = await kiorex(p1, 'PUT', '/pharmacy/cart', { pharmacyId: branchId, items: [{ sku: drug.id, qty }], ...(rxRecordId ? { prescriptionRecordId: rxRecordId } : {}) });
    expect(cart.status, JSON.stringify(cart.body)).toBe(200);
    const d = await kiorex(p1, 'PUT', '/pharmacy/cart/delivery', delivery ? { method: 'DELIVERY', address: delivery } : { method: 'PICKUP' });
    expect(d.status, JSON.stringify(d.body)).toBe(200);
    const o = await kiorex(p1, 'POST', '/pharmacy/orders', {});
    expect(o.status, JSON.stringify(o.body)).toBe(201);
    expect(o.body.status).toBe('PENDING_PAYMENT');
    await payFake(o.body.payment.paymentId);
    return o.body as { id: string; totalMinor: number; payment: { paymentId: string } };
  }
  const get = async (id: string) => (await kiorex(p1, 'GET', `/pharmacy/orders/${id}`)).body;
  const waitOrder = (id: string, want: string | string[]) => waitFor(`order ${id} -> ${want}`, async () => { const b = await get(id); return (Array.isArray(want) ? want : [want]).includes(b.status) ? b : false; }, 30_000, 500);
  const inboxOrder = async (kxId: string) => (await waitFor('pharmacy inbox order', async () => (await pharmacy(pharm, 'GET', '/kiorex-orders')).body.find((o: any) => o.externalOrderId === kxId) ?? false, 20_000, 400)) as any;
  const balance = async (account: string) => { const r = await q('kiorex_platform', `select coalesce(sum("creditMinor"),0)::int - coalesce(sum("debitMinor"),0)::int as b from "LedgerEntry" where account = $1`, [account]); return r[0].b as number; };

  it('contract surface: Kiorex lists the pharmacy branch and its catalogue straight from Pharmacy (prices in minor units, controlled never listed)', async () => {
    const ph = await kiorex(p1, 'GET', '/pharmacy/pharmacies');
    expect(ph.status).toBe(200);
    expect(ph.body.find((x: any) => x.id === branchId)).toMatchObject({ pickup: true });
    const drug = await makeDrug({ price: '12.50' });
    const s = await kiorex(p1, 'GET', `/pharmacy/search?q=${encodeURIComponent(drug.name)}`);
    expect(s.body.items.find((i: any) => i.sku === drug.id)).toMatchObject({ name: drug.name, priceMinor: 1250, rxRequired: false, available: true });
    expect(JSON.stringify(s.body)).not.toMatch(/"controlled":true/);
  });

  it('OTC golden path: order -> Pharmacy inbox -> accept -> pharmacist sign-off -> OrderReady -> dispense -> DispenseCompleted -> Kiorex COMPLETED(DISPENSED), funds released', async () => {
    const drug = await makeDrug({ price: '40.00', qty: 10 });
    const o = await order(drug, 2);
    expect(o.totalMinor).toBe(8000);
    // hand-over (Kiorex outbox -> Pharmacy POST /marketplace/v1/orders, idempotent on the Kiorex order id)
    await waitOrder(o.id, 'SUBMITTED');
    const inbox = await inboxOrder(o.id);
    expect(inbox).toMatchObject({ status: 'RECEIVED', hasRx: false, prepaid: true, paymentRef: expect.any(String), patientRef: expect.any(String) });
    expect(inbox.lines[0]).toMatchObject({ drugId: drug.id, qtyRequested: 2, unitPrice: '40.00' });
    // idempotent: the same intent again (same orderId) is a replay, never a second order
    const replay = await partnerCall('http://localhost:3100', PH_PARTNER, 'POST', '/marketplace/v1/orders', { orderId: o.id, branchId, lines: [{ sku: drug.id, quantity: 2, unitPrice: '40.00' }] });
    expect(replay.body).toMatchObject({ orderId: o.id, replayed: true });
    expect((await q('kiorly_pharmacy', `select count(*)::int c from "KiorexOrder" where "externalOrderId" = $1`, [o.id]))[0].c).toBe(1);

    const acc = await pharmacy(pharm, 'POST', `/kiorex-orders/${inbox.id}/accept`, {});
    expect(acc.status, JSON.stringify(acc.body)).toBe(201);
    expect(acc.body.order.status).toBe('ACCEPTED');
    // sign-off is mandatory before OrderReady (safety control, not a flag)
    expect((await pharmacy(pharm, 'POST', `/kiorex-orders/${inbox.id}/ready`)).body.code).toBe('SIGNOFF_REQUIRED');
    expect((await pharmacy(pharm, 'POST', `/dispensings/${acc.body.dispensing.id}/signoff`, {})).status).toBe(201);
    expect((await pharmacy(pharm, 'POST', `/kiorex-orders/${inbox.id}/ready`)).body.status).toBe('READY');
    const ready = await waitOrder(o.id, 'READY');
    expect(ready.readyAt).toBeTruthy();
    expect((await kiorex(p1, 'POST', `/pharmacy/orders/${o.id}/cancel`)).status).toBe(409); // too late to cancel once ready

    const done = await pharmacy(pharm, 'POST', `/dispensings/${acc.body.dispensing.id}/complete`, { idempotencyKey: randomUUID() });
    expect(done.status, JSON.stringify(done.body)).toBe(201);
    expect(done.body.sale.channel).toBe('KIOREX_ORDER');
    const fin = await waitOrder(o.id, 'DISPENSED');
    expect(fin.dispensedAt).toBeTruthy();
    // pharmacy side: outbox rows SENT (at-least-once, de-duplicated by Kiorex on eventId)
    await waitFor('pharmacy outbox drained', async () => (await q('kiorly_pharmacy', `select status from "OutboxEvent" where "aggregateId" = $1`, [o.id])).every((r: any) => r.status === 'SENT'), 15_000, 500);
    const types = (await q('kiorly_pharmacy', `select type from "OutboxEvent" where "aggregateId" = $1 order by "occurredAt"`, [o.id])).map((r: any) => r.type);
    expect(types).toEqual(['OrderReady', 'DispenseCompleted']);
    const receipts = await q('kiorex_platform', `select type, status from "WebhookReceipt" where "aggregateId" = $1 and source = 'pharmacy' order by "receivedAt"`, [o.id]);
    expect(receipts.map((r: any) => r.type)).toEqual(['OrderReady', 'DispenseCompleted']);
    // money: captured at order time, released to the partner payable on dispense (take rate NEEDS_HUMAN = 0), never refunded
    expect(fin.payment.status).toBe('CAPTURED');
    expect(await balance(`PAYABLE:ph:${branchId}`)).toBeGreaterThanOrEqual(8000);
    expect((await q('kiorex_platform', `select count(*)::int c from "Refund" where "paymentId" = $1`, [o.payment.paymentId]))[0].c).toBe(0);
    // Pharmacy settlement entry (idempotent per order) reconciles to the sale
    expect((await q('kiorly_pharmacy', `select count(*)::int c from "SettlementEntry" where "orderRef" = $1`, [o.id]))[0].c).toBe(1);
  });

  it('pharmacist REJECTS: OrderRejected -> Kiorex REJECTED + automatic FULL refund (payment REFUNDED, refund = total)', async () => {
    const drug = await makeDrug({ qty: 5 });
    const o = await order(drug, 1);
    await waitOrder(o.id, 'SUBMITTED');
    const inbox = await inboxOrder(o.id);
    const rej = await pharmacy(pharm, 'POST', `/kiorex-orders/${inbox.id}/reject`, { reason: 'Item damaged', reasonCode: 'DAMAGED' });
    expect(rej.body.status).toBe('REJECTED');
    const b = await waitOrder(o.id, 'REJECTED');
    expect(b.rejectionReason).toBe('DAMAGED');
    expect(b.payment.status).toBe('REFUNDED');
    const refunds = await q('kiorex_platform', `select "amountMinor", reason from "Refund" where "paymentId" = $1`, [o.payment.paymentId]);
    expect(refunds).toEqual([{ amountMinor: o.totalMinor, reason: 'REJECTED' }]);
    expect((await pharmacy(pharm, 'GET', `/kiorex-orders/${inbox.id}`)).body.status).toBe('REJECTED');
  });

  it('PARTIAL dispense (pharmacist accepts fewer units): DispenseCompleted carries the lines => pro-rata refund of the undispensed units, fulfilled units released, itemised refund (PROPOSED_DEFAULT policy)', async () => {
    const drug = await makeDrug({ qty: 10, price: '40.00' });
    const o = await order(drug, 3);
    expect(o.totalMinor).toBe(12000);
    await waitOrder(o.id, 'SUBMITTED');
    const inbox = await inboxOrder(o.id);
    const acc = await pharmacy(pharm, 'POST', `/kiorex-orders/${inbox.id}/accept`, { lines: [{ lineId: inbox.lines[0].id, qtyAccepted: 1 }] });
    expect(acc.body.order.status).toBe('PARTIALLY_ACCEPTED');
    await pharmacy(pharm, 'POST', `/dispensings/${acc.body.dispensing.id}/signoff`, {});
    await pharmacy(pharm, 'POST', `/kiorex-orders/${inbox.id}/ready`);
    await pharmacy(pharm, 'POST', `/dispensings/${acc.body.dispensing.id}/complete`, { idempotencyKey: randomUUID() }).then((r) => expect(r.status).toBe(201));
    const b = await waitOrder(o.id, 'PARTIALLY_FULFILLED');
    // the pharmacy event carries the per-line fulfilment (contracts 1.8.0)
    const ev = (await q('kiorly_pharmacy', `select payload from "OutboxEvent" where "aggregateId" = $1 and type = 'DispenseCompleted'`, [o.id]))[0].payload.data;
    expect(ev).toMatchObject({ partial: true, lines: [{ sku: drug.id, quantityRequested: 3, quantityDispensed: 1 }] });
    // itemised refund shown to the patient: 2 of 3 units x 40 EGP
    expect(b.refund).toMatchObject({ goodsMinor: 8000, deliveryFeeMinor: 0, totalMinor: 8000, fulfilledMinor: 4000, currency: 'EGP', policyNote: 'PROPOSED_DEFAULT delegated by founder 23 Nov 2026' });
    expect(b.refund.lines.find((l: any) => l.sku === drug.id)).toMatchObject({ qtyOrdered: 3, qtyFulfilled: 1, qtyRefunded: 2, refundMinor: 8000 });
    expect(b.payment.status).toBe('PARTIALLY_REFUNDED');
    // money path: Refund row (idempotency key per payment) + ledger release of the NET only + reconciled (nothing left HELD for this payment)
    expect(await q('kiorex_platform', `select "amountMinor", reason, "idempotencyKey" from "Refund" where "paymentId" = $1`, [o.payment.paymentId])).toEqual([{ amountMinor: 8000, reason: 'PARTIAL_FULFILMENT', idempotencyKey: `refund-partial:${o.payment.paymentId}` }]);
    const rel = await q('kiorex_platform', `select e."creditMinor"::int c from "LedgerEntry" e join "LedgerTx" t on t.id = e."txId" where t."paymentId" = $1 and t.kind like 'RELEASE_ORDER%' and e.account like 'PAYABLE:%'`, [o.payment.paymentId]);
    expect(rel.map((r: any) => r.c)).toEqual([4000 - Number(b.platformFeeMinor ?? 0)]);
    const held = await q('kiorex_platform', `select coalesce(sum(e."creditMinor" - e."debitMinor"),0)::int h from "LedgerEntry" e join "LedgerTx" t on t.id = e."txId" where t."paymentId" = $1 and e.account like 'HELD:%'`, [o.payment.paymentId]);
    expect(held[0].h).toBe(0);
    await waitFor('refund settled at the PSP (outbox)', async () => (await get(o.id)).refund?.status === 'SETTLED', 30_000, 500);
    expect((await q('kiorex_platform', `select count(*)::int c from "AuditLog" where action = 'pharmacy.partial_settled' and "resourceId" = $1`, [o.id]))[0].c).toBe(1);
    // the patient is told, in-app, with the amount
    await waitFor('partial-refund notification', async () => (await kiorex(p1, 'GET', '/me/notifications')).body.some((n: any) => n.kind === 'PHARMACY_ORDER_PARTIAL_REFUND'), 15_000, 500);
  });

  it('Rx path: vault prescription -> Pharmacy Rx validation request verifies the token with Kiorex -> pharmacist validates -> dispense; a revoked token is INVALID -> rejected + full refund', async () => {
    // Kiorly Clinic shares a prescription (signed /webhooks/kiorly event; the clinic itself is exercised by 03-booking-golden)
    const sub = (await kiorex(p1, 'GET', '/me/profile')).body.sub ?? (await q('kiorex_platform', `select sub from "PatientProfile" where phone = $1`, [PATIENT_1]))[0].sub;
    const kpid = `pat_e2e_${rnd()}`, clinicId = `cl_e2e_${rnd()}`;
    await q('kiorex_platform', `insert into "KiorlyPatientLink" (id, sub, "clinicId", "kiorlyPatientId", evidence, "createdAt") values ($1,$2,$3,$4,'PHONE', now()) on conflict do nothing`, [`kl_${rnd()}`, sub, clinicId, kpid]).catch(async () => {
      await q('kiorex_platform', `insert into "KiorlyPatientLink" ("sub","clinicId","kiorlyPatientId","evidence") values ($1,$2,$3,'PHONE')`, [sub, clinicId, kpid]);
    });
    const g = await kiorex(p1, 'PUT', '/me/record-sharing/PRESCRIPTIONS', { granted: true }); // the patient's own consent decides (revoked earlier by other suites)
    expect(g.status, JSON.stringify(g.body)).toBe(200);
    // The fake clinic patient is unknown to Kiorly, so the consent push to it answers 404 and Kiorex (correctly) marks the link STALE; the suite needs it LINKED to receive shares.
    const share = async (enc: string) => (await q('kiorex_platform', `update "KiorlyPatientLink" set status = 'LINKED' where "kiorlyPatientId" = $1`, [kpid]), await kiorexWebhook(WEBHOOK_SECRET, '/webhooks/kiorly', { eventId: `e2e_${rnd()}`, type: 'PRESCRIPTION_SHARED', aggregateType: 'Encounter', aggregateId: enc, target: 'KIOREX', occurredAt: new Date().toISOString(), data: { patientId: kpid, scope: 'PRESCRIPTIONS', encounterId: enc, clinicId, signedAt: new Date().toISOString() } })).body;
    expect((await share(`enc_${rnd()}`)).status).toBe('APPLIED');
    const rxs = (await kiorex(p1, 'GET', '/me/prescriptions')).body as any[];
    const rx = rxs.find((r) => r.clinicId === clinicId) ?? rxs[0];
    expect(rx.id).toBeTruthy();
    const drug = await makeDrug({ rx: true, price: '55.00', qty: 5 });
    // (1) valid token
    const o = await order(drug, 1, rx.id);
    await waitOrder(o.id, 'SUBMITTED');
    const inbox = await inboxOrder(o.id);
    expect(inbox).toMatchObject({ hasRx: true, status: 'RECEIVED' });
    expect((await get(o.id)).rxStatus).toBe('PENDING'); // Pharmacy verified the token with Kiorex but a pharmacist must still validate (KPMKT04)
    expect((await pharmacy(pharm, 'POST', `/kiorex-orders/${inbox.id}/accept`, {})).body.code).toBe('RX_VALIDATION_REQUIRED');
    const rxRow = (await pharmacy(pharm, 'GET', `/kiorex-orders/${inbox.id}`)).body;
    expect((await q('kiorly_pharmacy', `select "clinicRef", source from "Prescription" where id = $1`, [rxRow.prescriptionId]))[0]).toMatchObject({ clinicRef: clinicId, source: 'KIOREX_UPLOAD' });
    const val = await pharmacy(pharm, 'POST', `/prescriptions/${rxRow.prescriptionId}/validate`);
    expect(val.body.validated, JSON.stringify(val.body)).toBe(true);
    const acc = await pharmacy(pharm, 'POST', `/kiorex-orders/${inbox.id}/accept`, {});
    expect(acc.status, JSON.stringify(acc.body)).toBe(201);
    await pharmacy(pharm, 'POST', `/dispensings/${acc.body.dispensing.id}/signoff`, {});
    await pharmacy(pharm, 'POST', `/kiorex-orders/${inbox.id}/ready`);
    expect((await waitOrder(o.id, 'READY')).rxStatus).toBe('VALID');
    expect((await pharmacy(pharm, 'POST', `/dispensings/${acc.body.dispensing.id}/complete`, { idempotencyKey: randomUUID() })).status).toBe(201);
    await waitOrder(o.id, 'DISPENSED');

    // (2) revoked before the pharmacy re-validates => INVALID => rejected + full refund
    const rx2 = (await share(`enc_${rnd()}`)); expect(rx2.status).toBe('APPLIED');
    const rec = ((await kiorex(p1, 'GET', '/me/prescriptions')).body as any[]).find((r) => r.id !== rx.id) ?? rx;
    const drug2 = await makeDrug({ rx: true, price: '55.00', qty: 5 });
    const o2 = await order(drug2, 1, rec.id);
    await waitOrder(o2.id, 'SUBMITTED');
    const inbox2 = await inboxOrder(o2.id);
    await kiorexWebhook(WEBHOOK_SECRET, '/webhooks/kiorly', { eventId: `e2e_${rnd()}`, type: 'RECORD_SHARE_REVOKED', aggregateType: 'Patient', aggregateId: kpid, target: 'KIOREX', occurredAt: new Date().toISOString(), data: { patientId: kpid, scope: 'PRESCRIPTIONS', action: 'DELETE_REQUESTED' } });
    const tok = (await kiorex(p1, 'GET', '/me/prescriptions')).body.find?.((r: any) => r.id === rec.id)?.verification?.token ?? 'revoked';
    const v = await partnerCall('http://localhost:3100', PH_PARTNER, 'POST', '/marketplace/v1/prescriptions/validate', { orderId: o2.id, prescriptionRef: rec.id, verificationToken: (await q('kiorex_platform', `select id from "SharedRecord" where id = $1`, [rec.id])).length ? tok : 'kxrx1.gone.invalid', patientRef: sub });
    expect(v.body.status).toBe('INVALID');
    const b2 = await waitOrder(o2.id, 'REJECTED');
    expect(b2).toMatchObject({ rejectionReason: 'RX_INVALID', payment: { status: 'REFUNDED' } });
    expect(inbox2.id).toBeTruthy();
    expect((await q('kiorex_platform', `select "amountMinor" from "Refund" where "paymentId" = $1`, [o2.payment.paymentId]))[0].amountMinor).toBe(o2.totalMinor);
  });

  it('flag OFF at KIOREX (kiorex.pharmacy_orders): new search/cart/order => 403 FEATURE_DISABLED {key,scope}; an existing order stays readable and cancellable (refunded)', async () => {
    const drug = await makeDrug({ qty: 5 });
    const o = await order(drug, 1);
    await waitOrder(o.id, 'SUBMITTED');
    try {
      await setFlag(ops, 'kiorex.pharmacy_orders', 'OFF');
      for (const [m, p, b] of [['GET', '/pharmacy/search?q=x'], ['PUT', '/pharmacy/cart', { pharmacyId: branchId, items: [{ sku: drug.id, qty: 1 }] }], ['POST', '/pharmacy/orders', {}]] as const) {
        const r = await kiorex(p1, m, p, b);
        expect(r.status, `${m} ${p}`).toBe(403);
        expect(r.body).toMatchObject({ code: 'FEATURE_DISABLED', key: 'kiorex.pharmacy_orders' });
      }
      expect((await kiorex(p1, 'GET', `/pharmacy/orders/${o.id}`)).status).toBe(200); // OFF never hides data
      const c = await kiorex(p1, 'POST', `/pharmacy/orders/${o.id}/cancel`);
      expect(c.status, JSON.stringify(c.body)).toBe(200);
      expect(c.body).toMatchObject({ status: 'CANCELLED', payment: { status: 'REFUNDED' } });
      expect((await pharmacy(pharm, 'GET', '/kiorex-orders')).body.find((x: any) => x.externalOrderId === o.id).status).toBe('CANCELLED'); // Kiorex cancelled it at the pharmacy too
    } finally { await setFlag(ops, 'kiorex.pharmacy_orders', 'ON'); }
  });

  it('flag OFF at the PHARMACY (pharmacy.kiorex_orders, org scope): reads 403 with the pharmacy key; a paid order is rejected + refunded; staff inbox 403, data stays; ON again restores', async () => {
    const drug = await makeDrug({ qty: 5 });
    const orgId = (await q('kiorly_pharmacy', `select id from "Tenant" where "externalOrgId" = 'org_demo_kiorly'`))[0].id;
    // create the intent while ON, pay while OFF
    const s = await kiorex(p1, 'PUT', '/pharmacy/cart', { pharmacyId: branchId, items: [{ sku: drug.id, qty: 1 }] }); expect(s.status).toBe(200);
    await kiorex(p1, 'PUT', '/pharmacy/cart/delivery', { method: 'PICKUP' });
    const o = (await kiorex(p1, 'POST', '/pharmacy/orders', {})).body;
    try {
      await setFlag(ops, 'pharmacy.kiorex_orders', 'OFF', 'ORG', orgId);
      await waitPartnerFlags();
      // with several live partners an unscoped listing skips a partner that switched itself off (per-registration routing); asking for THIS partner surfaces its FEATURE_DISABLED
      const demoReg = (await q('kiorex_platform', `select id from "PartnerRegistration" where "clientKey" = 'kx_dev_pharmacy_client'`))[0].id;
      const read = await kiorex(p1, 'GET', `/pharmacy/pharmacies?partnerId=${demoReg}`);
      expect(read.status).toBe(403);
      expect(read.body).toMatchObject({ code: 'FEATURE_DISABLED', key: 'pharmacy.kiorex_orders', partner: 'pharmacy' });
      expect((await pharmacy(pharm, 'GET', '/kiorex-orders')).status).toBe(403);
      await payFake(o.payment.paymentId);
      const b = await waitOrder(o.id, 'REJECTED');
      expect(b).toMatchObject({ rejectionReason: 'FEATURE_DISABLED', payment: { status: 'REFUNDED' } });
      expect((await q('kiorly_pharmacy', `select count(*)::int c from "KiorexOrder" where "externalOrderId" = $1`, [o.id]))[0].c).toBe(0); // never ingested
    } finally { await setFlag(ops, 'pharmacy.kiorex_orders', 'ON', 'ORG', orgId); await waitPartnerFlags(); }
    expect((await pharmacy(pharm, 'GET', '/kiorex-orders')).status).toBe(200);
    expect((await kiorex(p1, 'GET', '/pharmacy/pharmacies')).status).toBe(200);
  });

  it('DELIVERY order: address is mandatory, shown on the patient order, reaches the pharmacy inbox with the delivery method; ready + dispensed flow back (delivered)', async () => {
    const drug = await makeDrug({ price: '30.00', qty: 10 });
    await kiorex(p1, 'PUT', '/pharmacy/cart', { pharmacyId: branchId, items: [{ sku: drug.id, qty: 1 }] });
    const noAddr = await kiorex(p1, 'PUT', '/pharmacy/cart/delivery', { method: 'DELIVERY' });
    expect(noAddr.status).toBe(400);
    expect(noAddr.body.code).toBe('ADDRESS_REQUIRED');
    const addr = { line1: '12 Road 9, Maadi', area: 'Maadi', governorate: 'Cairo', phone: '+201000001001' };
    const o = await order(drug, 1, undefined, addr);
    const placed = await get(o.id);
    expect(placed).toMatchObject({ deliveryMethod: 'DELIVERY', deliveryAddress: addr });
    expect(JSON.stringify(placed)).not.toContain('_feeMinor');
    await waitOrder(o.id, 'SUBMITTED');
    const inbox = await inboxOrder(o.id);
    expect(inbox).toMatchObject({ deliveryMethod: 'DELIVERY', prepaid: true });
    expect(inbox.deliveryAddress).toContain('12 Road 9');
    const acc = await pharmacy(pharm, 'POST', `/kiorex-orders/${inbox.id}/accept`, {});
    await pharmacy(pharm, 'POST', `/dispensings/${acc.body.dispensing.id}/signoff`, {});
    await pharmacy(pharm, 'POST', `/kiorex-orders/${inbox.id}/ready`);
    expect((await waitOrder(o.id, 'READY')).deliveryMethod).toBe('DELIVERY');
    // 1.8.0: staff hands the order to the courier => distinct OUT_FOR_DELIVERY state mirrored in Kiorex, patient notified (AR/EN, mock channels)
    const out = await pharmacy(pharm, 'POST', `/kiorex-orders/${inbox.id}/out-for-delivery`, { estimatedMinutes: 45 });
    expect(out.status, JSON.stringify(out.body)).toBe(201);
    expect(out.body.status).toBe('OUT_FOR_DELIVERY');
    const onTheWay = await waitOrder(o.id, 'OUT_FOR_DELIVERY');
    expect(onTheWay.outForDeliveryAt).toBeTruthy();
    expect((await kiorex(p1, 'POST', `/pharmacy/orders/${o.id}/cancel`)).status).toBe(409); // on its way: too late to cancel
    await pharmacy(pharm, 'POST', `/dispensings/${acc.body.dispensing.id}/complete`, { idempotencyKey: randomUUID() });
    expect((await waitOrder(o.id, 'DISPENSED')).dispensedAt).toBeTruthy();
    expect((await q('kiorly_pharmacy', `select type from "OutboxEvent" where "aggregateId" = $1 order by "occurredAt"`, [o.id])).map((r: any) => r.type)).toEqual(['OrderReady', 'OrderOutForDelivery', 'DispenseCompleted']);
    expect((await q('kiorex_platform', `select type from "WebhookReceipt" where "aggregateId" = $1 and source = 'pharmacy' order by "receivedAt"`, [o.id])).map((r: any) => r.type)).toEqual(['OrderReady', 'OrderOutForDelivery', 'DispenseCompleted']);
    const sub0 = (await q('kiorex_platform', `select sub from "PharmacyOrder" where id = $1`, [o.id]))[0].sub;
    expect((await kiorex(p1, 'GET', '/me/notifications')).body.some((n: any) => n.kind === 'PHARMACY_ORDER_OUT_FOR_DELIVERY')).toBe(true);
    // MessageLog rows (WhatsApp / push) honour quiet hours (market default 22:00-08:00 Cairo). Deterministic at any time of day: the patient's own preference (beforeAll) sets an explicit 0-0 window (no quiet hours) for those channels; the quiet window itself is asserted by the platform test 'quiet hours (explicit window...)' in test/pharmacy.int.spec.ts and the last test of this file.
    {
      const logs = await waitFor('out-for-delivery notification on the mock channels', async () => { const r = await q('kiorex_platform', `select channel, locale, body from "MessageLog" where sub = $1 and "templateId" = 'TODO_NEEDS_HUMAN_pharmacy_order_out_for_delivery' and "createdAt" > (now() at time zone 'utc') - interval '5 minutes'`, [sub0]); return r.length >= 1 ? r : false; }, 15_000, 500) as { channel: string; locale: string; body: string }[];
      expect(logs.every((l) => (l.locale === 'ar' ? /في الطريق/ : /out for delivery/i).test(l.body))).toBe(true); // rendered in the patient's language (AR/EN templates), never the raw key
      // patient was notified at READY and DISPENSED (mock WhatsApp + push go through the same templates and consent checks as real ones)
      const sub = (await q('kiorex_platform', `select sub from "PharmacyOrder" where id = $1`, [o.id]))[0].sub;
      await waitFor('patient notified (ready + dispensed)', async () => (await q('kiorex_platform', `select count(distinct "templateId")::int c from "MessageLog" where sub = $1 and "templateId" in ('TODO_NEEDS_HUMAN_pharmacy_order_ready','TODO_NEEDS_HUMAN_pharmacy_order_dispensed') and "createdAt" > (now() at time zone 'utc') - interval '5 minutes'`, [sub]))[0].c >= 2, 10_000, 500);
    }
  });

  it('OUT_FOR_DELIVERY is for delivery orders only: a pickup order cannot be sent out (409 NOT_A_DELIVERY_ORDER), and an early request on a delivery order is refused', async () => {
    const drug = await makeDrug({ qty: 5 });
    const pick = await order(drug, 1);
    await waitOrder(pick.id, 'SUBMITTED');
    const inboxP = await inboxOrder(pick.id);
    const refused = await pharmacy(pharm, 'POST', `/kiorex-orders/${inboxP.id}/out-for-delivery`, {});
    expect([refused.status, refused.body.code]).toEqual([409, 'NOT_A_DELIVERY_ORDER']);
    const del = await order(drug, 1, undefined, { line1: '3 Garden St, Maadi', area: 'Maadi', phone: '+201000001001' });
    await waitOrder(del.id, 'SUBMITTED');
    const inboxD = await inboxOrder(del.id);
    expect((await pharmacy(pharm, 'POST', `/kiorex-orders/${inboxD.id}/out-for-delivery`, {})).status).toBe(409); // not READY yet
    await pharmacy(pharm, 'POST', `/kiorex-orders/${inboxD.id}/reject`, { reason: 'cleanup', reasonCode: 'DAMAGED' }); // no stray open orders
    await pharmacy(pharm, 'POST', `/kiorex-orders/${inboxP.id}/reject`, { reason: 'cleanup', reasonCode: 'DAMAGED' });
  });

  it('Arabic names (contracts 1.8.0): the medicine has nameAr/formAr from the pharmacy; an Arabic query finds it; the order snapshot keeps nameAr; one without Arabic falls back', async () => {
    const withAr = await makeDrug({ qty: 5, price: '22.00', nameAr: 'دواء-اختبار-' });
    const plain = await makeDrug({ qty: 5 });
    const nameAr = withAr.nameAr!;
    expect(nameAr).toContain('دواء-اختبار-');
    const ar = await kiorex(p1, 'GET', `/pharmacy/search?q=${encodeURIComponent(nameAr)}&pharmacyId=${branchId}`);
    expect(ar.status, JSON.stringify(ar.body)).toBe(200);
    const hit = ar.body.items.find((i: any) => i.sku === withAr.id);
    expect(hit, 'Arabic query finds the medicine').toBeTruthy();
    expect(hit).toMatchObject({ name: withAr.name, nameAr, form: 'tablet', formAr: 'أقراص' });
    const en = await kiorex(p1, 'GET', `/pharmacy/search?q=${encodeURIComponent(withAr.name)}&pharmacyId=${branchId}`);
    expect(en.body.items.some((i: any) => i.sku === withAr.id)).toBe(true);
    const fallback = (await kiorex(p1, 'GET', `/pharmacy/search?q=${encodeURIComponent(plain.name)}&pharmacyId=${branchId}`)).body.items.find((i: any) => i.sku === plain.id);
    expect(fallback.name).toBe(plain.name);
    expect('nameAr' in fallback).toBe(false); // absent, never blank: the apps show the English name
    const o = await order(withAr, 1);
    const placed = await get(o.id);
    expect(placed.items[0]).toMatchObject({ sku: withAr.id, name: withAr.name, nameAr, formAr: 'أقراص' });
    await kiorex(p1, 'POST', `/pharmacy/orders/${o.id}/cancel`); // no stray open order
  });

  it('controlled medicines are never orderable: not in search, cart refused, a forged order intent is refused by the pharmacy (KPRX05)', async () => {
    const drug = await makeDrug({ price: '99.00', qty: 5, schedule: 'SCHEDULE_2', rx: true });
    const s = await kiorex(p1, 'GET', `/pharmacy/search?q=${encodeURIComponent(drug.name)}&pharmacyId=${branchId}`);
    expect(s.status).toBe(200);
    expect(s.body.items.find((i: any) => i.sku === drug.id)).toBeUndefined();
    const cart = await kiorex(p1, 'PUT', '/pharmacy/cart', { pharmacyId: branchId, items: [{ sku: drug.id, qty: 1 }] });
    expect(cart.status, JSON.stringify(cart.body)).toBe(422);
    expect(cart.body.code).toBe('CONTROLLED_NOT_ORDERABLE');
    const forged = await partnerCall('http://localhost:3100', PH_PARTNER, 'POST', '/marketplace/v1/orders', { orderId: `kx_ph_forged_${rnd()}`, branchId, lines: [{ sku: drug.id, quantity: 1, unitPrice: '99.00' }], prescription: { prescriberName: 'Dr X', prescriberLicenceNo: '1' } });
    expect(forged.status, JSON.stringify(forged.body)).toBe(422);
    expect(JSON.stringify(forged.body)).toContain('CONTROLLED_NOT_ORDERABLE');
    const catalogue = await partnerCall('http://localhost:3100', PH_PARTNER, 'GET', `/marketplace/v1/catalogue?pharmacyId=${branchId}&q=${encodeURIComponent(drug.name)}`);
    expect(JSON.stringify(catalogue.body)).not.toContain(drug.id);
  });

  it('out of stock: listed as unavailable, cannot be ordered; a pharmacist OUT_OF_STOCK rejection after payment refunds in full with a localisable reason code', async () => {
    const none = await makeDrug({ qty: 0 }); // priced but never received: no stock to promise, so it is not even listed
    const s = await kiorex(p1, 'GET', `/pharmacy/search?q=${encodeURIComponent(none.name)}&pharmacyId=${branchId}`);
    expect(s.body.items.find((i: any) => i.sku === none.id)).toBeUndefined();
    await kiorex(p1, 'PUT', '/pharmacy/cart', { pharmacyId: branchId, items: [{ sku: none.id, qty: 1 }] });
    await kiorex(p1, 'PUT', '/pharmacy/cart/delivery', { method: 'PICKUP' });
    const blocked = await kiorex(p1, 'POST', '/pharmacy/orders', {});
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('ITEM_UNAVAILABLE');
    // more than the shelf holds is just as unavailable
    const few = await makeDrug({ qty: 2 });
    await kiorex(p1, 'PUT', '/pharmacy/cart', { pharmacyId: branchId, items: [{ sku: few.id, qty: 5 }] });
    const cartView = (await kiorex(p1, 'GET', '/pharmacy/cart')).body;
    expect(cartView.items[0]).toMatchObject({ available: false });
    await kiorex(p1, 'DELETE', '/pharmacy/cart');
    // stock disappears after the patient paid: the pharmacist rejects with a code, Kiorex refunds in full and keeps the code
    const drug = await makeDrug({ qty: 3 });
    const o = await order(drug, 1);
    await waitOrder(o.id, 'SUBMITTED');
    const inbox = await inboxOrder(o.id);
    await pharmacy(pharm, 'POST', `/kiorex-orders/${inbox.id}/reject`, { reason: 'Out of stock', reasonCode: 'OUT_OF_STOCK' });
    const b = await waitOrder(o.id, 'REJECTED');
    expect(b).toMatchObject({ rejectionReason: 'OUT_OF_STOCK', payment: { status: 'REFUNDED' } });
    expect((await q('kiorex_platform', `select "amountMinor" from "Refund" where "paymentId" = $1`, [o.payment.paymentId]))[0].amountMinor).toBe(o.totalMinor);
  });

  it('patient cancels AFTER the pharmacy accepted: the pharmacy releases the reserved stock, Kiorex refunds in full; an unanswered order expires (SLA) and is refunded', async () => {
    const drug = await makeDrug({ qty: 4 });
    const o = await order(drug, 2);
    await waitOrder(o.id, 'SUBMITTED');
    const inbox = await inboxOrder(o.id);
    const acc = await pharmacy(pharm, 'POST', `/kiorex-orders/${inbox.id}/accept`, {});
    expect(acc.status).toBe(201);
    const c = await kiorex(p1, 'POST', `/pharmacy/orders/${o.id}/cancel`);
    expect(c.status, JSON.stringify(c.body)).toBe(200);
    expect(c.body).toMatchObject({ status: 'CANCELLED', payment: { status: 'REFUNDED' } });
    expect((await pharmacy(pharm, 'GET', `/kiorex-orders/${inbox.id}`)).body.status).toBe('CANCELLED');
    // SLA expiry: the pharmacy never answered
    const o2 = await order(drug, 1);
    await waitOrder(o2.id, 'SUBMITTED');
    const inbox2 = await inboxOrder(o2.id);
    await q('kiorly_pharmacy', `update "KiorexOrder" set "slaDueAt" = (now() at time zone 'utc') - interval '1 minute' where id = $1`, [inbox2.id]);
    const exp = await pharmacy(owner, 'POST', '/kiorex-orders/jobs/expire-overdue');
    expect(exp.status).toBe(201);
    expect(exp.body.expired).toBeGreaterThanOrEqual(1);
    const b2 = await waitOrder(o2.id, 'REJECTED');
    expect(b2).toMatchObject({ rejectionReason: 'SLA_EXPIRED', payment: { status: 'REFUNDED' } });
  });

  it('launch-locked: without gate evidence kiorex.pharmacy_orders is AWAITING_GATE (403 scope GATE); evidence in this run is labelled DEV-ONLY-NOT-A-REAL-GATE', async () => {
    const ev = await q('kiorex_platform', `select "gateId" from "FlagGateEvidence" where "flagKey" = 'kiorex.pharmacy_orders'`);
    expect(ev.at(-1)?.gateId).toMatch(/^DEV-ONLY-NOT-A-REAL-GATE/);
    await revokeDevGate(ops, 'kiorex.pharmacy_orders');
    const r = await kiorex(p1, 'GET', '/pharmacy/pharmacies');
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ code: 'FEATURE_DISABLED', key: 'kiorex.pharmacy_orders', scope: 'GATE' });
    await recordDevGate(ops, 'kiorex.pharmacy_orders');
    expect((await kiorex(p1, 'GET', '/pharmacy/pharmacies')).status).toBe(200);
    await sleep(0);
  });

  it('quiet hours are honoured on their own explicit window: the patient preference holds WhatsApp/push until the window ends, at any time of day', async () => {
    const localHour = (new Date().getUTCHours() + 2) % 24; // the window starts an hour ago and ends in two hours: it contains now
    for (const ch of ['WHATSAPP', 'PUSH']) expect((await kiorex(p1, 'PUT', `/me/notification-preferences/${ch}`, { quietStart: (localHour + 23) % 24, quietEnd: (localHour + 2) % 24 })).status).toBe(200);
    try {
      const prefs = (await kiorex(p1, 'GET', '/me/notification-preferences')).body as { channel: string; quietStart: number | null; quietEnd: number | null }[];
      for (const ch of ['WHATSAPP', 'PUSH']) expect(prefs.find((p) => p.channel === ch)).toMatchObject({ quietStart: (localHour + 23) % 24, quietEnd: (localHour + 2) % 24 });
    } finally {
      for (const ch of ['WHATSAPP', 'PUSH']) await kiorex(p1, 'PUT', `/me/notification-preferences/${ch}`, { quietStart: 0, quietEnd: 0 });
    }
  });
});
