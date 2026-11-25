import { describe, it, expect, beforeAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { kiorly, staffLogin, waitFor, q } from '../src/clients.js';
import { lab, labStaff, rnd } from '../src/verticals.js';
import { kiorlyMarketplace, partnerCall } from '../src/hmac.js';
import { LAB, LAB_PARTNER } from '../src/env.js';

/**
 * KNLAB01 / KLORD05, REAL services over HTTP: Kiorly Nurse (an EDITION of Kiorly Clinic) -> LabOrderPlaced on the clinic outbox -> Kiorex relay (second Lab
 * registration with the KIORLY_NURSE source) -> Kiorly Lab inbound order -> custody from the nurse's collection time -> lab receipt + results + release
 * on the Kiorly Nurse channel -> LabOrderStatusChanged / LabResultReleased -> Kiorex -> status + sanitized custody + secure link back to the nurse's clinic.
 *
 * Run against the ISOLATED stack (scripts/nurse-lab-stack.sh up; own databases, so no other outbox worker can steal its events):
 *   E2E_NURSE_STACK=1 E2E_KIORLY_URL=http://localhost:3012 E2E_KIOREX_URL=http://localhost:4002 E2E_LAB_URL=http://localhost:3202 npm test -- test/11-nurse-lab.e2e.ts
 * or against the standard stack (scripts/up.sh --build --seed --restart; needs `npm run db:seed:nurse -w api`, a Pro nurse tenant and the dev KIORLY_NURSE lab client).
 * Fixtures are inserted in the E2E databases only (a synthetic patient and a home visit for the seeded demo nurse); no launch gate is involved: the hand-off is
 * clinic.lab_order_handoff (a Module flag, effective by default), and nothing here records or fakes a human gate.
 */
const ISO = !!process.env.E2E_NURSE_STACK; // own e2e11 databases (npm run test:nurse)
const NS = ISO || !!process.env.E2E_FULL_STACK; // E2E_FULL_STACK: the private full stack (scripts/w9-stack.sh) has exactly one outbox worker per database too
const DBC = ISO ? 'kiorly_e2e11' : 'kiorly';
const DBL = ISO ? 'kiorly_lab_e2e11' : 'kiorly_lab';
const DBX = ISO ? 'kiorex_e2e11' : 'kiorex_platform';
const NURSE_CLIENT = { key: 'kl_dev_nurse', secret: 'dev_nurse_secret_change_me' };
const TENANT = 'demo_t_nsolo';

// Needs the isolated stack (own outbox workers + the KIORLY_NURSE lab registration): skipped in the default run, `npm run test:nurse` runs it (see README).
describe.skipIf(!NS)('m. Kiorly Nurse -> Kiorex -> Kiorly Lab -> result back to the nurse (KNLAB01)', () => {
  let nurse: string, owner: string, tech: string, director: string, signatory: string, reception: string;
  let patientId: string, apptId: string, orderId: string, code: string, patientName: string, patientPhone: string, bench: string;
  const sfx = rnd();
  const labelA = `NRS-${sfx}-A`;
  const col = (over: Record<string, unknown> = {}) => ({
    appointmentId: apptId,
    identifiers: [{ kind: 'FULL_NAME', value: patientName }, { kind: 'DATE_OF_BIRTH', value: '1990-04-12' }],
    collectedAt: new Date(Date.now() - 20 * 60_000).toISOString(), handedOverAt: new Date(Date.now() - 5 * 60_000).toISOString(), temperatureC: 5,
    tubes: [{ label: labelA, specimenType: 'blood' }], ...over,
  });
  const post = (path: string, body: unknown) => kiorly(nurse, 'POST', path, body);

  beforeAll(async () => {
    nurse = await staffLogin('mona@nurse-demo.kiorly.test', 'Demo@12345');
    [owner, tech, director, signatory, reception] = await Promise.all((['owner', 'tech', 'director', 'signatory', 'reception'] as const).map(labStaff));
    bench = (await lab(tech, 'GET', '/instruments')).body.find((i: any) => i.kind === 'MANUAL_BENCH').id;
    code = `NL${rnd()}`;
    const t = await lab(owner, 'POST', '/catalogue/tests', { code, nameEn: `Nurse E2E Glucose ${code}`, specimenType: 'blood', price: 120, analyteCodes: ['GLU'] });
    expect(t.status, JSON.stringify(t.body)).toBe(201);
    // fixtures in the clinic E2E database: a synthetic patient + a home visit assigned to the demo nurse
    const clinic = (await q(DBC, `select id from "Clinic" where "tenantId" = $1 limit 1`, [TENANT]))[0].id;
    const nurseId = (await q(DBC, `select id from "User" where email = 'mona@nurse-demo.kiorly.test'`))[0].id;
    patientId = `e2e_pat_${sfx}`; apptId = `e2e_apt_${sfx}`; patientName = `Nora E2E${sfx}`; patientPhone = `+2010${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
    await q(DBC, `insert into "Patient" (id, "tenantId", mrn, "firstNameEn", "lastNameEn", gender, phone, dob, "updatedAt") values ($1,$2,$3,$4,$5,'F',$6,'1990-04-12',now())`, [patientId, TENANT, `E2E-${sfx}`, 'Nora', `E2E${sfx}`, patientPhone]);
    await q(DBC, `insert into "Appointment" (id, "tenantId", "clinicId", "patientId", "clinicianId", "startsAt", "endsAt", status, "serviceLocation", "updatedAt") values ($1,$2,$3,$4,$5, now() + interval '1 hour', now() + interval '2 hour', 'CONFIRMED', 'HOME', now())`, [apptId, TENANT, clinic, patientId, nurseId]);
  });

  it('the nurse transcribes a doctor\'s lab request (never on her own authority); the collection is refused without consent', async () => {
    const items = [{ code, nameEn: 'Fasting glucose' }];
    expect((await post(`/nurse/visits/${apptId}/lab-orders`, { items, prescriber: { name: 'Dr Hesham Nabil', orderedOn: '2026-11-19' }, confirmedDoctorOrder: false })).body).toMatchObject({ code: 'DOCTOR_ORDER_REQUIRED' });
    const o = await post(`/nurse/visits/${apptId}/lab-orders`, { items, prescriber: { name: 'Dr Hesham Nabil', orderedOn: '2026-11-19' }, confirmedDoctorOrder: true });
    expect(o.status, JSON.stringify(o.body)).toBe(201);
    orderId = o.body.id;
    expect(o.body).toMatchObject({ status: 'ORDERED', prescriberName: 'Dr Hesham Nabil', collection: null });
    const r = await post(`/nurse/lab-orders/${orderId}/collection`, col());
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('LAB_HANDOFF_NO_CONSENT');
  });

  it('safety refusals before anything leaves the clinic: identifier mismatch, one identifier, future time, bad hand-over, bad label (never flagged)', async () => {
    // the patient consents through Kiorex's patient app path (signed marketplace API), which mints the LAB_RESULTS record-share grant
    const c = await kiorlyMarketplace('POST', `/patients/${patientId}/consents`, { consents: [{ scope: 'LAB_RESULTS', granted: true }] });
    expect(c.status, JSON.stringify(c.body)).toBeLessThan(300);
    const refused = async (over: Record<string, unknown>, status: number, codeWanted: string) => {
      const r = await post(`/nurse/lab-orders/${orderId}/collection`, col(over));
      expect(r.status, JSON.stringify(r.body)).toBe(status);
      expect(r.body.code).toBe(codeWanted);
      return r;
    };
    const wrong = await refused({ identifiers: [{ kind: 'FULL_NAME', value: 'Someone Else' }, { kind: 'DATE_OF_BIRTH', value: '1990-04-12' }] }, 422, 'IDENTIFIER_MISMATCH');
    expect(JSON.stringify(wrong.body)).not.toContain('Someone Else'); // only the KIND is named, never a value
    await refused({ identifiers: [{ kind: 'FULL_NAME', value: patientName }] }, 422, 'TWO_IDENTIFIERS_REQUIRED');
    await refused({ collectedAt: new Date(Date.now() + 3_600_000).toISOString(), handedOverAt: undefined }, 422, 'COLLECTED_IN_FUTURE');
    await refused({ handedOverAt: new Date(Date.now() - 3_600_000).toISOString() }, 422, 'HANDOVER_TIME_INVALID');
    await refused({ tubes: [{ label: 'a b', specimenType: 'blood' }] }, 422, 'TUBE_LABEL_INVALID');
    expect((await q(DBC, `select count(*)::int c from "OutboxEvent" where "tenantId" = $1 and type = 'LabOrderPlaced' and "aggregateId" = $2`, [TENANT, orderId]))[0].c).toBe(0);
    expect((await q(DBX, `select count(*)::int c from "NurseLabRelay" where id = $1`, [orderId]))[0].c).toBe(0);
    expect((await q(DBL, `select count(*)::int c from "LabOrder" where "sourceRef" = $1`, [orderId]))[0].c).toBe(0);
  });

  it('hand-over: LabOrderPlaced -> Kiorex relays with the KIORLY_NURSE client -> lab order with custody starting at the nurse\'s collection time; clinic is told ACCEPTED', async () => {
    const r = await post(`/nurse/lab-orders/${orderId}/collection`, col());
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body).toMatchObject({ alreadyHandedOff: false, handedOff: true, labStatus: 'HANDED_OFF', identifiersChecked: ['fullName', 'dateOfBirth'] });
    const ev = (await q(DBC, `select payload from "OutboxEvent" where "tenantId" = $1 and type = 'LabOrderPlaced' and "aggregateId" = $2`, [TENANT, orderId]));
    expect(ev).toHaveLength(1);
    expect(ev[0].payload).toMatchObject({ originEdition: 'NURSE', consentToken: expect.stringMatching(/^rsc_/), nurseCollection: { visitRef: apptId, samples: [{ label: labelA }] } });

    const relay = await waitFor('kiorex relay', async () => (await q(DBX, `select * from "NurseLabRelay" where id = $1`, [orderId]))[0], 45_000);
    expect(relay).toMatchObject({ status: 'SUBMITTED', clinicId: expect.any(String) });
    const lo = await waitFor('lab order', async () => (await q(DBL, `select id, status, source from "LabOrder" where "sourceRef" = $1`, [orderId]))[0]);
    expect(lo).toMatchObject({ source: 'KIORLY_NURSE', status: 'COLLECTED' });
    const sp = await q(DBL, `select id, barcode, status from "Specimen" where "orderId" = $1`, [lo.id]);
    expect(sp.map((s: any) => s.barcode)).toEqual([labelA]); // the physical tube label is what the lab scans
    const chain = await q(DBL, `select type, "actorId", "occurredAt", "temperatureC" from "CustodyEvent" where "specimenId" = $1 order by "occurredAt"`, [sp[0].id]);
    expect(chain.map((c: any) => c.type)).toEqual(['COLLECTED', 'TRANSPORT_STARTED']);
    expect(chain[0].actorId).toMatch(/^nurse:/);
    // the clinic hears ACCEPTED through the Kiorex outbox -> marketplace API push. A nurse's order reaches the lab already COLLECTED, so the lab announces ACCEPTED and COLLECTED within the same
    // millisecond and the clinic's mirror is monotonic: ACCEPTED is a transient headline that a 500 ms poll cannot be expected to see. What must hold: the mirror is at ACCEPTED OR LATER, and the clinic
    // really RECEIVED the ACCEPTED push (its audit log says so, whatever the headline is by now).
    const AT_LEAST_ACCEPTED = ['ACCEPTED', 'COLLECTED', 'IN_LAB', 'PARTIALLY_RESULTED', 'AWAITING_VALIDATION', 'VALIDATED', 'RELEASED'];
    const seen = await waitFor('clinic mirror ACCEPTED (or later)', async () => { const c = await kiorly(nurse, 'GET', `/nurse/lab-orders/${orderId}/custody`); return c.status === 200 && AT_LEAST_ACCEPTED.includes(c.body.labStatus) ? c.body : undefined; }, 45_000);
    await waitFor('clinic audit LAB_STATUS_RECEIVED ACCEPTED', async () => (await q(DBC, `select 1 from "AuditLog" where action = 'LAB_STATUS_RECEIVED' and "resourceId" = $1 and metadata->>'status' = 'ACCEPTED'`, [orderId])).length > 0 || undefined, 45_000);
    expect(seen.labOrderNumber).toBeTruthy();
    expect(JSON.stringify(seen)).not.toContain(patientName); // custody shown to the nurse carries tube labels and events only: no PHI
    expect(JSON.stringify(seen)).not.toContain(patientPhone);
    // idempotent: replaying the hand-over never creates a second event, relay row or lab order
    const again = await post(`/nurse/lab-orders/${orderId}/collection`, col());
    expect(again.body).toMatchObject({ alreadyHandedOff: true });
    expect((await q(DBC, `select count(*)::int c from "OutboxEvent" where "tenantId" = $1 and type = 'LabOrderPlaced' and "aggregateId" = $2`, [TENANT, orderId]))[0].c).toBe(1);
    expect((await q(DBL, `select count(*)::int c from "LabOrder" where "sourceRef" = $1`, [orderId]))[0].c).toBe(1);
  });

  it('client/source binding at the lab: only the nurse client reads the custody and the report; a Kiorex-booking client cannot', async () => {
    const path = `/api/v1/integration/v1/orders/${orderId}/custody`;
    const mine = await partnerCall(LAB, NURSE_CLIENT, 'GET', path);
    expect(mine.status, JSON.stringify(mine.body)).toBe(200);
    expect(mine.body.specimens[0].custody.map((c: any) => c.by)).toEqual(['NURSE', 'NURSE']);
    expect(JSON.stringify(mine.body)).not.toMatch(/fullName|phone|@/);
    const kx = await partnerCall(LAB, LAB_PARTNER, 'GET', path);
    expect(kx.status).toBe(404);
    expect(kx.body.code).toBe('NOT_AVAILABLE_FOR_CLIENT');
  });

  it('lab receipt by scan (a wrong label is blocked and recorded), results, validation, release on the Kiorly Nurse channel -> status, custody and the secure link reach the nurse', async () => {
    const lo = (await q(DBL, `select id, "orgId" from "LabOrder" where "sourceRef" = $1`, [orderId]))[0];
    const spec = (await lab(reception, 'GET', `/orders/${lo.id}`)).body.specimens as { id: string; barcode: string }[];
    const wrong = await lab(tech, 'POST', `/specimens/${spec[0].id}/receive`, { scannedBarcode: 'WRONG-LABEL-1' });
    expect(wrong.status).toBeGreaterThanOrEqual(400);
    expect((await q(DBL, `select count(*)::int c from "CustodyEvent" where "specimenId" = $1 and type = 'LABEL_MISMATCH_BLOCKED'`, [spec[0].id]))[0].c).toBe(1);
    expect((await lab(tech, 'POST', `/specimens/${spec[0].id}/receive`, { scannedBarcode: spec[0].barcode })).status).toBe(201);
    expect((await lab(tech, 'POST', `/specimens/${spec[0].id}/process`, { scannedBarcode: spec[0].barcode })).status).toBe(201);
    // the clinic sees the lab's RECEIVED custody event (IN_LAB status push carries the sanitized chain)
    const inLab = await waitFor('clinic mirror IN_LAB + RECEIVED', async () => { const c = await kiorly(nurse, 'GET', `/nurse/lab-orders/${orderId}/custody`); return c.body?.labStatus === 'IN_LAB' && c.body.custody.some((e: any) => e.type === 'RECEIVED' && e.by === 'LAB') ? c.body : undefined; }, 45_000);
    expect(inLab.custody[0]).toMatchObject({ type: 'COLLECTED', by: 'NURSE' });

    const mats = (await lab(tech, 'GET', '/qc/materials')).body as any[];
    const gluId = (await q(DBL, `select id from "Analyte" where code = 'GLU' and "orgId" = $1`, [lo.orgId]))[0].id;
    for (const m of mats.filter((x) => x.analyteId === gluId)) expect((await lab(tech, 'POST', '/qc/runs', { instrumentId: bench, materialId: m.id, value: Number(m.targetMean) })).status).toBe(201);
    const items = (await lab(tech, 'GET', `/orders/${lo.id}`)).body.items as { id: string }[];
    const e = await lab(tech, 'POST', '/results', { orderItemId: items[0].id, analyteId: gluId, instrumentId: bench, value: 85 });
    expect(e.status, JSON.stringify(e.body)).toBe(201);
    expect((await lab(director, 'POST', `/results/${e.body.id}/second-entry`, { value: 85 })).status).toBe(201);
    expect((await lab(tech, 'POST', `/results/${e.body.id}/tech-validate`, {})).status).toBe(201);
    const mv = await lab(signatory, 'POST', `/orders/${lo.id}/medical-validate`);
    expect(mv.body.every((r: any) => r.ok), JSON.stringify(mv.body)).toBe(true);
    const rep = await lab(signatory, 'POST', `/orders/${lo.id}/reports`);
    expect(rep.status, JSON.stringify(rep.body)).toBe(201);
    const rel = await lab(reception, 'POST', `/reports/${rep.body.id}/release`, { channels: ['KIORLY_NURSE_IMPORT'] });
    expect(rel.status, JSON.stringify(rel.body)).toBe(201);

    const done = await waitFor('clinic mirror RELEASED with the secure link', async () => { const c = await kiorly(nurse, 'GET', `/nurse/lab-orders/${orderId}/custody`); return c.body?.result?.secureLink ? c.body : undefined; }, 60_000);
    expect(done).toMatchObject({ labStatus: 'RELEASED', result: { reportId: rep.body.id, reportVersion: 1 } });
    expect(JSON.stringify(done)).not.toMatch(/"values"|"results"|\b85\b/); // never result values (KLCRIT03)
    const ord = (await q(DBC, `select status, "resultsReadyAt", "resultsJson" from "ClinicalOrder" where id = $1`, [orderId]))[0];
    expect(ord.status).toBe('RESULTS_READY');
    expect(ord.resultsReadyAt).toBeTruthy();
    expect(ord.resultsJson).toBeNull();
    // the nurse's client fetches the released PDF from the lab; a Kiorex-booking client cannot (channel consent per client)
    const pdfPath = `/api/v1/integration/v1/reports/${rep.body.id}/pdf`;
    expect((await partnerCall(LAB, NURSE_CLIENT, 'GET', pdfPath)).status).toBe(200);
    expect((await partnerCall(LAB, LAB_PARTNER, 'GET', pdfPath)).status).toBe(403);
    // Kiorex kept ids and statuses only
    const relay = (await q(DBX, `select * from "NurseLabRelay" where id = $1`, [orderId]))[0];
    expect(relay.status).toBe('RESULT_RELEASED');
    const dump = JSON.stringify([relay, await q(DBX, `select payload from "WebhookReceipt" where type = 'LabOrderPlaced' and "aggregateId" = $1`, [orderId])]);
    for (const secret of [patientName, patientPhone, labelA, '1990-04-12']) expect(dump).not.toContain(secret);
  });
});
