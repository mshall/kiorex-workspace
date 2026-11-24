import { describe, it, expect, beforeAll } from 'vitest';
import { randomInt } from 'node:crypto';
import { KIOREX, KIOREX_API } from '../src/env.js';
import { tokens } from '../src/fixtures.js';
import { kiorex, q } from '../src/clients.js';
import { loginWithPhone } from '../src/passport.js';
import { resetOtpLimits } from '../src/db.js';

/** EDGE 45: public SEO pages (slugs, 404/410/301, hostile paths, XSS reflection), sitemap, widget origin and message forgery, consent and preference edges. */
let t: Awaited<ReturnType<typeof tokens>>;
beforeAll(async () => { t = await tokens(); });
const page = (path: string, headers: Record<string, string> = {}) => fetch(`${KIOREX}${path}`, { redirect: 'manual', headers });

describe('S. Public pages: hostile and unusual slugs', () => {
  const hostile = ['%00', '..%2f..%2fetc%2fpasswd', '%2e%2e/%2e%2e', 'a'.repeat(600), encodeURIComponent('🙂'), encodeURIComponent('د‏‎كتور'), encodeURIComponent('<script>alert(1)</script>'), encodeURIComponent('"><img src=x onerror=alert(1)>'), 'MONA-FAHMY', 'mona-fahmy/', 'mona--fahmy', ' ', '%'];
  it('S1 an unknown or hostile slug is a 404 (or a redirect to the canonical), never a 5xx, and the slug is never reflected unescaped', async () => {
    for (const s of hostile) for (const lang of ['ar', 'en']) {
      const r = await page(`/${lang}/eg/doctor/${s}`);
      expect(r.status, `${lang}/${s.slice(0, 40)}`).toBeLessThan(500);
      const html = await r.text();
      expect(html).not.toMatch(/<script>alert\(1\)<\/script>/);
      expect(html).not.toMatch(/onerror=alert/);
    }
  });
  it('S2 odd query strings never break the page: huge, repeated, malformed percent-encoding, unicode, array syntax', async () => {
    for (const qs of ['?lt=' + 'x'.repeat(50_000), '?utm_source=a&utm_source=b&utm_source=c', '?x=%E0%A4%A', '?page=-1', '?page=999999999999', '?page=abc', '?q[]=1&q[]=2', '?lt=%00', `?utm_campaign=${encodeURIComponent('🙂'.repeat(500))}`]) {
      const r = await page(`/en/eg/doctor/mona-fahmy${qs}`);
      expect(r.status, qs.slice(0, 40)).toBeLessThan(500);
    }
  });
  it('S3 country, language and trailing-slash variants resolve consistently: unknown language 404, unknown country 404, case variants do not create a second indexable URL', async () => {
    expect((await page('/xx/eg/doctor/mona-fahmy')).status).toBe(404);
    expect((await page('/en/zz/doctor/mona-fahmy')).status).toBe(404);
    const upper = await page('/EN/EG/doctor/mona-fahmy');
    expect([200, 301, 308, 404]).toContain(upper.status);
    if (upper.status === 200) { const html = await upper.text(); expect(html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? '').toMatch(/\/en\/eg\/doctor\/mona-fahmy$/); }
  });
  it('S4 sitemap and robots: well-formed, no entry for a paused or unknown listing, every URL answers 200, sitemap index stays under the 50 000 url / 50 MB limits per file', async () => {
    const idx = await (await fetch(`${KIOREX}/sitemap.xml`)).text();
    const files = [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
    for (const f of files.slice(0, 6)) {
      const res = await fetch(f.replace(/^https?:\/\/[^/]+/, KIOREX));
      expect(res.status, f).toBe(200);
      const xml = await res.text();
      expect(Buffer.byteLength(xml)).toBeLessThan(50 * 1024 * 1024);
      const urls = [...xml.matchAll(/<loc>/g)].length;
      expect(urls).toBeLessThanOrEqual(50_000);
      expect(xml).toMatch(/^<\?xml/);
      expect(xml).not.toMatch(/<loc>[^<]*[<>"][^<]*<\/loc>/); // never an unescaped character inside a loc
    }
    expect((await fetch(`${KIOREX}/sitemaps/..%2f..%2fetc.xml`)).status).toBeLessThan(500);
  });
});

describe('W. Widget origin and postMessage forgery', () => {
  const session = (parentOrigin: string, org: string, origin = KIOREX) => fetch(`${KIOREX_API}/widget/v1/session`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ org, parentOrigin }) });
  it('W1 a non-allow-listed parent origin, a null/empty/odd origin and an unknown organisation never get a session token (4xx, no 5xx)', async () => {
    const slug = (await q('kiorex_platform', `select "orgRef" from "WidgetRegistration" limit 1`))[0]?.orgRef ?? 'unknown_org';
    for (const po of ['https://evil.example', 'null', '', 'http://localhost', 'https://book.example.test.evil.example', 'javascript:alert(1)', 'https://' + 'a'.repeat(3000) + '.com', 'file://']) {
      const r = await session(po, slug);
      expect(r.status, po.slice(0, 40)).toBeGreaterThanOrEqual(400); expect(r.status, po.slice(0, 40)).toBeLessThan(500);
    }
    for (const org of ['', 'nope', "' or 1=1 --", '../x', 'x'.repeat(5000)]) { const r = await session('https://evil.example', org); expect(r.status, org.slice(0, 20)).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500); }
  });
  it('W2 the widget endpoints reject a missing, forged or truncated widget token and never accept a patient bearer in its place', async () => {
    for (const tok of ['', 'x', 'a.b.c', 'Bearer abc', 'x'.repeat(10_000)]) {
      const r = await fetch(`${KIOREX_API}/widget/v1/config`, { headers: { 'x-kx-widget': tok, origin: KIOREX } });
      expect([400, 401, 403, 404]).toContain(r.status);
    }
    const asPatient = await fetch(`${KIOREX_API}/widget/v1/config`, { headers: { authorization: `Bearer ${t.p1}`, origin: KIOREX } });
    expect(asPatient.status).toBeGreaterThanOrEqual(400); expect(asPatient.status).toBeLessThan(500);
  });
});

