import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { localTotpSecret } from '../src/local-totp.js';
import { kiorex, opsLogin, q, waitFor } from '../src/clients.js';
import { loginWithPhone } from '../src/passport.js';
import { resetOtpLimits, resetRateLimits } from '../src/db.js';
import { pharmacy, pharmacyStaff, lab, labStaff, patientToken, payFake, recordDevGate, releaseDevGate, rnd, waitPartnerFlags } from '../src/verticals.js';
import { cleanupConnected, connectLab, connectPharmacy, type ConnectedPartner } from '../src/connect.js';
import { randomUUID } from 'node:crypto';
import { kiorexWebhook } from '../src/hmac.js';
import { LAB, WEBHOOK_SECRET } from '../src/env.js';

/**
 * t. Second live pharmacy and second live lab on the REAL stack: the demo tenants (registrations pr_pharmacy_dev / pr_lab_dev) plus one freshly connected tenant of each kind
 * (wizard + ops walk-through, exactly as 22). Every patient call must reach ONLY the registration that owns the pharmacy / lab: Kiorex's per-registration routing
 * (registrationId on carts, orders and bookings) is checked end to end, down to which partner database received the order.
 * Needs the real Pharmacy :3100 and Lab :3200 (multi-tenant: one process, one tenant per client key). The second PROCESS is not needed.
 */
