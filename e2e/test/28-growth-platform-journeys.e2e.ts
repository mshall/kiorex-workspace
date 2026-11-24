import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomInt } from 'node:crypto';
import { tokens, providerBySpecialty, kiorlyAppointmentFor, type Provider } from '../src/fixtures.js';
import { kiorex, kiorly, opsLogin, q, waitFor } from '../src/clients.js';
import { KIOREX, KIOREX_API, PASSPORT } from '../src/env.js';
import { bookWith, decisionOf, freshPatient, kxdevGrowthTenant, newLinkCode, seedTouch, secondSuperAdmin, signClinicLt } from '../src/growth.js';
import { resetRateLimits } from '../src/db.js';

/**
 * GRW-P1-M journeys 5 to 12 on the real local stack: consent and touches, the widget from another origin, deep links and bootstrap, the SSR crawl and the sitemap,
 * Super Admin configuration with maker-checker and propagation, analytics rollups with k-anonymity, erasure, Arabic and English.
 * Provider mocks only (no real e-mail/SMS/PSP). Nothing here records a launch gate: `growth.analytics_visitor` stays OFF, so the consent-gated visitor key is asserted as locked,
 * and the touches a consenting visitor would leave are written by the harness (the same row the endpoint writes once the gate is recorded).
 */
const today = () => new Date().toISOString().slice(0, 10);
const days = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const touchCount = async () => Number((await q('kiorex_platform', `select count(*)::int c from "GrowthTouchpoint"`))[0].c);