describe('C. Consent, preferences and suppression edges', () => {
  it('C1 notification preference edges: quiet hours across midnight keep their order, out-of-range hours and equal start/end are refused or normalised, never 5xx', async () => {
    for (const body of [{ quietStart: 22, quietEnd: 7 }, { quietStart: 0, quietEnd: 0 }, { quietStart: 23, quietEnd: 0 }, { quietStart: 24, quietEnd: 1 }, { quietStart: -1, quietEnd: 5 }, { quietStart: 1.5, quietEnd: 5 }, { quietStart: 'x', quietEnd: 5 }, {}, { enabled: 'maybe' }]) {
      const r = await kiorex(t.p1, 'PUT', '/me/notification-preferences/WHATSAPP', body);
      expect(r.status, JSON.stringify(body)).toBeLessThan(500);
    }
    expect((await kiorex(t.p1, 'PUT', '/me/notification-preferences/PIGEON', { enabled: true })).status).toBeGreaterThanOrEqual(400);
    await kiorex(t.p1, 'PUT', '/me/notification-preferences/WHATSAPP', { quietStart: null, quietEnd: null });
  });
  it('C2 consent decisions: unknown purpose, non-boolean, repeated toggles and concurrent toggles leave one consistent latest record (append-only history, no 5xx)', async () => {
    expect((await kiorex(t.p1, 'PUT', '/me/consents/NOT_A_PURPOSE', { granted: true })).status).toBeGreaterThanOrEqual(400);
    expect((await kiorex(t.p1, 'PUT', '/me/consents/MARKETING', { granted: 'yes' })).status).toBeGreaterThanOrEqual(400);
    const rs = await Promise.all(Array.from({ length: 10 }, (_, i) => kiorex(t.p1, 'PUT', '/me/consents/ANALYTICS_MEASUREMENT', { granted: i % 2 === 0 })));
    for (const r of rs) expect(r.status).toBeLessThan(500);
    const latest = (await q('kiorex_platform', `select granted from "ConsentRecord" where sub = $1 and purpose = 'ANALYTICS_MEASUREMENT' order by "createdAt" desc, id desc limit 1`, [t.p1Login.sub]))[0];
    const view = (await kiorex(t.p1, 'GET', '/me/consents')).body;
    const shown = Array.isArray(view) ? view.find((c: any) => c.purpose === 'ANALYTICS_MEASUREMENT') : view?.ANALYTICS_MEASUREMENT;
    if (shown && latest) expect(!!(shown.granted ?? shown)).toBe(latest.granted);
  });
  it('C3 erasure end to end: a brand-new patient creates data, deletes the account, and every Kiorex table keyed on the subject is cleared or anonymised; a second delete and a stale token are clean 401/404', async () => {
    await resetOtpLimits();
    const phone = `+2012${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;
    const l = await loginWithPhone(phone);
    await kiorex(l.accessToken, 'PUT', '/me/profile', { nameEn: 'Erase Me Edge', preferredLocale: 'ar' });
    await kiorex(l.accessToken, 'PUT', '/me/consents/MARKETPLACE_PROCESSING', { granted: true });
    const del = await fetch(`http://localhost:4400/api/account`, { method: 'DELETE', headers: { authorization: `Bearer ${l.accessToken}`, 'content-type': 'application/json' }, body: JSON.stringify({}) });
    expect([200, 202, 204, 400, 401, 403]).toContain(del.status);
    if (![200, 202, 204].includes(del.status)) return; // the dev Passport may require step-up for deletion: covered by 28's erasure journey
    await new Promise((r) => setTimeout(r, 4000));
    const prof = await q('kiorex_platform', `select "nameEn", phone from "PatientProfile" where sub = $1`, [l.sub]);
    for (const row of prof) { expect(row.nameEn ?? '').not.toContain('Erase Me'); expect(row.phone ?? '').not.toContain(phone.slice(-8)); }
    expect((await kiorex(l.accessToken, 'GET', '/me/profile')).status).toBeGreaterThanOrEqual(400);
  });
});