const OPS_ADMIN_TOTP = localTotpSecret('+201000009001'); // local-only, generated per machine
describe('t. Several live pharmacies and labs: each receives only its own traffic', () => {
  let sup: string, prep: string, p1: string, ownerA: string, pharmA: string, branchA: string, regA: string;
  let phB: ConnectedPartner, labB: ConnectedPartner, labIdA: string, labRegA: string;
  const nurseRegs: string[] = [];

  beforeAll(async () => {
    await resetOtpLimits(); await resetRateLimits();
    sup = (await opsLogin()).accessToken; p1 = await patientToken();
    try { prep = (await loginWithPhone('+201000009001', { clientId: 'kiorex-ops', otp: '000000', totpSecret: OPS_ADMIN_TOTP })).accessToken; }
    catch { await new Promise((r) => setTimeout(r, 31_000)); prep = (await loginWithPhone('+201000009001', { clientId: 'kiorex-ops', otp: '000000', totpSecret: OPS_ADMIN_TOTP })).accessToken; }
    await recordDevGate(sup, 'kiorex.pharmacy_orders'); await recordDevGate(sup, 'kiorex.lab_bookings');
    ownerA = await pharmacyStaff('owner'); pharmA = await pharmacyStaff('pharmacist');
    branchA = (await pharmacy(ownerA, 'GET', '/kiorex-orders/settings')).body.find((x: any) => x.optedIn)?.branchId;
    labIdA = (await q('kiorly_lab', `select l.id from "Lab" l join "Tenant" t on t.id = l."orgId" where t.slug = 'demo-lab' order by l."createdAt" limit 1`))[0].id;
    regA = (await q('kiorex_platform', `select id from "PartnerRegistration" where "clientKey" = 'kx_dev_pharmacy_client'`))[0].id;
    labRegA = (await q('kiorex_platform', `select id from "PartnerRegistration" where "clientKey" = 'kl_dev_kiorex'`))[0].id;
    phB = await connectPharmacy(prep, sup, 'B'); labB = await connectLab(prep, sup, 'B');
    await waitPartnerFlags();
  }, 180_000);
  afterAll(async () => { for (const r of nurseRegs) { await q('kiorex_platform', `delete from "NurseLabRelay" where "registrationId" = $1`, [r]); await q('kiorex_platform', `delete from "PartnerRegistration" where id = $1`, [r]); } await q('kiorex_platform', `delete from "NurseLabRelay" where id like 'e2e_nrs_%'`); await q('kiorex_platform', `delete from "WebhookReceipt" where "aggregateId" like 'e2e_nrs_%'`); await cleanupConnected(); await releaseDevGate(sup, 'kiorex.pharmacy_orders'); await releaseDevGate(sup, 'kiorex.lab_bookings'); });

  it('the registry holds several live registrations of each kind', async () => {
    const regs = (await kiorex(sup, 'GET', '/admin/partners')).body as { id: string; kind: string; active: boolean }[];
    expect(regs.filter((r) => r.kind === 'pharmacy' && r.active).map((r) => r.id)).toEqual(expect.arrayContaining([regA, phB.registrationId]));
    expect(regs.filter((r) => r.kind === 'lab' && r.active).map((r) => r.id)).toEqual(expect.arrayContaining([labRegA, labB.registrationId]));
  });

  describe('pharmacies', () => {
    async function drugA() {
      const tag = rnd(); const d = await pharmacy(ownerA, 'POST', '/catalogue/drugs', { brandName: `E2E-Route-A-${tag}`, activeIngredient: `e2e-ing-${tag}`, strength: '500 mg', dosageForm: 'tablet', packSize: '20', rxOnly: false, price: '40.00' });
      expect(d.status, JSON.stringify(d.body)).toBe(201);
      const exp = new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10);
      expect((await pharmacy(ownerA, 'POST', '/inventory/receipts', { branchId: branchA, invoiceNo: `E2E-${tag}`, lines: [{ drugId: d.body.id, lotNumber: `L-${tag}`, expiryDate: exp, quantity: 20, unitCost: '20.00' }] })).status).toBe(201);
      return d.body.id as string;
    }
    const order = async (branchId: string, sku: string, partnerId?: string) => {
      const cart = await kiorex(p1, 'PUT', '/pharmacy/cart', { pharmacyId: branchId, ...(partnerId ? { partnerId } : {}), items: [{ sku, qty: 1 }] });
      expect(cart.status, JSON.stringify(cart.body)).toBe(200);
      expect((await kiorex(p1, 'PUT', '/pharmacy/cart/delivery', { method: 'PICKUP' })).status).toBe(200);
      const o = await kiorex(p1, 'POST', '/pharmacy/orders', {}); expect(o.status, JSON.stringify(o.body)).toBe(201);
      await payFake(o.body.payment.paymentId);
      return { id: o.body.id as string, partnerId: o.body.partnerId as string };
    };
    const rows = async (id: string) => q('kiorly_pharmacy', `select "orgId", "branchId" from "KiorexOrder" where "externalOrderId" = $1`, [id]);

    it('the listing carries the owner of every branch; a search for one branch reaches only that partner', async () => {
      const list = (await kiorex(p1, 'GET', '/pharmacy/pharmacies')).body as { id: string; partnerId: string }[];
      expect(list.find((x) => x.id === branchA)?.partnerId).toBe(regA);
      expect(list.find((x) => x.id === phB.locationId)?.partnerId).toBe(phB.registrationId);
      const s = await kiorex(p1, 'GET', `/pharmacy/search?pharmacyId=${phB.locationId}&q=E2E-Routing`);
      expect(s.status, JSON.stringify(s.body)).toBe(200);
      expect(s.body.items.length).toBeGreaterThan(0);
      expect(s.body.items.every((i: any) => i.partnerId === phB.registrationId && i.pharmacyId === phB.locationId)).toBe(true);
    });
    it('an order for pharmacy A lands in A\'s database only; an order for pharmacy B lands in B\'s only; each carries its registration', async () => {
      const skuA = await drugA();
      const a = await order(branchA, skuA); const b = await order(phB.locationId, phB.sku!);
      expect(a.partnerId).toBe(regA); expect(b.partnerId).toBe(phB.registrationId);
      const stored = (id: string) => q('kiorex_platform', `select "registrationId" from "PharmacyOrder" where id = $1`, [id]).then((r) => r[0].registrationId);
      expect(await stored(a.id)).toBe(regA); expect(await stored(b.id)).toBe(phB.registrationId);
      const ra = await waitFor('A order at pharmacy A', async () => { const r = await rows(a.id); return r.length ? r : false; }, 20_000, 400);
      const rb = await waitFor('B order at pharmacy B', async () => { const r = await rows(b.id); return r.length ? r : false; }, 20_000, 400);
      expect(ra).toHaveLength(1); expect(rb).toHaveLength(1);
      expect(ra[0].branchId).toBe(branchA); expect(rb[0].branchId).toBe(phB.locationId);
      expect(ra[0].orgId).not.toBe(rb[0].orgId); // two different tenants, one process
      expect(await rows(a.id)).toHaveLength(1); // and neither order was also sent to the other tenant
      // B's pharmacist progresses the order: the webhook is verified against B's own secret and moves only B's order
      const email = `e2e-routing-rph-${rnd().toLowerCase()}@example.com`; // a pharmacist of tenant B (sign-off is pharmacist-only)
      expect((await pharmacy(phB.token, 'POST', '/staff', { displayName: 'E2E Pharmacist B', email, password: 'Demo@12345', role: 'PHARMACIST', branchId: phB.locationId, pharmacistLicenceNo: `SYN-${rnd()}` })).status).toBe(201);
      const pharmB = (await pharmacy(undefined, 'POST', '/auth/login', { email, password: 'Demo@12345' })).body.accessToken as string;
      const inboxB = (await waitFor('B inbox', async () => (await pharmacy(phB.token, 'GET', '/kiorex-orders')).body.find((o: any) => o.externalOrderId === b.id) ?? false, 20_000, 400)) as any;
      const acc = await pharmacy(pharmB, 'POST', `/kiorex-orders/${inboxB.id}/accept`, {}); expect(acc.status, JSON.stringify(acc.body)).toBe(201);
      expect((await pharmacy(pharmB, 'POST', `/dispensings/${acc.body.dispensing.id}/signoff`, {})).status).toBe(201);
      expect((await pharmacy(pharmB, 'POST', `/kiorex-orders/${inboxB.id}/ready`)).body.status).toBe('READY');
      await waitFor('B order READY in Kiorex', async () => (await kiorex(p1, 'GET', `/pharmacy/orders/${b.id}`)).body.status === 'READY', 20_000, 400);
      expect((await kiorex(p1, 'GET', `/pharmacy/orders/${a.id}`)).body.status).not.toBe('READY'); // A's order untouched
      void pharmA; void randomUUID;
    }, 90_000);
  });

  describe('labs', () => {
    it('tests and slots are tagged with the owning lab; a booking at lab B reaches only lab B, a booking at the demo lab only the demo lab', async () => {
      const tests = (await kiorex(p1, 'GET', '/lab/tests')).body.items as { labId: string; partnerId: string; code: string }[];
      expect(tests.find((t) => t.labId === labIdA)?.partnerId).toBe(labRegA);
      const tB = tests.find((t) => t.labId === labB.locationId); expect(tB?.partnerId).toBe(labB.registrationId);
      const from = new Date(Date.now() + 2 * 86400_000), to = new Date(Date.now() + 5 * 86400_000);
      const slotsB = await kiorex(p1, 'GET', `/lab/slots?labId=${labB.locationId}&collectionType=WALK_IN&from=${from.toISOString()}&to=${to.toISOString()}`);
      expect(slotsB.status, JSON.stringify(slotsB.body)).toBe(200); expect(slotsB.body.partnerId).toBe(labB.registrationId); expect(slotsB.body.slots.length).toBeGreaterThan(0);
      const book = await kiorex(p1, 'POST', '/lab/bookings', { labId: labB.locationId, testCodes: [tB!.code], collectionType: 'WALK_IN', slot: slotsB.body.slots[0] });
      expect(book.status, JSON.stringify(book.body)).toBe(201); expect(book.body.partnerId).toBe(labB.registrationId);
      await payFake(book.body.payment.paymentId);
      const onB = await waitFor('order at lab B', async () => { const r = await q('kiorly_lab', `select "orgId", "labId" from "LabOrder" where "sourceRef" = $1`, [book.body.id]); return r.length ? r : false; }, 20_000, 400);
      expect(onB).toHaveLength(1); expect(onB[0].labId).toBe(labB.locationId); expect(onB[0].orgId).toBe(labB.tenantId);
      expect((await q('kiorex_platform', `select "registrationId" from "LabBooking" where id = $1`, [book.body.id]))[0].registrationId).toBe(labB.registrationId);
      // the demo lab: its own test, its own registration (tests exist on the demo lab seed)
      const tA = tests.find((t) => t.labId === labIdA && t.partnerId === labRegA);
      const slotsA = await kiorex(p1, 'GET', `/lab/slots?labId=${labIdA}&collectionType=WALK_IN&from=${from.toISOString()}&to=${to.toISOString()}`);
      expect(slotsA.body.partnerId).toBe(labRegA);
      if (tA && slotsA.body.slots.length) {
        const bookA = await kiorex(p1, 'POST', '/lab/bookings', { labId: labIdA, testCodes: [tA.code], collectionType: 'WALK_IN', slot: slotsA.body.slots[Math.floor(slotsA.body.slots.length / 2)] });
        expect(bookA.status, JSON.stringify(bookA.body)).toBe(201); expect(bookA.body.partnerId).toBe(labRegA);
        await payFake(bookA.body.payment.paymentId);
        const onA = await waitFor('order at demo lab', async () => { const r = await q('kiorly_lab', `select "orgId", "labId" from "LabOrder" where "sourceRef" = $1`, [bookA.body.id]); return r.length ? r : false; }, 20_000, 400);
        expect(onA).toHaveLength(1); expect(onA[0].labId).toBe(labIdA); expect(onA[0].orgId).not.toBe(labB.tenantId);
      }
      void lab; void labStaff;
    }, 90_000);
  });

  describe('Nurse lab relay (LAB_NURSE)', () => {
    const placed = (orderId: string, preferredLabId: string, tag: string, testCode: string) => ({
      eventId: `e2e-${orderId}`, type: 'LabOrderPlaced', aggregateType: 'LabOrder', aggregateId: orderId, target: 'KIOREX', occurredAt: new Date().toISOString(),
      data: {
        orderId, clinicId: 'cl_e2e_nurse', patientRef: `pat_e2e_${tag}`, orderingClinicianId: 'usr_e2e_nurse', preferredLabId, consentToken: `rsc_${'0123456789abcdef'.repeat(2)}`, orderedAt: new Date().toISOString(),
        items: [{ code: testCode, nameEn: 'Fasting glucose' }], originEdition: 'NURSE', prescriberName: 'Dr E2E', identifiersChecked: ['fullName', 'dateOfBirth'],
        patient: { fullName: `Nora Routing ${tag}`, dateOfBirth: '1990-04-12', sex: 'F', phone: '+201000000042' },
        nurseCollection: { visitRef: `apt_e2e_${tag}`, collectorRef: 'usr_e2e_nurse', collectedAt: new Date(Date.now() - 20 * 60_000).toISOString(), handedOverAt: new Date(Date.now() - 5 * 60_000).toISOString(), temperatureC: 5, samples: [{ label: `NRS-${tag}`, specimenType: 'blood' }] },
      },
    });
    it('a nurse order for lab B reaches ONLY lab B (its own KIORLY_NURSE client), one for the demo lab only the demo lab; the relay row remembers the nurse registration', async () => {
      // lab B's owner creates its own KIORLY_NURSE integration client; Kiorex ops register it, paired with lab B's booking registration
      const c = await lab(labB.token, 'POST', '/integration-clients', { source: 'KIORLY_NURSE' });
      expect(c.status, JSON.stringify(c.body)).toBe(201);
      const reg = await kiorex(sup, 'POST', '/admin/partners/lab_nurse', { name: 'E2E nurse client lab B', baseUrl: LAB, clientKey: c.body.key, clientSecret: c.body.secret, labRegistrationId: labB.registrationId });
      expect(reg.status, JSON.stringify(reg.body)).toBe(201); nurseRegs.push(reg.body.id);
      const demoNurse = (await q('kiorex_platform', `select id, "labRegistrationId" from "PartnerRegistration" where "clientKey" = 'kl_dev_nurse'`))[0];
      expect(demoNurse.labRegistrationId).toBe(labRegA); // the dev nurse client belongs to the demo lab
      const tag = rnd().toLowerCase(); const idB = `e2e_nrs_b_${tag}`, idA = `e2e_nrs_a_${tag}`; const code = `NR${rnd()}`; // each lab needs the test and the sample must match its specimen type
      for (const t of [labB.token, await labStaff('owner')]) expect((await lab(t, 'POST', '/catalogue/tests', { code, nameEn: `Nurse routing glucose ${code}`, specimenType: 'blood', price: 120, analyteCodes: ['GLU'] })).status).toBe(201);
      const rb = await kiorexWebhook(WEBHOOK_SECRET, '/webhooks/kiorly', placed(idB, labB.locationId, `b${tag}`, code)); expect(rb.status, JSON.stringify(rb.body)).toBe(200); expect(rb.body.status).toBe('APPLIED');
      const ra = await kiorexWebhook(WEBHOOK_SECRET, '/webhooks/kiorly', placed(idA, labIdA, `a${tag}`, code)); expect(ra.status, JSON.stringify(ra.body)).toBe(200); expect(ra.body.status).toBe('APPLIED');
      const relay = (id: string) => q('kiorex_platform', `select status, "registrationId", "refusalCode" from "NurseLabRelay" where id = $1`, [id]).then((r) => r[0]);
      expect(await relay(idB), JSON.stringify(await relay(idB))).toMatchObject({ status: 'SUBMITTED', registrationId: reg.body.id });
      expect(await relay(idA), JSON.stringify(await relay(idA))).toMatchObject({ status: 'SUBMITTED', registrationId: demoNurse.id });
      const at = (id: string) => q('kiorly_lab', `select "orgId", source from "LabOrder" where "sourceRef" = $1`, [id]);
      const onB = await at(idB), onA = await at(idA);
      expect(onB).toHaveLength(1); expect(onB[0].orgId).toBe(labB.tenantId); expect(onB[0].source).toBe('KIORLY_NURSE');
      expect(onA).toHaveLength(1); expect(onA[0].orgId).not.toBe(labB.tenantId); expect(onA[0].source).toBe('KIORLY_NURSE');
      // an unknown lab is a definitive refusal relayed to the clinic, never a guess at the first registration
      const bad = `e2e_nrs_x_${tag}`;
      expect((await kiorexWebhook(WEBHOOK_SECRET, '/webhooks/kiorly', placed(bad, 'lab_does_not_exist', `x${tag}`, code))).body.status).toBe('APPLIED');
      expect(await relay(bad)).toMatchObject({ status: 'REFUSED', refusalCode: 'LAB_NOT_FOUND' });
      expect(await at(bad)).toHaveLength(0);
    }, 60_000);
  });
});
