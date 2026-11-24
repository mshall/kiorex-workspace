import { createHash, createHmac, randomInt } from 'node:crypto';
import { WEBHOOK_SECRET, KIOREX, KIOREX_API } from './env.js';
import { kiorex, q, staffLogin, kiorly, waitFor } from './clients.js';
import { loginWithPhone } from './passport.js';
import { resetOtpLimits } from './db.js';
import { partnerCall } from './hmac.js';
import { kiorlyAppointmentFor, waitStatus, pickSlot, hold, confirmBody, type Provider } from './fixtures.js';

/** Provider-link token exactly as the Clinic mints it (clinics-management growth/provider-links/link-touch.ts): `<b64url claims>.<b64url HMAC("kx-lt1\n"+payload)>`. */
export function signClinicLt(o: { tenantId: string; code: string; now?: number; secret?: string }): string {
  const payload = Buffer.from(JSON.stringify({ o: o.tenantId, c: o.code, t: o.now ?? Date.now(), v: 1 }), 'utf8').toString('base64url');
  return `${payload}.${createHmac('sha256', o.secret ?? WEBHOOK_SECRET).update(`kx-lt1\n${payload}`).digest('base64url')}`;
}
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const newLinkCode = () => Array.from({ length: 8 }, () => CROCKFORD[randomInt(0, 32)]).join('');

