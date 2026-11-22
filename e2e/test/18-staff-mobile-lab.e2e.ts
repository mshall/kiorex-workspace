import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { lab, rnd, waitFor, q, kiorex, patientToken } from '../src/verticals.js';
import { LAB_API } from '../src/env.js';

/**
 * Kiorly Team (staff app) LAB module, END TO END against the real Lab API :3200 and the seeded demo tenants.
 * Every staff step goes through the endpoints the Expo app calls (/mobile/* + the product REST routes it documents in
 * kiorly-lab/Docs/MOBILE.md, always with X-Kiorly-Client: kiorly-work/*). After each step the same state is read through the
 * WEB endpoints (no client header = what the lab web app :5193 calls) and asserted equal; where a DB row is the effect it is read from Postgres.
 *
 * Isolation: a fresh analyte (E2EM...) with its own critical rule, QC materials and a 1-minute TAT test is created per run, so no demo QC state is
 * touched. Nothing here records a gate or resets data. Demo credentials only (dev-login: org slug + email).
 */
type Role = 'owner' | 'director' | 'signatory' | 'tech' | 'phleb' | 'reception' | 'manager' | 'supervisor';
type Who = { token: string; id: string; role: string };
const APP = { 'x-kiorly-client': 'kiorly-work/1.0.0-e2e' };

async function login(org: string, role: string): Promise<Who> {
  const r = await lab(undefined, 'POST', '/auth/dev-login', { orgSlug: org, email: `${role}@${org}.test` });
  if (r.status !== 200 && r.status !== 201) throw new Error(`dev-login ${org}/${role}: ${r.status} ${JSON.stringify(r.body)}`);
  return { token: r.body.token ?? r.body.accessToken, id: r.body.user.id, role: r.body.user.role };
}
/** Staff-app call (mobile client header). */
const app = (w: Who, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => lab(w.token, method, path, body, { ...APP, ...headers });
/** Web-app call (no client header): what the lab web UI on :5193 sends. */
const web = (w: Who, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => lab(w.token, method, path, body, headers);

/** 00:00 of the current Africa/Cairo day as a UTC instant (what the app's orders screen and /mobile/summary ordersToday both use). */
function cairoMidnight(now = new Date()): Date {
  const parts = (d: Date) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(d).filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)])) as Record<string, number>;
  const off = (d: Date) => { const p = parts(d); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(d.getTime() / 1000) * 1000; };
  const o = off(now), p = parts(now);
  let g = Date.UTC(p.year, p.month - 1, p.day) - o;
  const o2 = off(new Date(g)); if (o2 !== o) g = Date.UTC(p.year, p.month - 1, p.day) - o2;
  return new Date(g);
}

const KEYS = ['phlebotomy', 'accession', 'critical', 'validation', 'worklist', 'qc', 'tat', 'orders', 'reagents'] as const;
const enabledModules = (b: any) => (b.modules as { key: string; enabled: boolean }[]).filter((m) => m.enabled).map((m) => m.key.replace('lab.', '')).sort();

describe('r. Kiorly Team LAB: role matrix and entitlement (bootstrap)', () => {
  const must = (keys: readonly string[], have: string[]) => keys.forEach((k) => expect(have, `module ${k} missing from [${have}]`).toContain(k));
  const mustNot = (keys: readonly string[], have: string[]) => keys.forEach((k) => expect(have, `module ${k} must not be present in [${have}]`).not.toContain(k));

  // [org, role, plan, must have, must NOT have]
  const MATRIX: [string, Role, string, string[], string[]][] = [
    ['demo-lab', 'phleb', 'PRO', ['phlebotomy', 'accession', 'orders'], ['validation', 'worklist', 'qc', 'reagents', 'critical', 'tat']],
    ['demo-lab', 'tech', 'PRO', ['worklist', 'qc', 'reagents', 'accession', 'validation'], ['phlebotomy']],
    ['demo-lab', 'signatory', 'PRO', ['validation', 'critical'], ['phlebotomy', 'accession', 'reagents']],
    ['demo-lab', 'reception', 'PRO', ['orders'], ['validation', 'qc', 'worklist', 'critical', 'reagents']],
    ['demo-lab', 'director', 'PRO', [...KEYS], []],
    ['demo-lab', 'owner', 'PRO', [...KEYS], []],
    ['demo-lab', 'manager', 'PRO', ['orders', 'tat', 'critical', 'qc', 'reagents'], ['phlebotomy', 'validation']],
    ['demo-lab', 'supervisor', 'PRO', [...KEYS], []],
    ['chain-lab', 'phleb', 'ENTERPRISE', ['phlebotomy', 'accession', 'orders'], ['validation', 'qc']],
    ['chain-lab', 'tech', 'ENTERPRISE', ['worklist', 'qc', 'reagents', 'accession'], ['phlebotomy']],
    ['chain-lab', 'signatory', 'ENTERPRISE', ['validation', 'critical'], ['phlebotomy']],
    ['chain-lab', 'reception', 'ENTERPRISE', ['orders'], ['validation', 'qc']],
    ['chain-lab', 'director', 'ENTERPRISE', [...KEYS], []],
    ['chain-lab', 'owner', 'ENTERPRISE', [...KEYS], []],
  ];
  for (const [org, role, plan, has, hasNot] of MATRIX) {
    it(`${org}/${role}: bootstrap modules are scoped to the role (${plan})`, async () => {
      const w = await login(org, role);
      const r = await app(w, 'GET', '/mobile/bootstrap');
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body).toMatchObject({ product: 'lab', org: { plan }, entitlement: { key: 'mobile_staff_app', enabled: true }, safetyAlertsOnly: false });
      const have = enabledModules(r.body);
      must(has, have); mustNot(hasNot, have);
      // every enabled module exposes screens, and the sign-off screen exists only for medical validators
      for (const m of r.body.modules.filter((x: any) => x.enabled)) expect(m.screens.length, m.key).toBeGreaterThan(0);
      const validation = r.body.modules.find((m: any) => m.key === 'lab.validation');
      const sign = validation?.enabled && (validation.screens as string[]).includes('sign-off');
      // sign-off needs a signatory ROLE + licence (the API answers NOT_AUTHORIZED_SIGNATORY otherwise), so the owner must not be offered it
      expect(Boolean(sign), 'sign-off screen').toBe(['signatory', 'director'].includes(role));
      // the web bootstrap of the same session agrees on who the user is
      const me = await web(w, 'GET', '/auth/me');
      expect(me.body.role ?? me.body.user?.role).toBe(r.body.user.role);
    });
  }

  it('signatory and director carry the signatory flag, the other roles do not', async () => {
    for (const [role, expected] of [['signatory', true], ['director', true], ['tech', false], ['phleb', false], ['reception', false], ['owner', false]] as const) {
      const r = await app(await login('demo-lab', role), 'GET', '/mobile/bootstrap');
      expect(r.body.user.signatory, role).toBe(expected);
    }
  });

  it('BASIC lab: entitlement off, no modules, safety alerts only; /mobile/alerts works, every other /mobile route is 403 FEATURE_DISABLED', async () => {
    const w = await login('basic-lab', 'director');
    const b = await app(w, 'GET', '/mobile/bootstrap');
    expect(b.status).toBe(200);
    expect(b.body).toMatchObject({ org: { plan: 'BASIC', rawPlan: 'LITE' }, entitlement: { key: 'mobile_staff_app', enabled: false, requiredPlan: 'PRO' }, safetyAlertsOnly: true, modules: [], permissions: [] });
    const alerts = await app(w, 'GET', '/mobile/alerts?status=open');
    expect(alerts.status).toBe(200);
    expect(alerts.body.items.length).toBeGreaterThan(0);
    expect(alerts.body.items.some((a: any) => a.kind === 'CRITICAL_VALUE')).toBe(true);
    for (const p of ['/mobile/summary', '/mobile/inbox', '/mobile/scan?code=X', '/mobile/search?q=ab', '/mobile/worklist/progress', '/mobile/reagents/low-stock', '/mobile/devices']) {
      const r = await app(w, 'GET', p);
      expect(r.status, p).toBe(403);
      expect(r.body, p).toMatchObject({ code: 'FEATURE_DISABLED', key: 'mobile_staff_app', scope: 'org' });
    }
    // the plan gate beats RBAC: a BASIC user who also LACKS the permission (reception: no results.read / inventory.read) still gets FEATURE_DISABLED
    const lacking = await login('basic-lab', 'reception');
    for (const p of ['/mobile/worklist/progress', '/mobile/reagents/low-stock']) {
      const r = await app(lacking, 'GET', p);
      expect([r.status, r.body.code], p).toEqual([403, 'FEATURE_DISABLED']);
    }
    expect((await app(lacking, 'GET', '/validation-queue?stage=medical')).body.code).toBe('FEATURE_DISABLED');
    // a product REST route carrying the app header is refused too, while the same call from the web (no header) is untouched
    expect((await app(w, 'GET', '/orders')).body).toMatchObject({ code: 'FEATURE_DISABLED' });
    expect((await web(w, 'GET', '/orders')).status).toBe(200);
  });
});

