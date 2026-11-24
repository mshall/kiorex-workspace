import { expect } from 'vitest';
import { kiorex, q, waitFor } from './clients.js';
import { lab, pharmacy, recordDevGate, rnd } from './verticals.js';
import { purgeTenant } from './db.js';

/**
 * Connect a SECOND standalone pharmacy / lab to Kiorex through the real wizard API and the real ops walk-through (enrolment code -> signed request -> automated checks ->
 * human steps -> two-person approval -> Go live), exactly as 22-standalone-connect does, so the registry holds several live partners of one kind. Returns what a routing test needs.
 */
export interface ConnectedPartner { kind: 'PHARMACY' | 'LAB'; token: string; tenantId: string; locationId: string; connectionId: string; registrationId: string; clientKey: string; sku?: string }

const P = '/admin/onboarding/partners';
const stepOf = (view: any, key: string) => view.steps.find((s: any) => s.key === key);
export const created = { connections: [] as string[], enrolments: [] as string[], tenants: { pharmacy: [] as string[], lab: [] as string[] } };

async function enrol(prep: string, kind: string, tag: string) {
  const r = await kiorex(prep, 'POST', '/admin/onboarding/enrolments', { kind, label: `e2e-routing ${tag}` });
  expect(r.status, JSON.stringify(r.body)).toBe(201); created.enrolments.push(r.body.id); return r.body.code as string;
}
async function walk(prep: string, sup: string, id: string, gateFlag: string) {
  const ops = (t: string, method: string, path: string, body?: unknown) => kiorex(t, method, `${P}${path}`, body);
  let v = (await ops(prep, 'POST', `/${id}/run-checks`)).body;
  const gate = stepOf(v, 'launch_gate');
  if (gate.state === 'ACTION') { await recordDevGate(sup, gateFlag); v = (await ops(prep, 'POST', `/${id}/run-checks`)).body; }
  expect((await ops(prep, 'POST', `/${id}/steps/review_documents`, { note: 'complete' })).status).toBe(200);
  expect((await ops(prep, 'POST', `/${id}/steps/verify_licence`, { reference: 'LIC-E2E-ROUTING' })).status).toBe(200);
  expect((await ops(prep, 'POST', `/${id}/steps/fees`, { mode: 'STANDARD' })).status).toBe(200);
  const req = await ops(prep, 'POST', `/${id}/request-approval`); expect(req.status, JSON.stringify(req.body)).toBe(200);
  const ap = await ops(sup, 'POST', `/${id}/approve`); expect(ap.status, JSON.stringify(ap.body)).toBe(200);
  const live = await ops(prep, 'POST', `/${id}/go-live`); expect(live.status, JSON.stringify(live.body)).toBe(200); expect(live.body.status).toBe('LIVE');
}
async function connection(kind: string, orgRef: string) {
  const id = await waitFor(`connection ${kind}`, async () => (await q('kiorex_platform', `select id from "PartnerConnection" where kind = $1 and "orgRef" = $2`, [kind, orgRef]))[0]?.id, 20_000, 400) as string;
  created.connections.push(id); return id;
}
const registrationOf = async (id: string) => (await q('kiorex_platform', `select r.id, r."clientKey" from "PartnerConnection" c join "PartnerRegistration" r on r.id = c."registrationId" where c.id = $1`, [id]))[0] as { id: string; clientKey: string };

export async function connectPharmacy(prep: string, sup: string, label: string): Promise<ConnectedPartner> {
  const tag = rnd().toLowerCase(); const email = `e2e-routing-ph-${tag}@example.com`;
  const s = await pharmacy(undefined, 'POST', '/onboarding/signup', { pharmacyName: `E2E Routing Pharmacy ${label} ${tag}`, ownerName: 'E2E Owner', email, password: 'Demo@12345', branchName: 'Main' });
  expect(s.status, JSON.stringify(s.body)).toBe(201); created.tenants.pharmacy.push(s.body.tenantId);
  const tok = (await pharmacy(undefined, 'POST', '/auth/login', { email, password: 'Demo@12345' })).body.accessToken as string;
  expect((await pharmacy(tok, 'PUT', `/kiorex-connect/branches/${s.body.branchId}`, { optedIn: true, licenceNo: `PH-LIC-${tag}`, deliveryRadiusKm: '5', latitude: '30.0444', longitude: '31.2357', openingHours: { sat: ['09:00', '23:00'], sun: ['09:00', '23:00'] } })).status).toBe(200);
  const d = await pharmacy(tok, 'POST', '/catalogue/drugs', { brandName: `E2E-Routing-Med-${tag}`, activeIngredient: `e2e-ing-${tag}`, strength: '500 mg', dosageForm: 'tablet', packSize: '20', rxOnly: false, price: '40.00' });
  expect(d.status, JSON.stringify(d.body)).toBe(201);
  const exp = new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10);
  expect((await pharmacy(tok, 'POST', '/inventory/receipts', { branchId: s.body.branchId, invoiceNo: `E2E-${tag}`, lines: [{ drugId: d.body.id, lotNumber: `L-${tag}`, expiryDate: exp, quantity: 50, unitCost: '20.00' }] })).status).toBe(201);
  await pharmacy(tok, 'POST', '/kiorex-connect/licence', { name: 'licence.pdf', contentBase64: Buffer.from('%PDF-1.4\n%E2E dev licence placeholder\n%%EOF').toString('base64') });
  await pharmacy(tok, 'PUT', '/kiorex-connect/payout', { label: 'Main settlement account' }); await pharmacy(tok, 'PUT', '/kiorex-connect/terms', { version: '2026-11' });
  const r = await pharmacy(tok, 'POST', '/kiorex-connect/request', { contactEmail: email, enrolmentCode: await enrol(prep, 'PHARMACY', tag) });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  const id = await connection('PHARMACY', s.body.tenantId);
  await walk(prep, sup, id, 'kiorex.pharmacy_orders');
  const reg = await registrationOf(id);
  return { kind: 'PHARMACY', token: tok, tenantId: s.body.tenantId, locationId: s.body.branchId, connectionId: id, registrationId: reg.id, clientKey: reg.clientKey, sku: d.body.id };
}

