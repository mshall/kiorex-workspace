import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { kiorex, opsLogin, waitFor, q } from '../src/clients.js';
import { kiorexWebhook } from '../src/hmac.js';
import { pharmacy, pharmacyStaff, lab, labStaff, recordDevGate, releaseDevGate, setFlag, waitPartnerFlags, patientToken, payFake, rnd } from '../src/verticals.js';
import { WEBHOOK_SECRET } from '../src/env.js';

/**
 * GRW-P4-A on a PRIVATE real stack (`scripts/cross-product-stack.sh up`: Kiorex :4103 built from the lane's worktree, Kiorly Pharmacy :3103, Kiorly Lab :3203, own databases, the shared Passport read only).
 * Clinic visit -> shared prescription -> continuity card -> REAL Pharmacy order (HTTP, signed, contract-valid block) -> CROSS_PRODUCT decision with the clinic decision as parent -> funnel; and a lab order -> REAL Lab booking.
 * The Clinic is played by the signed webhook (as 04-pharmacy.e2e.ts does; the Clinic itself is covered by 03-booking-golden), the clinic booking and its decision are written to the lane's own database.
 * The launch-locked package flag gets the DEV-ONLY gate evidence for this database and loses it again in afterAll. Nothing here is a real approval.
 */
const STACK = process.env.E2E_KIOREX_URL?.includes(':4103');
const d = STACK ? describe : describe.skip; // never runs against the shared stack (it does not carry this lane's build)
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
d('39. Cross-product journeys: clinic visit to Pharmacy and Lab on the real private stack', () => {
  let ops: string, p1: string, owner: string, pharm: string, labOwner: string, branchId: string, sub: string, labId: string, code: string;
  let visitId = '', visitDecision = '', kpid = '', clinicId = '';
  const B = '/growth/v1/continuity';

  beforeAll(async () => {
    ops = (await opsLogin()).accessToken; p1 = await patientToken(); owner = await pharmacyStaff('owner'); pharm = await pharmacyStaff('pharmacist'); labOwner = await labStaff('owner');
    branchId = (await pharmacy(owner, 'GET', '/kiorex-orders/settings')).body.find((x: any) => x.optedIn)?.branchId;
    if (!branchId) throw new Error('no opted-in pharmacy branch (the private stack seeds it)');
    sub = (await kiorex(p1, 'GET', '/me/profile')).body.sub;
    for (const k of ['kiorex.pharmacy_orders', 'kiorex.lab_bookings']) { await setFlag(ops, k, 'ON').catch(() => undefined); await recordDevGate(ops, k); }
    await recordDevGate(ops, 'growth.cross_product'); await waitPartnerFlags();
    for (const ch of ['WHATSAPP', 'PUSH']) await kiorex(p1, 'PUT', `/me/notification-preferences/${ch}`, { quietStart: 0, quietEnd: 0 });
    await q('kiorex_platform', `delete from "CrossProductEntryPoint" where sub = $1`, [sub]); await kiorex(p1, 'PUT', `${B}/consent`, { granted: false, source: 'web' }); // the consent history is append-only: a repeat run starts from a withdrawal
    // a completed visit of the patient at a clinic, decided by the real clinic rules (no provider evidence here: UNATTRIBUTED), written the way the booking module leaves it
    clinicId = `cl_e2e_${rnd()}`; visitId = `kx_bk_e2e39${rnd()}`; kpid = `pat_e2e_${rnd()}`;
    const startsAt = new Date(Date.now() - 3 * 3600_000).toISOString();
    await q('kiorex_platform', `insert into "BookingIntent" (id, sub, "providerId", "clinicId", "clinicianId", "tenantId", "typeId", "startsAt", "endsAt", status, channel, "createdAt", "updatedAt") values ($1,$2,'lst_e2e',$3,'dr_e2e','org_e2e','typ_e2e',$4::timestamptz,$4::timestamptz + interval '30 minutes','COMPLETED','MARKETPLACE',$4::timestamptz - interval '1 day', now())`, [visitId, sub, clinicId, startsAt]);
    const pol = (await kiorex(ops, 'GET', '/growth/config/resolve?kind=ATTRIBUTION_POLICY&market=EG')).body?.versionId as string | undefined; // the real resolver (it materialises the PROPOSED_DEFAULT row on first read)
    if (!pol) throw new Error('no ATTRIBUTION_POLICY version resolved by the private Kiorex');
    visitDecision = `gad_e2e39_${rnd()}`;
    await q('kiorex_platform', `insert into "GrowthAttributionDecision" (id, market, "bookingId", origin, "reasonCode", "policyVersionId", "inputsHash", "evidenceTouchIds") values ($1,'EG',$2,'MARKETPLACE','MARKETPLACE_TOUCH',$3,$4,'{}')`, [visitDecision, visitId, pol, sha(visitId)]);
    // the Clinic shares the prescription and the lab order (signed webhooks); the patient has granted the prescription share
    await q('kiorex_platform', `insert into "KiorlyPatientLink" (id, sub, "clinicId", "kiorlyPatientId", evidence, status, "createdAt") values ($1,$2,$3,$4,'PHONE','LINKED', now())`, [`kl_${rnd()}`, sub, clinicId, kpid]);
    expect((await kiorex(p1, 'PUT', '/me/record-sharing/PRESCRIPTIONS', { granted: true })).status).toBe(200);
    await q('kiorex_platform', `update "KiorlyPatientLink" set status = 'LINKED' where "kiorlyPatientId" = $1`, [kpid]);
    code = `E2E${rnd()}`;
    expect((await lab(labOwner, 'POST', '/catalogue/tests', { code, nameEn: `E2E39 ${code}`, nameAr: `اختبار ${code}`, specimenType: 'blood', price: 120, analyteCodes: ['GLU'] })).status).toBe(201);
    labId = (await lab(labOwner, 'GET', '/auth/me')).body?.labs?.[0]?.id ?? (await q('kiorly_lab', `select id from "Lab" order by "createdAt" limit 1`))[0].id;
  });
  afterAll(async () => {
    for (const k of ['growth.cross_product', 'kiorex.pharmacy_orders', 'kiorex.lab_bookings']) await releaseDevGate(ops, k).catch(() => undefined);
    for (const ch of ['WHATSAPP', 'PUSH']) await kiorex(p1, 'PUT', `/me/notification-preferences/${ch}`, { quietStart: null, quietEnd: null }).catch(() => undefined);
  });

  // the fake clinic patient is unknown to Kiorly, so the consent push to it answers 404 and Kiorex (correctly) marks the link STALE: the suite needs it LINKED to receive each share (as 04-pharmacy does)
  const webhook = async (type: string, aggregateId: string, data: Record<string, unknown>) => (await q('kiorex_platform', `update "KiorlyPatientLink" set status = 'LINKED' where "kiorlyPatientId" = $1`, [kpid]), kiorexWebhook(WEBHOOK_SECRET, '/webhooks/kiorly', { eventId: `e2e_${rnd()}${randomUUID().slice(0, 4)}`, type, aggregateType: 'Encounter', aggregateId, target: 'KIOREX', occurredAt: new Date().toISOString(), data }));
  const cards = async () => (await kiorex(p1, 'GET', `${B}/cards`)).body as { enabled: boolean; consent: boolean; cards: any[] };

  it('locked until a human records the gate: no cards (the DEV-ONLY gate of this database is recorded in beforeAll and the suite proves the unlocked path)', async () => {
    expect(await cards()).toMatchObject({ enabled: true });
    const defs = (await kiorex(ops, 'GET', '/admin/flags')).body as any[];
    expect(defs.find((x) => x.key === 'growth.cross_product')).toMatchObject({ launchLocked: true });
    expect((await kiorex(undefined, 'GET', `${B}/cards`)).status).toBe(401);
  });

  it('a shared prescription offers the pharmacy card; the order that attaches it to a REAL pharmacy order is CROSS_PRODUCT with the clinic decision as parent; the partner receives a contract-valid block that never mentions continuity', async () => {
    const enc = `enc_${rnd()}`;
    expect((await webhook('PRESCRIPTION_SHARED', enc, { patientId: kpid, scope: 'PRESCRIPTIONS', encounterId: enc, clinicId, signedAt: new Date(Date.now() - 3_000_000).toISOString(), items: [{ name: 'Amoxicillin 500', dose: '1 tab' }] })).body.status).toBe('APPLIED');
    const c = await waitFor('the pharmacy card', async () => (await cards()).cards.find((x) => x.kind === 'RX_TO_PHARMACY') ?? false, 15_000, 400);
    expect(c).toMatchObject({ toProduct: 'PHARMACY', path: '/pharmacy' }); expect(c.recordId).toBeTruthy();
    expect((await kiorex(p1, 'PUT', `${B}/consent`, { granted: true, source: 'web' })).body.granted).toBe(true);
    const tag = rnd();
    const dr = (await pharmacy(owner, 'POST', '/catalogue/drugs', { brandName: `E2E-39-${tag}`, activeIngredient: `e2e-ing-${tag}`, strength: '500 mg', dosageForm: 'tablet', packSize: '20', rxOnly: true, price: '40.00' })).body;
    expect((await pharmacy(owner, 'POST', '/inventory/receipts', { branchId, invoiceNo: `E2E39-${tag}`, lines: [{ drugId: dr.id, lotNumber: `L-${tag}`, expiryDate: new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10), quantity: 20, unitCost: '20.00' }] })).status).toBe(201);
    expect((await kiorex(p1, 'PUT', '/pharmacy/cart', { pharmacyId: branchId, items: [{ sku: dr.id, qty: 1 }], prescriptionRecordId: c.recordId })).status).toBe(200);
    expect((await kiorex(p1, 'PUT', '/pharmacy/cart/delivery', { method: 'PICKUP' })).status).toBe(200);
    const o = await kiorex(p1, 'POST', '/pharmacy/orders', { prescriptionRecordId: c.recordId }, { 'x-kx-continuity': c.id }); expect(o.status, JSON.stringify(o.body)).toBe(201);
    await payFake(o.body.payment.paymentId);
    await waitFor('order submitted', async () => (await kiorex(p1, 'GET', `/pharmacy/orders/${o.body.id}`)).body.status === 'SUBMITTED' || false, 30_000);
    const dec = (await q('kiorex_platform', `select id, origin, "reasonCode", "parentDecisionId" from "GrowthProductDecision" where "factKind" = 'ORDER' and "factId" = $1 and "supersedesId" is null`, [o.body.id]))[0];
    expect(dec).toMatchObject({ origin: 'CROSS_PRODUCT', reasonCode: 'CONTINUITY_ENTRY_POINT', parentDecisionId: visitDecision });
    const link = (await q('kiorex_platform', `select * from "CrossProductContinuity" where "decisionId" = $1`, [dec.id]))[0];
    expect(link).toMatchObject({ fromProduct: 'CLINIC', toProduct: 'PHARMACY', entryPoint: 'RX_TO_PHARMACY', parentOrigin: 'MARKETPLACE', toOrigin: 'CROSS_PRODUCT', parentDecisionId: visitDecision });
    expect(link.fromFactRef).toMatch(/^[0-9a-f]{32}$/); expect(link.toFactRef).toMatch(/^[0-9a-f]{32}$/);
    // the REAL pharmacy stored the block as MARKETPLACE with the decision ref; nothing about continuity or the visit reached it
    const po = (await q('kiorly_pharmacy', `select "acquisitionOrigin", "acquisitionDecisionRef" from "KiorexOrder" where "externalOrderId" = $1`, [o.body.id]))[0];
    expect(po).toMatchObject({ acquisitionOrigin: 'MARKETPLACE', acquisitionDecisionRef: dec.id });
    expect(JSON.stringify(await q('kiorly_pharmacy', `select * from "KiorexOrder" where "externalOrderId" = $1`, [o.body.id]))).not.toMatch(/CROSS_PRODUCT|CONTINUITY|kx_bk_e2e39/);
    expect((await cards()).cards.find((x) => x.kind === 'RX_TO_PHARMACY')).toBeUndefined(); // used
    // no reward, referral or charge side effects
    for (const t of ['RewardLot', 'RewardLedgerEntry', 'ReferralRelationship']) expect(Number((await q('kiorex_platform', `select count(*)::int c from "${t}" where false or true`))[0].c)).toBe(0);
  });

  it('a lab order from the Clinic offers the lab card; the REAL lab booking from the card is CROSS_PRODUCT; the same booking without the card is independent; tables hold no test names', async () => {
    const ord = `ord_${rnd()}`;
    await webhook('LabOrderPlaced', ord, { orderId: ord, encounterId: `enc_${rnd()}`, clinicId, patientRef: kpid, orderingClinicianId: 'dr_e2e', consentToken: 'tok', orderedAt: new Date(Date.now() - 1_800_000).toISOString(), items: [{ code, name: `E2E39 ${code}` }], notes: 'fasting' });
    const c = await waitFor('the lab card', async () => (await cards()).cards.find((x) => x.kind === 'LAB_ORDER_TO_LAB') ?? false, 15_000, 400);
    const slotsFrom = new Date(Date.now() + 2 * 86400_000), slotsTo = new Date(Date.now() + 5 * 86400_000);
    const s = await kiorex(p1, 'GET', `/lab/slots?labId=${labId}&collectionType=HOME&from=${slotsFrom.toISOString()}&to=${slotsTo.toISOString()}`); expect(s.status, JSON.stringify(s.body)).toBe(200);
    const book = (slot: any, headers: Record<string, string> = {}) => kiorex(p1, 'POST', '/lab/bookings', { labId, testCodes: [code], collectionType: 'HOME', slot, address: { line1: '12 Nile St', area: 'Maadi', phone: '+201000000001' } }, headers);
    const b1 = await book(s.body.slots[0], { 'x-kx-continuity': c.id }); expect(b1.status, JSON.stringify(b1.body)).toBe(201);
    const b2 = await book(s.body.slots[s.body.slots.length - 1]); expect(b2.status, JSON.stringify(b2.body)).toBe(201);
    const dec = async (id: string) => (await q('kiorex_platform', `select origin, "parentDecisionId" from "GrowthProductDecision" where "factKind" = 'LAB_BOOKING' and "factId" = $1`, [id]))[0];
    expect(await dec(b1.body.id)).toMatchObject({ origin: 'CROSS_PRODUCT', parentDecisionId: visitDecision });
    expect((await dec(b2.body.id)).origin).not.toBe('CROSS_PRODUCT');
    await payFake(b1.body.payment.paymentId);
    await waitFor('lab order', async () => (await q('kiorly_lab', `select id from "LabOrder" where "sourceRef" = $1`, [b1.body.id]))[0] ?? false, 20_000, 400);
    const links = JSON.stringify(await q('kiorex_platform', `select * from "CrossProductContinuity"`));
    const prompts = JSON.stringify((await q('kiorex_platform', `select * from "CrossProductEntryPoint" where sub = $1`, [sub])).map(({ parentBookingId, ...rest }: any) => rest)); // the patient's own prompt state keeps only the id of their own booking
    for (const dump of [links, prompts]) expect(dump).not.toMatch(new RegExp(`${code}|fasting|Amoxicillin|${clinicId}|enc_|ord_`));
    expect(links).not.toContain(visitId); // the link table holds keyed hashes only
  });

  it('the ops funnel is aggregate: small cells read <10, ops roles only, no identifier; withdrawing consent makes the next order independent', async () => {
    const f = (await kiorex(ops, 'GET', '/ops/growth/cross-product/funnel?days=7')).body;
    expect(f).toMatchObject({ rewards: 'NONE', commissionLink: 'INERT', enabled: true });
    for (const r of f.products) for (const k of ['offered', 'continued', 'dismissed', 'notContinued']) expect(r[k] === '<10' || (typeof r[k] === 'number' && (r[k] === 0 || r[k] >= 10))).toBe(true);
    expect(JSON.stringify(f)).not.toMatch(new RegExp(`${sub}|${clinicId}|${visitId}|kx_ph_|kx_lb_`));
    expect((await kiorex(p1, 'GET', '/ops/growth/cross-product/funnel')).status).toBe(403);
    expect((await kiorex(p1, 'PUT', `${B}/consent`, { granted: false, source: 'web' })).body.granted).toBe(false);
    expect((await cards()).cards).toEqual([]);
  });
});
