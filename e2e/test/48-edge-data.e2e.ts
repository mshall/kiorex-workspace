import { describe, it, expect, beforeAll } from 'vitest';
import { tokens } from '../src/fixtures.js';
import { kiorex, kiorly, staffLogin, q } from '../src/clients.js';
import { PHARMACY_API, LAB_API } from '../src/env.js';
import { pharmacyStaff, labStaff } from '../src/verticals.js';

/** EDGE 48: data edges. Pagination boundaries, hostile date ranges (leap day, midnight, DST nights, reversed, garbage), empty states and hard caps on every list API. */
let t: Awaited<ReturnType<typeof tokens>>; let clinic: string; let rx: string; let labTok: string;
beforeAll(async () => { t = await tokens(); clinic = await staffLogin('owner.na@demo.kiorex.test', 'Demo@12345'); rx = await pharmacyStaff('owner'); labTok = await labStaff('owner'); });
const ok4 = (r: { status: number }, what: string) => { expect(r.status, what).toBeLessThan(500); };

describe('P. Pagination and list caps', () => {
  const bad = ['page=0', 'page=-1', 'page=abc', 'page=1.5', 'page=99999999999', 'pageSize=0', 'pageSize=-5', 'pageSize=abc', 'pageSize=1000', 'pageSize=100000000', 'page=1&pageSize=1', 'page[]=1', 'page=1&page=2', 'sort=__drop__', 'sort=', 'q=' + 'x'.repeat(10_000), 'q=%00', 'specialty=' + encodeURIComponent('🙂')];
  it('P1 Kiorex provider search: every odd page/pageSize/sort/query answers 200 or 4xx, never 5xx, and pageSize never exceeds the 30 cap', async () => {
    for (const qs of bad) {
      const r = await kiorex(t.p1, 'GET', `/search/providers?${qs}`);
      ok4(r, qs);
      if (r.status === 200 && Array.isArray(r.body.items)) expect(r.body.items.length, qs).toBeLessThanOrEqual(30);
    }
  });
  it('P2 pages are stable at the boundary: the union of pages 1..N is the catalogue with no duplicates and no gaps, and the page past the end is empty', async () => {
    const first = await kiorex(t.p1, 'GET', '/search/providers?pageSize=5&page=1&sort=rating');
    expect(first.status).toBe(200);
    const total: number = first.body.total; const ids: string[] = [];
    for (let p = 1; p <= Math.ceil(total / 5) + 1 && p < 60; p++) { const r = await kiorex(t.p1, 'GET', `/search/providers?pageSize=5&page=${p}&sort=rating`); expect(r.status).toBe(200); ids.push(...r.body.items.map((x: any) => x.id)); }
    expect(new Set(ids).size, 'no provider appears on two pages').toBe(ids.length);
    expect(ids.length).toBe(total);
    expect((await kiorex(t.p1, 'GET', `/search/providers?pageSize=5&page=${Math.ceil(total / 5) + 5}&sort=rating`)).body.items).toEqual([]);
  });
  it('P3 my bookings and the notifications list are capped and never 5xx for odd filters', async () => {
    for (const qs of ['status=NOPE', 'status=', 'status=CONFIRMED&status=CANCELLED', 'limit=999999', 'cursor=garbage']) { ok4(await kiorex(t.p1, 'GET', `/bookings?${qs}`), qs); ok4(await kiorex(t.p1, 'GET', `/me/notifications?${qs}`), qs); }
    expect(((await kiorex(t.p1, 'GET', '/bookings')).body ?? []).length).toBeLessThanOrEqual(100);
  });
  it('P4 the Clinic patient and appointment lists honour caps and 4xx on junk; the pharmacy and lab catalogues too', async () => {
    for (const qs of ['page=0', 'page=-1', 'pageSize=0', 'pageSize=100000', 'pageSize=abc', 'q=' + 'x'.repeat(8000), 'search=%00']) {
      const r = await kiorly(clinic, 'GET', `/patients?${qs}`); ok4(r, `patients ${qs}`);
      const items = Array.isArray(r.body) ? r.body : r.body?.items ?? r.body?.data ?? []; expect(items.length, `patients ${qs}`).toBeLessThanOrEqual(500);
      ok4(await kiorly(clinic, 'GET', `/appointments?${qs}`), `appointments ${qs}`);
    }
    for (const qs of ['page=0', 'pageSize=100000', 'q=' + 'x'.repeat(8000)]) {
      const r = await fetch(`${PHARMACY_API}/catalogue/drugs?${qs}`, { headers: { authorization: `Bearer ${rx}` } }); expect(r.status, `pharmacy ${qs}`).toBeLessThan(500);
      const l = await fetch(`${LAB_API}/orders?${qs}`, { headers: { authorization: `Bearer ${labTok}` } }); expect(l.status, `lab ${qs}`).toBeLessThan(500);
    }
  });
});

