import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { kiorex, opsLogin, waitFor, q } from '../src/clients.js';
import { lab, labStaff, recordDevGate, releaseDevGate, revokeDevGate, setFlag, waitPartnerFlags, patientToken, payFake, rnd } from '../src/verticals.js';
import { partnerCall } from '../src/hmac.js';
import { LAB_PARTNER } from '../src/env.js';

/**
 * REAL Kiorex <-> Kiorly Lab over HTTP: Kiorex :4000 (registration pr_lab_dev) -> Lab :3200 /api/v1/integration/v1, Lab outbox -> Kiorex /webhooks/lab
 * (per-partner secret + X-Kiorly-Client-Key). Lab staff steps use the Lab's own API. Kiorex Pay (fake PSP) captures first; funds release on result release.
 * Results reach Kiorex ONLY as LabResultReleased: signed report version + secure link, never values (KLCRIT03).
 * kiorex.lab_bookings is launch-locked: DEV-ONLY-NOT-A-REAL-GATE evidence for this database only, revoked afterwards.
 */
describe('l. Kiorex lab bookings against the real Kiorly Lab', () => {
  let ops: string, p1: string, owner: string, reception: string, tech: string, director: string, signatory: string, phleb: string, manager: string;
  let labId: string, code: string, bench: string, glu: { id: string; mean: number; sd: number }[];

  beforeAll(async () => {
    ops = (await opsLogin()).accessToken; p1 = await patientToken();
    [owner, reception, tech, director, signatory, phleb, manager] = await Promise.all((['owner', 'reception', 'tech', 'director', 'signatory', 'phleb', 'manager'] as const).map(labStaff));
    await setFlag(ops, 'kiorex.lab_bookings', 'ON').catch(() => undefined);
    await recordDevGate(ops, 'kiorex.lab_bookings');
    await waitPartnerFlags();
    code = `E2E${rnd()}`;
    const t = await lab(owner, 'POST', '/catalogue/tests', { code, nameEn: `E2E Glucose ${code}`, nameAr: `جلوكوز اختبار ${code}`, specimenType: 'blood', price: 120, analyteCodes: ['GLU'] });
    expect(t.status, JSON.stringify(t.body)).toBe(201);
    labId = (await lab(owner, 'GET', '/auth/me')).body?.labs?.[0]?.id ?? (await q('kiorly_lab', `select id from "Lab" order by "createdAt" limit 1`))[0].id;
    bench = (await lab(tech, 'GET', '/instruments')).body.find((i: any) => i.kind === 'MANUAL_BENCH').id;
  });
  afterAll(async () => { await releaseDevGate(ops, 'kiorex.lab_bookings'); });

  const slotFor = async () => {
    const from = new Date(Date.now() + 2 * 86400_000), to = new Date(Date.now() + 5 * 86400_000);
    const s = await kiorex(p1, 'GET', `/lab/slots?labId=${labId}&collectionType=HOME&from=${from.toISOString()}&to=${to.toISOString()}`);
    expect(s.status, JSON.stringify(s.body)).toBe(200);
    expect(s.body.slots.length).toBeGreaterThan(0);
    // the demo phlebotomist's open visits (demo seed + earlier runs) must not overlap (PHLEBOTOMIST_UNAVAILABLE / OVERLAP, field-visit travel buffers): choose a clear slot
    const busy = await q('kiorly_lab', `select h."slotStart" s, h."slotEnd" e from "HomeCollection" h join "StaffUser" u on u.id = h."phlebotomistId" where u.email = 'phleb@demo-lab.test' and h.status in ('SCHEDULED','EN_ROUTE','ARRIVED')`);
    const margin = 90 * 60_000;
    const clear = (s.body.slots as { startsAt: string; endsAt: string }[]).filter((x) => busy.every((b: any) => new Date(x.endsAt).getTime() + margin <= new Date(`${b.s.toISOString?.() ?? b.s}`).getTime() || new Date(x.startsAt).getTime() >= new Date(`${b.e.toISOString?.() ?? b.e}`).getTime() + margin));
    const pool = clear.length ? clear : s.body.slots;
    return pool[Math.floor(Math.random() * pool.length)] as { startsAt: string; endsAt: string };
  };
  async function book(slot?: { startsAt: string; endsAt: string }) {
    const sl = slot ?? (await slotFor());
    const b = await kiorex(p1, 'POST', '/lab/bookings', { labId, testCodes: [code], collectionType: 'HOME', slot: sl, address: { line1: '12 Nile St', area: 'Maadi', phone: '+201000000001' } });
    expect(b.status, JSON.stringify(b.body)).toBe(201);
    return b.body as { id: string; totalMinor: number; payment: { paymentId: string } };
  }
  const get = async (id: string) => (await kiorex(p1, 'GET', `/lab/bookings/${id}`)).body;
  const waitBooking = (id: string, want: string | string[]) => waitFor(`booking ${id} -> ${want}`, async () => { const b = await get(id); return (Array.isArray(want) ? want : [want]).includes(b.status) ? b : false; }, 30_000, 500);
  const labOrder = async (kxId: string) => (await waitFor('lab order', async () => (await q('kiorly_lab', `select id, status, source, "orderNumber" from "LabOrder" where "sourceRef" = $1`, [kxId]))[0] ?? false, 20_000, 400)) as { id: string; status: string; source: string };
  const balance = async (account: string) => (await q('kiorex_platform', `select coalesce(sum("creditMinor"),0)::int - coalesce(sum("debitMinor"),0)::int as b from "LedgerEntry" where account = $1`, [account]))[0].b as number;

  it('catalogue and slots come from the Lab: test with the Lab\'s own price (minor units), quote = price authority', async () => {
    const t = await kiorex(p1, 'GET', `/lab/tests?q=${code}`);
    expect(t.status, JSON.stringify(t.body)).toBe(200);
    expect(t.body.items.find((i: any) => i.code === code)).toMatchObject({ labId, priceMinor: 12000, homeCollection: true });
    // 1.8.0 Arabic names: nameAr + Arabic specimen type come from the Lab; Arabic search finds the test; English name is always present; no Arabic => field absent
    const item = t.body.items.find((i: any) => i.code === code);
    expect(item).toMatchObject({ name: `E2E Glucose ${code}`, nameAr: `جلوكوز اختبار ${code}`, sampleTypeAr: 'دم' });
    const ar = await kiorex(p1, 'GET', `/lab/tests?q=${encodeURIComponent(`جلوكوز اختبار ${code}`)}`);
    expect(ar.body.items.map((i: any) => i.code)).toContain(code);
    const noAr = t.body.items.find((i: any) => i.code !== code && !('nameAr' in i));
    if (noAr) expect(noAr.name).toBeTruthy(); // fallback: the apps show the English name
    const quoted = await kiorex(p1, 'GET', `/lab/tests?q=${code}`);
    expect(quoted.body.items.length).toBeGreaterThan(0);
    expect(quoted.body.items.every((i: any) => i.code === code)).toBe(true);
    const q1 = await book();
    expect(q1).toMatchObject({ totalMinor: 12000 });
  });

  it('golden path: booking -> pay -> Lab order (KIOREX_BOOKING, idempotent) -> home collection -> QC-passing result -> sign -> release -> LabResultReleased -> vault secure link only; funds released', async () => {
    const slot = await slotFor();
    const b = await book(slot);
    await payFake(b.payment.paymentId);
    await waitBooking(b.id, 'SUBMITTED');
    const o = await labOrder(b.id);
    expect(o).toMatchObject({ source: 'KIOREX_BOOKING', status: 'AWAITING_COLLECTION' });
    expect((await get(b.id)).tests[0]).toMatchObject({ code, nameAr: `جلوكوز اختبار ${code}` }); // the booking snapshot keeps the Arabic name
    expect((await q('kiorly_lab', `select count(*)::int c from "LabOrder" where "sourceRef" = $1`, [b.id]))[0].c).toBe(1);
    // the same intent again is a replay (idempotent on sourceRef), never a second order
    const replay = await partnerCall('http://localhost:3200', LAB_PARTNER, 'POST', '/api/v1/integration/v1/orders', { sourceRef: b.id, labId, patient: { fullName: 'Amira Samy', externalId: 'x' }, testCodes: [code] });
    expect(replay.body).toMatchObject({ orderId: o.id, created: false });
    // slot capacity consumed on the Lab side
    const hc = (await q('kiorly_lab', `select h.id, h."slotId", h.status from "HomeCollection" h where h."orderId" = $1`, [o.id]))[0];
    expect(hc.slotId).toBeTruthy();
    expect((await q('kiorly_lab', `select booked from "CollectionSlot" where id = $1`, [hc.slotId]))[0].booked).toBeGreaterThanOrEqual(1);

    // --- Lab staff work through the Lab's own API ---
    const order = (await lab(reception, 'GET', `/orders/${o.id}`)).body;
    const spec = order.specimens as { id: string; barcode: string }[];
    expect(spec.length).toBeGreaterThan(0);
    const phlebId = (await q('kiorly_lab', `select id from "StaffUser" where email = 'phleb@demo-lab.test'`))[0].id;
    const asg = await lab(manager, 'POST', `/home-collections/${hc.id}/assign`, { phlebotomistId: phlebId });
    expect(asg.status, JSON.stringify(asg.body)).toBe(201);
    const st = await lab(phleb, 'POST', `/home-collections/${hc.id}/start`);
    expect(st.status, JSON.stringify(st.body)).toBe(201);
    // KLORD04 field safety: "arrived" (a coarse location stamp = check-in) must precede the collection
    const arr = await lab(phleb, 'POST', `/home-collections/${hc.id}/arrive`, { geostamp: { lat: 30.0444, lng: 31.2357 } });
    expect(arr.status, JSON.stringify(arr.body)).toBeLessThan(300);
    const conf = await lab(phleb, 'POST', `/home-collections/${hc.id}/confirm`, { scannedBarcodes: spec.map((s) => s.barcode), identifiersChecked: ['phone', 'externalId'] }, { 'idempotency-key': `e2e-${b.id}` });
    expect(conf.status, JSON.stringify(conf.body)).toBeLessThan(300);
    await waitBooking(b.id, 'COLLECTED'); // LabOrderStatusChanged -> Kiorex
    for (const s of spec) {
      expect((await lab(tech, 'POST', `/specimens/${s.id}/receive`, { scannedBarcode: s.barcode })).status).toBe(201);
      expect((await lab(tech, 'POST', `/specimens/${s.id}/process`, { scannedBarcode: s.barcode })).status).toBe(201);
    }
    // QC must pass for the analyte before results can be validated (KLQC): both levels at target
    const mats = (await lab(tech, 'GET', '/qc/materials')).body as any[];
    const gluId = (await q('kiorly_lab', `select id from "Analyte" where code = 'GLU' and "orgId" = (select "orgId" from "LabOrder" where id = $1)`, [o.id]))[0].id;
    for (const m of mats.filter((x) => x.analyteId === gluId)) {
      const r = await lab(tech, 'POST', '/qc/runs', { instrumentId: bench, materialId: m.id, value: Number(m.targetMean) });
      expect(r.status, JSON.stringify(r.body)).toBe(201);
    }
    const items = (await lab(tech, 'GET', `/orders/${o.id}`)).body.items as { id: string }[];
    const e = await lab(tech, 'POST', '/results', { orderItemId: items[0].id, analyteId: gluId, instrumentId: bench, value: 85 });
    expect(e.status, JSON.stringify(e.body)).toBe(201);
    expect((await lab(director, 'POST', `/results/${e.body.id}/second-entry`, { value: 85 })).status).toBe(201);
    expect((await lab(tech, 'POST', `/results/${e.body.id}/tech-validate`, {})).status).toBe(201);
    const mv = await lab(signatory, 'POST', `/orders/${o.id}/medical-validate`);
    expect(mv.body.every((r: any) => r.ok), JSON.stringify(mv.body)).toBe(true);
    const rep = await lab(signatory, 'POST', `/orders/${o.id}/reports`);
    expect(rep.status, JSON.stringify(rep.body)).toBe(201);
    const rel = await lab(reception, 'POST', `/reports/${rep.body.id}/release`, { channels: ['KIOREX_VAULT'] });
    expect(rel.status, JSON.stringify(rel.body)).toBe(201);
    expect(rel.body.secureLink).toMatch(/\/r\//);
    // PUBLIC_BASE_URL-derived: the Lab web dev port is 5193 (it used to point at 5191, the Clinic docs server).
    expect(new URL(rel.body.secureLink).origin).toBe(process.env.LAB_PUBLIC_BASE_URL ?? 'http://localhost:5193');

    // --- Kiorex: LabResultReleased -> vault (secure link only) + funds released ---
    const done = await waitBooking(b.id, 'RESULT_RELEASED');
    expect(done.resultRecordId).toBeTruthy();
    const rec = (await kiorex(p1, 'GET', `/me/vault/${done.resultRecordId}`)).body;
    expect(rec).toMatchObject({ kind: 'LAB_RESULT' });
    expect(rec.report?.secureLink ?? JSON.stringify(rec)).toContain('/r/');
    expect(JSON.stringify(rec)).not.toMatch(/"values"|"results"|"valueNumeric"|\b85\b/);
    const types = (await q('kiorly_lab', `select type from "OutboxEvent" where payload->'data'->>'orderId' = $1 or "aggregateId" = $1 order by "occurredAt"`, [o.id])).map((r: any) => r.type);
    expect(types).toContain('LabResultReleased');
    await waitFor('lab outbox drained', async () => (await q('kiorly_lab', `select status from "OutboxEvent" where "orgId" = (select "orgId" from "LabOrder" where id = $1)  and status <> 'SENT' and attempts > 0`, [o.id])).length === 0, 15_000, 500);
    const r = await q('kiorex_platform', `select type from "WebhookReceipt" where source = 'lab' and payload::text like $1`, [`%${o.id}%`]);
    expect(r.map((x: any) => x.type)).toContain('LabResultReleased');
    expect(await balance(`PAYABLE:lab:${labId}`)).toBeGreaterThanOrEqual(12000);
    expect(done.payment.status).toBe('CAPTURED');
    expect((await q('kiorex_platform', `select count(*)::int c from "Refund" where "paymentId" = $1`, [b.payment.paymentId]))[0].c).toBe(0);
  });

  it('Lab refuses (slot gone / full): Kiorex rejects the booking and refunds in full; patient cancel before collection refunds and cancels at the Lab', async () => {
    // cancel path
    const b = await book(); await payFake(b.payment.paymentId); await waitBooking(b.id, 'SUBMITTED');
    const o = await labOrder(b.id);
    const c = await kiorex(p1, 'POST', `/lab/bookings/${b.id}/cancel`);
    expect(c.status, JSON.stringify(c.body)).toBe(200);
    expect(c.body).toMatchObject({ status: 'CANCELLED', payment: { status: 'REFUNDED' } });
    expect((await q('kiorly_lab', `select status from "LabOrder" where id = $1`, [o.id]))[0].status).toBe('CANCELLED');
    expect((await q('kiorex_platform', `select "amountMinor" from "Refund" where "paymentId" = $1`, [b.payment.paymentId]))[0].amountMinor).toBe(b.totalMinor);
    // slot full at the Lab after Kiorex's pre-check: fill capacity directly then pay
    const slot = await slotFor();
    const b2 = await book(slot);
    await q('kiorly_lab', `update "CollectionSlot" set booked = capacity where "startsAt" = $1`, [slot.startsAt]);
    await payFake(b2.payment.paymentId);
    const rej = await waitBooking(b2.id, 'REJECTED');
    expect(rej).toMatchObject({ rejectionReason: 'SLOT_FULL', payment: { status: 'REFUNDED' } });
    await q('kiorly_lab', `update "CollectionSlot" set booked = 0 where "startsAt" = $1`, [slot.startsAt]);
  });

  it('flag OFF at KIOREX (kiorex.lab_bookings): new tests/slots/bookings 403 FEATURE_DISABLED {key,scope}; existing bookings readable', async () => {
    const b = await book(); await payFake(b.payment.paymentId); await waitBooking(b.id, 'SUBMITTED');
    try {
      await setFlag(ops, 'kiorex.lab_bookings', 'OFF');
      for (const [m, p, body] of [['GET', '/lab/tests'], ['GET', `/lab/slots?labId=${labId}&collectionType=HOME`], ['POST', '/lab/bookings', {}]] as const) {
        const r = await kiorex(p1, m, p, body);
        expect(r.status, p).toBe(403);
        expect(r.body).toMatchObject({ code: 'FEATURE_DISABLED', key: 'kiorex.lab_bookings' });
      }
      expect((await kiorex(p1, 'GET', `/lab/bookings/${b.id}`)).status).toBe(200);
    } finally { await setFlag(ops, 'kiorex.lab_bookings', 'ON'); }
  });

  it('flag OFF at the LAB (lab.kiorex_bookings, org scope): Kiorex sees 403 FEATURE_DISABLED with the lab key; a paid booking is rejected + refunded; ON again restores', async () => {
    const orgId = (await q('kiorly_lab', `select id from "Tenant" where slug = 'demo-lab'`))[0].id;
    const b = await book();
    try {
      await setFlag(ops, 'lab.kiorex_bookings', 'OFF', 'ORG', orgId);
      await waitPartnerFlags();
      const r = await kiorex(p1, 'GET', '/lab/tests');
      expect(r.status).toBe(403);
      expect(r.body).toMatchObject({ code: 'FEATURE_DISABLED', key: 'lab.kiorex_bookings', partner: 'lab' });
      await payFake(b.payment.paymentId);
      expect(await waitBooking(b.id, 'REJECTED')).toMatchObject({ rejectionReason: 'FEATURE_DISABLED', payment: { status: 'REFUNDED' } });
      expect((await q('kiorly_lab', `select count(*)::int c from "LabOrder" where "sourceRef" = $1`, [b.id]))[0].c).toBe(0);
    } finally { await setFlag(ops, 'lab.kiorex_bookings', 'ON', 'ORG', orgId); await waitPartnerFlags(); }
    expect((await kiorex(p1, 'GET', '/lab/tests')).status).toBe(200);
  });

  it('launch-locked: without gate evidence kiorex.lab_bookings is AWAITING_GATE (403 scope GATE); the evidence of this run is labelled DEV-ONLY-NOT-A-REAL-GATE', async () => {
    expect((await q('kiorex_platform', `select "gateId" from "FlagGateEvidence" where "flagKey" = 'kiorex.lab_bookings'`)).at(-1)?.gateId).toMatch(/^DEV-ONLY-NOT-A-REAL-GATE/);
    await revokeDevGate(ops, 'kiorex.lab_bookings');
    const r = await kiorex(p1, 'GET', '/lab/tests');
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ code: 'FEATURE_DISABLED', key: 'kiorex.lab_bookings', scope: 'GATE' });
    await recordDevGate(ops, 'kiorex.lab_bookings');
  });
});