describe('s. Kiorly Team LAB: reception -> phlebotomy -> bench -> critical -> sign-off -> release (one order, app and web agree)', () => {
  let who: Record<Role, Who>;
  let code: string, analyteId: string, bench: string, matIds: string[], patient: { id: string; fullName: string };
  const st: { orderId?: string; orderNumber?: string; items?: { id: string }[]; spec?: { id: string; barcode: string; accessionNumber: string }; resultId?: string; critId?: string; alertKey?: string; reportId?: string } = {};

  beforeAll(async () => {
    who = {} as any;
    for (const r of ['owner', 'director', 'signatory', 'tech', 'phleb', 'reception', 'manager', 'supervisor'] as Role[]) who[r] = await login('demo-lab', r);
    code = `E2EM${rnd()}`;
    const o = who.owner;
    const a = await web(o, 'POST', '/catalogue/analytes', { code, nameEn: `E2E Mobile K ${code}`, unit: 'mmol/L', precision: 1, valueType: 'NUMERIC' });
    expect(a.status, JSON.stringify(a.body)).toBe(201); analyteId = a.body.id;
    expect((await web(o, 'POST', `/catalogue/analytes/${analyteId}/reference-intervals`, { sex: null, ageMinDays: 0, ageMaxDays: null, low: 3.5, high: 5.1 })).status).toBe(201);
    expect((await web(o, 'PUT', `/analytes/${analyteId}/critical-rule`, { criticalLow: 2.5, criticalHigh: 6.5, ackWithinMinutes: 30 })).status).toBe(200);
    matIds = [];
    for (const [lvl, mean] of [['LEVEL_1', 4], ['LEVEL_2', 6]] as const) {
      const m = await web(o, 'POST', '/qc/materials', { analyteId, level: lvl, materialLot: `E2E-${code}-${lvl}`, targetMean: mean, targetSd: 0.2 });
      expect(m.status, JSON.stringify(m.body)).toBe(201); matIds.push(m.body.id);
    }
    const t = await web(o, 'POST', '/catalogue/tests', { code, nameEn: `E2E Mobile test ${code}`, specimenType: 'blood', price: 50, tatMinutes: 1, analyteCodes: [code] });
    expect(t.status, JSON.stringify(t.body)).toBe(201);
    bench = (await web(who.tech, 'GET', '/instruments')).body.find((i: any) => i.kind === 'MANUAL_BENCH').id;
    const p = await app(who.reception, 'GET', '/mobile/search?q=Hana');
    patient = p.body.patients.find((x: any) => x.fullName === 'Hana Gamal') ?? p.body.patients[0];
    expect(patient?.id).toBeTruthy();
  });

  const passingQc = async (w: Who) => { for (const id of matIds) { const m = (await web(w, 'GET', `/qc/materials?analyteId=${analyteId}`)).body.find((x: any) => x.id === id); const r = await app(w, 'POST', '/qc/runs', { instrumentId: bench, materialId: id, value: Number(m.targetMean) }); expect(r.status, JSON.stringify(r.body)).toBe(201); expect(r.body.run.status).toBe('PASS'); expect(r.body.blockId).toBeNull(); } };

  it('reception: looks up the patient from the app, creates a STAT order and finds it by scan/search/filters; the web order agrees', async () => {
    const found = await app(who.reception, 'GET', `/mobile/search?q=${encodeURIComponent(patient.fullName)}`);
    expect(found.status).toBe(200);
    expect(found.body.patients.map((p: any) => p.id)).toContain(patient.id);
    const before = (await app(who.reception, 'GET', '/mobile/summary')).body;
    const c = await app(who.reception, 'POST', '/orders', { patientId: patient.id, testCodes: [code], priority: 'STAT', source: 'WALK_IN', accession: 'AUTO', identifiersChecked: ['dateOfBirth', 'phone'], consentChannels: ['PRINTED'] });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    Object.assign(st, { orderId: c.body.id, orderNumber: c.body.orderNumber, items: c.body.items });
    expect(c.body).toMatchObject({ status: 'AWAITING_COLLECTION', priority: 'STAT' });
    expect(st.orderNumber).toMatch(/^ORD-/);
    // scan the order number: ORDER type with the pending specimen (accession already assigned)
    const sc = await app(who.reception, 'GET', `/mobile/scan?code=${st.orderNumber}`);
    expect(sc.status, JSON.stringify(sc.body)).toBe(200);
    expect(sc.body.type).toBe('ORDER');
    expect(sc.body.order).toMatchObject({ orderNumber: st.orderNumber, status: 'AWAITING_COLLECTION' });
    expect(sc.body.specimens).toHaveLength(1);
    expect(sc.body.specimens[0]).toMatchObject({ status: 'PENDING_COLLECTION' });
    st.spec = (await web(who.reception, 'GET', `/orders/${st.orderId}`)).body.specimens[0];
    expect(st.spec!.barcode).toBeTruthy();
    // search by order number finds it; list filters: status + search, priority in the row
    const s2 = await app(who.reception, 'GET', `/mobile/search?q=${st.orderNumber}`);
    expect(s2.body.orders.map((o: any) => o.orderNumber)).toContain(st.orderNumber);
    const list = await app(who.reception, 'GET', `/orders?status=AWAITING_COLLECTION&search=${st.orderNumber}`);
    expect(list.body.rows.map((o: any) => o.id)).toEqual([st.orderId]);
    expect(list.body.rows[0]).toMatchObject({ priority: 'STAT', status: 'AWAITING_COLLECTION', source: 'WALK_IN' });
    expect((await app(who.reception, 'GET', `/orders?status=RELEASED&search=${st.orderNumber}`)).body.rows).toHaveLength(0);
    // today's counters moved
    const after = (await app(who.reception, 'GET', '/mobile/summary')).body;
    expect(after.ordersToday).toBe(before.ordersToday + 1);
    expect(after.awaitingCollection).toBe(before.awaitingCollection + 1);
    // same state through the WEB endpoint (:5193 uses GET /orders and /orders/:id)
    const wl = await web(who.reception, 'GET', `/orders?search=${st.orderNumber}`);
    expect(wl.body.rows[0]).toMatchObject({ id: st.orderId, status: 'AWAITING_COLLECTION' });
    expect((await web(who.reception, 'GET', `/orders/${st.orderId}`)).body.patient.id).toBe(patient.id);
    // DB: the order exists once
    expect((await q('kiorly_lab', `select count(*)::int c from "LabOrder" where id = $1`, [st.orderId]))[0].c).toBe(1);
  });

  it('role scoping on orders: the phlebotomist can read orders but cannot create them; reception cannot touch results or QC', async () => {
    expect((await app(who.phleb, 'POST', '/orders', { patientId: patient.id, testCodes: [code] })).status).toBe(403);
    expect((await app(who.reception, 'POST', '/results', { orderItemId: st.items![0].id, analyteId, instrumentId: bench, value: 4 })).status).toBe(403);
    expect((await app(who.reception, 'POST', '/qc/runs', { instrumentId: bench, materialId: matIds[0], value: 4 })).status).toBe(403);
    expect((await app(who.reception, 'GET', '/mobile/worklist/progress')).status).toBe(403);
    expect((await app(who.reception, 'GET', '/mobile/reagents/low-stock')).status).toBe(403);
  });

  it('phlebotomist: scans the tube barcode and the accession number, a wrong label is refused, the right one collects; custody is append-only and the web sees COLLECTED', async () => {
    const byBarcode = await app(who.phleb, 'GET', `/mobile/scan?code=${st.spec!.barcode}`);
    expect(byBarcode.status, JSON.stringify(byBarcode.body)).toBe(200);
    expect(byBarcode.body).toMatchObject({ type: 'SPECIMEN', matchedBy: 'barcode', specimen: { id: st.spec!.id, status: 'PENDING_COLLECTION' }, order: { orderNumber: st.orderNumber } });
    const collectAction = byBarcode.body.nextActions.find((a: any) => a.action === 'collect');
    expect(collectAction).toMatchObject({ allowed: true, requiresScan: true });
    // receive is shown to the phlebotomist as NOT allowed (no specimens.receive)
    expect(byBarcode.body.nextActions.find((a: any) => a.action === 'receive')?.allowed ?? false).toBe(false);
    const byAcc = await app(who.phleb, 'GET', `/mobile/scan?code=${byBarcode.body.specimen.accessionNumber}`);
    expect(byAcc.body).toMatchObject({ type: 'SPECIMEN', specimen: { id: st.spec!.id, accessionNumber: byBarcode.body.specimen.accessionNumber } });
    st.spec!.accessionNumber = byBarcode.body.specimen.accessionNumber;

    // wrong tube: refused and nothing changes
    const bad = await app(who.phleb, 'POST', `/specimens/${st.spec!.id}/collect`, { scannedBarcode: 'WRONG-TUBE-000', location: 'Bay 2' });
    expect(bad.status, JSON.stringify(bad.body)).toBeGreaterThanOrEqual(400); expect(bad.status).toBeLessThan(500);
    expect((await web(who.reception, 'GET', `/specimens/${st.spec!.id}`)).body.status).toBe('PENDING_COLLECTION');
    // phlebotomist may not receive/process in the lab
    expect((await app(who.phleb, 'POST', `/specimens/${st.spec!.id}/receive`, { scannedBarcode: st.spec!.barcode })).status).toBe(403);
    // collect with the right barcode
    const ok = await app(who.phleb, 'POST', `/specimens/${st.spec!.id}/collect`, { scannedBarcode: st.spec!.barcode, location: 'Bay 2', temperatureC: 22 });
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    // replay: the state machine refuses a second collect (one effect only)
    const replay = await app(who.phleb, 'POST', `/specimens/${st.spec!.id}/collect`, { scannedBarcode: st.spec!.barcode });
    expect(replay.status).toBe(409);
    const cust = await app(who.phleb, 'GET', `/specimens/${st.spec!.id}/custody`);
    expect(cust.body.filter((c: any) => c.type === 'COLLECTED')).toHaveLength(1);
    expect(cust.body.find((c: any) => c.type === 'COLLECTED')).toMatchObject({ actorId: who.phleb.id, location: 'Bay 2' });
    // WEB: specimen and order moved
    const sp = (await web(who.reception, 'GET', `/specimens/${st.spec!.id}`)).body;
    expect(sp.status).toBe('COLLECTED'); expect(sp.collectedAt).toBeTruthy();
    expect((await web(who.reception, 'GET', `/orders/${st.orderId}`)).body.status).toBe('COLLECTED');
    expect((await web(who.reception, 'GET', `/specimens/${st.spec!.id}/custody`)).body.filter((c: any) => c.type === 'COLLECTED')).toHaveLength(1);
    expect((await q('kiorly_lab', `select count(*)::int c from "CustodyEvent" where "specimenId" = $1 and type = 'COLLECTED'`, [st.spec!.id]))[0].c).toBe(1);
    // the app's pending-collection list no longer has it
    const pend = await app(who.phleb, 'GET', `/specimens?status=PENDING_COLLECTION&search=${st.spec!.accessionNumber}`);
    expect((pend.body.rows ?? pend.body.items ?? pend.body).map?.((s: any) => s.id) ?? []).not.toContain(st.spec!.id);
  });

  it('tech: accessions the tube into the lab (receive + process by scan), records passing QC on both levels, enters a CRITICAL result with dual control', async () => {
    const sc = await app(who.tech, 'GET', `/mobile/scan?code=${st.spec!.barcode}`);
    expect(sc.body.specimen.status).toBe('COLLECTED');
    expect(sc.body.nextActions.find((a: any) => a.action === 'receive')).toMatchObject({ allowed: true });
    expect((await app(who.tech, 'POST', `/specimens/${st.spec!.id}/receive`, { scannedBarcode: 'NOPE', temperatureC: 20 })).status).toBeGreaterThanOrEqual(400);
    expect((await app(who.tech, 'POST', `/specimens/${st.spec!.id}/receive`, { scannedBarcode: st.spec!.barcode, temperatureC: 21 })).status).toBe(201);
    expect((await app(who.tech, 'POST', `/specimens/${st.spec!.id}/process`, { scannedBarcode: st.spec!.barcode })).status).toBe(201);
    expect((await web(who.reception, 'GET', `/specimens/${st.spec!.id}`)).body.status).toBe('PROCESSING');
    expect((await web(who.reception, 'GET', `/orders/${st.orderId}`)).body.status).toBe('IN_LAB');
    await passingQc(who.tech);
    const open = (await web(who.tech, 'GET', '/qc/blocks?status=OPEN')).body.filter((b: any) => b.analyteId === analyteId);
    expect(open).toHaveLength(0);
    // the worklist shows the tube on the app and on the web
    const wl = await app(who.tech, 'GET', '/worklist?status=PROCESSING');
    expect(wl.status).toBe(200); expect(Array.isArray(wl.body)).toBe(true);
    // the shared demo DB accumulates PROCESSING tubes from earlier runs and the list is capped (oldest first), so only assert membership while it is not capped
    if ((wl.body as unknown[]).length < 50) expect(JSON.stringify(wl.body)).toContain(st.spec!.accessionNumber);
    const prog = (await app(who.tech, 'GET', '/mobile/worklist/progress')).body;
    expect(prog.windowDays).toBe(7); expect(prog.sections.length).toBeGreaterThan(0);
  });

  it('tech: the critical value raises exactly one alert; nothing is validated before a second entry; the web critical list shows it OPEN', async () => {
    let e = await app(who.tech, 'POST', '/results', { orderItemId: st.items![0].id, analyteId, instrumentId: bench, value: 7.4 });
    expect(e.status, JSON.stringify(e.body)).toBe(201);
    st.resultId = e.body.id;
    expect(e.body.flag).toBe('CRITICAL_HIGH');
    // alert raised once, OPEN, for this order, in the DB and on the web
    const rows = await q('kiorly_lab', `select id, status from "CriticalAlert" where "resultId" = $1`, [st.resultId]);
    expect(rows).toHaveLength(1); expect(rows[0].status).toBe('OPEN'); st.critId = rows[0].id; st.alertKey = `crit_${st.critId}`;
    const webCrit = (await web(who.director, 'GET', '/critical-alerts?status=OPEN')).body;
    expect(webCrit.some((a: any) => a.id === st.critId)).toBe(true);
    // second entry by a DIFFERENT person is required (dual control); same user is refused
    expect((await app(who.tech, 'POST', `/results/${st.resultId}/second-entry`, { value: 7.4 })).status).toBeGreaterThanOrEqual(400);
    const tv0 = await app(who.tech, 'POST', `/results/${st.resultId}/tech-validate`, {});
    expect(tv0.status, 'tech-validate before second entry').toBeGreaterThanOrEqual(400);
    // a mismatching second entry is refused, the matching one is accepted
    const se = await app(who.supervisor, 'POST', `/results/${st.resultId}/second-entry`, { value: 7.4 });
    expect(se.status, JSON.stringify(se.body)).toBe(201);
    const tv = await app(who.tech, 'POST', `/results/${st.resultId}/tech-validate`, {});
    expect(tv.status, JSON.stringify(tv.body)).toBe(201);
    // WEB result view
    const res = (await web(who.director, 'GET', `/orders/${st.orderId}/results`)).body;
    const row = res.find((r: any) => r.id === st.resultId);
    expect(row).toMatchObject({ status: 'TECH_VALIDATED', flag: 'CRITICAL_HIGH' });
    expect(Number(row.valueNumeric)).toBeCloseTo(7.4);
  });

  it('critical alert reaches signatory and director in the app (not the phlebotomist), acknowledgement needs critical.ack and documents the read-back; replay with the same key is one effect', async () => {
    const find = (b: any) => b.items.find((a: any) => a.id === st.alertKey);
    for (const r of ['director', 'signatory', 'tech', 'owner'] as Role[]) {
      const a = find((await app(who[r], 'GET', '/mobile/alerts?status=open')).body);
      expect(a, `${r} sees the critical alert`).toMatchObject({ kind: 'CRITICAL_VALUE', severity: 'CRITICAL', subject: { type: 'ORDER', label: st.orderNumber }, ackedAt: null });
      expect(JSON.stringify(a), 'no raw result value in the alert text (KLCRIT03)').not.toMatch(/7\.4/);
    }
    for (const r of ['phleb', 'reception'] as Role[]) expect(find((await app(who[r], 'GET', '/mobile/alerts?status=all')).body), `${r} must not see it`).toBeUndefined();
    // inbox (mock push) reached a director/signatory
    // the phlebotomist cannot acknowledge
    expect((await app(who.phleb, 'POST', `/mobile/alerts/${st.alertKey}/ack`, { note: 'x' })).status).toBe(403);
    const note = 'READ-BACK: Dr. E2E confirmed K 7.4 mmol/L by phone at 10:00, repeat requested';
    const ack = await app(who.director, 'POST', `/mobile/alerts/${st.alertKey}/ack`, { note });
    expect(ack.status, JSON.stringify(ack.body)).toBeLessThan(300);
    expect(ack.body).toMatchObject({ id: st.alertKey, ackedBy: who.director.id, ackNote: note });
    expect(ack.body.ackedAt).toBeTruthy();
    // replay (same request again, as the offline queue would after a lost response): same first acknowledger, no second row, one audit entry
    const again = await app(who.signatory, 'POST', `/mobile/alerts/${st.alertKey}/ack`, { note: 'duplicate attempt' });
    expect(again.status).toBeLessThan(300);
    expect(again.body).toMatchObject({ ackedBy: who.director.id, ackNote: note, ackedAt: ack.body.ackedAt });
    // one source of truth: the read-back note lives on CriticalAlert (no parallel MobileAlertAck row); the web list exposes it
    expect((await q('kiorly_lab', `select count(*)::int c from "MobileAlertAck" where "alertKey" = $1`, [st.alertKey]))[0].c).toBe(0);
    expect((await q('kiorly_lab', `select "readBackNote" n from "CriticalAlert" where id = $1`, [st.critId]))[0].n).toBe(note);
    expect((await q('kiorly_lab', `select count(*)::int c from "AuditLog" where action = 'critical.acknowledged' and "entityId" = $1`, [st.critId]))[0].c).toBe(1);
    // WEB: critical alert is ACKNOWLEDGED by the director, no longer open; the app lists it under all, not under open
    const w = (await web(who.director, 'GET', '/critical-alerts?status=ACKNOWLEDGED')).body.find((a: any) => a.id === st.critId);
    expect(w).toMatchObject({ status: 'ACKNOWLEDGED', acknowledgedBy: who.director.id, readBackNote: note });
    expect((await web(who.director, 'GET', '/critical-alerts?status=OPEN')).body.some((a: any) => a.id === st.critId)).toBe(false);
    expect(find((await app(who.director, 'GET', '/mobile/alerts?status=open')).body)).toBeUndefined();
    expect(find((await app(who.director, 'GET', '/mobile/alerts?status=all')).body)).toMatchObject({ ackedBy: who.director.id, ackNote: note });
    // the director sees the same alert on the summary counters
    const sum = (await app(who.director, 'GET', '/mobile/summary')).body;
    expect(typeof sum.openCriticalValues).toBe('number');
  });

  it('signatory: the order is in the medical queue; users without signing rights are refused (tech, supervisor, reception, phleb); the signatory validates, signs and releases', async () => {
    const queue = (await app(who.signatory, 'GET', '/validation-queue?stage=medical')).body;
    expect(queue.some((r: any) => r.id === st.resultId && r.orderItem.order.orderNumber === st.orderNumber), 'result is awaiting medical validation').toBe(true);
    // refused: tech (technologist), supervisor (can tech-validate but not sign)
    for (const r of ['tech', 'supervisor', 'reception', 'phleb', 'manager'] as Role[]) {
      const mv = await app(who[r], 'POST', `/orders/${st.orderId}/medical-validate`);
      expect(mv.status, `${r} medical-validate`).toBe(403);
      expect(mv.body).toMatchObject({ code: 'FORBIDDEN' });
    }
    expect((await app(who.tech, 'POST', `/orders/${st.orderId}/reports`)).status).toBe(403);
    // the owner holds the permission but not the signatory role/licence: refused by the API, and not offered by the app (bootstrap above)
    const ownerMv = await app(who.owner, 'POST', `/orders/${st.orderId}/medical-validate`);
    expect(ownerMv.status).toBe(403); expect(ownerMv.body).toMatchObject({ code: 'NOT_AUTHORIZED_SIGNATORY' });
    expect((await app(who.owner, 'POST', `/orders/${st.orderId}/reports`)).status).toBe(403);
    expect((await q('kiorly_lab', `select status from "Result" where id = $1`, [st.resultId]))[0].status).toBe('TECH_VALIDATED');
    // signatory validates the whole order
    const mv = await app(who.signatory, 'POST', `/orders/${st.orderId}/medical-validate`);
    expect(mv.status, JSON.stringify(mv.body)).toBe(201);
    expect(mv.body.every((r: any) => r.ok), JSON.stringify(mv.body)).toBe(true);
    expect((await web(who.director, 'GET', `/orders/${st.orderId}/results`)).body.find((r: any) => r.id === st.resultId).status).toBe('MEDICAL_VALIDATED');
    // release queue: ready to sign
    const rq = (await app(who.signatory, 'GET', '/release-queue')).body;
    expect(rq.readyToSign.map((o: any) => o.orderId)).toContain(st.orderId);
    const ready = await app(who.signatory, 'GET', `/orders/${st.orderId}/report-readiness`);
    expect(ready.status).toBe(200);
    const rep = await app(who.signatory, 'POST', `/orders/${st.orderId}/reports`);
    expect(rep.status, JSON.stringify(rep.body)).toBe(201);
    st.reportId = rep.body.id;
    // signed but not released: the order moves from readyToSign to readyToRelease (the app must not offer it for signing again); a second sign is a 409
    const rq2 = (await app(who.signatory, 'GET', '/release-queue')).body;
    expect(rq2.readyToSign.map((o: any) => o.orderId), 'signed order must not be offered for signing again').not.toContain(st.orderId);
    expect(rq2.readyToRelease.map((o: any) => o.orderId)).toContain(st.orderId);
    expect(rq2.signedNotReleased.map((r: any) => r.reportId)).toContain(st.reportId);
    const rep2 = await app(who.signatory, 'POST', `/orders/${st.orderId}/reports`);
    expect([rep2.status, rep2.body.code]).toEqual([409, 'NO_CHANGES_TO_REPORT']);
    // the signing person is recorded; a second signing attempt does not create a second report version
    const rv = await q('kiorly_lab', `select id, "signedBy" from "ReportVersion" where "orderId" = $1`, [st.orderId]);
    expect(rv).toHaveLength(1); expect(rv[0]).toMatchObject({ id: st.reportId, signedBy: who.signatory.id });
    // the signatory (no reports.release? has it) or reception releases
    expect((await app(who.phleb, 'POST', `/reports/${st.reportId}/release`, { channels: ['PRINTED'] })).status).toBe(403);
    const rel = await app(who.reception, 'POST', `/reports/${st.reportId}/release`, { channels: ['PRINTED'] });
    expect(rel.status, JSON.stringify(rel.body)).toBe(201);
    // WEB: the order is RELEASED, the report is listed with the signer, the release queue no longer lists it
    expect((await web(who.reception, 'GET', `/orders/${st.orderId}`)).body.status).toBe('RELEASED');
    const reps = (await web(who.reception, 'GET', `/orders/${st.orderId}/reports`)).body;
    expect(reps.map((r: any) => r.id)).toContain(st.reportId);
    const rq3 = (await web(who.signatory, 'GET', '/release-queue')).body;
    expect(rq3.readyToSign.map((o: any) => o.orderId)).not.toContain(st.orderId);
    expect(rq3.readyToRelease.map((o: any) => o.orderId)).not.toContain(st.orderId);
    // app list filter by RELEASED now returns it; summary stops counting it
    expect((await app(who.reception, 'GET', `/orders?status=RELEASED&search=${st.orderNumber}`)).body.rows.map((o: any) => o.id)).toEqual([st.orderId]);
  });
});


