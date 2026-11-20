import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { kiorex, opsLogin, waitFor, q, sleep } from '../src/clients.js';
import { pharmacy, pharmacyStaff, recordDevGate, revokeDevGate, setFlag, waitPartnerFlags, patientToken, payFake, rnd } from '../src/verticals.js';
import { partnerCall, kiorexWebhook } from '../src/hmac.js';
import { PH_PARTNER, WEBHOOK_SECRET, PATIENT_1 } from '../src/env.js';
import { randomUUID } from 'node:crypto';
import { purgeE2eConsentPushes } from '../src/db.js';

/**
 * REAL Kiorex <-> Kiorly Pharmacy over HTTP (no fake partner): Kiorex :4000 (partner registration pr_pharmacy_dev) -> Pharmacy :3100 /marketplace/v1,
 * Pharmacy outbox -> Kiorex /webhooks/pharmacy (per-partner secret + X-Kiorly-Client-Key). Kiorly Clinic's Rx share is a signed /webhooks/kiorly event.
 * Money: Kiorex Pay (fake PSP) captures first; rejection = full refund; partial dispense parks in PARTIAL_REVIEW (NEEDS_HUMAN #22).
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
  });
  afterAll(async () => { await revokeDevGate(ops, 'kiorex.pharmacy_orders'); await purgeE2eConsentPushes(); }); // fake pat_e2e_* link must not outlive the suite

  async function makeDrug(o: { rx?: boolean; price?: string; qty?: number } = {}) {
    const tag = rnd();
    const d = await pharmacy(owner, 'POST', '/catalogue/drugs', { brandName: `E2E-Med-${tag}`, activeIngredient: `e2e-ing-${tag}`, strength: '500 mg', dosageForm: 'tablet', packSize: '20', rxOnly: o.rx ?? false, price: o.price ?? '40.00' });
    expect(d.status, JSON.stringify(d.body)).toBe(201);
    const exp = new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10);
    const r = await pharmacy(owner, 'POST', '/inventory/receipts', { branchId, invoiceNo: `E2E-${tag}`, lines: [{ drugId: d.body.id, lotNumber: `L-${tag}`, expiryDate: exp, quantity: o.qty ?? 20, unitCost: '20.00' }] });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    return { id: d.body.id as string, name: d.body.brandName as string, price: o.price ?? '40.00', lotId: r.body.lines[0].lotId as string };
  }
  /** Patient: search -> cart -> pickup -> order -> pay. Returns the Kiorex order after the hand-over to the pharmacy. */
  async function order(drug: { id: string; name: string }, qty: number, rxRecordId?: string) {
    const s = await kiorex(p1, 'GET', `/pharmacy/search?q=${encodeURIComponent(drug.name)}&pharmacyId=${branchId}`);
    expect(s.status, JSON.stringify(s.body)).toBe(200);
    expect(s.body.items.find((i: any) => i.sku === drug.id)).toMatchObject({ available: true });
    const cart = await kiorex(p1, 'PUT', '/pharmacy/cart', { pharmacyId: branchId, items: [{ sku: drug.id, qty }], ...(rxRecordId ? { prescriptionRecordId: rxRecordId } : {}) });
    expect(cart.status, JSON.stringify(cart.body)).toBe(200);
    expect((await kiorex(p1, 'PUT', '/pharmacy/cart/delivery', { method: 'PICKUP' })).status).toBe(200);
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

  it('PARTIAL dispense (pharmacist accepts fewer units): DispenseCompleted partial => Kiorex PARTIAL_REVIEW, funds NOT auto-released (NEEDS_HUMAN #22)', async () => {
    const drug = await makeDrug({ qty: 10 });
    const o = await order(drug, 3);
    await waitOrder(o.id, 'SUBMITTED');
    const inbox = await inboxOrder(o.id);
    const acc = await pharmacy(pharm, 'POST', `/kiorex-orders/${inbox.id}/accept`, { lines: [{ lineId: inbox.lines[0].id, qtyAccepted: 1 }] });
    expect(acc.body.order.status).toBe('PARTIALLY_ACCEPTED');
    await pharmacy(pharm, 'POST', `/dispensings/${acc.body.dispensing.id}/signoff`, {});
    await pharmacy(pharm, 'POST', `/kiorex-orders/${inbox.id}/ready`);
    await pharmacy(pharm, 'POST', `/dispensings/${acc.body.dispensing.id}/complete`, { idempotencyKey: randomUUID() }).then((r) => expect(r.status).toBe(201));
    const b = await waitOrder(o.id, 'PARTIAL_REVIEW');
    expect(b.payment.status).toBe('CAPTURED');
    expect(await balance(`PAYABLE:ph:${branchId}`)).toBeGreaterThanOrEqual(0);
    expect((await q('kiorex_platform', `select count(*)::int c from "LedgerTx" where "paymentId" = $1 and kind like 'RELEASE_ORDER%'`, [o.payment.paymentId]))[0].c).toBe(0);
    expect((await q('kiorex_platform', `select count(*)::int c from "AuditLog" where action = 'pharmacy.partial_dispense_review' and "resourceId" = $1`, [o.id]))[0].c).toBe(1);
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
      const read = await kiorex(p1, 'GET', '/pharmacy/pharmacies');
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

  it('launch-locked: without gate evidence kiorex.pharmacy_orders is AWAITING_GATE (403 scope GATE); evidence in this run is labelled DEV-ONLY-NOT-A-REAL-GATE', async () => {
    const ev = await q('kiorex_platform', `select "gateId" from "FlagGateEvidence" where "flagKey" = 'kiorex.pharmacy_orders'`);
    expect(ev.at(-1)?.gateId).toBe('DEV-ONLY-NOT-A-REAL-GATE');
    await revokeDevGate(ops, 'kiorex.pharmacy_orders');
    const r = await kiorex(p1, 'GET', '/pharmacy/pharmacies');
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ code: 'FEATURE_DISABLED', key: 'kiorex.pharmacy_orders', scope: 'GATE' });
    await recordDevGate(ops, 'kiorex.pharmacy_orders');
    expect((await kiorex(p1, 'GET', '/pharmacy/pharmacies')).status).toBe(200);
    await sleep(0);
  });
});
