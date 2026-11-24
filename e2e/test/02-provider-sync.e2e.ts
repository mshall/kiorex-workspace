import { describe, it, expect, beforeAll } from 'vitest';
import { tokens, syncProviders, providerBySpecialty, kxdevProviders, KXDEV_DOCTORS } from '../src/fixtures.js';
import { kiorex, q } from '../src/clients.js';

/** KXM-DS-01..04/07 search & slots · KX-09 §03 provider pull from Kiorly. */
describe('b. Provider sync from Kiorly and catalogue search', () => {
  let t: Awaited<ReturnType<typeof tokens>>;
  beforeAll(async () => { t = await tokens(); });

  it('pulls the 3 LIVE KX-DEV doctors from Kiorly', async () => {
    const r = await syncProviders(t.ops);
    expect(r.upserted + r.skipped).toBeGreaterThanOrEqual(3);
    const live = await q('kiorly', `select count(*)::int c from "MarketplaceListing" where status = 'LIVE'`);
    const dir = await kiorex(t.ops, 'GET', '/admin/providers?status=LIVE');
    expect(dir.body.total).toBe(live[0].c);
    // the directory is paged (50 a page) and the QA demo dataset adds more LIVE doctors than that: page through it instead of reading page 1
    const names: string[] = [];
    for (let page = 1; page <= 100; page++) {
      const d = await kiorex(t.ops, 'GET', `/admin/providers?status=LIVE&page=${page}`);
      names.push(...d.body.items.map((p: any) => p.nameEn));
      if (!d.body.items.length || names.length >= d.body.total) break;
    }
    expect(names).toEqual(expect.arrayContaining(KXDEV_DOCTORS));
  });

  it('search by specialty (paediatrics) returns the paediatrician with 3 inline slots (DS-01/02/07)', async () => {
    const r = await kiorex(t.p1, 'GET', '/search/providers?specialty=paediatrics&pageSize=30&sort=rating');
    expect(r.status).toBe(200);
    const p = r.body.items.find((x: any) => x.nameEn === 'Dr Mona Fahmy');
    expect(p).toBeTruthy();
    expect(p).toMatchObject({ nameEn: 'Dr Mona Fahmy', specialty: 'paediatrics', bookable: true, verified: true, currency: 'EGP' });
    expect(p.nextSlots).toHaveLength(3);
    for (const s of p.nextSlots) expect(new Date(s.startsAt).getTime()).toBeGreaterThan(Date.now());
    expect(p.clinicNameEn).toContain('Nile Family');
    expect(p.minFeeMinor).toBeGreaterThan(0);
  });

  it('browsing returns the three KX-DEV live doctors, each with inline next slots', async () => {
    const all = await kxdevProviders(t.p1);
    expect(all.map((p) => p.nameEn).sort()).toEqual(['Dr Hesham Nabil', 'Dr Karim Adel', 'Dr Mona Fahmy']);
    for (const p of all) expect(p.nextSlots.length).toBe(3);
  }, 90_000);

  it('the specialty list and a profile (KXM-PR-01) are served', async () => {
    const sp = await kiorex(undefined, 'GET', '/specialties');
    expect(sp.body.map((s: any) => s.code)).toContain('paediatrics');
    const p = await providerBySpecialty(t.p1, 'paediatrics');
    const prof = await kiorex(t.p1, 'GET', `/providers/${p.id}`);
    expect(prof.status).toBe(200);
    expect(prof.body.bookable).toBe(true);
    const slots = await kiorex(t.p1, 'GET', `/providers/${p.id}/slots?typeId=${p.defaultTypeId}`);
    expect(slots.body.slots.length).toBeGreaterThan(5);
  });

  it('emergency keywords return guidance and no results (KXM-DS-06)', async () => {
    const r = await kiorex(t.p1, 'GET', '/search/providers?q=chest%20pain');
    expect(r.status).toBe(200);
    expect(r.body.items ?? []).toHaveLength(0);
  });
});
