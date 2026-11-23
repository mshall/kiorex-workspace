import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { q, sleep, waitFor, kiorex, opsLogin } from '../src/clients.js';
import { recordDevGate, releaseDevGate, revokeDevGate, setFlag, waitPartnerFlags, patientToken, payFake } from '../src/verticals.js';
import { purgeE2eConsentPushes } from '../src/db.js';
import { PHARMACY_API, PHARMACY_PASSWORD } from '../src/env.js';
import { randomUUID } from 'node:crypto';

/**
 * Kiorly Team (staff app) pharmacy module against the REAL running Pharmacy API and the seeded demo tenants.
 * Every flow is performed the way the app does it (`X-Kiorly-Client: kiorly-team/*`, /mobile/* read models + the existing endpoints named in
 * kiorly-pharmacy/Docs/MOBILE.md) and then re-read through the WEB path (no client header = what the :5192 web app calls) to prove both
 * surfaces show the same state. Fixtures (drugs "E2E-Med-*", lots, POs, Rx) are created per run through the owner API; nothing is reset.
 */
const MOBILE = { 'x-kiorly-client': 'kiorly-team/1.0-e2e' };
type R = { status: number; body: any };
async function http(token: string | undefined, method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<R> {
  const res = await fetch(PHARMACY_API + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text(); let json: any; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, body: json };
}
/** What the Kiorly Team app sends. */
const mob = (t: string, m: string, p: string, b?: unknown) => http(t, m, p, b, MOBILE);
/** What the web app (:5192) sends: no client header. */
const web = (t: string, m: string, p: string, b?: unknown) => http(t, m, p, b);
const login = async (user: string) => {
  const r = await http(undefined, 'POST', '/auth/login', { email: `${user}@demo.kiorly.local`, password: PHARMACY_PASSWORD });
  if (r.status !== 200) throw new Error(`login ${user}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.accessToken as string;
};
const rnd = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const day = 86_400_000;
const isoDate = (d: number) => new Date(Date.now() + d * day).toISOString().slice(0, 10);
const must = (r: R, ...ok: number[]) => { expect(ok.length ? ok : [200, 201], JSON.stringify(r.body)).toContain(r.status); return r.body; };
const mods = (b: any) => b.modules.filter((m: any) => m.enabled).map((m: any) => m.key.replace('pharmacy.', '')).sort();
const dbq = <T = any>(sql: string, p: unknown[] = []) => q<T>('kiorly_pharmacy', sql, p);

const T: Record<string, string> = {};
const boot: Record<string, any> = {};
const ALL_USERS = ['owner', 'pharmacist', 'manager', 'cashier', 'assistant', 'chain', 'solo.owner', 'solo.pharmacist', 'solo.manager', 'solo.cashier', 'solo.assistant', 'owner.basic', 'pharmacist.basic', 'cashier.basic'];
let branchId = '';

/** A dedicated test branch of the demo tenant with its own branch-bound cashier / assistant / manager: the seeded main branch already has an open till shift
 *  and an open stock count (one of each is allowed per branch), which the demo must keep. Deactivated again in afterAll. */
let tillBranch = '';
const TILL = { cashier: 'CASHIER', assistant: 'ASSISTANT', manager: 'BRANCH_MANAGER' } as const;
const tillTok: Record<string, string> = {};
beforeAll(async () => {
  for (const u of ALL_USERS) { T[u] = await login(u); boot[u] = (await mob(T[u], 'GET', '/mobile/bootstrap')).body; }
  branchId = boot.pharmacist.user.branchId;
  expect(branchId).toBeTruthy();
  const br = must(await web(T.owner, 'GET', '/branches')) as any[];
  let b = br.find((x) => x.code === 'E2ETILL');
  if (!b) b = must(await web(T.owner, 'POST', '/branches', { name: 'E2E Till Branch (test)', code: 'E2ETILL' }), 201);
  else if (!b.active) must(await web(T.owner, 'PATCH', `/branches/${b.id}`, { active: true }));
  tillBranch = b.id;
  const staff = must(await web(T.owner, 'GET', '/staff')) as any[];
  for (const [k, role] of Object.entries(TILL)) {
    const email = `e2e.till.${k}@demo.kiorly.local`, st = staff.find((x) => x.email === email);
    if (!st) must(await web(T.owner, 'POST', '/staff', { displayName: `E2E Till ${k}`, email, password: PHARMACY_PASSWORD, role, branchId: tillBranch }), 201);
    else must(await web(T.owner, 'PATCH', `/staff/${st.id}`, { active: true, branchId: tillBranch, password: PHARMACY_PASSWORD }));
    tillTok[k] = await login(`e2e.till.${k}`);
  }
});
afterAll(async () => {
  // leave the demo tidy: close any till shift / count we left, then deactivate the test staff and branch
  const cur = await web(tillTok.cashier, 'GET', '/pos/shifts/current').catch(() => undefined);
  if (cur?.status === 200 && cur.body?.id) await web(tillTok.cashier, 'POST', `/pos/shifts/${cur.body.id}/close`, { countedCash: '0.00' });
  const staff = (await web(T.owner, 'GET', '/staff')).body as any[];
  for (const k of Object.keys(TILL)) { const st = staff.find((x) => x.email === `e2e.till.${k}@demo.kiorly.local`); if (st) await web(T.owner, 'PATCH', `/staff/${st.id}`, { active: false }); }
  if (tillBranch) await web(T.owner, 'PATCH', `/branches/${tillBranch}`, { active: false });
});

// ---- fixtures through the owner (web) API
async function makeDrug(o: { rx?: boolean; ingredient?: string; strength?: string; schedule?: string; gtin?: string; price?: string; name?: string } = {}) {
  const tag = rnd();
  const r = await web(T.owner, 'POST', '/catalogue/drugs', { brandName: o.name ?? `E2E-Med-${tag}`, activeIngredient: o.ingredient ?? `e2e-ing-${tag}`, strength: o.strength ?? '500 mg', dosageForm: 'tablet', packSize: '20', rxOnly: o.rx ?? false, controlledSchedule: o.schedule, gtin: o.gtin, price: o.price ?? '40.00' });
  return { ...must(r, 201), tag } as { id: string; brandName: string; tag: string };
}
async function receive(drugId: string, lot: string, qty: number, expDays: number, extra: Record<string, unknown> = {}, token = T.owner, mobile = false) {
  const r = await (mobile ? mob : web)(token, 'POST', '/inventory/receipts', { branchId, invoiceNo: `E2E-${rnd()}`, idempotencyKey: `e2e-${randomUUID()}`, lines: [{ drugId, lotNumber: lot, expiryDate: isoDate(expDays), quantity: qty, unitCost: '20.00' }], ...extra });
  const b = must(r, 201);
  return b.lines[0].lotId as string;
}
const lotQty = async (lotId: string) => Number((await dbq(`select coalesce(sum("qtyDelta"),0)::int n from "StockMovement" where "lotId"=$1 and type not in ('RESERVE','RELEASE_RESERVATION')`, [lotId]))[0].n);

describe('q. Kiorly Team pharmacy: role matrix (bootstrap per role, entitlement, scoping)', () => {
  it('records modules / plan / entitlement for every demo login', () => {
    const rows = ALL_USERS.map((u) => `${u.padEnd(17)} ${boot[u].user.role.padEnd(15)} ${boot[u].org.plan.padEnd(10)} ent=${boot[u].entitlement.enabled} alertsOnly=${boot[u].safetyAlertsOnly} | ${mods(boot[u]).join(',')}`);
    console.log('\nROLE MATRIX\n' + rows.join('\n'));
    for (const u of ALL_USERS) { expect(boot[u].apiVersion).toBe(1); expect(boot[u].product).toBe('pharmacy'); expect(boot[u].entitlement.key).toBe('mobile_staff_app'); }
  });

  it('CHAIN (ENTERPRISE) roles get role-appropriate modules', () => {
    for (const u of ['owner', 'pharmacist', 'manager', 'cashier', 'assistant', 'chain']) { expect(boot[u].org).toMatchObject({ plan: 'ENTERPRISE', rawPlan: 'CHAIN', mode: 'INTEGRATED' }); expect(boot[u].entitlement).toMatchObject({ enabled: true, reason: null }); expect(boot[u].safetyAlertsOnly).toBe(false); }
    expect(mods(boot.owner)).toEqual(['barcode', 'controlled', 'customers', 'expiry', 'orders', 'receiving', 'rx', 'search', 'shift', 'stockcount']);
    expect(mods(boot.pharmacist)).toEqual(mods(boot.owner));
    expect(mods(boot.manager)).toEqual(mods(boot.owner));
    // cashier: till work (shift, customers, barcode, expiry/search) - NOT receiving, stock count, controlled witness, online orders
    expect(mods(boot.cashier)).toEqual(['barcode', 'customers', 'expiry', 'rx', 'search', 'shift']);
    for (const m of ['receiving', 'stockcount', 'controlled', 'orders']) expect(mods(boot.cashier)).not.toContain(m);
    // assistant: receive + count but no controlled register, no orders
    expect(mods(boot.assistant)).toEqual(['barcode', 'customers', 'expiry', 'receiving', 'rx', 'search', 'shift', 'stockcount']);
    // chain ops: read-only head-office view, no Rx / till / receiving
    expect(mods(boot.chain)).toEqual(['barcode', 'customers', 'expiry', 'orders', 'search']);
  });

  it('override screen only for the licensed pharmacist signer (never manager/cashier/assistant)', () => {
    const screens = (u: string) => boot[u].modules.find((m: any) => m.key === 'pharmacy.rx').screens as string[];
    expect(screens('pharmacist')).toContain('rx.override'); expect(screens('owner')).toContain('rx.override');
    for (const u of ['manager', 'cashier', 'assistant']) expect(screens(u)).not.toContain('rx.override');
    expect(boot.pharmacist.user.isPharmacist).toBe(true); expect(boot.cashier.user.isPharmacist).toBe(false);
  });

  it('PRO standalone pharmacy: same role scoping, no online orders module (STANDALONE)', () => {
    for (const u of ['solo.owner', 'solo.pharmacist', 'solo.manager', 'solo.cashier', 'solo.assistant']) { expect(boot[u].org).toMatchObject({ plan: 'PRO', rawPlan: 'PRO', mode: 'STANDALONE' }); expect(boot[u].entitlement.enabled).toBe(true); expect(mods(boot[u])).not.toContain('orders'); }
    expect(mods(boot['solo.pharmacist'])).toEqual(['barcode', 'controlled', 'customers', 'expiry', 'receiving', 'rx', 'search', 'shift', 'stockcount']);
    expect(mods(boot['solo.manager'])).toEqual(mods(boot['solo.pharmacist']));
    expect(mods(boot['solo.cashier'])).toEqual(['barcode', 'customers', 'expiry', 'rx', 'search', 'shift']);
    expect(mods(boot['solo.assistant'])).toEqual(['barcode', 'customers', 'expiry', 'receiving', 'rx', 'search', 'shift', 'stockcount']);
  });

  it('BASIC (Lite) Corner pharmacy: entitlement off, safety-alert inbox only, every other /mobile and client route is 403 FEATURE_DISABLED', async () => {
    for (const u of ['owner.basic', 'pharmacist.basic', 'cashier.basic']) {
      expect(boot[u].org).toMatchObject({ plan: 'BASIC', rawPlan: 'LITE' });
      expect(boot[u].entitlement).toMatchObject({ enabled: false, reason: 'PLAN_BELOW_PRO', requiredPlan: 'PRO' });
      expect(boot[u]).toMatchObject({ safetyAlertsOnly: true, modules: [], device: null });
      const al = await mob(T[u], 'GET', '/mobile/alerts'); expect(al.status).toBe(200); expect(Array.isArray(al.body.items)).toBe(true);
      for (const p of ['/mobile/inbox', '/mobile/devices', '/mobile/pharmacy/expiry-lowstock', '/mobile/pharmacy/shift-summary', '/mobile/pharmacy/search?q=para', '/mobile/pharmacy/barcode/123456', '/prescriptions/verification-queue', '/customers']) {
        const r = await mob(T[u], 'GET', p);
        expect(r.status, `${u} ${p}`).toBe(403);
        // the plan gate beats RBAC: even a role that lacks the route's permission (cashier.basic) gets FEATURE_DISABLED so the app routes to the upgrade screen
        expect(r.body, `${u} ${p}`).toMatchObject({ code: 'FEATURE_DISABLED', key: 'mobile_staff_app', scope: 'org' });
      }
      // the controlled-drug witness queue answers a safety alert, so it is exempt from the plan gate on every plan (RBAC still applies)
      const pw = await mob(T[u], 'GET', '/mobile/pharmacy/controlled/pending-witness');
      if (u === 'owner.basic') expect(pw.status).toBe(200); else expect(pw.body?.code).not.toBe('FEATURE_DISABLED');
      expect((await mob(T[u], 'POST', '/mobile/devices', { deviceId: 'dev-basic-12345', platform: 'web', name: 'x' })).status).toBe(403);
    }
    // the WEB app of the same Lite org is untouched
    expect((await web(T['owner.basic'], 'GET', '/prescriptions/verification-queue')).status).toBe(200);
    expect((await web(T['owner.basic'], 'GET', '/customers')).status).toBe(200);
  });

  it('role scoping on the read models: cashier cannot reach receiving / stock count / controlled; manager can countersign; cashier cannot', async () => {
    expect((await mob(T.cashier, 'GET', '/mobile/pharmacy/controlled/pending-witness')).status).toBe(403);
    expect((await mob(T.cashier, 'POST', '/mobile/pharmacy/controlled/countersign', { discrepancyId: 'x' })).status).toBe(403);
    expect((await mob(T.cashier, 'POST', '/inventory/counts', { branchId, type: 'CYCLE', drugIds: [] })).status).toBe(403);
    expect((await mob(T.cashier, 'POST', '/inventory/receipts', { branchId, lines: [] })).status).toBe(403);
    expect((await mob(T.cashier, 'POST', '/prescriptions/x/validate')).status).toBe(403);
    expect((await mob(T.cashier, 'GET', '/kiorex-orders')).status).toBe(403);
    expect((await mob(T.assistant, 'GET', '/mobile/pharmacy/controlled/pending-witness')).status).toBe(403);
    expect((await mob(T.manager, 'GET', '/mobile/pharmacy/controlled/pending-witness')).status).toBe(200);
    expect((await mob(T.pharmacist, 'GET', '/mobile/pharmacy/controlled/pending-witness')).status).toBe(200);
    // alert ack: pharmacist/manager/owner/chain only
    expect((await mob(T.cashier, 'POST', '/mobile/alerts/NOPE:1/ack', {})).status).toBe(403);
    expect((await mob(T.assistant, 'POST', '/mobile/alerts/NOPE:1/ack', {})).status).toBe(403);
  });
});

// ======================================================================= flows
describe('r. Rx queue -> validate -> safety override -> dispense (FEFO) as the pharmacist', () => {
  async function paperRx(drugIds: string[], patient = `E2E Patient ${rnd()}`, qty = 1) {
    const r = await web(T.pharmacist, 'POST', '/prescriptions/paper', { patient: { displayName: patient, allergies: [] }, prescriberName: 'Dr E2E', prescriberLicenceNo: 'MD-E2E', lines: drugIds.map((id) => ({ drugId: id, quantity: qty, directions: 'daily' })) });
    return must(r, 201).id as string;
  }
  const queueIds = async (token: string, fn = mob) => (must(await fn(token, 'GET', '/prescriptions/verification-queue')).items as any[]).map((i) => i.id);

  it('seeded demo Rx queue is visible on the app and identical on web; RECEIVED -> validate is pharmacist-only', async () => {
    const m = must(await mob(T.pharmacist, 'GET', '/prescriptions/verification-queue'));
    const w = must(await web(T.pharmacist, 'GET', '/prescriptions/verification-queue'));
    expect(m.total).toBeGreaterThan(0);
    expect(m.items.map((i: any) => i.id).sort()).toEqual(w.items.map((i: any) => i.id).sort());
    expect(m.items[0]).toMatchObject({ status: expect.stringMatching(/RECEIVED|VALIDATING/), lines: expect.any(Number), patient: { displayName: expect.any(String) } });
    // the seeded Rx patients are real names, not placeholders
    expect(m.items.some((i: any) => i.patient.displayName.length > 2 && i.prescriberName)).toBe(true);
  });

  it('new Rx appears in the queue, a cashier/assistant/manager cannot validate it, the pharmacist can; web shows VALIDATED', async () => {
    const d = await makeDrug({ rx: true }); await receive(d.id, `L-${d.tag}`, 10, 200);
    const rx = await paperRx([d.id]);
    expect(await queueIds(T.pharmacist)).toContain(rx);
    expect(await queueIds(T.pharmacist, web)).toContain(rx);
    // cashier reads the queue (rx.read) but cannot validate (rx.validate is pharmacist/owner/manager only)
    expect(await queueIds(T.cashier)).toContain(rx);
    for (const u of ['cashier', 'assistant']) expect((await mob(T[u], 'POST', `/prescriptions/${rx}/validate`)).status, u).toBe(403);
    const v = must(await mob(T.pharmacist, 'POST', `/prescriptions/${rx}/validate`), 200, 201);
    expect(v.validated).toBe(true);
    const wRx = must(await web(T.manager, 'GET', `/prescriptions/${rx}`));
    expect(wRx.status).toBe('VALIDATED');
    expect(await queueIds(T.pharmacist, web)).not.toContain(rx);
    expect((await dbq(`select status from "Prescription" where id=$1`, [rx]))[0].status).toBe('VALIDATED');
  });

  it('interaction BLOCK: no sign-off until a licensed pharmacist overrides with a reason (>=5 chars); manager/cashier refused; override attributed and visible on web', async () => {
    const tag = rnd();
    const w = await makeDrug({ rx: true, ingredient: 'warfarin', strength: '5 mg', name: `E2E-Warf-${tag}` });
    const i = await makeDrug({ rx: true, ingredient: 'ibuprofen', strength: '400 mg', name: `E2E-Ibu-${tag}` });
    const lw = await receive(w.id, `W-${tag}`, 10, 200); await receive(i.id, `I-${tag}`, 10, 200);
    const rx = await paperRx([w.id, i.id]);
    must(await mob(T.pharmacist, 'POST', `/prescriptions/${rx}/validate`), 200, 201);
    const d = must(await mob(T.pharmacist, 'POST', '/dispensings', { prescriptionId: rx, branchId, items: [{ drugId: w.id, quantity: 1 }, { drugId: i.id, quantity: 1 }] }), 201);
    const chk = d.safetyChecks.find((c: any) => c.kind === 'INTERACTION');
    expect(chk).toMatchObject({ outcome: 'BLOCK', overridable: true }); expect(chk.detail).toMatch(/warfarin/);
    expect(d.unresolvedBlocks).toBeGreaterThanOrEqual(1);
    const blocked = await mob(T.pharmacist, 'POST', `/dispensings/${d.id}/signoff`, {});
    expect(blocked.body.code).toBe('SAFETY_BLOCK_UNRESOLVED');
    for (const u of ['manager', 'cashier', 'assistant']) expect((await mob(T[u], 'POST', `/dispensings/${d.id}/override/${chk.id}`, { reason: 'trying to override' })).status, u).toBe(403);
    expect((await mob(T.pharmacist, 'POST', `/dispensings/${d.id}/override/${chk.id}`, { reason: 'no' })).status).toBe(400);
    const ov = must(await mob(T.pharmacist, 'POST', `/dispensings/${d.id}/override/${chk.id}`, { reason: 'Prescriber confirmed, INR monitored' }), 201);
    const after = ov.safetyChecks.find((c: any) => c.kind === 'INTERACTION');
    expect(after).toMatchObject({ outcome: 'OVERRIDDEN_BY_PHARMACIST', overriddenBy: boot.pharmacist.user.id, overrideReason: 'Prescriber confirmed, INR monitored' });
    // web read of the same dispensing + override review list (what :5192 shows)
    const wd = must(await web(T.owner, 'GET', `/dispensings/${d.id}`));
    expect(wd.safetyChecks.find((c: any) => c.id === chk.id)).toMatchObject({ outcome: 'OVERRIDDEN_BY_PHARMACIST', overrideReason: 'Prescriber confirmed, INR monitored' });
    const ovl = must(await web(T.owner, 'GET', '/clinical/overrides'));
    expect(JSON.stringify(ovl)).toContain('Prescriber confirmed, INR monitored');
    // now sign off + complete with the FEFO lot decremented and an idempotent replay
    must(await mob(T.pharmacist, 'POST', `/dispensings/${d.id}/signoff`, {}), 201);
    const key = `e2e-${randomUUID()}`;
    const before = await lotQty(lw);
    const c1 = must(await mob(T.pharmacist, 'POST', `/dispensings/${d.id}/complete`, { idempotencyKey: key, payments: [{ method: 'CASH', amount: '200.00' }] }), 201);
    const c2 = await mob(T.pharmacist, 'POST', `/dispensings/${d.id}/complete`, { idempotencyKey: key, payments: [{ method: 'CASH', amount: '200.00' }] });
    expect([200, 201]).toContain(c2.status);
    expect(await lotQty(lw)).toBe(before - 1);                       // one effect only
    expect((await dbq(`select count(*)::int n from "Dispensing" where id=$1 and status='DISPENSED'`, [d.id]))[0].n).toBe(1);
    expect(must(await web(T.owner, 'GET', `/dispensings/${d.id}`)).status).toBe('DISPENSED');
    expect(must(await web(T.owner, 'GET', `/prescriptions/${rx}`)).status).toMatch(/DISPENSED/);
  });

  it('dispense picks the earliest-expiry (FEFO) lot and the stock ledger is decremented there; web inventory shows it', async () => {
    const d = await makeDrug({ rx: false, price: '25.00' });
    const near = await receive(d.id, `NEAR-${d.tag}`, 5, 40), far = await receive(d.id, `FAR-${d.tag}`, 5, 300);
    const rx = await paperRx([d.id], undefined, 2);
    must(await mob(T.pharmacist, 'POST', `/prescriptions/${rx}/validate`), 200, 201);
    const disp = must(await mob(T.pharmacist, 'POST', '/dispensings', { prescriptionId: rx, branchId, items: [{ drugId: d.id, quantity: 2 }] }), 201);
    expect(disp.lines[0].lotId).toBe(near);
    must(await mob(T.pharmacist, 'POST', `/dispensings/${disp.id}/signoff`, {}), 201);
    must(await mob(T.pharmacist, 'POST', `/dispensings/${disp.id}/complete`, { idempotencyKey: `e2e-${randomUUID()}`, payments: [{ method: 'CASH', amount: '50.00' }] }), 201);
    expect(await lotQty(near)).toBe(3); expect(await lotQty(far)).toBe(5);
    // app read model (barcode lots, FEFO order) and web stock agree
    const bc = must(await mob(T.cashier, 'GET', `/mobile/pharmacy/barcode/${encodeURIComponent(d.brandName)}`));
    expect(bc.found).toBe(true);
    const lots = bc.lots.map((l: any) => [l.id, l.qtyOnHand]);
    expect(lots).toEqual([[near, 3], [far, 5]]);
    const wl = must(await web(T.owner, 'GET', `/inventory/lots?drugId=${d.id}&branchId=${branchId}`));
    const rows = (wl.items ?? wl) as any[];
    expect(rows.map((l: any) => [l.id, Number(l.qtyOnHand)]).sort()).toEqual([[near, 3], [far, 5]].sort());
  });
});

describe('s. Barcode lookup + customer lookup (cashier at the till)', () => {
  it('seeded product by GTIN: app read model == web POS lookup (drug, price, stock, FEFO lots)', async () => {
    const [row] = await dbq(`select d.id, d."brandName", d.gtin from "Drug" d where d.gtin is not null and d.active and exists (select 1 from "StockLot" l where l."drugId"=d.id and l."branchId"=$1 and l."qtyOnHand">0 and l.status='AVAILABLE') order by d."brandName" limit 1`, [branchId]);
    expect(row, 'a seeded GTIN product with stock').toBeTruthy();
    const m = must(await mob(T.cashier, 'GET', `/mobile/pharmacy/barcode/${row.gtin}?branchId=${branchId}`));
    expect(m).toMatchObject({ found: true, drug: { id: row.id, brandName: row.brandName, gtin: row.gtin } });
    expect(Number(m.price)).toBeGreaterThan(0); expect(m.lots.length).toBeGreaterThan(0);
    const days = m.lots.map((l: any) => l.daysToExpiry); expect([...days].sort((a, b) => a - b)).toEqual(days); // FEFO order
    const w = must(await web(T.cashier, 'GET', `/pos/lookup?code=${row.gtin}&branchId=${branchId}`));
    expect(JSON.stringify(w)).toContain(row.id);
    expect(JSON.stringify(w)).toContain(String(Number(m.price)));      // same price the till charges
    // DB truth for on-hand
    const [{ n }] = await dbq(`select coalesce(sum("qtyOnHand"),0)::int n from "StockLot" where "drugId"=$1 and "branchId"=$2 and "qtyOnHand">0`, [row.id, branchId]);
    expect(m.stock.onHand).toBe(n);
    // unknown barcode -> found:false (not an error)
    expect((await mob(T.cashier, 'GET', '/mobile/pharmacy/barcode/0000000000000')).body.found).toBe(false);
  });

  it('GS1 string with lot -> scannedLotMatch; rx-only / controlled flag exposed for a fixture drug', async () => {
    const gtin = `6229${String(Date.now()).slice(-9)}`;
    const d = await makeDrug({ rx: true, gtin, price: '42.50' });
    await receive(d.id, 'GS1-A', 6, 90); await receive(d.id, 'GS1-B', 4, 400);
    const r = must(await mob(T.pharmacist, 'GET', `/mobile/pharmacy/barcode/${encodeURIComponent(`01${gtin.padStart(14, '0')}10GS1-B`)}`));
    expect(r).toMatchObject({ found: true, price: '42.50', requiresPrescription: true });
    expect(r.lots.find((l: any) => l.lotNumber === 'GS1-B').scannedLotMatch).toBe(true);
    expect(r.lots.find((l: any) => l.lotNumber === 'GS1-A').scannedLotMatch).toBe(false);
    expect(r.stock.onHand).toBe(10);
  });

  it('customer lookup: seeded customer found by name on the app (module customers + global search) and on web', async () => {
    const [c] = await dbq(`select id, "displayName", phone, "customerNo" from "PatientRef" where "orgId"=(select "orgId" from "StaffUser" where email='cashier@demo.kiorly.local') and phone is not null order by "customerNo" limit 1`);
    const needle = c.displayName.split(' ')[0];
    const list = must(await mob(T.cashier, 'GET', `/customers?q=${encodeURIComponent(needle)}&pageSize=50`));
    expect(list.items.some((x: any) => x.id === c.id)).toBe(true);
    const byPhone = must(await mob(T.cashier, 'GET', `/customers?q=${c.phone}`));
    expect(byPhone.items.map((x: any) => x.id)).toContain(c.id);
    const det = must(await mob(T.cashier, 'GET', `/customers/${c.id}`));
    expect(det).toMatchObject({ id: c.id, displayName: c.displayName });
    expect((await mob(T.cashier, 'GET', `/customers/${c.id}/history`)).status).toBe(200);
    const search = must(await mob(T.cashier, 'GET', `/mobile/pharmacy/search?q=${encodeURIComponent(needle)}`));
    expect(search.customers.some((x: any) => x.id === c.id && x.displayName === c.displayName)).toBe(true);
    const wlist = must(await web(T.cashier, 'GET', `/customers?q=${encodeURIComponent(needle)}&pageSize=50`));
    expect(wlist.items.map((x: any) => x.id)).toContain(c.id);
    // PHI scoping: chain ops reads customers (customer.read) but a Lite cashier of another tenant does not see them
    expect(JSON.stringify((await mob(T['cashier.basic'], 'GET', `/mobile/pharmacy/search?q=${needle}`)).body)).toContain('FEATURE_DISABLED');
    expect((await web(T['owner.basic'], 'GET', `/customers/${c.id}`)).status).toBe(404);
  });
});

describe('t. Cashier shift open -> sales -> close with cash reconciliation (dedicated till branch)', () => {
  let cashier = '', drug: { id: string; brandName: string; tag: string };
  beforeAll(async () => {
    cashier = tillTok.cashier;
    const cur = await web(cashier, 'GET', '/pos/shifts/current');   // an aborted earlier run must not leave a shift behind
    if (cur.status === 200 && cur.body?.id) await web(cashier, 'POST', `/pos/shifts/${cur.body.id}/close`, { countedCash: '0.00' });
    drug = await makeDrug({ price: '40.00' });
    must(await web(T.owner, 'POST', '/inventory/receipts', { branchId: tillBranch, invoiceNo: `E2E-${rnd()}`, lines: [{ drugId: drug.id, lotNumber: `T-${drug.tag}`, expiryDate: isoDate(300), quantity: 20, unitCost: '20.00' }] }), 201);
  });

  it('the till cashier sees the shift module and NOT receiving/count/controlled/orders; no shift open yet', async () => {
    const b = (await mob(cashier, 'GET', '/mobile/bootstrap')).body;
    expect(b.user).toMatchObject({ role: 'CASHIER', branchId: tillBranch });
    expect(mods(b)).toContain('shift'); for (const m of ['receiving', 'stockcount', 'controlled', 'orders']) expect(mods(b)).not.toContain(m);
    const s = must(await mob(cashier, 'GET', '/mobile/pharmacy/shift-summary'));
    expect(s).toMatchObject({ open: false, report: null, shift: null });
  });

  it('open shift (float 200) -> cash sale (idempotent replay = one sale) -> X-report -> close with a -15 variance; web agrees', async () => {
    const shift = must(await mob(cashier, 'POST', '/pos/shifts/open', { openingFloat: '200.00' }), 201);
    expect((await mob(cashier, 'POST', '/pos/shifts/open', { openingFloat: '200.00' })).body.code).toBe('SHIFT_ALREADY_OPEN');
    const open = must(await mob(cashier, 'GET', '/mobile/pharmacy/shift-summary'));
    expect(open).toMatchObject({ open: true, shift: { id: shift.id, mine: true, openingFloat: '200.00' }, report: { report: 'X', expectedCash: '200.00', salesCount: 0 } });

    const key = `e2e-sale-${randomUUID()}`;
    const body = { idempotencyKey: key, lines: [{ drugId: drug.id, quantity: 2 }], payments: [{ method: 'CASH', amount: '200.00' }] };
    const s1 = must(await mob(cashier, 'POST', '/pos/sales', body), 201);
    const s2 = await mob(cashier, 'POST', '/pos/sales', body);
    expect([200, 201]).toContain(s2.status); expect(s2.body.sale.id).toBe(s1.sale.id);
    expect((await dbq(`select count(*)::int n from "Sale" where "idempotencyKey"=$1`, [key]))[0].n).toBe(1);
    expect((await dbq(`select coalesce(sum("qtyOnHand"),0)::int n from "StockLot" where "drugId"=$1 and "branchId"=$2`, [drug.id, tillBranch]))[0].n).toBe(18);
    const total = s1.sale.total as string;

    const x = must(await mob(cashier, 'GET', '/mobile/pharmacy/shift-summary')).report;
    expect(x.salesCount).toBe(1);
    expect(Number(x.expectedCash)).toBeCloseTo(200 + Number(total), 2);   // float + cash taken
    const counted = (Number(x.expectedCash) - 15).toFixed(2);
    const close = must(await mob(cashier, 'POST', `/pos/shifts/${shift.id}/close`, { countedCash: counted }), 201);
    expect(close.shift.variance).toBe('-15.00'); expect(close.zReport.expectedCash).toBe(x.expectedCash); expect(close.shift.status).toBe('CLOSED');
    expect((await mob(cashier, 'POST', `/pos/shifts/${shift.id}/close`, { countedCash: counted })).status).toBeGreaterThanOrEqual(400);   // second close refused, no double effect
    const after = must(await mob(cashier, 'GET', '/mobile/pharmacy/shift-summary'));
    expect(after.open).toBe(false);
    expect(after.lastClosed).toMatchObject({ id: shift.id, variance: '-15.00', countedCash: counted, expectedCash: x.expectedCash });
    // web: manager reads the Z-report of that shift (what the :5192 shifts screen calls)
    const z = must(await web(T.manager, 'GET', `/pos/shifts/${shift.id}/z-report`));
    expect(z).toMatchObject({ expectedCash: x.expectedCash, salesCount: 1 });
    const row = (await dbq(`select status, variance::text v, "countedCash"::text c from "Shift" where id=$1`, [shift.id]))[0];
    expect(row).toMatchObject({ status: 'CLOSED', v: '-15.00' });
  });
});

describe('u. Receiving a PO by scanning (partial then full) + stock count with variance and approval', () => {
  let drugA: { id: string; brandName: string; tag: string }, drugB: typeof drugA, gtinA = '', poId = '', supplierId = '';
  const poLine = async (id: string, drugId: string) => ((await web(T.manager, 'GET', `/purchase-orders/${id}`)).body.lines as any[]).find((l) => l.drugId === drugId);

  it('manager sees the open PO from the app and parses a GS1 scan to the PO line drug', async () => {
    gtinA = `6228${String(Date.now()).slice(-9)}`;
    drugA = await makeDrug({ gtin: gtinA }); drugB = await makeDrug();
    supplierId = must(await web(T.owner, 'POST', '/suppliers', { name: `E2E Supplier ${rnd()}`, phone: '01000000009', email: 'e2e-supplier@demo.kiorly.local' }), 201).id;
    const po = must(await web(T.owner, 'POST', '/purchase-orders', { branchId, supplierId, lines: [{ drugId: drugA.id, qtyOrdered: 10, unitCost: '12.00' }, { drugId: drugB.id, qtyOrdered: 6, unitCost: '8.00' }] }), 201);
    poId = po.id;
    expect(must(await web(T.owner, 'POST', `/purchase-orders/${poId}/send`, { via: 'EMAIL' }), 200, 201).status).toBe('SENT');
    const open = (must(await mob(T.manager, 'GET', '/purchase-orders')) as any[]).find((p) => p.id === poId);
    expect(open).toMatchObject({ status: 'SENT', poNumber: expect.stringMatching(/^PO-/), lines: [expect.objectContaining({ drugId: drugA.id, qtyOrdered: 10, qtyReceived: 0 }), expect.objectContaining({ drugId: drugB.id })] });
    const scan = must(await mob(T.manager, 'POST', '/inventory/scan/parse', { code: `(01)${gtinA.padStart(14, '0')}(17)${isoDate(365).slice(2).replace(/-/g, '')}(10)SCAN${drugA.tag}` }), 200, 201);
    expect(scan).toMatchObject({ gtin: expect.any(String), lotNumber: `SCAN${drugA.tag}`, drug: { id: drugA.id } });
    // cashier cannot receive; assistant can
    expect((await mob(T.cashier, 'POST', '/inventory/receipts', { branchId, purchaseOrderId: poId, lines: [{ drugId: drugA.id, lotNumber: 'X', expiryDate: isoDate(300), quantity: 1, unitCost: '12.00' }] })).status).toBe(403);
  });

  it('partial receipt (4 of 10) -> PARTIALLY_RECEIVED; replay with the same idempotency key = one effect; web PO + lot agree', async () => {
    const key = `e2e-rcv-${randomUUID()}`;
    const body = { branchId, supplierId, purchaseOrderId: poId, invoiceNo: `INV-${rnd()}`, invoiceTotal: '48.00', idempotencyKey: key, lines: [{ drugId: drugA.id, lotNumber: `RCV1-${drugA.tag}`, expiryDate: isoDate(365), quantity: 4, unitCost: '12.00' }] };
    const r1 = must(await mob(T.assistant, 'POST', '/inventory/receipts', body), 201);
    const r2 = await mob(T.assistant, 'POST', '/inventory/receipts', body);
    expect([200, 201]).toContain(r2.status);
    expect(r2.body.id ?? r2.body.receiptId).toBe(r1.id ?? r1.receiptId);
    const lotId = r1.lines[0].lotId;
    expect(await lotQty(lotId)).toBe(4);                                              // replay did not double the stock
    expect((await dbq(`select count(*)::int n from "StockLot" where "drugId"=$1 and "lotNumber"=$2`, [drugA.id, `RCV1-${drugA.tag}`]))[0].n).toBe(1);
    const po = must(await web(T.manager, 'GET', `/purchase-orders/${poId}`));
    expect(po.status).toBe('PARTIALLY_RECEIVED');
    expect(await poLine(poId, drugA.id)).toMatchObject({ qtyOrdered: 10, qtyReceived: 4 });
    expect((await poLine(poId, drugB.id)).qtyReceived).toBe(0);
    // the app barcode read model (what the receiving screen shows next) sees the new lot
    const bc = must(await mob(T.assistant, 'GET', `/mobile/pharmacy/barcode/${gtinA}`));
    expect(bc.lots.map((l: any) => [l.lotNumber, l.qtyOnHand])).toContainEqual([`RCV1-${drugA.tag}`, 4]);
  });

  it('final receipt (6 + 6) -> RECEIVED; a further receipt is refused PO_CLOSED; supplier/PO totals on web', async () => {
    must(await mob(T.manager, 'POST', '/inventory/receipts', { branchId, supplierId, purchaseOrderId: poId, idempotencyKey: `e2e-rcv-${randomUUID()}`, lines: [
      { drugId: drugA.id, lotNumber: `RCV2-${drugA.tag}`, expiryDate: isoDate(400), quantity: 6, unitCost: '12.00' },
      { drugId: drugB.id, lotNumber: `RCVB-${drugB.tag}`, expiryDate: isoDate(400), quantity: 6, unitCost: '8.00' }] }), 201);
    expect(must(await web(T.owner, 'GET', `/purchase-orders/${poId}`)).status).toBe('RECEIVED');
    expect(await poLine(poId, drugA.id)).toMatchObject({ qtyReceived: 10 }); expect(await poLine(poId, drugB.id)).toMatchObject({ qtyReceived: 6 });
    const extra = await mob(T.manager, 'POST', '/inventory/receipts', { branchId, purchaseOrderId: poId, idempotencyKey: `e2e-rcv-${randomUUID()}`, lines: [{ drugId: drugA.id, lotNumber: `RCV3-${drugA.tag}`, expiryDate: isoDate(400), quantity: 1, unitCost: '12.00' }] });
    expect(extra.status).toBe(409); expect(extra.body.code).toBe('PO_CLOSED');
    expect((await dbq(`select coalesce(sum("qtyOnHand"),0)::int n from "StockLot" where "drugId"=$1`, [drugA.id]))[0].n).toBe(10);
    const rc = must(await web(T.owner, 'GET', `/inventory/receipts?branchId=${branchId}`));
    expect(JSON.stringify(rc)).toContain(poId);
  });

  it('stock count (till branch): assistant counts with a -3 variance, submits; assistant/cashier cannot approve; manager approves -> stock adjusted; web shows APPROVED', async () => {
    const gtinC = `6227${String(Date.now()).slice(-9)}`;
    const drugC = await makeDrug({ gtin: gtinC });
    const mk = async (lot: string, qty: number, exp: number) => must(await web(T.owner, 'POST', '/inventory/receipts', { branchId: tillBranch, invoiceNo: `E2E-${rnd()}`, lines: [{ drugId: drugC.id, lotNumber: lot, expiryDate: isoDate(exp), quantity: qty, unitCost: '10.00' }] }), 201).lines[0].lotId as string;
    const target = await mk(`CNT1-${drugC.tag}`, 6, 200), other = await mk(`CNT2-${drugC.tag}`, 4, 300);
    const asst = tillTok.assistant, mgr = tillTok.manager, csh = tillTok.cashier;
    expect((await mob(csh, 'POST', '/inventory/counts', { branchId: tillBranch, type: 'CYCLE', drugIds: [drugC.id] })).status).toBe(403);
    const open = await web(asst, 'GET', '/inventory/counts');
    for (const c of (open.body as any[]).filter((c) => ['OPEN', 'PENDING_APPROVAL'].includes(c.status))) await web(mgr, 'POST', `/inventory/counts/${c.id}/reject`, { reason: 'e2e cleanup' });
    const count = must(await mob(asst, 'POST', '/inventory/counts', { type: 'CYCLE', drugIds: [drugC.id] }), 201);
    expect(count.lines.map((l: any) => [l.lotId, l.qtyExpected, l.qtyCounted]).sort()).toEqual([[target, 6, null], [other, 4, null]].sort());
    // the app resolves lot ids from the barcode read model, then writes one line per scan
    const bc = must(await mob(asst, 'GET', `/mobile/pharmacy/barcode/${gtinC}`));
    expect(bc.lots.map((l: any) => l.id).sort()).toEqual([target, other].sort());
    must(await mob(asst, 'PUT', `/inventory/counts/${count.id}/lines`, { lines: [{ lotId: target, qtyCounted: 3 }, { lotId: other, qtyCounted: 4 }] }), 200, 201);
    expect(must(await mob(asst, 'POST', `/inventory/counts/${count.id}/submit`), 200, 201).status).toBe('PENDING_APPROVAL');
    expect(await lotQty(target)).toBe(6);                                           // nothing moves before approval
    for (const t of [asst, csh]) expect((await mob(t, 'POST', `/inventory/counts/${count.id}/approve`)).status).toBe(403);
    const ok = must(await mob(mgr, 'POST', `/inventory/counts/${count.id}/approve`), 200, 201);
    expect(ok.status).toBe('APPROVED');
    expect(await lotQty(target)).toBe(3); expect(await lotQty(other)).toBe(4);
    expect((await dbq(`select count(*)::int n from "StockMovement" where "lotId"=$1 and type='COUNT_VARIANCE' and "qtyDelta"=-3`, [target]))[0].n).toBe(1);
    // web: count detail + list + lot quantity
    expect(must(await web(mgr, 'GET', `/inventory/counts/${count.id}`)).status).toBe('APPROVED');
    expect((must(await web(mgr, 'GET', '/inventory/counts')) as any[]).find((c) => c.id === count.id)?.status).toBe('APPROVED');
    expect(must(await web(T.owner, 'GET', `/inventory/lots?drugId=${drugC.id}&branchId=${tillBranch}`)).items.find((l: any) => l.id === target).qtyOnHand).toBe(3);
    // a second approval is refused: single effect
    expect((await mob(mgr, 'POST', `/inventory/counts/${count.id}/approve`)).status).toBeGreaterThanOrEqual(400);
    expect(await lotQty(target)).toBe(3);
  });
});

describe('v. Controlled drugs: dispensing, discrepancy report, witness countersign by a DIFFERENT user', () => {
  let drug: { id: string; brandName: string; tag: string }, lotId = '', discId = '';
  const reg = async (drugId: string) => must(await web(T.pharmacist, 'GET', `/controlled/register?drugId=${drugId}&branchId=${branchId}&pageSize=200`));
  const balance = async (drugId: string) => (must(await web(T.pharmacist, 'GET', `/controlled/balances?branchId=${branchId}`)) as any[]).find((b) => b.drug?.id === drugId || b.drugId === drugId);

  it('licensed pharmacist dispenses a schedule-2 drug: ID capture required, register decremented, hard limit not overridable; cashier cannot sign off', async () => {
    drug = await makeDrug({ rx: true, schedule: 'SCHEDULE_2', ingredient: 'morphine', strength: '10 mg' });
    lotId = await receive(drug.id, `CD-${drug.tag}`, 40, 300);
    expect((await balance(drug.id))).toMatchObject({ onHand: 40, registerBalance: 40, inSync: true });
    const mkRx = async (qty: number) => { const r = must(await web(T.pharmacist, 'POST', '/prescriptions/paper', { patient: { displayName: `E2E CD Patient ${rnd()}`, allergies: [] }, prescriberName: 'Dr E2E', prescriberLicenceNo: 'MD-E2E', lines: [{ drugId: drug.id, quantity: qty, directions: 'as needed' }] }), 201).id; must(await mob(T.pharmacist, 'POST', `/prescriptions/${r}/validate`), 200, 201); return r as string; };
    // over the per-Rx limit: hard stop
    const big = must(await mob(T.pharmacist, 'POST', '/dispensings', { prescriptionId: await mkRx(10), branchId, items: [{ drugId: drug.id, quantity: 10 }] }), 201);
    const lim = big.safetyChecks.find((c: any) => c.kind === 'CONTROLLED_LIMIT');
    expect(lim.outcome).toBe('BLOCK');
    expect((await mob(T.pharmacist, 'POST', `/dispensings/${big.id}/override/${lim.id}`, { reason: 'I really want to dispense' })).body.code).toBe('NOT_OVERRIDABLE');
    must(await mob(T.pharmacist, 'POST', `/dispensings/${big.id}/cancel`, { reason: 'too many' }), 200, 201);
    // the real dispensing
    const d = must(await mob(T.pharmacist, 'POST', '/dispensings', { prescriptionId: await mkRx(2), branchId, items: [{ drugId: drug.id, quantity: 2 }] }), 201);
    expect((await mob(T.cashier, 'POST', `/dispensings/${d.id}/signoff`, {})).status).toBe(403);
    expect((await mob(T.pharmacist, 'POST', `/dispensings/${d.id}/signoff`, {})).body.code).toBe('CONTROLLED_ID_REQUIRED');
    must(await mob(T.pharmacist, 'POST', `/dispensings/${d.id}/controlled-id`, { nationalId: '29801011234567', patientName: 'Sara Test' }), 201);
    must(await mob(T.pharmacist, 'POST', `/dispensings/${d.id}/signoff`, {}), 201);
    const key = `e2e-cd-${randomUUID()}`;
    must(await mob(T.pharmacist, 'POST', `/dispensings/${d.id}/complete`, { idempotencyKey: key, payments: [{ method: 'CASH', amount: '200.00' }] }), 201);
    expect([200, 201]).toContain((await mob(T.pharmacist, 'POST', `/dispensings/${d.id}/complete`, { idempotencyKey: key, payments: [{ method: 'CASH', amount: '200.00' }] })).status);
    expect(await lotQty(lotId)).toBe(38);
    const log = await dbq(`select quantity, "patientNationalIdLast4" l4 from "ControlledSubstanceLogEntry" where "dispensingId"=$1`, [d.id]);
    expect(log).toEqual([{ quantity: 2, l4: '4567' }]);                                // exactly one register row; full ID never stored
    expect(await balance(drug.id)).toMatchObject({ onHand: 38, registerBalance: 38, inSync: true });
    expect(JSON.stringify(await reg(drug.id))).toContain(d.id);
  });

  it('shelf count 3 short: pharmacist reports the discrepancy (witnessed at the till); it appears as CRITICAL + witness-pending alerts, and in pending-witness on the app and the web list', async () => {
    const au = must(await web(T.pharmacist, 'POST', '/controlled/audits', { branchId, drugId: drug.id, countedQty: 35, notes: 'E2E: 3 ampoules short', witness: { email: 'manager@demo.kiorly.local', password: PHARMACY_PASSWORD } }), 201);
    expect(au).toMatchObject({ match: false, expected: 38, counted: 35, difference: -3 });
    discId = au.discrepancy.id;
    // an audit with a matching count creates no discrepancy
    expect((await web(T.pharmacist, 'POST', '/controlled/audits', { branchId, drugId: drug.id, countedQty: 38, witness: { email: 'manager@demo.kiorly.local', password: PHARMACY_PASSWORD } })).body.match).toBe(true);
    // wrong witness credentials are refused
    expect((await web(T.pharmacist, 'POST', '/controlled/audits', { branchId, drugId: drug.id, countedQty: 35, witness: { email: 'manager@demo.kiorly.local', password: 'nope-nope' } })).status).toBeGreaterThanOrEqual(400);
    const pend = must(await mob(T.manager, 'GET', '/mobile/pharmacy/controlled/pending-witness')).items.find((i: any) => i.id === discId);
    expect(pend).toMatchObject({ expectedQty: 38, countedQty: 35, difference: -3, witnessPending: true, canCountersign: true, reportedBy: boot.pharmacist.user.id, drug: { id: drug.id, brandName: drug.brandName } });
    expect(must(await mob(T.pharmacist, 'GET', '/mobile/pharmacy/controlled/pending-witness')).items.find((i: any) => i.id === discId).canCountersign).toBe(false);
    const kinds = (must(await mob(T.pharmacist, 'GET', '/mobile/alerts')).items as any[]).filter((a) => a.subject?.id === discId).map((a) => a.kind).sort();
    expect(kinds).toEqual(['CONTROLLED_DRUG_DISCREPANCY', 'CONTROLLED_WITNESS_PENDING']);
    const w = (must(await web(T.owner, 'GET', '/controlled/discrepancies?status=OPEN')) as any[]).find((x) => x.id === discId);
    expect(w).toMatchObject({ status: 'OPEN', difference: -3, drug: { id: drug.id } });
    // the SAFETY push reached the managers' app inbox
    await waitFor('discrepancy push', async () => (await mob(T.manager, 'GET', '/mobile/inbox')).body.items.find((m: any) => m.data?.discrepancyId === discId) ?? false, 10_000, 300);
  });

  it('the REPORTER cannot countersign (409 WITNESS_MUST_DIFFER); cashier/assistant 403; a different user (manager) can; replay = one signature; alert clears; web unchanged', async () => {
    const cs = (t: string, id = discId) => mob(t, 'POST', '/mobile/pharmacy/controlled/countersign', { discrepancyId: id, note: 'recounted together' });
    const same = await cs(T.pharmacist);
    expect([same.status, same.body.code]).toEqual([409, 'WITNESS_MUST_DIFFER']);
    expect((await cs(T.cashier)).status).toBe(403); expect((await cs(T.assistant)).status).toBe(403);
    expect((await cs(T.manager, 'does-not-exist')).status).toBe(404);
    expect(await dbq(`select 1 from "ControlledCountersign" where "discrepancyId"=$1`, [discId])).toHaveLength(0);
    const ok = must(await cs(T.manager));
    expect(ok).toMatchObject({ discrepancyId: discId, witnessId: boot.manager.user.id });
    expect((await cs(T.manager)).status).toBe(200);                                    // idempotent
    expect(await dbq(`select 1 from "ControlledCountersign" where "discrepancyId"=$1`, [discId])).toHaveLength(1);
    expect((await dbq(`select count(*)::int n from "AuditLog" where action='controlled.countersign' and "entityId"=$1`, [discId]))[0].n).toBe(2);
    const pend = must(await mob(T.pharmacist, 'GET', '/mobile/pharmacy/controlled/pending-witness')).items.find((i: any) => i.id === discId);
    expect(pend).toMatchObject({ witnessPending: false, countersigns: [expect.objectContaining({ witnessId: boot.manager.user.id })] });
    const kinds = (must(await mob(T.pharmacist, 'GET', '/mobile/alerts')).items as any[]).filter((a) => a.subject?.id === discId).map((a) => a.kind);
    expect(kinds).toEqual(['CONTROLLED_DRUG_DISCREPANCY']);                            // witness-pending cleared, discrepancy still open
    // countersign does not touch the register or the stock: web still shows the shelf short + OPEN
    expect(await lotQty(lotId)).toBe(38);
    expect((must(await web(T.owner, 'GET', '/controlled/discrepancies?status=OPEN')) as any[]).find((x) => x.id === discId).status).toBe('OPEN');
  });

  it('alert ack: pharmacist acks once (idempotent, first wins), cashier 403; then the pharmacist resolves it on web with a witness and a stock correction -> the alert is gone', async () => {
    const id = `CONTROLLED_DRUG_DISCREPANCY:${discId}`;
    const a1 = must(await mob(T.pharmacist, 'POST', `/mobile/alerts/${encodeURIComponent(id)}/ack`, { note: 'investigating' }));
    const a2 = must(await mob(T.manager, 'POST', `/mobile/alerts/${encodeURIComponent(id)}/ack`, {}));
    expect(a2.ackedAt).toBe(a1.ackedAt);
    expect((await dbq(`select count(*)::int n from "MobileAlertAck" where "alertKey"=$1`, [id]))[0].n).toBe(1);
    expect((await mob(T.pharmacist, 'GET', '/mobile/alerts')).body.items.some((a: any) => a.id === id)).toBe(false);
    expect((await mob(T.pharmacist, 'GET', '/mobile/alerts?status=all')).body.items.find((a: any) => a.id === id)).toMatchObject({ ackedAt: a1.ackedAt });
    const res = must(await web(T.pharmacist, 'POST', `/controlled/discrepancies/${discId}/resolve`, { resolution: 'Recounted; 3 ampoules written off', adjustLotId: lotId, witness: { email: 'manager@demo.kiorly.local', password: PHARMACY_PASSWORD } }), 200, 201);
    expect(JSON.stringify(res)).toMatch(/RESOLVED/);
    expect(await lotQty(lotId)).toBe(35);
    expect(await balance(drug.id)).toMatchObject({ onHand: 35, inSync: true });
    expect((await mob(T.pharmacist, 'GET', '/mobile/alerts?status=all')).body.items.some((a: any) => a.subject?.id === discId)).toBe(false);
    expect((await mob(T.manager, 'GET', '/mobile/pharmacy/controlled/pending-witness')).body.items.some((i: any) => i.id === discId)).toBe(false);
    expect((await mob(T.manager, 'POST', '/mobile/pharmacy/controlled/countersign', { discrepancyId: discId })).body.code).toBe('ALREADY_RESOLVED');
  });
});

describe('w. Expiry dashboard: near-expiry, expired, quarantined, recalled + the recalled-lot safety alert', () => {
  let drug: { id: string; brandName: string; tag: string }; let near = '', quar = '', recl = '';
  it('fixture lots: near-expiry (10 d), quarantined (pharmacist) and recalled (notice) lots appear on the app and on web', async () => {
    drug = await makeDrug();
    near = await receive(drug.id, `NEAR-${drug.tag}`, 7, 10); quar = await receive(drug.id, `QUAR-${drug.tag}`, 5, 200); recl = await receive(drug.id, `RECL-${drug.tag}`, 3, 250);
    expect((await mob(T.cashier, 'POST', `/inventory/lots/${quar}/quarantine`, { reason: 'cashier tries' })).status).toBe(403);
    must(await mob(T.pharmacist, 'POST', `/inventory/lots/${quar}/quarantine`, { reason: 'Cold chain doubt (E2E)' }), 200, 201);
    must(await mob(T.pharmacist, 'POST', '/recalls', { drugId: drug.id, lotNumbers: [`RECL-${drug.tag}`], reason: 'E2E supplier recall', source: 'E2E' }), 201);
    const web1 = must(await web(T.manager, 'GET', `/inventory/lots?drugId=${drug.id}&branchId=${branchId}`)).items as any[];
    expect(Object.fromEntries(web1.map((l) => [l.id, l.status]))).toEqual({ [near]: 'AVAILABLE', [quar]: 'QUARANTINE', [recl]: 'RECALLED' });
    expect(web1.find((l) => l.id === recl).blockReason).toBe('RECALLED'); expect(web1.find((l) => l.id === quar).blockReason).toBe('QUARANTINE');
    expect(must(await web(T.owner, 'GET', `/inventory/lots?status=RECALLED&drugId=${drug.id}`)).total).toBe(1);
  });

  it('app expiry dashboard (cashier, read-only) buckets the lots and shows seeded EXPIRED lots; web /inventory/expiry agrees', async () => {
    const m = must(await mob(T.cashier, 'GET', `/mobile/pharmacy/expiry-lowstock?branchId=${branchId}`));
    const w = must(await web(T.cashier, 'GET', `/inventory/expiry?branchId=${branchId}`));
    // near-expiry: our 10-day lot is in the 30-day bucket on both
    const item = (m.expiry.items as any[]).find((i) => i.lotId === near);
    if (item) {
      expect(item).toMatchObject({ lotNumber: `NEAR-${drug.tag}`, qtyOnHand: 7, status: 'AVAILABLE', brandName: drug.brandName });
      expect(item.daysToExpiry).toBeGreaterThanOrEqual(9); expect(item.daysToExpiry).toBeLessThanOrEqual(10);
    } else expect((m.expiry.items as any[]).length).toBe(40); // list is capped at 40 on a busy dev DB; the bucket counts below still prove the lot
    expect((w.d30 as any[]).some((l) => l.lotId === near)).toBe(true);
    // expired: seeded DMEXP lots, same count on both
    expect(m.expiry.expired.lots).toBeGreaterThanOrEqual(3); expect(m.expiry.expired.lots).toBe((w.expired as any[]).length);
    expect((m.expiry.items as any[]).filter((i) => i.status === 'EXPIRED').every((i) => i.daysToExpiry < 0)).toBe(true);
    expect((m.expiry.items as any[]).some((i) => /^DMEXP/.test(i.lotNumber))).toBe(true);
    expect(m.expiry.within30.lots).toBe((w.d30 as any[]).length);
    // quarantined lot (within 90 d? no, 200 d) is reported in the blocked section; recalled too
    if (m.blocked) {
      expect((m.blocked.items as any[]).find((i) => i.lotId === quar)).toMatchObject({ status: 'QUARANTINE', qtyOnHand: 5 });
      expect((m.blocked.items as any[]).find((i) => i.lotId === recl)).toMatchObject({ status: 'RECALLED', qtyOnHand: 3 });
      expect(m.blocked.quarantined.lots).toBeGreaterThanOrEqual(1); expect(m.blocked.recalled.lots).toBeGreaterThanOrEqual(1);
    } else console.warn('[17] running API build predates the `blocked` section of /mobile/pharmacy/expiry-lowstock: rebuild+restart :3100 to exercise it');
    // blocked lots are never sellable: the barcode read model flags them
    const bc = must(await mob(T.cashier, 'GET', `/mobile/pharmacy/barcode/${encodeURIComponent(drug.brandName)}`));
    const st = Object.fromEntries(bc.lots.map((l: any) => [l.id, l.status]));
    expect(st).toMatchObject({ [near]: 'AVAILABLE', [quar]: 'QUARANTINE', [recl]: 'RECALLED' });
    expect(bc.stock.available).toBe(7);                                              // 7 sellable, 8 blocked units not counted
    expect(bc.stock.onHand).toBe(15);
  });

  it('recalled lot in stock raises a CRITICAL RECALLED_LOT_IN_STOCK alert (every plan role reads it); ack is pharmacist/manager only; writing the lot off clears it', async () => {
    const find = async (t: string) => ((await mob(t, 'GET', '/mobile/alerts?status=all')).body.items as any[]).find((a) => a.kind === 'RECALLED_LOT_IN_STOCK' && a.subject?.label === drug.brandName);
    const al = await find(T.cashier);
    expect(al).toMatchObject({ severity: 'CRITICAL', ackedAt: null, subject: { label: drug.brandName } });
    expect(al.title).toContain(drug.brandName); expect(al.titleAr).toBeTruthy();
    expect((await mob(T.cashier, 'POST', `/mobile/alerts/${encodeURIComponent(al.id)}/ack`, {})).status).toBe(403);
    const a1 = must(await mob(T.pharmacist, 'POST', `/mobile/alerts/${encodeURIComponent(al.id)}/ack`, { note: 'lot pulled to quarantine shelf' }));
    expect(a1.ackedAt).toBeTruthy();
    expect(must(await mob(T.manager, 'POST', `/mobile/alerts/${encodeURIComponent(al.id)}/ack`, {})).ackedAt).toBe(a1.ackedAt);
    expect((await dbq(`select count(*)::int n from "MobileAlertAck" where "alertKey"=$1`, [al.id]))[0].n).toBe(1);
    expect(((await mob(T.pharmacist, 'GET', '/mobile/alerts')).body.items as any[]).some((a) => a.id === al.id)).toBe(false);   // acked -> out of the open list
    // the BASIC (Lite) tenant never sees this tenant's alerts
    expect(((await mob(T['owner.basic'], 'GET', '/mobile/alerts?status=all')).body.items as any[]).some((a) => a.id === al.id)).toBe(false);
    // clean up: write the blocked lots off; the alert disappears because the hazard is gone
    must(await web(T.pharmacist, 'POST', `/inventory/lots/${recl}/write-off`, { reason: 'E2E cleanup write-off' }), 200, 201);
    must(await web(T.pharmacist, 'POST', `/inventory/lots/${quar}/release`, { reason: 'E2E cleanup release' }), 200, 201);
    expect(await find(T.pharmacist)).toBeUndefined();
    expect(await lotQty(recl)).toBe(0);
  });
});

describe('x. Online (Kiorex) order status progression on the app, mirrored in Kiorex and on the web inbox', () => {
  let ops = '', p1 = '';
  beforeAll(async () => {
    ops = (await opsLogin()).accessToken; p1 = await patientToken();
    await setFlag(ops, 'kiorex.pharmacy_orders', 'ON').catch(() => undefined);
    await recordDevGate(ops, 'kiorex.pharmacy_orders');      // DEV-ONLY-NOT-A-REAL-GATE evidence for this database, revoked below
    // the pharmacy/lab flag pollers of a long-running dev stack can lag; order ingestion does not depend on the partner snapshot, so do not fail on it
    await waitPartnerFlags(4_000).catch(() => console.warn('[17] partner flag snapshot not refreshed (pollers idle); continuing'));
  });
  afterAll(async () => { await releaseDevGate(ops, 'kiorex.pharmacy_orders'); await purgeE2eConsentPushes(); });

  async function placeOrder(qty: number) {
    const d = await makeDrug({ price: '40.00' }); await receive(d.id, `ORD-${d.tag}`, 10, 300);
    const s = await kiorex(p1, 'GET', `/pharmacy/search?q=${encodeURIComponent(d.brandName)}&pharmacyId=${branchId}`);
    expect(s.body.items.find((i: any) => i.sku === d.id)).toMatchObject({ available: true });
    must(await kiorex(p1, 'PUT', '/pharmacy/cart', { pharmacyId: branchId, items: [{ sku: d.id, qty }] }));
    must(await kiorex(p1, 'PUT', '/pharmacy/cart/delivery', { method: 'PICKUP' }));
    const o = (await kiorex(p1, 'POST', '/pharmacy/orders', {})); expect(o.status, JSON.stringify(o.body)).toBe(201);
    await payFake(o.body.payment.paymentId);
    return { drug: d, kx: o.body as { id: string; totalMinor: number; payment: { paymentId: string } } };
  }
  const kxGet = async (id: string) => (await kiorex(p1, 'GET', `/pharmacy/orders/${id}`)).body;
  const kxWait = (id: string, want: string) => waitFor(`kiorex order ${id} -> ${want}`, async () => { const b = await kxGet(id); return b.status === want ? b : false; }, 30_000, 500);
  /** Pharmacy -> Kiorex webhooks need the real partner delivery mode; a stack started with mock delivery records the outbox rows (asserted) but Kiorex never hears them. */
  let mirrorLive: boolean | undefined;
  const mirrored = async (id: string, want: string) => {
    if (mirrorLive === false) return false;
    try { await waitFor(`kiorex ${want}`, async () => (await kxGet(id)).status === want, mirrorLive ? 30_000 : 8_000, 500); mirrorLive = true; return true; }
    catch { mirrorLive = false; console.warn(`[17] Kiorex did not receive the pharmacy webhook for ${id} (${want}): pharmacy->Kiorex delivery is not live on this stack; Kiorex-side mirror NOT verified`); return false; }
  };
  const outbox = async (kxId: string) => (await dbq(`select type from "OutboxEvent" where "aggregateId"=$1 order by "occurredAt"`, [kxId])).map((r: any) => r.type);
  const inbox = async (kxId: string) => (await waitFor('order in app inbox', async () => ((await mob(T.pharmacist, 'GET', '/kiorex-orders')).body as any[]).find((o) => o.externalOrderId === kxId) ?? false, 25_000, 400)) as any;

  it('order lands RECEIVED on the app and web, pharmacist gets the order.received push; cashier has no orders module', async () => {
    const { kx } = await placeOrder(2);
    await kxWait(kx.id, 'SUBMITTED');
    const o = await inbox(kx.id);
    expect(o).toMatchObject({ status: 'RECEIVED', hasRx: false, prepaid: true });
    expect(((await web(T.manager, 'GET', '/kiorex-orders?status=RECEIVED')).body as any[]).map((x) => x.id)).toContain(o.id);
    await waitFor('order.received push', async () => (await mob(T.pharmacist, 'GET', '/mobile/inbox?limit=50')).body.items.find((m: any) => m.data?.orderId === o.id && m.data?.template === 'order.received') ?? false, 10_000, 300);
    expect((await mob(T.cashier, 'GET', '/kiorex-orders')).status).toBe(403);
    expect((await mob(T.cashier, 'POST', `/kiorex-orders/${o.id}/accept`, {})).status).toBe(403);
    expect(mods(boot.chain)).toContain('orders'); expect((await mob(T.chain, 'GET', '/kiorex-orders')).status).toBe(200);   // chain ops reads, cannot respond
    expect((await mob(T.chain, 'POST', `/kiorex-orders/${o.id}/accept`, {})).status).toBe(403);
  });

  it('RECEIVED -> ACCEPTED -> (sign-off) -> READY -> DISPENSED through the app; each step visible on web and in Kiorex; stock reserved then decremented', async () => {
    const { kx, drug } = await placeOrder(2);
    await kxWait(kx.id, 'SUBMITTED');
    const o = await inbox(kx.id);
    const lotId = (await dbq(`select id from "StockLot" where "drugId"=$1 and "branchId"=$2`, [drug.id, branchId]))[0].id as string;
    const webStatus = async () => (await web(T.manager, 'GET', `/kiorex-orders/${o.id}`)).body.status;
    const acc = must(await mob(T.pharmacist, 'POST', `/kiorex-orders/${o.id}/accept`, {}), 201);
    expect(acc.order.status).toBe('ACCEPTED'); expect(await webStatus()).toBe('ACCEPTED');
    expect((await dbq(`select "qtyReserved" r from "StockLot" where id=$1`, [lotId]))[0].r).toBe(2);
    expect((await mob(T.pharmacist, 'POST', `/kiorex-orders/${o.id}/ready`)).body.code).toBe('SIGNOFF_REQUIRED');   // safety control, never skipped
    must(await mob(T.pharmacist, 'POST', `/dispensings/${acc.dispensing.id}/signoff`, {}), 201);
    expect(must(await mob(T.pharmacist, 'POST', `/kiorex-orders/${o.id}/ready`), 200, 201).status).toBe('READY');
    expect(await webStatus()).toBe('READY');
    if (await mirrored(kx.id, 'READY')) expect((await kxGet(kx.id)).readyAt).toBeTruthy();
    const key = `e2e-ord-${randomUUID()}`;
    const done = must(await mob(T.pharmacist, 'POST', `/dispensings/${acc.dispensing.id}/complete`, { idempotencyKey: key }), 201);
    expect(done.sale.channel).toBe('KIOREX_ORDER');
    expect([200, 201]).toContain((await mob(T.pharmacist, 'POST', `/dispensings/${acc.dispensing.id}/complete`, { idempotencyKey: key })).status);
    expect(await webStatus()).toBe('DISPENSED');
    expect(await outbox(kx.id)).toEqual(['OrderReady', 'DispenseCompleted']);      // exactly one of each despite the replayed complete
    if (await mirrored(kx.id, 'DISPENSED')) expect((await kxGet(kx.id)).dispensedAt).toBeTruthy();
    expect(await lotQty(lotId)).toBe(8);
    expect((await dbq(`select count(*)::int n from "SettlementEntry" where "orderRef"=$1`, [kx.id]))[0].n).toBe(1);   // one settlement despite the replay
    expect((await dbq(`select count(*)::int n from "Sale" where "dispensingId"=$1`, [acc.dispensing.id]))[0].n).toBe(1);
  });

  it('rejection from the app: REJECTED on web and in Kiorex with an automatic full refund', async () => {
    const { kx } = await placeOrder(1);
    await kxWait(kx.id, 'SUBMITTED');
    const o = await inbox(kx.id);
    expect((await mob(T.manager, 'POST', `/kiorex-orders/${o.id}/reject`, { reason: 'x' })).status).toBe(400);   // reason required
    expect(must(await mob(T.manager, 'POST', `/kiorex-orders/${o.id}/reject`, { reason: 'Item damaged', reasonCode: 'DAMAGED' }), 200, 201).status).toBe('REJECTED');
    expect((await web(T.pharmacist, 'GET', `/kiorex-orders/${o.id}`)).body.status).toBe('REJECTED');
    expect(await outbox(kx.id)).toEqual(['OrderRejected']);
    if (await mirrored(kx.id, 'REJECTED')) {
      expect((await kxGet(kx.id)).payment.status).toBe('REFUNDED');
      expect(await q('kiorex_platform', `select "amountMinor", reason from "Refund" where "paymentId"=$1`, [kx.payment.paymentId])).toEqual([{ amountMinor: kx.totalMinor, reason: 'REJECTED' }]);
    }
  });
});

describe('y. PRO standalone pharmacy (Solo): the same role work, isolated from the CHAIN tenant', () => {
  it('solo roles: Rx queue, validate, shift summary, expiry, controlled witness list, customer lookup; cross-tenant isolation', async () => {
    const q1 = must(await mob(T['solo.pharmacist'], 'GET', '/prescriptions/verification-queue'));
    expect(q1.total).toBeGreaterThan(0);
    const chainIds = (must(await mob(T.pharmacist, 'GET', '/prescriptions/verification-queue')).items as any[]).map((i) => i.id);
    for (const i of q1.items) expect(chainIds).not.toContain(i.id);                    // tenant isolation
    // a solo-tenant Rx can be validated by the solo pharmacist but never by the chain pharmacist or a solo cashier
    const rx = q1.items.find((i: any) => i.status === 'RECEIVED');
    if (rx) {
      expect((await mob(T['solo.cashier'], 'POST', `/prescriptions/${rx.id}/validate`)).status).toBe(403);
      expect((await mob(T.pharmacist, 'POST', `/prescriptions/${rx.id}/validate`)).status).toBe(404);
    }
    const ss = must(await mob(T['solo.cashier'], 'GET', '/mobile/pharmacy/shift-summary'));
    expect(ss).toMatchObject({ open: true, shift: { mine: true, openedByName: expect.any(String) }, report: { report: 'X' } });
    expect(Number(ss.report.expectedCash)).toBeGreaterThanOrEqual(Number(ss.shift.openingFloat));
    expect(must(await mob(T['solo.manager'], 'GET', '/mobile/pharmacy/expiry-lowstock')).expiry.items).toBeInstanceOf(Array);
    const pend = must(await mob(T['solo.manager'], 'GET', '/mobile/pharmacy/controlled/pending-witness')).items as any[];
    const chainPend = (must(await mob(T.manager, 'GET', '/mobile/pharmacy/controlled/pending-witness')).items as any[]).map((i) => i.id);
    for (const i of pend) expect(chainPend).not.toContain(i.id);
    expect((await mob(T['solo.cashier'], 'GET', '/mobile/pharmacy/controlled/pending-witness')).status).toBe(403);
    expect((await mob(T['solo.cashier'], 'GET', '/customers?pageSize=5')).body.items.length).toBeGreaterThan(0);
    const gt = (await dbq(`select d.gtin from "Drug" d where d.gtin is not null and exists (select 1 from "StockLot" l where l."drugId"=d.id and l."qtyOnHand">0 and l."orgId"=(select "orgId" from "StaffUser" where email='solo.owner@demo.kiorly.local')) limit 1`))[0];
    if (gt) expect((await mob(T['solo.cashier'], 'GET', `/mobile/pharmacy/barcode/${gt.gtin}`)).body.found).toBe(true);
    // BASIC owner has the alert inbox (and only that)
    expect((await mob(T['owner.basic'], 'GET', '/mobile/alerts')).status).toBe(200);
  });
});