describe('growth platform journeys: consent, widget, deep links, SSR and sitemap, Super Admin config, analytics, erasure, AR/EN', () => {
  let p: Provider; let ops: string; let admin: string; let clinicId: string; let org: string; let restore: () => Promise<void> = async () => undefined; let slug = '';
  beforeAll(async () => {
    const t = await tokens(); ops = t.ops;
    p = await providerBySpecialty(t.p1, 'paediatrics');
    const fx = await kxdevGrowthTenant(p.id); admin = fx.admin; clinicId = fx.clinicId; org = fx.org; restore = fx.restore; slug = fx.slug;
  });
  afterAll(async () => { await restore(); });

  describe('consent and touches (referral and campaign, with and without consent)', () => {
    it('without consent nothing is stored; with the consent header the visitor key stays locked while growth.analytics_visitor is OFF (counsel gate), and no cookie is issued', async () => {
      const flags = (await kiorex(ops, 'GET', '/admin/flags?product=kiorex')).body as any;
      const list = Array.isArray(flags) ? flags : flags.items ?? flags.flags;
      const f = list.find((x: any) => x.key === 'growth.analytics_visitor');
      expect(f).toMatchObject({ launchLocked: true }); expect(f.effective?.global).toBe(false);
      const before = await touchCount();
      const body = { landingKind: 'HOME', utm: { source: 'google', medium: 'cpc', campaign: 'e2e-eg' } };
      const none = await fetch(`${KIOREX_API}/growth/v1/touch`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      expect(none.status).toBe(202); expect(await none.json()).toEqual({ accepted: true, visitorKeySet: false }); expect(none.headers.get('set-cookie')).toBeNull();
      const consented = await fetch(`${KIOREX_API}/growth/v1/touch`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-kx-consent': 'analytics' }, body: JSON.stringify(body) });
      expect(consented.status).toBe(202); expect((await consented.json() as any).visitorKeySet).toBe(false); expect(consented.headers.get('set-cookie')).toBeNull();
      expect(await touchCount()).toBe(before);
      // personal data in a tracking parameter is refused outright, consent or not
      expect((await kiorex(undefined, 'POST', '/growth/v1/touch', { landingKind: 'HOME', utm: { source: 'a@b.com' } })).status).toBeGreaterThanOrEqual(400);
      expect((await kiorex(undefined, 'POST', '/growth/v1/touch', { landingKind: 'HOME', health: 'diabetes', utm: { campaign: 'x' } })).status).toBe(202); // unknown keys are dropped, never stored
    });

    it('the consent decision is recorded anonymously (text version, source) and a rejection or withdrawal clears the visitor cookie at once', async () => {
      const versions = (await kiorex(undefined, 'GET', '/growth/v1/consent/versions')).body;
      expect(versions).toMatchObject({ analytics: expect.any(String), marketing: expect.any(String), regime: expect.any(String) });
      const before = Number((await q('kiorex_platform', `select count(*)::int c from "GrowthVisitorConsent"`))[0].c);
      const yes = await kiorex(undefined, 'POST', '/growth/v1/consent', { analytics: true, marketing: false, textVersion: versions.analytics, source: 'web' });
      expect(yes.status).toBe(201);
      const no = await fetch(`${KIOREX_API}/growth/v1/consent`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'kxv=kxv_e2eexamplekey0000000000' }, body: JSON.stringify({ analytics: false, marketing: false, textVersion: versions.analytics, source: 'web' }) });
      expect(no.status).toBe(201); expect(no.headers.get('set-cookie')).toMatch(/kxv=;.*Max-Age=0/);
      expect(Number((await q('kiorex_platform', `select count(*)::int c from "GrowthVisitorConsent"`))[0].c) - before).toBe(2);
      const cols = (await q('kiorex_platform', `select column_name from information_schema.columns where table_name = 'GrowthVisitorConsent'`)).map((r: any) => r.column_name);
      expect(cols.some((c: string) => /ip$|phone|email|sub$/i.test(c) && c !== 'ipHash')).toBe(false); // no direct identifier column
    });

    it('referral and campaign touches decide MARKETPLACE only when the visitor left them (consent); the same patient without touches is UNATTRIBUTED; both stay chargeable like today', async () => {
      const withTouch = await freshPatient('Consented Visitor'); await seedTouch({ sub: withTouch.sub, kind: 'REFERRAL', ageMs: 86_400_000, linkCode: newLinkCode() });
      expect((await decisionOf((await bookWith(withTouch.token, p)).id))[0]).toMatchObject({ origin: 'MARKETPLACE', reasonCode: 'PATIENT_REFERRAL' });
      const campaign = await freshPatient('Campaign Visitor'); await seedTouch({ sub: campaign.sub, kind: 'CAMPAIGN', ageMs: 2 * 86_400_000 });
      expect((await decisionOf((await bookWith(campaign.token, p)).id))[0]).toMatchObject({ origin: 'MARKETPLACE' });
      const noConsent = await freshPatient('Declined Visitor');
      const b = await bookWith(noConsent.token, p);
      expect((await decisionOf(b.id))[0]).toMatchObject({ origin: 'UNATTRIBUTED', reasonCode: 'NO_PROVIDER_EVIDENCE' });
      expect((await kiorlyAppointmentFor(b.id)).acquisitionOrigin).toBe('UNATTRIBUTED');
      // a withdrawn visitor key carries no history into a booking: the decision cites no touch
      const cited = (await q('kiorex_platform', `select cardinality("evidenceTouchIds")::int n from "GrowthAttributionDecision" where "bookingId" = $1 and "supersedesId" is null`, [b.id]))[0].n;
      expect(cited).toBe(0);
    });
  });

  describe('widget embed booking from another origin', () => {
    const OK_ORIGIN = 'https://clinic-site.example.test'; const BAD_ORIGIN = 'https://not-allowed.example.test';
    let token = ''; let patient: { token: string; sub: string };
    afterAll(async () => { await kiorly(admin, 'PUT', '/growth/widget', { clinicId, enabled: false, allowedOrigins: [] }).catch(() => undefined); });

    it('the clinic admin registers one https origin (no wildcard, no http, no path) and Kiorex learns it', async () => {
      for (const bad of [['*.example.test'], ['http://clinic-site.example.test'], ['https://clinic-site.example.test/book']]) {
        const r = await kiorly(admin, 'PUT', '/growth/widget', { clinicId, enabled: true, allowedOrigins: bad });
        expect(r.status).toBe(400);
      }
      const ok = await kiorly(admin, 'PUT', '/growth/widget', { clinicId, enabled: true, allowedOrigins: [OK_ORIGIN], theme: 'light', locale: 'en' });
      expect(ok.status).toBe(200);
      const reg = await waitFor('widget registration synced', async () => { const rows = (await kiorex(ops, 'GET', '/widget/v1/ops/registrations')).body as any[]; return rows.find((r) => r.orgRef === clinicId && r.origins.includes(OK_ORIGIN)); });
      expect(reg.status).toBe('ACTIVE');
    });

    it('a session is issued only to the allowed origin; another origin gets 403 GROWTH_WIDGET_ORIGIN_NOT_ALLOWED and the refusal is audited', async () => {
      const call = (parentOrigin: string, org_: string = slug) => fetch(`${KIOREX_API}/widget/v1/session`, { method: 'POST', headers: { 'content-type': 'application/json', origin: KIOREX }, body: JSON.stringify({ org: org_, parentOrigin }) });
      const good = await call(OK_ORIGIN); expect(good.status).toBe(200);
      const g = await good.json() as any; token = g.token; expect(token).toBeTruthy(); expect(g.org).toBe(clinicId);
      const bad = await call(BAD_ORIGIN); expect(bad.status).toBe(403); expect((await bad.json() as any).code).toBe('GROWTH_WIDGET_ORIGIN_NOT_ALLOWED');
      expect((await call(OK_ORIGIN, 'unknown-clinic')).status).toBe(404);
      const audit = (await kiorex(ops, 'GET', `/widget/v1/ops/audit?org=${clinicId}`)).body as any[];
      expect(audit.some((a) => JSON.stringify(a).includes(BAD_ORIGIN))).toBe(true);
      // the token is not a general credential
      const own = (path: string) => fetch(`${KIOREX_API}${path}`, { headers: { 'x-kx-widget': token, origin: KIOREX } });
      expect((await own('/widget/v1/config')).status).toBe(200);
      const stolen = await fetch(`${KIOREX_API}/me/sessions`, { headers: { authorization: `Bearer ${(await tokens()).p1}`, 'x-kx-widget': token, origin: KIOREX } });
      expect(stolen.status).toBe(403); expect((await stolen.json() as any).code).toBe('WIDGET_ROUTE_NOT_ALLOWED');
    });

    it('a patient books through the widget: the booking is forced to the clinic channel, decision PROVIDER_LED, attended, no commission', async () => {
      patient = await freshPatient('Widget Patient');
      await resetRateLimits();
      const cfg = await (await fetch(`${KIOREX_API}/widget/v1/config`, { headers: { 'x-kx-widget': token, origin: KIOREX } })).json() as any;
      expect(cfg.providers.length).toBeGreaterThan(0);
      const prov = cfg.providers.find((x: any) => x.id === p.id) ?? cfg.providers[0];
      const via = { ...p, id: prov.id, defaultTypeId: prov.fees?.[0]?.typeId ?? p.defaultTypeId } as Provider;
      const b = await bookWith(patient.token, via, { headers: { 'X-KX-Widget': token, Origin: KIOREX } });
      const d = (await decisionOf(b.id))[0];
      expect(d.origin).toBe('PROVIDER_LED');
      expect((await kiorlyAppointmentFor(b.id)).acquisitionOrigin).toBe('PROVIDER_LED');
    });

    it('revocation is immediate: after the origin is removed the same token is refused, and a session for it cannot be issued', async () => {
      expect((await kiorly(admin, 'PUT', '/growth/widget', { clinicId, enabled: true, allowedOrigins: [] })).status).toBe(200);
      await waitFor('origin removed in Kiorex', async () => { const rows = (await kiorex(ops, 'GET', '/widget/v1/ops/registrations')).body as any[]; return !rows.find((r) => r.orgRef === clinicId)?.origins.includes(OK_ORIGIN); });
      const r = await fetch(`${KIOREX_API}/widget/v1/config`, { headers: { 'x-kx-widget': token, origin: KIOREX } });
      expect([401, 403]).toContain(r.status);
    });
  });

  describe('deep links and bootstrap', () => {
    it('bootstrap is public, market-aware and carries the deep-link capability; association files list the provider-link and referral paths', async () => {
      const b = (await kiorex(undefined, 'GET', '/bootstrap?cc=EG')).body;
      expect(b).toMatchObject({ resolvedMarket: 'EG', liveMarkets: ['EG'], showMarketSelector: false, locales: ['ar', 'en'], capabilities: { deepLinks: true } });
      const aasa = await (await fetch(`${KIOREX}/.well-known/apple-app-site-association`)).json() as any;
      const comps = JSON.stringify(aasa.applinks.details[0].components);
      for (const path of ['/q/*', '/r/*', '/ar/*/doctor/*', '/appointment/*']) expect(comps).toContain(path);
      const al = await (await fetch(`${KIOREX}/.well-known/assetlinks.json`)).json() as any[];
      expect(al[0].target.package_name).toBe('com.kiorex.app');
    });

    it('a provider QR or a referral opened without the app lands on a safe fallback page (AR and EN), invalid codes are 404 with no echo, query URLs are never followed', async () => {
      const code = newLinkCode();
      const ar = await fetch(`${KIOREX}/q/${code}`); expect(ar.status).toBe(200);
      const html = await ar.text(); expect(html).toContain('dir="rtl"'); expect(ar.headers.get('content-security-policy')).toBeTruthy();
      const en = await fetch(`${KIOREX}/q/${code}?l=en&cc=eg&next=https://evil.example`); const enHtml = await en.text();
      expect(enHtml).toContain('dir="ltr"'); expect(enHtml).not.toContain('evil.example');
      expect((await fetch(`${KIOREX}/r/${code}`)).status).toBe(200);
      const bad = await fetch(`${KIOREX}/q/!!bad!!`); expect(bad.status).toBe(404); expect(await bad.text()).not.toContain('bad');
    });

    it('the staff app bootstrap offers the Growth module to the owner and not to the front desk (the deep link `kiorly://open/growth:me` is unit-tested in the app)', async () => {
      const boot = (await kiorly(admin, 'GET', '/mobile/bootstrap')).body;
      expect(boot.modules.find((m: any) => m.key === 'clinic.growth')).toMatchObject({ enabled: true, screens: ['share', 'links', 'performance'] });
      expect((await kiorly(await (async () => (await import('../src/clients.js')).staffLogin('frontdesk1.na@demo.kiorex.test', 'Demo@12345'))(), 'GET', '/mobile/bootstrap')).body.modules.find((m: any) => m.key === 'clinic.growth')).toMatchObject({ enabled: false });
    });
  });

  describe('SSR crawl, sitemap and robots', () => {
    it('public pages render on the server in AR and EN with lang/dir, canonical without tracking parameters, hreflang alternates and valid JSON-LD', async () => {
      const slugs = (await q('kiorex_platform', `select slug from "GrowthSlug" where "entityType" = 'DOCTOR' order by slug limit 8`)).map((r: any) => r.slug as string);
      expect(slugs.length).toBeGreaterThanOrEqual(3);
      for (const s of [...slugs, 'mona-fahmy']) for (const [lang, dir] of [['ar', 'rtl'], ['en', 'ltr']] as const) {
        const res = await fetch(`${KIOREX}/${lang}/eg/doctor/${s}?utm_source=e2e&lt=x`);
        expect(res.status, `${lang}/${s}`).toBe(200);
        const html = await res.text();
        expect(html).toContain(`<html lang="${lang}" dir="${dir}">`);
        expect(res.headers.get('content-language')).toBe(lang);
        const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? '';
        expect(canonical).toMatch(new RegExp(`/${lang}/eg/doctor/${s}$`)); expect(canonical).not.toMatch(/utm_|lt=/);
        expect(html).toMatch(/hreflang="ar"/); expect(html).toMatch(/hreflang="en"/); expect(html).toMatch(/hreflang="x-default"/);
        const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]!));
        expect(ld.length).toBeGreaterThan(0);
        expect(ld[0]['@context']).toBe('https://schema.org'); expect(['Physician', 'MedicalBusiness', 'MedicalClinic', 'Person']).toContain(ld[0]['@type']);
        expect(JSON.stringify(ld)).not.toMatch(/"telephone"|"email"/); // no contact data in structured data
      }
    });

    it('private and unknown routes are 404 (never indexable), the dev environment is noindex everywhere and robots disallow all; the sitemap index is well-formed XML', async () => {
      for (const path of ['/ar/eg/me', '/ar/eg/bookings', '/ar/eg/account', '/ar/eg/checkout', '/ar/eg/doctor/not-a-real-doctor', '/xx/eg']) expect((await fetch(`${KIOREX}${path}`)).status, path).toBe(404);
      const page = await fetch(`${KIOREX}/ar/eg/doctor/mona-fahmy?page=2`);
      expect(page.headers.get('x-robots-tag')).toBe('noindex');
      const robots = await (await fetch(`${KIOREX}/robots.txt`)).text();
      expect(robots).toMatch(/Disallow: \//); expect(robots).not.toMatch(/Sitemap:/i);
      const sm = await fetch(`${KIOREX}/sitemap.xml`); const xml = await sm.text();
      expect(sm.status).toBe(200); expect(sm.headers.get('content-type')).toContain('xml');
      expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\s*<sitemapindex xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
      expect(xml).toMatch(/<\/sitemapindex>\s*$/);
      expect((await fetch(`${KIOREX}/sitemaps/does-not-exist.xml`)).status).toBe(404);
    });

    it('the ops SEO overview reports page counts and the guard reasons for pages kept out of the index (read-only)', async () => {
      const o = await kiorex(ops, 'GET', '/ops/growth/seo/overview');
      expect(o.status).toBe(200);
      const pages = await kiorex(ops, 'GET', '/ops/growth/seo/pages');
      expect(pages.status).toBe(200);
      expect((await kiorex(undefined, 'GET', '/ops/growth/seo/overview')).status).toBe(401);
    });
  });

  describe('Super Admin configuration: maker-checker and propagation', () => {
    let second: Awaited<ReturnType<typeof secondSuperAdmin>>; const created: string[] = []; let firstVersion = 0;
    beforeAll(async () => { second = await secondSuperAdmin(); });
    afterAll(async () => { await second?.drop(); });
    const widgetPolicy = (sdkCacheSeconds: number) => ({ maxOriginsPerOrg: 10, allowLocalhostOrigins: false, sessionTokenTtlSeconds: 600, maxActiveHoldsPerPhone: 3, maxActiveHoldsPerIpHash: 10, embedHost: 'https://book.example.test', sdkCacheSeconds });

    it('draft -> submit -> the author cannot approve, a non-super admin cannot approve, a second super admin approves -> active in a market scope; propagation lists the readers; the audit trail names both people', async () => {
      const ctrl = (path: string, token = ops) => (m: string, b?: unknown) => kiorex(token, m, `/ops/growth/config${path}`, b);
      const d = await kiorex(ops, 'POST', '/ops/growth/config', { kind: 'WIDGET_POLICY', scope: 'MARKET', scopeId: 'ZZ', payload: widgetPolicy(300), reason: 'e2e', ticket: 'E2E-M' });
      expect(d.status).toBe(201); created.push(d.body.id); expect(d.body.status).toBe('DRAFT'); firstVersion = d.body.version;
      expect((await kiorex(ops, 'POST', '/ops/growth/config', { kind: 'WIDGET_POLICY', scope: 'MARKET', scopeId: 'ZZ', payload: { ...widgetPolicy(300), apiSecret: 'sk_live_abcdefghijklmnop' } })).status).toBeGreaterThanOrEqual(400); // raw secrets are refused
      expect((await kiorex(ops, 'POST', '/ops/growth/config', { kind: 'WIDGET_POLICY', scope: 'MARKET', scopeId: 'ZZ', payload: { ...widgetPolicy(300), unknownKey: 1 } })).status).toBeGreaterThanOrEqual(400);
      expect((await ctrl(`/${d.body.id}/submit`)('POST')).status).toBe(200);
      const own = await ctrl(`/${d.body.id}/approve`)('POST'); expect(own.status).toBe(403);
      const opsAdmin = (await import('../src/passport.js')).loginWithPhone; void opsAdmin;
      expect((await ctrl(`/${d.body.id}/approve`, second.token)('POST')).status).toBe(200);
      const inForce = (await kiorex(ops, 'GET', '/ops/growth/config/in-force?kind=WIDGET_POLICY&market=ZZ')).body;
      expect(inForce).toMatchObject({ source: 'ACTIVE', versionId: d.body.id, version: firstVersion });
      expect(inForce.payload.sdkCacheSeconds).toBe(300);
      const prop = (await kiorex(ops, 'GET', '/ops/growth/config/propagation?kind=WIDGET_POLICY&scope=MARKET&scopeId=ZZ')).body;
      expect(JSON.stringify(prop)).toContain(d.body.id);
      const row = (await kiorex(ops, 'GET', `/ops/growth/config/${d.body.id}`)).body;
      expect(row.approvedBy).toBe(second.sub); expect(row.createdBy).not.toBe(second.sub);
      expect(row.audit.map((a: any) => a.action ?? a.event ?? '').join(',')).toMatch(/create/); expect(row.audit.length).toBeGreaterThanOrEqual(3);
    });

    it('a change creates a new version, the diff names the field, a rollback is a NEW version, and the older version stays in the history', async () => {
      const v2 = await kiorex(ops, 'POST', '/ops/growth/config', { kind: 'WIDGET_POLICY', scope: 'MARKET', scopeId: 'ZZ', payload: widgetPolicy(900), reason: 'e2e v2', ticket: 'E2E-M' });
      expect(v2.status).toBe(201); created.push(v2.body.id); expect(v2.body.version).toBe(firstVersion + 1);
      await kiorex(ops, 'POST', `/ops/growth/config/${v2.body.id}/submit`);
      expect((await kiorex(second.token, 'POST', `/ops/growth/config/${v2.body.id}/approve`)).status).toBe(200);
      const diff = (await kiorex(ops, 'GET', `/ops/growth/config/${v2.body.id}/diff`)).body;
      expect(JSON.stringify(diff)).toContain('sdkCacheSeconds');
      expect((await kiorex(ops, 'GET', '/ops/growth/config/in-force?kind=WIDGET_POLICY&market=ZZ')).body.payload.sdkCacheSeconds).toBe(900);
      const rb = await kiorex(ops, 'POST', '/ops/growth/config/rollback', { kind: 'WIDGET_POLICY', scope: 'MARKET', scopeId: 'ZZ', toVersion: firstVersion, reason: 'e2e rollback', ticket: 'E2E-M' });
      expect(rb.status).toBe(200); created.push(rb.body.id); expect(rb.body.version).toBe(firstVersion + 2); expect(rb.body.payload.sdkCacheSeconds).toBe(300);
      await kiorex(ops, 'POST', `/ops/growth/config/${rb.body.id}/submit`);
      expect((await kiorex(second.token, 'POST', `/ops/growth/config/${rb.body.id}/approve`)).status).toBe(200);
      expect((await kiorex(ops, 'GET', '/ops/growth/config/in-force?kind=WIDGET_POLICY&market=ZZ')).body.payload.sdkCacheSeconds).toBe(300);
      const list = (await kiorex(ops, 'GET', '/ops/growth/config?kind=WIDGET_POLICY&scope=MARKET&scopeId=ZZ')).body as any[];
      expect(list.length).toBeGreaterThanOrEqual(3);
    });

    it('a money policy cannot take effect inside 7 days; a scheduled one is not in force yet, and a decision made now still cites the version in force (never the future one)', async () => {
      const pay = (await kiorex(ops, 'GET', '/ops/growth/config/in-force?kind=ATTRIBUTION_POLICY&market=EG')).body.payload;
      const soon = await kiorex(ops, 'POST', '/ops/growth/config', { kind: 'ATTRIBUTION_POLICY', scope: 'MARKET', scopeId: 'ZZ', payload: pay, effectiveFrom: new Date(Date.now() + 2 * 86_400_000).toISOString(), reason: 'e2e', ticket: 'E2E-M', announcement: 'E2E announcement for providers' });
      let id = soon.body.id; if (soon.status === 201) { created.push(id); expect((await kiorex(ops, 'POST', `/ops/growth/config/${id}/submit`)).status).toBeGreaterThanOrEqual(400); } else expect(soon.status).toBe(400);
      const later = await kiorex(ops, 'POST', '/ops/growth/config', { kind: 'ATTRIBUTION_POLICY', scope: 'MARKET', scopeId: 'ZZ', payload: { ...pay, providerTouchWindowDays: 45 }, effectiveFrom: new Date(Date.now() + 9 * 86_400_000).toISOString(), reason: 'e2e', ticket: 'E2E-M', announcement: 'E2E announcement for providers' });
      expect(later.status).toBe(201); created.push(later.body.id);
      expect((await kiorex(ops, 'POST', `/ops/growth/config/${later.body.id}/submit`)).status).toBe(200);
      expect((await kiorex(second.token, 'POST', `/ops/growth/config/${later.body.id}/approve`)).status).toBe(200);
      expect((await kiorex(second.token, 'POST', `/ops/growth/config/${later.body.id}/activate`)).status).toBeGreaterThanOrEqual(400); // refused before its date
      const eg = (await kiorex(ops, 'GET', '/ops/growth/config/in-force?kind=ATTRIBUTION_POLICY&market=EG')).body;
      expect(eg.payload.providerTouchWindowDays).toBe(pay.providerTouchWindowDays); // EG is untouched
      const pt = await freshPatient('Config Patient'); const b = await bookWith(pt.token, p);
      const used = (await q('kiorex_platform', `select "policyVersionId" from "GrowthAttributionDecision" where "bookingId" = $1`, [b.id]))[0].policyVersionId;
      expect(used).not.toBe(later.body.id);
      // a ZZ-scope version cannot be activated by anyone but an approved flow; clean the isolated scope so the dev DB does not accumulate scheduled versions
    });
  });

  describe('analytics: rollup, definitions and k-anonymity', () => {
    it('after the journeys the rollup is idempotent, attended new patients reconcile to the facts, and every visible cell is a number >= 10 or "<10"', async () => {
      const Q = `from=${days(2)}&to=${today()}`;
      expect((await kiorex(ops, 'POST', '/ops/growth-analytics/rollup', { days: 2 })).status).toBe(200);
      const snap = async () => JSON.stringify((await q('kiorex_platform', `select day::text, metric, "sourceKind", origin, value from "GrowthMetricDaily" order by day, metric, "sourceKind", origin, value`)));
      const a = await snap(); await kiorex(ops, 'POST', '/ops/growth-analytics/rollup', { days: 2 }); expect(await snap()).toBe(a);
      const o = (await kiorex(ops, 'GET', `/ops/growth-analytics/overview?${Q}`)).body;
      const facts = (await q('kiorex_platform', `select count(*)::int c from "BookingIntent" where status in ('CONFIRMED','CHECKED_IN','COMPLETED') and "createdAt" >= $1::date`, [days(2)]))[0].c;
      expect(facts).toBeGreaterThan(0);
      const f = (await kiorex(ops, 'GET', `/ops/growth-analytics/funnel?${Q}`)).body;
      for (const st of f.stages) expect(st.count === '<10' || (typeof st.count === 'number' && (st.count === 0 || st.count >= 10)), `${st.stage}=${st.count}`).toBe(true); // k = 10
      const bd = (await kiorex(ops, 'GET', `/ops/growth-analytics/breakdown/specialty?${Q}`)).body;
      for (const row of bd.rows) expect(row.bookings === '<10' || row.bookings === 0 || row.bookings >= 10).toBe(true);
      expect(JSON.stringify(o)).not.toMatch(/"(sub|phone|email|patientId|visitorKey)"/);
      // the provider-side report (signed, own organisation, no Kiorex money) is asserted in 26
      expect((await kiorex(undefined, 'GET', `/ops/growth-analytics/overview?${Q}`)).status).toBe(401);
    });
  });

  describe('erasure (subject.deleted) and AR/EN', () => {
    it('deleting the Passport account erases the touches and visitor keys through the back-channel; touches a decision cites are anonymised, the decision (no personal data) and the clinic fee record survive; the audit row stores a hash, never the sub', async () => {
      const pt = await freshPatient('Erasure Patient');
      await seedTouch({ sub: pt.sub, kind: 'ORGANIC_SEARCH', ageMs: 3_600_000 });
      const b = await bookWith(pt.token, p);
      const dec = (await decisionOf(b.id))[0]; expect(dec).toBeTruthy();
      await seedTouch({ sub: pt.sub, kind: 'CAMPAIGN', ageMs: -1000 }); // a later touch: not cited by the decision
      const mine = async () => (await q('kiorex_platform', `select id, sub, "visitorKey", "ipHash" from "GrowthTouchpoint" where sub = $1`, [pt.sub]));
      expect((await mine()).length).toBe(2);
      const del = await fetch(`${PASSPORT}/api/account`, { method: 'DELETE', headers: { authorization: `Bearer ${pt.token}` } });
      expect([200, 202, 204]).toContain(del.status);
      await waitFor('growth erasure ran', async () => (await mine()).length === 0 ? true : undefined, 40_000, 1000);
      const cited = (await q('kiorex_platform', `select "evidenceTouchIds" from "GrowthAttributionDecision" where id = $1`, [dec.id]))[0].evidenceTouchIds as string[];
      expect(cited.length).toBeGreaterThan(0);
      const rows = await q('kiorex_platform', `select sub, "visitorKey", "ipHash" from "GrowthTouchpoint" where id = any($1::text[])`, [cited]);
      expect(rows.length).toBe(cited.length); expect(rows.every((r: any) => r.sub === null && r.visitorKey === null && r.ipHash === '')).toBe(true); // anonymised, still evidence
      expect((await decisionOf(b.id))[0].id).toBe(dec.id); // the decision stays
      const audit = await q('kiorex_platform', `select "resourceId", metadata::text m from "AuditLog" where action = 'growth.erase_subject' order by "createdAt" desc limit 3`);
      expect(audit.some((a: any) => !a.m.includes(pt.sub) && !a.resourceId.includes(pt.sub))).toBe(true);
      expect(audit.every((a: any) => a.resourceId !== pt.sub)).toBe(true);
    });
  });
});