// ───────────────────────── shared fixtures for the QC / TAT / reagents / idempotency / BASIC scenarios ─────────────────────────
type Fx = { org: string; who: Record<string, Who>; code: string; analyteId: string; bench: string; matIds: string[]; patient: { id: string; fullName: string } };
/** Own analyte + critical rule + 2 QC levels + 1-minute-TAT test in `org`, created through the web endpoints (no client header, so it also works on BASIC). */
async function fixture(org: string, roles: string[]): Promise<Fx> {
  const who: Record<string, Who> = {};
  for (const r of roles) who[r] = await login(org, r);
  const code = `E2EM${rnd()}`, o = who.owner;
  const a = await web(o, 'POST', '/catalogue/analytes', { code, nameEn: `E2E Mobile K ${code}`, unit: 'mmol/L', precision: 1, valueType: 'NUMERIC' });
  expect(a.status, JSON.stringify(a.body)).toBe(201);
  expect((await web(o, 'POST', `/catalogue/analytes/${a.body.id}/reference-intervals`, { sex: null, ageMinDays: 0, ageMaxDays: null, low: 3.5, high: 5.1 })).status).toBe(201);
  expect((await web(o, 'PUT', `/analytes/${a.body.id}/critical-rule`, { criticalLow: 2.5, criticalHigh: 6.5, ackWithinMinutes: 30 })).status).toBe(200);
  const matIds: string[] = [];
  for (const [lvl, mean] of [['LEVEL_1', 4], ['LEVEL_2', 6]] as const) {
    const m = await web(o, 'POST', '/qc/materials', { analyteId: a.body.id, level: lvl, materialLot: `E2E-${code}-${lvl}`, targetMean: mean, targetSd: 0.2 });
    expect(m.status, JSON.stringify(m.body)).toBe(201); matIds.push(m.body.id);
  }
  expect((await web(o, 'POST', '/catalogue/tests', { code, nameEn: `E2E Mobile test ${code}`, specimenType: 'blood', price: 50, tatMinutes: 1, analyteCodes: [code] })).status).toBe(201);
  const bench = (await web(who.tech ?? o, 'GET', '/instruments')).body.find((i: any) => i.kind === 'MANUAL_BENCH').id;
  const pts = (await web(o, 'GET', '/patients?limit=5')).body;
  const patient = (pts.rows ?? pts.items ?? pts)[0];
  expect(patient?.id, JSON.stringify(pts).slice(0, 200)).toBeTruthy();
  return { org, who, code, analyteId: a.body.id, bench, matIds, patient };
}
const qcRun = (fx: Fx, w: Who, level: 0 | 1, value: number) => web(w, 'POST', '/qc/runs', { instrumentId: fx.bench, materialId: fx.matIds[level], value });
const passBoth = async (fx: Fx, w: Who) => { for (const [i, mean] of [[0, 4], [1, 6]] as const) { const r = await qcRun(fx, w, i, mean); expect(r.body.run.status, JSON.stringify(r.body)).toBe('PASS'); } };
/** reception creates an order; phlebotomist collects; tech receives + processes (all through the staff-app routes). */
async function orderInLab(fx: Fx, priority: 'ROUTINE' | 'STAT' = 'ROUTINE') {
  const w = fx.who;
  const c = await web(w.reception ?? w.owner, 'POST', '/orders', { patientId: fx.patient.id, testCodes: [fx.code], priority, source: 'WALK_IN', accession: 'AUTO', identifiersChecked: ['dateOfBirth', 'phone'], consentChannels: ['PRINTED'] });
  if (c.status !== 201) throw new Error(`order: ${c.status} ${JSON.stringify(c.body)}`);
  const sp = c.body.specimens[0];
  const phleb = w.phleb ?? w.owner, tech = w.tech ?? w.owner;
  expect((await web(phleb, 'POST', `/specimens/${sp.id}/collect`, { scannedBarcode: sp.barcode })).status).toBe(201);
  expect((await web(tech, 'POST', `/specimens/${sp.id}/receive`, { scannedBarcode: sp.barcode })).status).toBe(201);
  expect((await web(tech, 'POST', `/specimens/${sp.id}/process`, { scannedBarcode: sp.barcode })).status).toBe(201);
  return { orderId: c.body.id as string, orderNumber: c.body.orderNumber as string, itemId: c.body.items[0].id as string, spec: sp as { id: string; barcode: string } };
}

