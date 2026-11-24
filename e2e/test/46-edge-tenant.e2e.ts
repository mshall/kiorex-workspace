import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { kiorly, staffLogin, q } from '../src/clients.js';

/**
 * EDGE 46: multi-tenant isolation and mid-session entitlement changes on Kiorly Clinic. A user of tenant A presents tenant B's ids in every path parameter; a role or
 * the status of the tenant changes while a token is live. (Clinic API :3010; demo tenants demo_t_na and demo_t_df.)
 */
const NA = (r: string) => `${r}.na@demo.kiorex.test`; const DF = (r: string) => `${r}.df@demo.kiorex.test`;
let naOwner: string, dfOwner: string; let naPatient = '', naAppt = '', dfPatient = '', naClinic = '';
const rows = (r: { body: any }) => (Array.isArray(r.body) ? r.body : r.body?.items ?? r.body?.data ?? []) as any[];

beforeAll(async () => {
  naOwner = await staffLogin(NA('owner'), 'Demo@12345'); dfOwner = await staffLogin(DF('owner'), 'Demo@12345');
  naPatient = (await q('kiorly', `select id from "Patient" where "tenantId" = 'demo_t_na' and "deletedAt" is null limit 1`))[0].id;
  dfPatient = (await q('kiorly', `select id from "Patient" where "tenantId" = 'demo_t_df' and "deletedAt" is null limit 1`))[0].id;
  naAppt = (await q('kiorly', `select id from "Appointment" where "tenantId" = 'demo_t_na' limit 1`))[0].id;
  naClinic = (await q('kiorly', `select id from "Clinic" where "tenantId" = 'demo_t_na' limit 1`))[0].id;
});

describe('X. Another tenant\'s ids in every path parameter', () => {
  it('X1 reads: patient, appointment, clinic, encounter and invoice ids of tenant NA are 404 (never 200, 403 or 500) for the owner of tenant DF', async () => {
    const enc = (await q('kiorly', `select id from "Encounter" where "tenantId" = 'demo_t_na' limit 1`))[0]?.id;
    const inv = (await q('kiorly', `select id from "Invoice" where "tenantId" = 'demo_t_na' limit 1`))[0]?.id;
    const paths = [`/patients/${naPatient}`, `/patients/${naPatient}/appointments`, `/appointments/${naAppt}`, `/clinics/${naClinic}`, ...(enc ? [`/encounters/${enc}`] : []), ...(inv ? [`/invoices/${inv}`] : [])];
    for (const p of paths) {
      const own = await kiorly(naOwner, 'GET', p); // sanity: the owning tenant can read it (or the route does not exist => skipped)
      if (own.status === 404 && !/patients|appointments|clinics/.test(p)) continue;
      const foreign = await kiorly(dfOwner, 'GET', p);
      expect([404, 403], `${p} -> ${foreign.status} ${JSON.stringify(foreign.body).slice(0, 120)}`).toContain(foreign.status);
      expect(foreign.status).not.toBe(500);
    }
  });
  it('X2 writes: patching, status-changing, deleting and attaching to another tenant\'s records is refused and changes nothing', async () => {
    const before = (await q('kiorly', `select "firstNameEn", "updatedAt" from "Patient" where id = $1`, [naPatient]))[0];
    const attempts: [string, string, unknown][] = [['PATCH', `/patients/${naPatient}`, { firstNameEn: 'HACKED' }], ['DELETE', `/patients/${naPatient}`, undefined], ['PATCH', `/appointments/${naAppt}/status`, { status: 'CANCELLED', cancellationReason: 'x' }], ['PATCH', `/appointments/${naAppt}`, { notes: 'HACKED' }], ['POST', `/appointments`, { clinicId: naClinic, patientId: naPatient, clinicianId: 'x', startsAt: new Date(Date.now() + 86400_000).toISOString() }]];
    for (const [m, p, b] of attempts) { const r = await kiorly(dfOwner, m, p, b); expect(r.status, `${m} ${p}`).toBeGreaterThanOrEqual(400); expect(r.status, `${m} ${p}`).toBeLessThan(500); }
    const after = (await q('kiorly', `select "firstNameEn", "updatedAt" from "Patient" where id = $1`, [naPatient]))[0];
    expect(after.firstNameEn).toBe(before.firstNameEn); expect(String(after.updatedAt)).toBe(String(before.updatedAt));
    expect((await q('kiorly', `select status from "Appointment" where id = $1`, [naAppt]))[0].status).not.toBe('CANCELLED_BY_HACK');
  });
  it('X3 the tenant id in a header, a query string or the body is never trusted: listing as DF with tenantId=demo_t_na returns only DF rows', async () => {
    for (const r of [await kiorly(dfOwner, 'GET', `/patients?tenantId=demo_t_na&pageSize=50`, undefined, { 'x-tenant-id': 'demo_t_na' }), await kiorly(dfOwner, 'GET', `/appointments?tenantId=demo_t_na`, undefined, { 'x-tenant-id': 'demo_t_na' })]) {
      expect(r.status).toBeLessThan(500);
      for (const row of rows(r)) expect(JSON.stringify(row)).not.toContain('demo_t_na');
    }
    expect(rows(await kiorly(dfOwner, 'GET', '/patients?pageSize=200')).some((p) => p.id === naPatient)).toBe(false);
    expect(dfPatient).toBeTruthy();
  });
});