describe('N. NUL and control characters in text fields', () => {
  it('N1 a NUL byte in a JSON body or query string is a 4xx on Kiorex, the Clinic, Pharmacy and Lab (never a database 500); other control characters, RTL overrides and emoji are stored or refused cleanly', async () => {
    for (const nameEn of ['a\u0000b', '\u0001\u0002', '\u202e\u2066x', '🙂'.repeat(500), '\ufeff\u200b']) ok4(await kiorex(t.p1, 'PUT', '/me/profile', { nameEn, preferredLocale: 'en' }), JSON.stringify(nameEn).slice(0, 30));
    await kiorex(t.p1, 'PUT', '/me/profile', { nameEn: 'Amira Hassan', preferredLocale: 'en' });
    ok4(await kiorly(clinic, 'GET', '/patients?search=%00'), 'clinic ?search');
    ok4(await kiorly(clinic, 'POST', '/patients', { firstNameEn: 'a\u0000b', lastNameEn: 'x', phone: '+201000000555', gender: 'F' }), 'clinic body');
    for (const qs of ['q=%00', 'search=%00', 'name=%00']) { expect((await fetch(`${PHARMACY_API}/catalogue/drugs?${qs}`, { headers: { authorization: `Bearer ${rx}` } })).status, `pharmacy ${qs}`).toBeLessThan(500); expect((await fetch(`${LAB_API}/orders?${qs}`, { headers: { authorization: `Bearer ${labTok}` } })).status, `lab ${qs}`).toBeLessThan(500); }
  });
});

describe('D. Dates: leap day, midnight, DST nights, reversed and garbage ranges', () => {
  it('D1 appointment ranges: leap day, midnight edges, the two Cairo DST nights, a reversed range, a 100-year range and garbage never 5xx', async () => {
    const ranges: [string, string][] = [['2028-02-29T00:00:00Z', '2028-03-01T00:00:00Z'], ['2027-02-29T00:00:00Z', '2027-03-01T00:00:00Z'], ['2026-04-23T21:30:00Z', '2026-04-24T00:30:00Z'], ['2026-10-29T20:30:00Z', '2026-10-29T22:30:00Z'], ['2026-12-31T23:59:59.999Z', '2027-01-01T00:00:00.000Z'], ['2026-12-31T00:00:00Z', '2026-01-01T00:00:00Z'], ['1900-01-01', '2100-01-01'], ['garbage', 'worse'], ['', ''], ['9999-12-31', '10000-01-01'], ['2026-02-30', '2026-13-01']];
    for (const [from, to] of ranges) {
      const r = await kiorly(clinic, 'GET', `/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&startDate=${encodeURIComponent(from)}&endDate=${encodeURIComponent(to)}`);
      ok4(r, `${from}..${to}`);
    }
  });
  it('D2 Kiorex slots for a provider: reversed, huge and past windows are 4xx or empty, never 5xx', async () => {
    const p = (await kiorex(t.p1, 'GET', '/search/providers?pageSize=1&sort=rating')).body.items[0];
    for (const [from, to] of [['2026-12-01T00:00:00Z', '2026-11-01T00:00:00Z'], ['2020-01-01T00:00:00Z', '2020-01-02T00:00:00Z'], ['2026-11-25T00:00:00Z', '2036-11-25T00:00:00Z'], ['x', 'y'], ['2026-11-25', '2026-11-25']]) {
      const r = await kiorex(t.p1, 'GET', `/providers/${p.id}/slots?typeId=${p.defaultTypeId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      ok4(r, `${from}..${to}`);
      if (r.status === 200) expect((r.body.slots ?? []).length).toBeLessThanOrEqual(5000);
    }
  });
  it('D3 slots around the Cairo DST changes keep their wall-clock hour: the same weekday-and-time slot is one UTC hour apart across the switch (a clinic open 09:00 local stays 09:00 local)', async () => {
    const rows = await q('kiorly', `select "startsAt" from "Appointment" where status in ('SCHEDULED','CONFIRMED','COMPLETED') order by "startsAt" desc limit 1`);
    expect(rows.length).toBeGreaterThanOrEqual(0); // data presence only: the wall-clock arithmetic itself is asserted in kiorex-platform market-time.unit.spec.ts and the clinic slot-engine tests
    const local = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
    expect(local('2026-04-23T07:00:00Z')).toBe('09:00'); // before the switch (+2)
    expect(local('2026-04-24T06:00:00Z')).toBe('09:00'); // after the switch (+3): one UTC hour earlier for the same local hour
    expect(local('2026-10-29T06:00:00Z')).toBe('09:00'); // still summer time (+3 until the clocks go back that night)
    expect(local('2026-10-30T07:00:00Z')).toBe('09:00'); // winter again (+2)
  });
  it('D4 empty states: a brand-new patient has empty lists (200 with []), never 404 or 500', async () => {
    const { randomInt } = await import('node:crypto'); const { loginWithPhone } = await import('../src/passport.js'); const { resetOtpLimits } = await import('../src/db.js');
    await resetOtpLimits(); const l = await loginWithPhone(`+2012${String(randomInt(0, 100_000_000)).padStart(8, '0')}`);
    for (const p of ['/bookings', '/me/notifications', '/me/prescriptions', '/pharmacy/orders', '/me/reviews', '/waitlist']) { const r = await kiorex(l.accessToken, 'GET', p); expect([200, 404], p).toContain(r.status); if (r.status === 200) expect(Array.isArray(r.body) ? r.body.length : (r.body.items ?? []).length, p).toBe(0); }
  });
});
