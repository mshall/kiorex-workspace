import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { kiorex, opsLogin, waitFor, q } from '../src/clients.js';
import { secondSuperAdmin } from '../src/growth.js';
import { KIOREX } from '../src/env.js';
import { pool } from '../src/db.js';

/** The suite creates market ZY ONCE (the wizard refuses a second plan): on a database that already ran it (a second consecutive run on one stack) every ZY row is removed first. Append-only and immutability triggers are off for this one cleanup transaction (test databases only). */
async function resetZy() {
  const c = await pool('kiorex_platform').connect();
  try {
    await c.query('BEGIN'); await c.query('SET LOCAL session_replication_role = replica');
    for (const [t, col] of [['GrowthCampaign', 'market'], ['GrowthEvent', 'market'], ['GrowthSlug', 'market'], ['MarketGeography', 'market'], ['MarketOnboardingPlan', 'cc'], ['GrowthConfigReader', 'scopeId'], ['GrowthConfigVersion', 'scopeId']] as const) await c.query(`delete from "${t}" where "${col}" = 'ZY'`);
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK').catch(() => undefined); throw e; } finally { c.release(); }
}

/**
 * GRW-P3-G and GRW-GC-4b on a real Kiorex API (private instance from `scripts/w8a2-stack.sh up`, own database, Passport :4400 shared read-only): the synthetic market ZY is created ONLY through the
 * market wizard API and the configuration versions of two real super admins. No source or deployment change happens in the run: the API process was started before ZY existed. Currency JOD
 * with three decimals, Asia/Amman quiet hours, the data cell, geography with Arabic names (BOM and 20,000 rows), a campaign in ZY with JOD, and the human gate: `market.zy.live` is registered
 * launch-locked and stays OFF (the suite never records a gate), so ZY stays hidden from sign-up and the bootstrap while the console already lists it. EG is unchanged throughout.
 * Fresh database per run: the plan and the versions are rows that are never deleted (configuration versions are immutable), so run `scripts/w8a2-stack.sh down && up` between runs.
 */
const W = '/admin/growth/market-onboarding'; const CFG = '/ops/growth/config';
const csv = (rows: string[]) => ['level,key,parentKey,nameAr,nameEn,slugAr,slugEn', ...rows].join('\n');
const GEO = `﻿${csv(['CITY,amman,,عمّان,Amman,amman,amman', 'CITY,irbid,,إربد,Irbid,irbid,irbid', 'DISTRICT,abdoun,amman,عبدون,Abdoun,abdoun,abdoun', 'DISTRICT,sweileh,amman,صويلح,Sweileh,sweileh,sweileh'])}`;
const identity = { name: { ar: 'زد واي', en: 'Zeta Yankee' }, currency: 'JOD', minorUnits: 3, phoneCode: '+962', timezone: 'Asia/Amman', locales: ['ar', 'en'], defaultLocale: 'ar', quietHours: { start: '22:00', end: '08:00' }, workingWeek: [0, 1, 2, 3, 4] };
const regulation = { marketingLicenceRequired: true, marketingLicenceHeld: false, consentRegimeId: 'zy-regime-v0', minimumAge: 18, healthAdvertisingRestricted: true, reviewMarkupAllowed: false, dataExportRuleId: 'zy-export-v0' };

describe('38. market ZY by configuration only (wizard, two approvers, human gate)', () => {
  let a: string; let two: Awaited<ReturnType<typeof secondSuperAdmin>>; let pub: { drafted: Record<string, { id: string }> };
  beforeAll(async () => { await resetZy(); a = (await opsLogin()).accessToken; two = await secondSuperAdmin(); });
  afterAll(async () => { await two?.drop().catch(() => undefined); });

  it('every wizard endpoint needs a session and the super admin role to write', async () => {
    for (const p of [`${W}/catalogue`, `${W}/plans`]) expect((await kiorex(undefined, 'GET', p)).status, p).toBe(401);
    expect((await kiorex(undefined, 'POST', `${W}/plans`, { cc: 'ZY' })).status).toBe(401);
    const cat = await kiorex(a, 'GET', `${W}/catalogue`); expect(cat.status).toBe(200); expect(cat.body.existing.sort()).toEqual(['AE', 'EG', 'SA']); expect(cat.body.dataCells.cells).toContain('frankfurt');
  });

  it('EG, SA and AE cannot be created (they change through their configuration versions); ZY can, once', async () => {
    for (const cc of ['EG', 'SA', 'AE']) expect((await kiorex(a, 'POST', `${W}/plans`, { cc })).body.code).toBe('MARKET_EXISTS');
    expect((await kiorex(a, 'POST', `${W}/plans`, { cc: 'ZY' })).status).toBe(201); expect((await kiorex(a, 'POST', `${W}/plans`, { cc: 'ZY' })).status).toBe(409);
  });

  it('the answers are validated: a bad currency, an invalid time zone and an unknown data cell are refused with a reason', async () => {
    const bad = await kiorex(a, 'PUT', `${W}/plans/ZY/steps/identity`, { ...identity, currency: 'jod', timezone: 'Mars/Olympus' }); expect(bad.status).toBe(422); expect(JSON.stringify(bad.body)).toMatch(/currency/); expect(JSON.stringify(bad.body)).toMatch(/timezone/);
    const cell = await kiorex(a, 'PUT', `${W}/plans/ZY/steps/residency`, { dataCellId: 'mars' }); expect(cell.status).toBe(422); expect(JSON.stringify(cell.body)).toMatch(/unknown cell is refused/);
  });

  it('all eight steps are answered, geography imports with BOM and Arabic names, 20,001 rows are refused', async () => {
    const put = (s: string, b: unknown) => kiorex(a, 'PUT', `${W}/plans/ZY/steps/${s}`, b);
    expect((await put('identity', identity)).status).toBe(200); expect((await put('regulation', regulation)).status).toBe(200);
    expect((await put('consent', { textVersionIds: { analytics: 'TODO_NEEDS_HUMAN_v0', marketing: 'TODO_NEEDS_HUMAN_v0' }, maxMarketingPerDay: 1, maxMarketingPerWeek: 2 })).status).toBe(200);
    expect((await put('residency', { dataCellId: 'frankfurt' })).status).toBe(200); expect((await put('providers', { importBatchId: 'imp_zy_batch_1' })).status).toBe(200);
    expect((await put('specialties', { enabled: [{ code: 'dermatology', nameAr: 'الجلدية', nameEn: 'Dermatology' }] })).status).toBe(200); expect((await put('integrations', { whatsappPhoneNumberIdRef: null })).status).toBe(200);
    const big = csv(Array.from({ length: 20_001 }, (_, i) => `CITY,c${i},,مدينة ${i},City ${i},c${i}-ar-x,c${i}-en-x`)); const refused = await kiorex(a, 'POST', `${W}/geography/preview`, { csv: big }); expect(refused.body.errors[0].code).toBe('TOO_MANY_ROWS');
    const imp = await kiorex(a, 'POST', `${W}/plans/ZY/geography`, { csv: GEO }); expect(imp.status).toBe(200); expect(imp.body).toEqual({ cities: 2, districts: 2 });
    const geo = await kiorex(a, 'GET', `${W}/plans/ZY/geography?level=CITY`); expect(geo.body.map((g: { nameAr: string }) => g.nameAr)).toEqual(['عمّان', 'إربد']);
  });

  it('publish drafts three versions awaiting a checker; the maker cannot approve; nothing resolves for ZY yet', async () => {
    const r = await kiorex(a, 'POST', `${W}/plans/ZY/publish`); expect(r.status).toBe(200); pub = r.body; expect(Object.keys(pub.drafted).sort()).toEqual(['CONSENT_DEFAULTS', 'MARKET_GROWTH', 'MARKET_PROFILE']);
    expect((await kiorex(a, 'POST', `${CFG}/${pub.drafted.MARKET_PROFILE!.id}/approve`)).status).toBe(403);
    const ready = await kiorex(a, 'GET', `${W}/plans/ZY/readiness`); expect(ready.body.items.find((i: { id: string }) => i.id === 'configVersions').status).toBe('AWAITING_CHECKER');
    const markets = await kiorex(a, 'GET', '/ops/growth/markets'); expect(markets.body.find((m: { code: string }) => m.code === 'ZY')?.currency ?? '').not.toBe('EGP'); // before approval ZY shows blanks, never another market's defaults
  });

  it('a second super admin approves all three; ZY then resolves from configuration in the running process, EG is unchanged', async () => {
    for (const k of ['MARKET_PROFILE', 'MARKET_GROWTH', 'CONSENT_DEFAULTS']) expect((await kiorex(two.token, 'POST', `${CFG}/${pub.drafted[k]!.id}/approve`)).status, k).toBe(200);
    const ready = await waitFor('configuration versions approved', async () => { const r = await kiorex(a, 'GET', `${W}/plans/ZY/readiness`); return r.body.items.find((i: { id: string }) => i.id === 'configVersions').status === 'DONE' ? r.body : false; }, 20_000);
    expect(ready.live).toBe(false); expect(ready.items.find((i: { id: string }) => i.id === 'launchGate').status).toBe('NEEDS_HUMAN'); expect(ready.items.find((i: { id: string }) => i.id === 'legalTexts').status).toBe('NEEDS_HUMAN'); expect(ready.sameCellMarkets).toContain('EG');
    const card = await waitFor('the ZY market card', async () => (await kiorex(a, 'GET', '/ops/growth/markets')).body.find((m: { code: string }) => m.code === 'ZY'), 20_000);
    expect(card).toMatchObject({ currency: 'JOD', phoneCode: '+962', timeZone: 'Asia/Amman', quietHours: { start: '22:00', end: '08:00' }, live: false }); expect(card.name).toMatchObject({ en: 'Zeta Yankee', ar: 'زد واي' });
    expect(card.geography).toMatchObject({ cities: 2, districts: 2 });
    const eg = (await kiorex(a, 'GET', '/ops/growth/markets')).body.find((m: { code: string }) => m.code === 'EG'); expect(eg).toMatchObject({ currency: 'EGP', phoneCode: '+20', timeZone: 'Africa/Cairo', live: true });
  });

  it('the human gate holds: market.zy.live is registered launch-locked and OFF, so ZY is hidden from sign-up and the bootstrap, and a ZY page answers as not live', async () => {
    const all = await kiorex(undefined, 'GET', '/markets?all=true'); const zy = all.body.find((m: { code: string }) => m.code === 'ZY'); expect(zy).toBeTruthy(); expect(zy.live).toBe(false);
    expect((await kiorex(undefined, 'GET', '/markets')).body.map((m: { code: string }) => m.code)).not.toContain('ZY');
    const boot = await kiorex(undefined, 'GET', '/bootstrap?cc=zy'); expect(boot.body.liveMarkets).not.toContain('ZY'); expect(boot.body.resolvedMarket).not.toBe('ZY'); expect(boot.body.markets.map((m: { code: string }) => m.code)).not.toContain('ZY');
    const def = await q('kiorex_platform', `select "launchLocked", class from "FlagDefinition" where key = 'market.zy.live'`); expect(def[0]).toMatchObject({ launchLocked: true, class: 'LAUNCH_LOCKED' });
    expect(Number((await q('kiorex_platform', `select count(*)::int as n from "FlagGateEvidence" where "flagKey" = 'market.zy.live'`))[0].n)).toBe(0); // no code path recorded a gate
    const page = await fetch(`${KIOREX}/ar/zy/doctors`, { redirect: 'manual' }); expect([404, 200, 302, 301]).toContain(page.status); if (page.status === 200) expect((await page.text()).toLowerCase()).not.toContain('"zy"');
  });

  it('a campaign in ZY is priced in JOD and tagged zy, a growth event in ZY never shows in the EG report, and the audit trail names every wizard step without answers', async () => {
    const camp = await kiorex(a, 'POST', '/admin/growth/campaigns', { market: 'ZY', key: 'zy-launch', name: 'Launch', objective: 'ACQUISITION', budgetTotalMinor: 1_000_000, budgetDailyMinor: 200_000, channels: ['EMAIL'], startsAt: new Date(Date.now() - 3_600_000).toISOString(), endsAt: new Date(Date.now() + 86_400_000 * 20).toISOString(), utmConfig: { targetPath: '/doctors' } });
    expect(camp.status).toBe(201); expect(camp.body).toMatchObject({ market: 'ZY', currency: 'JOD', utmCampaign: 'zy-zy-launch' });
    await q('kiorex_platform', `insert into "GrowthEvent" (id, market, name, props, "dedupeKey", "occurredAt") values ('e2e_zy_ev_1', 'ZY', 'BookingConfirmed', '{}', 'e2e|zy|1', now())`);
    const zyRep = (await kiorex(a, 'GET', '/ops/growth/analytics?market=ZY&days=7')).body; const egRep = (await kiorex(a, 'GET', '/ops/growth/analytics?market=EG&days=7')).body;
    expect(zyRep.events.reduce((s: number, e: { count: number }) => s + e.count, 0)).toBe(1); expect(JSON.stringify(egRep)).not.toContain('e2e_zy_ev_1');
    const audit = await q('kiorex_platform', `select action, metadata::text as m from "AuditLog" where resource = 'MarketOnboardingPlan' and "resourceId" = 'ZY' order by "createdAt"`);
    expect(audit.map((r: { action: string }) => r.action)).toEqual(expect.arrayContaining(['growth.market_onboarding.create', 'growth.market_onboarding.step', 'growth.market_onboarding.geography', 'growth.market_onboarding.publish']));
    expect(JSON.stringify(audit)).not.toMatch(/JOD|Zeta|zy-regime/); // steps and counts only, never the answers
  });
});