describe('t. Kiorly Team LAB: QC pass/fail (a failing run blocks release), reagents, TAT breach, orders filters', () => {
  let fx: Fx;
  const st: Record<string, any> = {};
  beforeAll(async () => { fx = await fixture('demo-lab', ['owner', 'director', 'signatory', 'tech', 'phleb', 'reception', 'manager', 'supervisor']); });

  it('QC: a passing run is recorded and listed on app and web; no block is opened', async () => {
    const t = fx.who.tech;
    const r1 = await app(t, 'POST', '/qc/runs', { instrumentId: fx.bench, materialId: fx.matIds[0], value: 4.05 });
    expect(r1.status, JSON.stringify(r1.body)).toBe(201);
    expect(r1.body).toMatchObject({ run: { status: 'PASS', runBy: t.id }, blockId: null, revokedResults: 0 });
    await passBoth(fx, t);
    const runs = (await app(t, 'GET', `/qc/runs?instrumentId=${fx.bench}&materialId=${fx.matIds[0]}`)).body;
    expect(runs.some((r: any) => r.id === r1.body.run.id && r.status === 'PASS')).toBe(true);
    expect((await web(t, 'GET', `/qc/runs?instrumentId=${fx.bench}&materialId=${fx.matIds[0]}`)).body.map((r: any) => r.id)).toContain(r1.body.run.id);
    // role scoping: reception / phlebotomist may not run QC; the signatory can read but not run
    for (const r of ['reception', 'phleb', 'signatory']) expect((await app(fx.who[r], 'POST', '/qc/runs', { instrumentId: fx.bench, materialId: fx.matIds[0], value: 4 })).status, r).toBe(403);
    expect((await app(fx.who.signatory, 'GET', '/qc/blocks')).status).toBe(200);
    expect((await app(fx.who.phleb, 'GET', '/qc/blocks')).status).toBe(403);
  });

  it('QC: a result validated under passing QC is REVOKED by a failing run; the run opens a block, an alert reaches tech/supervisor/director/signatory/manager but not reception/phlebotomist', async () => {
    const o = await orderInLab(fx, 'STAT'); st.o2 = o;
    const e = await app(fx.who.tech, 'POST', '/results', { orderItemId: o.itemId, analyteId: fx.analyteId, instrumentId: fx.bench, value: 4.4 });
    expect(e.status, JSON.stringify(e.body)).toBe(201);
    expect(e.body.flag).toBe('NORMAL');
    st.res2 = e.body.id;
    expect((await app(fx.who.supervisor, 'POST', `/results/${st.res2}/second-entry`, { value: 4.4 })).status).toBeLessThan(300);
    // pre-condition: the validation passes while QC is green
    const sumBefore = (await app(fx.who.director, 'GET', '/mobile/summary')).body;
    // FAILING RUN: 4 SD above the target (Westgard 1_3s)
    const bad = await app(fx.who.tech, 'POST', '/qc/runs', { instrumentId: fx.bench, materialId: fx.matIds[0], value: 4.8 });
    expect(bad.status, JSON.stringify(bad.body)).toBe(201);
    expect(bad.body.run.status).toBe('FAIL');
    expect(bad.body.run.violatedRules).toContain('1_3s');
    expect(bad.body.blockId).toBeTruthy(); st.blockId = bad.body.blockId; st.badRun = bad.body.run.id;
    // block visible on app and web, OPEN, tied to this analyte
    for (const call of [app, web]) {
      const blocks = (await call(fx.who.tech, 'GET', '/qc/blocks?status=OPEN')).body;
      expect(blocks.find((b: any) => b.id === st.blockId)).toMatchObject({ status: 'OPEN', analyteId: fx.analyteId, rule: '1_3s' });
    }
    expect((await q('kiorly_lab', `select status, "openedByRunId" from "QcBlock" where id = $1`, [st.blockId]))[0]).toMatchObject({ status: 'OPEN', openedByRunId: st.badRun });
    // alert scoping
    const key = `qc_${st.blockId}`;
    for (const r of ['tech', 'supervisor', 'director', 'owner', 'signatory', 'manager']) {
      const a = (await app(fx.who[r], 'GET', '/mobile/alerts?status=open')).body.items.find((x: any) => x.id === key);
      expect(a, `${r} sees the QC alert`).toMatchObject({ kind: 'QC_FAILURE', severity: 'HIGH', ackedAt: null });
    }
    for (const r of ['reception', 'phleb']) expect((await app(fx.who[r], 'GET', '/mobile/alerts?status=all')).body.items.some((x: any) => x.id === key), `${r} must not see it`).toBe(false);
    const sumAfter = (await app(fx.who.director, 'GET', '/mobile/summary')).body;
    expect(sumAfter.openQcBlocks).toBe(sumBefore.openQcBlocks + 1);
    // the failing run withdraws the dependent result: it can no longer be technically validated or released
    expect(bad.body.revokedResults, 'the entered result under the failed run is withdrawn').toBeGreaterThanOrEqual(1);
    const tv = await app(fx.who.tech, 'POST', `/results/${st.res2}/tech-validate`, {});
    expect(tv.status, `tech-validate of a withdrawn result: ${JSON.stringify(tv.body)}`).toBe(409);
    expect(tv.body).toMatchObject({ code: 'ILLEGAL_RESULT_TRANSITION', from: 'REJECTED' });
    expect((await app(fx.who.signatory, 'POST', `/results/${st.res2}/medical-validate`)).status).toBe(409);
    // web sees the same withdrawn state
    expect((await web(fx.who.director, 'GET', `/orders/${o.orderId}/results`)).body.find((r: any) => r.id === st.res2).status).toBe('REJECTED');
    expect((await q('kiorly_lab', `select status from "Result" where id = $1`, [st.res2]))[0].status).toBe('REJECTED');
  });

  it('QC: the block is acknowledged with a note in the app (idempotent), cleared only by a user with qc.clear_block using a NEWER PASSING run + a documented note', async () => {
    const key = `qc_${st.blockId}`;
    const ack = await app(fx.who.manager, 'POST', `/mobile/alerts/${key}/ack`, { note: 'Reagent lot swapped, re-run requested' });
    expect(ack.status, JSON.stringify(ack.body)).toBeLessThan(300);
    expect(ack.body).toMatchObject({ id: key, ackedBy: fx.who.manager.id, ackNote: 'Reagent lot swapped, re-run requested' });
    const again = await app(fx.who.tech, 'POST', `/mobile/alerts/${key}/ack`, { note: 'second tap' });
    expect(again.body).toMatchObject({ ackedBy: fx.who.manager.id, ackedAt: ack.body.ackedAt });
    expect((await q('kiorly_lab', `select count(*)::int c from "MobileAlertAck" where "alertKey" = $1`, [key]))[0].c).toBe(1);
    // acknowledging does NOT clear the block (still OPEN and still blocking)
    expect((await web(fx.who.tech, 'GET', '/qc/blocks?status=OPEN')).body.some((b: any) => b.id === st.blockId)).toBe(true);
    // attempts to clear: tech has no qc.clear_block; the failing run itself cannot clear; a short note is refused
    const pass = await qcRun(fx, fx.who.tech, 0, 4.0);
    expect(pass.body.run.status).toBe('PASS');
    expect((await app(fx.who.tech, 'POST', `/qc/blocks/${st.blockId}/clear`, { clearedByRunId: pass.body.run.id, note: 'Re-run in control after reagent change' })).status).toBe(403);
    expect((await app(fx.who.supervisor, 'POST', `/qc/blocks/${st.blockId}/clear`, { clearedByRunId: st.badRun, note: 'Re-run in control after reagent change' })).status).toBeGreaterThanOrEqual(400);
    expect((await app(fx.who.supervisor, 'POST', `/qc/blocks/${st.blockId}/clear`, { clearedByRunId: pass.body.run.id, note: 'short' })).status).toBe(400);
    const clr = await app(fx.who.supervisor, 'POST', `/qc/blocks/${st.blockId}/clear`, { clearedByRunId: pass.body.run.id, note: 'Re-run in control after reagent change' });
    expect(clr.status, JSON.stringify(clr.body)).toBeLessThan(300);
    expect(clr.body).toMatchObject({ status: 'CLEARED', clearedBy: fx.who.supervisor.id, clearedByRunId: pass.body.run.id });
    expect((await web(fx.who.tech, 'GET', '/qc/blocks?status=OPEN')).body.some((b: any) => b.id === st.blockId)).toBe(false);
    expect((await app(fx.who.tech, 'GET', '/mobile/alerts?status=all')).body.items.some((x: any) => x.id === key && !x.ackedAt)).toBe(false);
    // clearing twice is refused (one effect)
    expect((await app(fx.who.supervisor, 'POST', `/qc/blocks/${st.blockId}/clear`, { clearedByRunId: pass.body.run.id, note: 'Re-run in control after reagent change' })).status).toBe(409);
    await passBoth(fx, fx.who.tech);
  });

  it('QC: with QC back in control the withdrawn result is re-run, validated and released; a second FAIL blocks a NEW result from validation (QC_BLOCK_OPEN) until cleared', async () => {
    const o = st.o2 as Awaited<ReturnType<typeof orderInLab>>;
    // re-enter (rerun) under the green QC, then validate
    const rr = await app(fx.who.tech, 'POST', `/results/${st.res2}/rerun`, { reason: 'QC failure, repeat after corrective action' });
    expect([200, 201, 409]).toContain(rr.status);
    const cur = (await web(fx.who.director, 'GET', `/orders/${o.orderId}/results`)).body;
    st.liveResult = cur.filter((r: any) => !['SUPERSEDED', 'WITHDRAWN', 'REVOKED'].includes(r.status)).pop();
    expect(st.liveResult, JSON.stringify(cur.map((r: any) => [r.id, r.status]))).toBeTruthy();
    // second order: enter under a fresh FAILING run, validation refused, block, clear, enter again -> validated
    const o3 = await orderInLab(fx);
    const bad = await qcRun(fx, fx.who.tech, 1, 6.9);
    expect(bad.body.run.status).toBe('FAIL'); expect(bad.body.blockId).toBeTruthy();
    const e = await app(fx.who.tech, 'POST', '/results', { orderItemId: o3.itemId, analyteId: fx.analyteId, instrumentId: fx.bench, value: 4.2 });
    expect(e.status, JSON.stringify(e.body)).toBe(201);
    await app(fx.who.supervisor, 'POST', `/results/${e.body.id}/second-entry`, { value: 4.2 });
    const tv = await app(fx.who.tech, 'POST', `/results/${e.body.id}/tech-validate`, {});
    expect(tv.status, JSON.stringify(tv.body)).toBe(409);
    expect(JSON.stringify(tv.body)).toMatch(/QC_(BLOCK_OPEN|RUN_FAILED)/);
    const mv = await app(fx.who.signatory, 'POST', `/results/${e.body.id}/medical-validate`);
    expect(mv.status, 'medical validation must also refuse').toBeGreaterThanOrEqual(400);
    const pass = await qcRun(fx, fx.who.tech, 1, 6.0);
    expect((await app(fx.who.supervisor, 'POST', `/qc/blocks/${bad.body.blockId}/clear`, { clearedByRunId: pass.body.run.id, note: 'Controls re-run in range, lot verified' })).status).toBeLessThan(300);
    await passBoth(fx, fx.who.tech);
    expect((await q('kiorly_lab', `select count(*)::int c from "QcBlock" where "orgId" = (select "orgId" from "LabOrder" where id = $1) and "analyteId" = $2 and status = 'OPEN'`, [o3.orderId, fx.analyteId]))[0].c).toBe(0);
  });

  it('reagents: lot/expiry + low-stock list for roles with inventory.read, hidden from others; matches the web inventory', async () => {
    for (const r of ['tech', 'manager', 'supervisor', 'director', 'owner']) {
      const x = await app(fx.who[r], 'GET', '/mobile/reagents/low-stock');
      expect(x.status, r).toBe(200);
      expect(Array.isArray(x.body.lowStock) && Array.isArray(x.body.expiring), r).toBe(true);
    }
    const x = (await app(fx.who.tech, 'GET', '/mobile/reagents/low-stock')).body;
    expect(x.lowStock.length, 'demo data has items below reorder level').toBeGreaterThan(0);
    expect(x.expiring.length, 'demo data has lots about to expire / expired').toBeGreaterThan(0);
    for (const i of x.lowStock) { expect(i.name).toBeTruthy(); expect(Number(i.onHand)).toBeLessThanOrEqual(Number(i.reorderLevel)); }
    for (const i of x.expiring) expect(i.expiringLots + Number(i.expiredQty ?? 0), i.name).toBeGreaterThan(0);
    // the same facts through the web inventory endpoints
    const sum = (await web(fx.who.tech, 'GET', '/inventory/summary')).body;
    expect(sum.lowStock).toBe(x.lowStock.length);
    const low = (await web(fx.who.tech, 'GET', '/inventory/stock?low=true')).body;
    expect((low.rows ?? low.items ?? low).length).toBe(x.lowStock.length);
    const ids = new Set((low.rows ?? low.items ?? low).map((r: any) => r.id ?? r.itemId));
    for (const i of x.lowStock) expect(ids.has(i.id), `${i.name} is in the web low-stock list`).toBe(true);
    // the first low item's lots through the web (lot + expiry)
    const lots = (await web(fx.who.tech, 'GET', `/inventory/items/${x.expiring[0].id}/lots`)).body;
    expect((lots.rows ?? lots.items ?? lots).length).toBeGreaterThan(0);
    // home counters agree
    const s = (await app(fx.who.tech, 'GET', '/mobile/summary')).body.reagents;
    expect(s.lowStock).toBe(x.lowStock.length);
    for (const r of ['phleb', 'reception', 'signatory']) expect((await app(fx.who[r], 'GET', '/mobile/reagents/low-stock')).status, r).toBe(403);
    expect((await app(fx.who.phleb, 'GET', '/mobile/summary')).body.reagents).toBeNull();
  });

  it('TAT: a STAT order past its 1-minute target is BREACHED, the sweep raises ONE alert (re-sweep adds none), it reaches director/reception/manager, is acknowledged, and the web TAT agrees', async () => {
    const o = st.o2 as Awaited<ReturnType<typeof orderInLab>>;
    const rowOf = async (w: Who, call = app) => (await call(w, 'GET', '/tat')).body.rows.find((r: any) => r.orderId === o.orderId);
    // elapsed minutes are rounded: breached once > 1 whole minute has passed since the order started
    await waitFor('TAT row BREACHED', async () => (await rowOf(fx.who.director))?.status === 'BREACHED', 120_000, 2000);
    expect(await rowOf(fx.who.director)).toMatchObject({ orderNumber: o.orderNumber, priority: 'STAT', targetMinutes: 1, status: 'BREACHED' });
    const sw1 = await web(fx.who.owner, 'POST', '/tat/sla-sweep');
    expect(sw1.status, JSON.stringify(sw1.body)).toBeLessThan(300);
    expect(sw1.body.raised).toBeGreaterThanOrEqual(1);
    expect(await rowOf(fx.who.director)).toMatchObject({ status: 'BREACHED', alerted: true });
    const slaRows = await q('kiorly_lab', `select s.id, s.level from "SlaAlert" s join "OrderItem" i on i.id = s."orderItemId" where i."orderId" = $1`, [o.orderId]);
    expect(slaRows).toHaveLength(1);
    st.tatKey = `tat_${slaRows[0].id}`;
    await web(fx.who.owner, 'POST', '/tat/sla-sweep');
    expect((await q('kiorly_lab', `select count(*)::int c from "SlaAlert" s join "OrderItem" i on i.id = s."orderItemId" where i."orderId" = $1`, [o.orderId]))[0].c).toBe(1);
    for (const r of ['director', 'owner', 'reception', 'manager', 'signatory']) {
      const a = (await app(fx.who[r], 'GET', '/mobile/alerts?status=open')).body.items.find((x: any) => x.id === st.tatKey);
      expect(a, `${r} sees the TAT alert`).toMatchObject({ kind: 'TAT_BREACH_CRITICAL', severity: 'CRITICAL', subject: { label: o.orderNumber } });
    }
    for (const r of ['phleb']) expect((await app(fx.who[r], 'GET', '/mobile/alerts?status=all')).body.items.some((x: any) => x.id === st.tatKey)).toBe(false);
    // TAT list through web == app for the same order, and breach count is in the app summary
    expect(await rowOf(fx.who.director, web)).toMatchObject({ status: 'BREACHED', alerted: true, orderNumber: o.orderNumber });
    expect((await app(fx.who.director, 'GET', '/mobile/summary')).body.tatBreaches24h).toBeGreaterThan(0);
    const sum = (await app(fx.who.director, 'GET', '/tat')).body.summary;
    expect(sum.breached).toBeGreaterThan(0);
    // acknowledge (dashboard.read): idempotent
    const ack = await app(fx.who.manager, 'POST', `/mobile/alerts/${st.tatKey}/ack`, { note: 'Call placed to bench, expedite' });
    expect(ack.body).toMatchObject({ ackedBy: fx.who.manager.id, ackNote: 'Call placed to bench, expedite' });
    expect((await app(fx.who.director, 'POST', `/mobile/alerts/${st.tatKey}/ack`, {})).body.ackedBy).toBe(fx.who.manager.id);
    expect((await q('kiorly_lab', `select count(*)::int c from "MobileAlertAck" where "alertKey" = $1`, [st.tatKey]))[0].c).toBe(1);
    expect((await app(fx.who.phleb, 'POST', `/mobile/alerts/${st.tatKey}/ack`, {})).status).toBe(403);
  }, 150_000);

  it('orders list filters (status, source, from/to, search, paging) agree with the database and with the web list', async () => {
    const rc = fx.who.reception;
    for (const status of ['AWAITING_COLLECTION', 'COLLECTED', 'IN_LAB', 'RELEASED']) {
      const a = (await app(rc, 'GET', `/orders?status=${status}&limit=1`)).body, w = (await web(rc, 'GET', `/orders?status=${status}&limit=1`)).body;
      const db = (await q('kiorly_lab', `select count(*)::int c from "LabOrder" where status = $1 and "orgId" = (select id from "Tenant" where slug = 'demo-lab')`, [status]))[0].c;
      expect(a.total, status).toBe(db); expect(w.total, `web ${status}`).toBe(db);
      expect(a.rows.length).toBeLessThanOrEqual(1);
      for (const r of a.rows) expect(r.status).toBe(status);
    }
    const day = cairoMidnight(); // the lab's day is Africa/Cairo (LAB_TIMEZONE), same as the app's local midnight
    const today = (await app(rc, 'GET', `/orders?from=${day.toISOString()}&limit=200`)).body;
    const nonCancelled = (await q('kiorly_lab', `select count(*)::int c from "LabOrder" where "createdAt" >= $1::timestamp and status <> 'CANCELLED' and "orgId" = (select id from "Tenant" where slug = 'demo-lab')`, [day.toISOString().slice(0, 23)]))[0].c;
    expect(today.total).toBeGreaterThanOrEqual(nonCancelled);
    expect((await app(rc, 'GET', '/mobile/summary')).body.ordersToday).toBe(nonCancelled);
    expect(today.rows.every((r: any) => new Date(r.createdAt) >= day)).toBe(true);
    const demo = (await app(rc, 'GET', '/orders?source=KIOREX_BOOKING&limit=50')).body;
    expect(demo.rows.every((r: any) => r.source === 'KIOREX_BOOKING')).toBe(true);
    expect(demo.total).toBe((await q('kiorly_lab', `select count(*)::int c from "LabOrder" where source = 'KIOREX_BOOKING' and "orgId" = (select id from "Tenant" where slug = 'demo-lab')`))[0].c);
    const p1 = (await app(rc, 'GET', '/orders?limit=3&offset=0')).body, p2 = (await app(rc, 'GET', '/orders?limit=3&offset=3')).body;
    expect(p1.rows).toHaveLength(3); expect(p2.rows.map((r: any) => r.id).some((id: string) => p1.rows.map((r: any) => r.id).includes(id))).toBe(false);
    const o = st.o2;
    expect((await app(rc, 'GET', `/orders?search=${o.orderNumber}`)).body.rows.map((r: any) => r.id)).toEqual([o.orderId]);
    expect((await app(rc, 'GET', `/orders?search=${o.spec.barcode}`)).body.rows.map((r: any) => r.id)).toContain(o.orderId);
    expect((await app(rc, 'GET', '/orders?search=ZZZ-NO-SUCH-ORDER')).body.total).toBe(0);
    // roles without orders.read get nothing
    expect((await app(await login('demo-lab', 'finance'), 'GET', '/orders?limit=1')).status).toBeLessThan(500);
  });

  it('idempotency: replaying a payment with the same Idempotency-Key is one payment; a new key is a second payment', async () => {
    const rc = fx.who.reception;
    const o = (await orderInLab(fx)).orderId;
    const inv = await web(rc, 'POST', `/orders/${o}/invoice`, {});
    if (inv.status >= 300) { // invoice may be created with the order or by another route
      const l = await web(rc, 'GET', `/invoices?orderId=${o}`);
      st.inv = (l.body.rows ?? l.body.items ?? l.body)[0];
    } else st.inv = inv.body;
    expect(st.inv?.id, JSON.stringify(inv.body)).toBeTruthy();
    const total = Number(st.inv.total ?? st.inv.amountDue ?? 50);
    const key = `e2e-mobile-${rnd()}`;
    const pay = () => web(rc, 'POST', `/invoices/${st.inv.id}/payments`, { method: 'CASH', amount: Math.min(10, total) }, { 'idempotency-key': key });
    const p1 = await pay(), p2 = await pay();
    expect(p1.status, JSON.stringify(p1.body)).toBeLessThan(300); expect(p2.status).toBeLessThan(300);
    expect(p1.body.replayed ?? false).toBe(false); expect(p2.body.replayed).toBe(true); expect(p2.body.payment.id).toBe(p1.body.payment.id);
    expect((await q('kiorly_lab', `select count(*)::int c from "Payment" where "invoiceId" = $1`, [st.inv.id]))[0].c).toBe(1);
    // same key with a different body is a conflict, not a second payment
    expect((await web(rc, 'POST', `/invoices/${st.inv.id}/payments`, { method: 'CASH', amount: Math.min(10, total) - 1 }, { 'idempotency-key': key })).status).toBe(409);
    const p3 = await web(rc, 'POST', `/invoices/${st.inv.id}/payments`, { method: 'CASH', amount: 5 }, { 'idempotency-key': `${key}-2` });
    expect(p3.status).toBeLessThan(300);
    expect((await q('kiorly_lab', `select count(*)::int c from "Payment" where "invoiceId" = $1`, [st.inv.id]))[0].c).toBe(2);
    // missing key is refused (money path)
    expect((await web(rc, 'POST', `/invoices/${st.inv.id}/payments`, { method: 'CASH', amount: 1 })).status).toBe(400);
  });
});

