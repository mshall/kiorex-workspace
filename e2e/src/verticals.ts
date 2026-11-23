import { createHmac } from 'node:crypto';
import { PHARMACY_API, LAB_API, PHARMACY_PASSWORD, FLAGS_SECRET } from './env.js';
import { kiorex, opsLogin, patientLogin, waitFor, sleep, q } from './clients.js';
import type { Res } from './clients.js';
import { PATIENT_1 } from './env.js';

async function http(base: string, token: string | undefined, method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res> {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json: any; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, body: json, headers: res.headers };
}
export const pharmacy = (token: string | undefined, method: string, path: string, body?: unknown) => http(PHARMACY_API, token, method, path, body);
export const lab = (token: string | undefined, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => http(LAB_API, token, method, path, body, headers);

/** Pharmacy staff login (AUTH_MODE=local; demo tenant seeded by kiorly-pharmacy: owner | pharmacist | cashier | manager). */
export async function pharmacyStaff(role: 'owner' | 'pharmacist' | 'cashier' | 'manager'): Promise<string> {
  const r = await pharmacy(undefined, 'POST', '/auth/login', { email: `${role}@demo.kiorly.local`, password: PHARMACY_PASSWORD });
  if (r.status !== 200) throw new Error(`pharmacy login ${role}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.accessToken;
}
/** Lab staff dev-login (AUTH_MODE=dev; demo tenant "demo-lab"). */
export async function labStaff(role: 'owner' | 'director' | 'signatory' | 'tech' | 'phleb' | 'reception' | 'manager'): Promise<string> {
  const r = await lab(undefined, 'POST', '/auth/dev-login', { orgSlug: 'demo-lab', email: `${role}@demo-lab.test` });
  if (r.status !== 200 && r.status !== 201) throw new Error(`lab dev-login ${role}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.accessToken ?? r.body.token;
}

// ───────────── flags (Kiorex super admin = the control plane) ─────────────
/**
 * DEV-ONLY-NOT-A-REAL-GATE: launch-locked flags are effective only with gate evidence (ADR-024). For the E2E database ONLY, record the same
 * clearly labelled dev evidence the dev seed records for market.eg.live. Never done by application code; revoked again in afterAll.
 */
const hadSeededGate = new Map<string, boolean>();
export async function recordDevGate(ops: string, flagKey: string) {
  if (!hadSeededGate.has(flagKey)) hadSeededGate.set(flagKey, Number((await q('kiorex_platform', `select count(*)::int c from "FlagGateEvidence" where "flagKey" = $1`, [flagKey]))[0].c) > 0);
  const r = await kiorex(ops, 'PUT', `/admin/flags/${flagKey}/gate`, { gateId: 'DEV-ONLY-NOT-A-REAL-GATE', approver: 'E2E DEV (not a human approval)', approvedOn: new Date().toISOString(), documentUrl: 'https://dev.invalid/e2e-dev-gate-not-evidence' });
  if (r.status !== 200) throw new Error(`gate ${flagKey}: ${r.status} ${JSON.stringify(r.body)}`);
}
/** afterAll: undo only what this suite added. If the dev seed already recorded dev evidence (demo stack), keep it so the patient app does not fall back to "Awaiting approval". */
export async function releaseDevGate(ops: string, flagKey: string) { if (!hadSeededGate.get(flagKey)) await revokeDevGate(ops, flagKey); }
export async function revokeDevGate(ops: string, flagKey: string) { await kiorex(ops, 'POST', `/admin/flags/${flagKey}/gate/revoke`, { reason: 'E2E cleanup (dev gate evidence is test-only)' }); }
/** Toggle a flag as super admin. `emergency` skips the two-person rule for money-path flags (reviewed later); only used for short-lived E2E toggles. */
export async function setFlag(ops: string, key: string, value: 'ON' | 'OFF', scope: 'GLOBAL' | 'MARKET' | 'ORG' = 'GLOBAL', scopeId?: string) {
  const r = await kiorex(ops, 'PUT', `/admin/flags/${key}/values`, { scope, scopeId, value, reason: 'E2E scenario', ticket: 'E2E-VERTICALS', emergency: true });
  if (r.status !== 200) throw new Error(`setFlag ${key}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}
/** Partners poll the Kiorex snapshot every ~1.5 s in the E2E stack (FLAGS_POLL_INTERVAL_MS); wait until both hold the current version. */
export async function waitPartnerFlags(timeoutMs = 20_000) {
  await pushFlagChanged(); // same signed `flag.changed` push the Kiorex control plane sends: makes the suite independent of a stalled poller
  const cur = Number((await q('kiorex_platform', 'select version from "ControlState" where id = 1'))[0].version);
  await waitFor('partners hold the current flag snapshot', async () => {
    const [p, l] = await Promise.all([q('kiorly_pharmacy', `select version from "FlagSnapshotCache" where product = 'kiorly-pharmacy'`), q('kiorly_lab', `select version from "FlagSnapshotCache" where product = 'kiorly-lab'`)]);
    return p[0] && l[0] && Number(p[0].version) >= cur && Number(l[0].version) >= cur;
  }, timeoutMs, 400);
  await sleep(300);
}

/** Signed `flag.changed` push to both partners (webhook scheme, per-product flags secret); each partner re-fetches the snapshot immediately. Best effort. */
export async function pushFlagChanged() {
  const raw = '{}', ts = String(Math.floor(Date.now() / 1000));
  const sig = `sha256=${createHmac('sha256', FLAGS_SECRET).update(`${ts}.${raw}`).digest('hex')}`;
  await Promise.all([PHARMACY_API, LAB_API].map((b) => fetch(`${b}/feature-flags/kiorex/changed`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-kiorly-timestamp': ts, 'x-kiorly-signature': sig }, body: raw }).catch(() => undefined)));
}

// ───────────── patient fixtures ─────────────
export async function patientToken() {
  const t = (await patientLogin(PATIENT_1)).accessToken;
  const prof = await kiorex(t, 'GET', '/me/profile');
  if (!prof.body?.nameEn) await kiorex(t, 'PUT', '/me/profile', { nameEn: 'Amira Samy' });
  await kiorex(t, 'PUT', '/me/consents/MARKETPLACE_PROCESSING', { granted: true });
  return t;
}
export async function payFake(paymentId: string) {
  const r = await kiorex(undefined, 'POST', `/pay/fake-checkout/${paymentId}/complete`, { outcome: 'pay' });
  if (r.status !== 200) throw new Error(`fake checkout ${r.status} ${JSON.stringify(r.body)}`);
}
export const rnd = () => Math.random().toString(36).slice(2, 8).toUpperCase();
export { opsLogin, kiorex, waitFor, sleep, q };