export async function connectLab(prep: string, sup: string, label: string): Promise<ConnectedPartner> {
  const tag = rnd().toLowerCase(); const email = `e2e-routing-lab-${tag}@example.com`;
  const o = await lab(undefined, 'POST', '/onboarding/tenants', { name: `E2E Routing Lab ${label} ${tag}`, slug: `e2e-routing-${tag}`, labName: `Routing lab ${label}`, labCode: `R${tag.slice(0, 3).toUpperCase()}`, ownerName: 'E2E Owner', ownerEmail: email, loadStarterCatalogue: true });
  expect(o.status, JSON.stringify(o.body)).toBe(201); created.tenants.lab.push(o.body.tenantId);
  const tok = o.body.token as string;
  await lab(tok, 'PUT', `/labs/${o.body.labId}`, { licenceNo: `LAB-LIC-${tag}` });
  await lab(tok, 'POST', '/kiorex-connect/licence', { name: 'licence.pdf', contentBase64: Buffer.from('%PDF-1.4\n%E2E\n%%EOF').toString('base64') });
  await lab(tok, 'PUT', '/kiorex-connect/payout', { label: 'Settlement' }); await lab(tok, 'PUT', '/kiorex-connect/terms', { version: '2026-11' });
  const r = await lab(tok, 'POST', '/kiorex-connect/request', { contactEmail: email, enrolmentCode: await enrol(prep, 'LAB', tag) });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  const id = await connection('LAB', o.body.tenantId);
  await walk(prep, sup, id, 'kiorex.lab_bookings');
  const reg = await registrationOf(id);
  return { kind: 'LAB', token: tok, tenantId: o.body.tenantId, locationId: o.body.labId, connectionId: id, registrationId: reg.id, clientKey: reg.clientKey };
}

/** Removes everything connectPharmacy/connectLab created in the Kiorex database (the partner tenants stay in the partner databases, like 22 does). */
export async function cleanupConnected() {
  for (const id of created.connections) {
    const [c] = await q('kiorex_platform', `select "orgRef", "registrationId" from "PartnerConnection" where id = $1`, [id]);
    if (c?.registrationId) { await q('kiorex_platform', `update "PharmacyOrder" set "registrationId" = null where "registrationId" = $1`, [c.registrationId]); await q('kiorex_platform', `update "LabBooking" set "registrationId" = null where "registrationId" = $1`, [c.registrationId]); await q('kiorex_platform', `delete from "PartnerRegistration" where id = $1`, [c.registrationId]); }
    await q('kiorex_platform', `delete from "FlagValue" where "scope" = 'ORG' and "scopeId" = $1`, [c?.orgRef ?? '']);
    await q('kiorex_platform', `delete from "AuditLog" where resource = 'PartnerConnection' and "resourceId" = $1`, [id]);
    await q('kiorex_platform', `delete from "PartnerConnection" where id = $1`, [id]);
  }
  await q('kiorex_platform', `delete from "AuditLog" where resource = 'PartnerEnrolment' and "resourceId" = any($1)`, [created.enrolments]);
  await q('kiorex_platform', `delete from "PartnerEnrolment" where id = any($1)`, [created.enrolments]);
  await q('kiorex_platform', `delete from "MessageLog" where "templateId" like 'partner.onboarding.%' and recipient like 'e2e-routing-%'`);
  // the partner-side tenants (own databases) go too: a fixture never outlives the run
  for (const t of created.tenants.pharmacy) await purgeTenant('kiorly_pharmacy', t).catch(() => undefined);
  for (const t of created.tenants.lab) await purgeTenant('kiorly_lab', t).catch(() => undefined);
  created.connections.length = 0; created.enrolments.length = 0; created.tenants.pharmacy.length = 0; created.tenants.lab.length = 0;
}