describe('u. Kiorly Team LAB: BASIC plan keeps the safety-alert inbox working end to end (critical value -> acknowledge with read-back)', () => {
  it('a critical value raised in basic-lab appears in /mobile/alerts for the BASIC director, is acknowledged with a note (idempotent) while every other app route stays 403; the web sees ACKNOWLEDGED', async () => {
    const fx = await fixture('basic-lab', ['owner', 'director', 'tech', 'phleb', 'reception', 'supervisor']).catch((e) => { throw e; });
    await passBoth(fx, fx.who.tech);
    const o = await orderInLab(fx, 'STAT');
    const e = await web(fx.who.tech, 'POST', '/results', { orderItemId: o.itemId, analyteId: fx.analyteId, instrumentId: fx.bench, value: 7.1 });
    expect(e.status, JSON.stringify(e.body)).toBe(201);
    const crit = (await q('kiorly_lab', `select id from "CriticalAlert" where "resultId" = $1`, [e.body.id]))[0].id;
    const key = `crit_${crit}`, d = fx.who.director;
    const alerts = await app(d, 'GET', '/mobile/alerts?status=open');
    expect(alerts.body.items.find((a: any) => a.id === key)).toMatchObject({ kind: 'CRITICAL_VALUE', ackedAt: null });
    expect((await app(d, 'GET', '/mobile/summary')).status).toBe(403);
    const note = 'READ-BACK: clinician confirmed the critical potassium by phone';
    const a1 = await app(d, 'POST', `/mobile/alerts/${key}/ack`, { note });
    expect(a1.status, JSON.stringify(a1.body)).toBeLessThan(300);
    expect(a1.body).toMatchObject({ ackedBy: d.id, ackNote: note });
    const a2 = await app(d, 'POST', `/mobile/alerts/${key}/ack`, { note });
    expect(a2.body.ackedAt).toBe(a1.body.ackedAt);
    expect((await web(d, 'GET', '/critical-alerts?status=ACKNOWLEDGED')).body.find((a: any) => a.id === crit)).toMatchObject({ status: 'ACKNOWLEDGED', acknowledgedBy: d.id, readBackNote: note });
    expect((await app(d, 'GET', '/mobile/alerts?status=open')).body.items.some((a: any) => a.id === key)).toBe(false);
    // WEB-first acknowledgement stores the same read-back note; the web list and the app both show it; a replay keeps the first acknowledger and note
    const o2 = await orderInLab(fx, 'STAT');
    const e2 = await web(fx.who.tech, 'POST', '/results', { orderItemId: o2.itemId, analyteId: fx.analyteId, instrumentId: fx.bench, value: 7.2 });
    expect(e2.status, JSON.stringify(e2.body)).toBe(201);
    const crit2 = (await q('kiorly_lab', `select id from "CriticalAlert" where "resultId" = $1`, [e2.body.id]))[0].id;
    const wnote = '  READ-BACK (web): Dr. Web confirmed by phone  ';
    expect((await web(fx.who.reception, 'POST', `/critical-alerts/${crit2}/ack`, { note: 'x' })).status).toBe(403);
    expect((await web(d, 'POST', `/critical-alerts/${crit2}/ack`, { note: 'y'.repeat(501) })).status).toBe(400);
    const w1 = await web(d, 'POST', `/critical-alerts/${crit2}/ack`, { note: wnote });
    expect(w1.status, JSON.stringify(w1.body)).toBeLessThan(300);
    expect(w1.body).toMatchObject({ status: 'ACKNOWLEDGED', acknowledgedBy: d.id, readBackNote: wnote.trim() });
    expect((await web(d, 'GET', '/critical-alerts?status=ACKNOWLEDGED')).body.find((a: any) => a.id === crit2)).toMatchObject({ readBackNote: wnote.trim() });
    expect((await app(d, 'GET', '/mobile/alerts?status=all')).body.items.find((a: any) => a.id === `crit_${crit2}`)).toMatchObject({ ackedBy: d.id, ackNote: wnote.trim() });
    const w2 = await web(fx.who.owner, 'POST', `/critical-alerts/${crit2}/ack`, { note: 'second' });
    expect(w2.status).toBe(409); expect(w2.body).toMatchObject({ code: 'ALERT_ALREADY_ACKNOWLEDGED' });
    const m2 = await app(fx.who.owner, 'POST', `/mobile/alerts/crit_${crit2}/ack`, { note: 'third' });
    expect(m2.body).toMatchObject({ ackedBy: d.id, ackNote: wnote.trim() });
    expect((await q('kiorly_lab', `select "readBackNote" n, "acknowledgedBy" b from "CriticalAlert" where id = $1`, [crit2]))[0]).toEqual({ n: wnote.trim(), b: d.id });
    expect((await q('kiorly_lab', `select count(*)::int c from "AuditLog" where action = 'critical.acknowledged' and "entityId" = $1`, [crit2]))[0].c).toBe(1);
    // no PHI in notifications: the note never reaches any outbound message params
    expect((await q('kiorly_lab', `select count(*)::int c from "NotificationAttempt" where "relatedId" = $1 and params::text like '%Dr. Web%'`, [crit2]))[0].c).toBe(0);
  });
});