/** A brand-new patient (fresh phone => "new patient" for the commission rule), signed in through the dev Passport. */
export async function freshPatient(name = 'Growth Tester') {
  const phone = `+2012${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;
  await resetOtpLimits();
  const login = await loginWithPhone(phone);
  expectOk((await kiorex(login.accessToken, 'PUT', '/me/profile', { nameEn: name, gender: 'FEMALE', preferredLocale: 'en' })).status, 200, 'profile');
  return { phone, token: login.accessToken, sub: login.sub };
}
export function expectOk(got: number, want: number, what: string) { if (got !== want) throw new Error(`${what}: expected ${want}, got ${got}`); }

/** Hold + confirm with optional growth inputs (lt, visitor header). Returns the confirm response and the Kiorex booking id. */
export async function bookWith(token: string, p: Provider, o: { lt?: string; visitor?: string; slot?: { startsAt: string; endsAt: string }; confirm?: boolean; headers?: Record<string, string> } = {}) {
  let slot = o.slot ?? (await pickSlot(token, p));
  let h = await kiorex(token, 'POST', '/bookings', { providerId: p.id, typeId: p.defaultTypeId, startsAt: slot.startsAt, endsAt: slot.endsAt, ...(o.lt ? { lt: o.lt } : {}) }, { ...(o.visitor ? { 'X-KX-Visitor': o.visitor } : {}), ...(o.headers ?? {}) });
  for (let i = 0; i < 6 && h.status === 409 && !o.slot; i++) { slot = await pickSlot(token, p); h = await kiorex(token, 'POST', '/bookings', { providerId: p.id, typeId: p.defaultTypeId, startsAt: slot.startsAt, endsAt: slot.endsAt, ...(o.lt ? { lt: o.lt } : {}) }, { ...(o.visitor ? { 'X-KX-Visitor': o.visitor } : {}), ...(o.headers ?? {}) }); }
  if (h.status !== 201) throw new Error(`hold ${h.status} ${JSON.stringify(h.body)}`);
  const id = h.body.id as string;
  if (o.confirm === false) return { id, slot };
  const c = await kiorex(token, 'POST', `/bookings/${id}/confirm`, confirmBody, { 'Idempotency-Key': id, ...(o.visitor ? { 'X-KX-Visitor': o.visitor } : {}), ...(o.headers ?? {}) });
  if (c.status !== 200) throw new Error(`confirm ${c.status} ${JSON.stringify(c.body)}`);
  return { id, slot, confirmed: c.body };
}

/** Clinic staff checks the patient in and signs the encounter (as test 06 does): the commission decision is written at check-in, the charge confirmed at completion. */
export async function completeVisit(patientToken: string, bookingId: string, staff: string) {
  const apt = await kiorlyAppointmentFor(bookingId);
  await waitStatus(patientToken, bookingId, 'CONFIRMED');
  expectOk((await kiorly(staff, 'PATCH', `/appointments/${apt.id}/status`, { status: 'CHECKED_IN' })).status, 200, 'check-in');
  await waitStatus(patientToken, bookingId, 'CHECKED_IN');
  const enc = await waitFor('encounter', async () => (await q('kiorly', `select id from "Encounter" where "appointmentId" = $1`, [apt.id]))[0]);
  expectOk((await kiorly(staff, 'PATCH', `/encounters/${enc.id}`, { noMedications: true, subjective: 'cough', assessment: 'URTI', plan: 'rest' })).status, 200, 'encounter');
  expectOk((await kiorly(staff, 'POST', `/encounters/${enc.id}/diagnoses`, { icd10Code: 'J06.9', descriptionEn: 'URTI', isPrimary: true })).status, 201, 'diagnosis');
  expectOk((await kiorly(staff, 'POST', `/encounters/${enc.id}/finalize`)).status, 201, 'finalize');
  await waitStatus(patientToken, bookingId, 'COMPLETED');
  return apt;
}

export const decisionOf = async (bookingId: string) => (await q('kiorex_platform', `select id, origin, "reasonCode", "policyVersionId", "inputsHash" from "GrowthAttributionDecision" where "bookingId" = $1 and "supersedesId" is null`, [bookingId]));
export const clinicDecision = async (appointmentId: string) => (await q('kiorly', `select decision, origin, "isNewPatient", "reasonCodes", amount from "KiorexCommissionDecision" where "appointmentId" = $1 order by "createdAt"`, [appointmentId]));
export const clinicCharges = async (appointmentId: string) => (await q('kiorly', `select status, amount from "KiorexCommissionCharge" where "appointmentId" = $1`, [appointmentId]));

/** A touch the visitor left before booking (the consent-gated touch endpoint is locked until the counsel gate; the e2e writes the same row the endpoint would). */
export async function seedTouch(o: { sub: string; kind: string; ageMs: number; linkCode?: string; org?: string | null; dwellMs?: number }) {
  const src = (await q('kiorex_platform', `insert into "GrowthAcquisitionSource" (id, market, "sourceKind", "sourceRef", active) values ($1, 'EG', $2, $3, true) on conflict (market, "sourceKind", "sourceRef") do update set active = true returning id`, [`gas_e2e_${Math.random().toString(36).slice(2, 10)}`, o.kind, o.linkCode ?? '']))[0];
  await q('kiorex_platform', `insert into "GrowthTouchpoint" (id, market, sub, "sourceId", kind, "providerOrgRef", "linkCode", "landingKind", "dwellMs", "occurredAt", "ipHash", "uaClass") values ($1, 'EG', $2, $3, $4, $5, $6, 'HOME', $7, ($8::timestamptz at time zone 'UTC'), 'e2e', 'unknown')`,
    [`gtp_e2e_${Math.random().toString(36).slice(2, 12)}`, o.sub, src.id, o.kind, o.org ?? null, o.linkCode ?? null, o.dwellMs ?? 1800, new Date(Date.now() - o.ageMs).toISOString()]); // an ISO string: the pg driver would shift a Date into local time for a timestamp-without-zone column
}
export const evidenceAsClinic = (bookingId: string, org: string) => partnerCall(KIOREX, { key: 'kx_dev_client', secret: WEBHOOK_SECRET }, 'GET', `/api/v1/growth/v1/evidence/${bookingId}`, undefined, { 'x-kiorly-org-ref': org });
/** Signed headers for ONE request, reusable to prove replay protection (the same nonce twice must be refused). */
export function signedHeaders(method: string, fullPath: string, secret = WEBHOOK_SECRET, key = 'kx_dev_client', body?: string) {
  const ts = String(Date.now()), nonce = `e2e-${Math.random().toString(36).slice(2)}${Date.now()}`;
  const sha = createHash('sha256').update(body ?? '').digest('hex');
  const sig = createHmac('sha256', secret).update(`${ts}\n${nonce}\n${method.toUpperCase()}\n${fullPath}\n${sha}`).digest('base64url');
  return { 'x-kiorly-client-key': key, 'x-kiorly-timestamp': ts, 'x-kiorly-nonce': nonce, 'x-kiorly-signature': sig };
}
export { staffLogin, KIOREX_API };

// ---- GRW-P1-M fixtures shared by 27 and 28 ----
export const KXDEV_ADMIN = { id: 'e2e_growth_admin', email: 'e2e.growth.admin@kiorly.dev', slug: 'e2e-kxdev-zamalek' };
/**
 * The KX-DEV clinic has no admin user and no booking slug, so the Growth surfaces (links, widget, statement) cannot be reached through the real API.
 * This adds a CLINIC_ADMIN (a copy of Dr Mona's row, other id and e-mail) and a booking slug, and returns the restore function. Dev databases only.
 */
export async function kxdevGrowthTenant(providerId: string) {
  const row = (await q('kiorex_platform', `select "tenantId", "clinicId" from "Provider" where id = $1`, [providerId]))[0];
  const clinicId = row.clinicId as string;
  const oldSlug = (await q('kiorly', `select "bookingSlug" from "Clinic" where id = $1`, [clinicId]))[0]?.bookingSlug ?? null;
  await q('kiorly', `update "Clinic" set "bookingSlug" = $2 where id = $1`, [clinicId, KXDEV_ADMIN.slug]);
  await q('kiorly', `delete from "User" where id = $1`, [KXDEV_ADMIN.id]);
  await q('kiorly', `insert into "User" select (jsonb_populate_record(null::"User", to_jsonb(u) || $1::jsonb)).* from "User" u where email = 'kxdev.mona.fahmy@kiorly.dev'`, [JSON.stringify({ id: KXDEV_ADMIN.id, email: KXDEV_ADMIN.email, role: 'CLINIC_ADMIN', additionalRoles: [], isTenantOwner: false, phone: null, displayName: 'E2E Growth Admin' })]);
  const admin = await staffLogin(KXDEV_ADMIN.email);
  return {
    org: row.tenantId as string, clinicId, admin, slug: KXDEV_ADMIN.slug,
    restore: async () => {
      await q('kiorly', `update "Clinic" set "bookingSlug" = $2 where id = $1`, [clinicId, oldSlug]).catch(() => undefined);
      await q('kiorly', `delete from "User" where id = $1`, [KXDEV_ADMIN.id]).catch(() => undefined);
    },
  };
}

/** A second Passport super admin (maker-checker needs two people). Row-level fixture in the dev Passport database, removed by `drop`. */
export const SECOND_ADMIN = { sub: '01HZKX0000000000000E2E0A2', phone: '+201000009777', totp: 'REMOVED-OLD-DEMO-TOTP-SECRET' };
export async function secondSuperAdmin() {
  const drop = async () => { await q('kiorex_account', `delete from totp_credentials where sub = $1`, [SECOND_ADMIN.sub]); await q('kiorex_account', `delete from accounts where sub = $1`, [SECOND_ADMIN.sub]); };
  await drop();
  await q('kiorex_account', `insert into accounts (sub, phone, phone_verified, name, roles) values ($1, $2, true, 'E2E Second Super Admin', '["ops_admin","super_admin"]'::jsonb)`, [SECOND_ADMIN.sub, SECOND_ADMIN.phone]);
  await q('kiorex_account', `insert into totp_credentials (sub, secret, confirmed_at) values ($1, $2, now())`, [SECOND_ADMIN.sub, SECOND_ADMIN.totp]);
  await resetOtpLimits();
  const login = await loginWithPhone(SECOND_ADMIN.phone, { clientId: 'kiorex-ops', totpSecret: SECOND_ADMIN.totp });
  return { token: login.accessToken, sub: login.sub, drop };
}