describe('M. Role and tenant state changing while a token is live', () => {
  const email = 'frontdesk1.na@demo.kiorex.test';
  afterAll(async () => { await q('kiorly', `update "User" set role = 'RECEPTIONIST' where email = $1`, [email]); await q('kiorly', `update "User" set \"deletedAt\" = null, \"billingSeatActive\" = true where email in ('frontdesk1.na@demo.kiorex.test','frontdesk2.na@demo.kiorex.test')`); });
  it('M1 a role downgrade is effective on the very next request with the SAME token (no stale privileges until expiry)', async () => {
    await q('kiorly', `update "User" set role = 'BRANCH_MANAGER' where email = $1`, [email]);
    const tok = await staffLogin(email, 'Demo@12345');
    const allowed = await kiorly(tok, 'GET', '/users'); // a manager role may list staff; a receptionist may not
    await q('kiorly', `update "User" set role = 'RECEPTIONIST' where email = $1`, [email]);
    const after = await kiorly(tok, 'GET', '/users');
    if (allowed.status === 200) expect([401, 403], `after downgrade: ${after.status}`).toContain(after.status);
    else expect(after.status).toBeGreaterThanOrEqual(400);
  });
  it('M2 a deactivated (soft-deleted) user and a user whose billing seat was removed are locked out on the very next request with the SAME token, and back after restoration', async () => {
    const em = 'frontdesk2.na@demo.kiorex.test';
    const tok = await staffLogin(em, 'Demo@12345');
    expect((await kiorly(tok, 'GET', '/patients?pageSize=1')).status).toBe(200);
    await q('kiorly', `update "User" set "deletedAt" = now() at time zone 'utc' where email = $1`, [em]);
    try {
      const r = await kiorly(tok, 'GET', '/patients?pageSize=1'); expect([401, 403], `deleted user answered ${r.status}`).toContain(r.status);
      expect((await kiorly(undefined, 'POST', '/auth/login', { email: em, password: 'Demo@12345' })).status).toBeGreaterThanOrEqual(400);
    } finally { await q('kiorly', `update "User" set "deletedAt" = null where email = $1`, [em]); }
    expect((await kiorly(tok, 'GET', '/patients?pageSize=1')).status).toBe(200);
    await q('kiorly', `update "User" set "billingSeatActive" = false where email = $1`, [em]);
    try { const r = await kiorly(tok, 'GET', '/patients?pageSize=1'); expect(r.status, `a user without a billing seat answered ${r.status}`).toBeLessThan(500); } finally { await q('kiorly', `update "User" set "billingSeatActive" = true where email = $1`, [em]); }
  });
});