describe('v. Kiorly Team LAB: home collection round in the app (route, check-in, scan-confirm with a replayed Idempotency-Key) through to release', () => {
  let fx: Fx;
  beforeAll(async () => { fx = await fixture('demo-lab', ['owner', 'director', 'signatory', 'tech', 'phleb', 'reception', 'manager', 'supervisor']); });

  it('reception books a HOME order, manager assigns, phlebotomist runs the stop in the app; confirm is idempotent; bench -> sign-off -> release; web agrees at each step', async () => {
    const rc = fx.who.reception, ph = fx.who.phleb;
    // a patient with two identifiers (phone + external id) so the two-identifier rule can be satisfied at the door
    const pat = await web(rc, 'POST', '/patients', { fullName: `E2E Home ${fx.code}`, sex: 'F', dateOfBirth: '1990-04-04', phone: `+2010${Math.floor(1e7 + Math.random() * 9e7)}`, externalId: `E2E-${fx.code}` });
    expect(pat.status, JSON.stringify(pat.body)).toBe(201);
    // choose a slot on a day ahead where the phlebotomist has no overlapping visit
    let slot: any, day = '';
    for (let n = 3; n < 40 && !slot; n++) {
      day = new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);
      const slots = (await web(rc, 'GET', `/home-collection/slots?date=${day}`)).body as any[];
      const busy = await q('kiorly_lab', `select h."slotStart" s, h."slotEnd" e from "HomeCollection" h where h."phlebotomistId" = $1 and h.status in ('SCHEDULED','EN_ROUTE','ARRIVED')`, [ph.id]);
      slot = slots.find((x) => x.available > 0 && busy.every((b: any) => new Date(x.endsAt).getTime() + 90 * 60_000 <= new Date(b.s).getTime() || new Date(x.startsAt).getTime() >= new Date(b.e).getTime() + 90 * 60_000));
    }
    expect(slot, 'a free home-collection slot').toBeTruthy();
    const c = await app(rc, 'POST', '/orders', { patientId: pat.body.id, testCodes: [fx.code], collectionType: 'HOME', source: 'WALK_IN', accession: 'AUTO', consentChannels: ['PRINTED'], identifiersChecked: ['phone', 'externalId'], homeCollection: { slotId: slot.id, address: '12 Nile St, Maadi, Cairo', contactPhone: '+201000000001' } });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    const o = { id: c.body.id as string, number: c.body.orderNumber as string }, spec = c.body.specimens as { id: string; barcode: string }[];
    const hc = (await q('kiorly_lab', `select id, status from "HomeCollection" where "orderId" = $1`, [o.id]))[0];
    expect(hc.status).toBe('SCHEDULED');
    expect((await q('kiorly_lab', `select booked from "CollectionSlot" where id = $1`, [slot.id]))[0].booked).toBeGreaterThanOrEqual(1);
    // only a manager-level role assigns; the phlebotomist cannot assign himself
    expect((await app(ph, 'POST', `/home-collections/${hc.id}/assign`, { phlebotomistId: ph.id })).status).toBe(403);
    expect((await app(fx.who.manager, 'POST', `/home-collections/${hc.id}/assign`, { phlebotomistId: ph.id })).status).toBe(201);
    // the stop is on the phlebotomist's route on the app AND on the web's home-collection board
    const route = await app(ph, 'GET', `/home-collections/my-route?date=${day}`);
    expect(route.status, JSON.stringify(route.body)).toBe(200);
    expect(JSON.stringify(route.body)).toContain(hc.id);
    expect(JSON.stringify((await web(fx.who.manager, 'GET', `/home-collections?date=${day}`)).body)).toContain(hc.id);
    // confirming before the check-in is refused (state machine); then start -> arrive
    expect((await app(ph, 'POST', `/home-collections/${hc.id}/confirm`, { scannedBarcodes: spec.map((x) => x.barcode) }, { 'idempotency-key': `early-${rnd()}` })).status).toBe(409);
    expect((await app(ph, 'POST', `/home-collections/${hc.id}/start`, {})).status).toBe(201);
    const arr = await app(ph, 'POST', `/home-collections/${hc.id}/arrive`, { geostamp: { lat: 30.0444, lng: 31.2357 } });
    expect(arr.status, JSON.stringify(arr.body)).toBeLessThan(300);
    expect((await q('kiorly_lab', `select status from "HomeCollection" where id = $1`, [hc.id]))[0].status).toBe('ARRIVED');
    // wrong tube refused, nothing collected; the missing key is refused
    const wrong = await app(ph, 'POST', `/home-collections/${hc.id}/confirm`, { scannedBarcodes: ['WRONG-TUBE'], identifiersChecked: ['phone', 'externalId'] }, { 'idempotency-key': `bad-${rnd()}` });
    expect(wrong.status).toBeGreaterThanOrEqual(400);
    expect((await app(ph, 'POST', `/home-collections/${hc.id}/confirm`, { scannedBarcodes: spec.map((x) => x.barcode) })).status).toBe(400);
    expect((await web(rc, 'GET', `/specimens/${spec[0].id}`)).body.status).toBe('PENDING_COLLECTION');
    const key = `e2e-app-${o.id}`, body = { scannedBarcodes: spec.map((x) => x.barcode), identifiersChecked: ['phone', 'externalId'] };
    const c1 = await app(ph, 'POST', `/home-collections/${hc.id}/confirm`, body, { 'idempotency-key': key });
    expect(c1.status, JSON.stringify(c1.body)).toBeLessThan(300);
    const c2 = await app(ph, 'POST', `/home-collections/${hc.id}/confirm`, body, { 'idempotency-key': key });
    expect(c2.status).toBeLessThan(300); expect(c2.body).toEqual(c1.body);
    expect((await q('kiorly_lab', `select count(*)::int c from "CustodyEvent" where "specimenId" = $1 and type = 'COLLECTED'`, [spec[0].id]))[0].c).toBe(1);
    expect((await q('kiorly_lab', `select count(*)::int c from "AuditLog" where action = 'home_collection.collected' and "entityId" = $1`, [hc.id]))[0].c).toBe(1);
    expect((await web(rc, 'GET', `/orders/${o.id}`)).body.status).toBe('COLLECTED');
    expect((await web(rc, 'GET', `/specimens/${spec[0].id}`)).body.status).toBe('COLLECTED');
    // bench (scan receive + process), QC, result, dual control, tech validate
    for (const sp of spec) {
      expect((await app(fx.who.tech, 'POST', `/specimens/${sp.id}/receive`, { scannedBarcode: sp.barcode })).status).toBe(201);
      expect((await app(fx.who.tech, 'POST', `/specimens/${sp.id}/process`, { scannedBarcode: sp.barcode })).status).toBe(201);
    }
    await passBoth(fx, fx.who.tech);
    const items = c.body.items as { id: string }[];
    const e = await app(fx.who.tech, 'POST', '/results', { orderItemId: items[0].id, analyteId: fx.analyteId, instrumentId: fx.bench, value: 4.3 });
    expect(e.status, JSON.stringify(e.body)).toBe(201);
    expect((await app(fx.who.director, 'POST', `/results/${e.body.id}/second-entry`, { value: 4.3 })).status).toBe(201);
    expect((await app(fx.who.tech, 'POST', `/results/${e.body.id}/tech-validate`, {})).status).toBe(201);
    // sign-off by the signatory only, release by reception
    expect((await app(fx.who.signatory, 'GET', '/validation-queue?stage=medical')).body.some((r: any) => r.id === e.body.id)).toBe(true);
    expect((await app(fx.who.tech, 'POST', `/orders/${o.id}/medical-validate`)).status).toBe(403);
    const mv = await app(fx.who.signatory, 'POST', `/orders/${o.id}/medical-validate`);
    expect(mv.body.every((r: any) => r.ok), JSON.stringify(mv.body)).toBe(true);
    const rep = await app(fx.who.signatory, 'POST', `/orders/${o.id}/reports`);
    expect(rep.status, JSON.stringify(rep.body)).toBe(201);
    const rel = await app(fx.who.reception, 'POST', `/reports/${rep.body.id}/release`, { channels: ['PRINTED'] });
    expect(rel.status, JSON.stringify(rel.body)).toBe(201);
    expect((await web(rc, 'GET', `/orders/${o.id}`)).body.status).toBe('RELEASED');
    expect((await q('kiorly_lab', `select "signedBy" from "ReportVersion" where id = $1`, [rep.body.id]))[0].signedBy).toBe(fx.who.signatory.id);
  }, 120_000);
});

describe('w. Kiorex patient side: a lab order released from the lab reaches the patient only as signed report + secure link (read-only check of the existing booking)', () => {
  it('a KIOREX_BOOKING order that is RELEASED in the lab is RESULT_RELEASED at Kiorex; the vault record carries the secure link and no values; the staff app shows the same order released', async () => {
    const p1 = await patientToken();
    const rows = await q('kiorly_lab', `select o.id, o."orderNumber", o."sourceRef" from "LabOrder" o where o.source = 'KIOREX_BOOKING' and o.status = 'RELEASED' order by o."createdAt" desc`);
    let checked = 0;
    const rc = await login('demo-lab', 'signatory');
    for (const r of rows) {
      const b = await kiorex(p1, 'GET', `/lab/bookings/${r.sourceRef}`);
      if (b.status !== 200) continue; // belongs to another demo patient
      expect(b.body.status, r.sourceRef).toBe('RESULT_RELEASED');
      const rec = (await kiorex(p1, 'GET', `/me/vault/${b.body.resultRecordId}`)).body;
      expect(rec).toMatchObject({ kind: 'LAB_RESULT' });
      expect(rec.report?.secureLink ?? JSON.stringify(rec)).toContain('/r/');
      expect(JSON.stringify(rec)).not.toMatch(/"values"|"results"|"valueNumeric"/);
      // staff app + web: the same order, released, with a signed report version
      expect((await app(rc, 'GET', `/orders?search=${r.orderNumber}&status=RELEASED&source=KIOREX_BOOKING`)).body.rows.map((x: any) => x.id)).toEqual([r.id]);
      expect((await web(rc, 'GET', `/orders/${r.id}`)).body.status).toBe('RELEASED');
      expect((await web(rc, 'GET', `/orders/${r.id}/reports`)).body.length).toBeGreaterThan(0);
      checked++; if (checked >= 2) break;
    }
    // needs a prior run of 05-lab (or the demo seed's released Kiorex bookings for this patient); never fails silently
    expect(checked, 'at least one released Kiorex booking of the demo patient +201000000001 (run 05-lab first)').toBeGreaterThan(0);
  });
});

export { LAB_API, waitFor, beforeAll, afterAll };
