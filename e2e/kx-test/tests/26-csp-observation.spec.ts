import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { URLS } from '../lib/hosts';
import { ensureSession, openAs, type PersonaName } from '../lib/session';

/**
 * F-CSP-1 (full pass 28 Nov 2026): every static site sends `Content-Security-Policy-Report-Only` (infra/tofu static_site, observation only). This spec visits the pages of every app, signed out and signed in,
 * and fails when the browser reports a violation of that policy (console message "[Report Only] Refused ..."). Zero violations across these pages is the gate for turning the header into an enforced
 * `Content-Security-Policy`. It uses saved sessions (no new phone code when they are fresh).
 */
const isCsp = (t: string) => /content security policy|\[report only\]/i.test(t);
const watch = (page: Page, sink: string[]) => { page.on('console', (m) => { if (isCsp(m.text())) sink.push(`${page.url()} :: ${m.text().slice(0, 220)}`); }); };

test.describe('CSP report-only: no violation on any app', () => {
  test('every static site sends the report-only policy and no enforced policy that would block it', async ({ request }) => {
    for (const [name, base] of [['patient web', URLS.patientWeb], ['ops', URLS.ops], ['Kiorly admin', URLS.opsKiorly], ['Kiorly Home', URLS.home], ['Pharmacy web', URLS.pharmacy], ['Lab web', URLS.lab], ['Kiorly site', URLS.site]] as const) {
      const r = await request.get(`${base}/`);
      expect(r.headers()['content-security-policy-report-only'] ?? '', `${name} report-only policy`).toContain("default-src 'self'");
      expect(r.headers()['content-security-policy-report-only'], name).toContain("frame-ancestors 'none'");
    }
  });

  test('signed out pages of every app', async ({ browser }) => {
    const sink: string[] = []; const ctx = await browser.newContext({ locale: 'en-US' });
    for (const url of [`${URLS.patientWeb}/`, `${URLS.patientWeb}/search`, `${URLS.patientWeb}/services`, `${URLS.patientWeb}/join`, `${URLS.ops}/`, `${URLS.opsKiorly}/`, `${URLS.home}/signin`, `${URLS.pharmacy}/login`, `${URLS.lab}/login`, `${URLS.site}/en/`, `${URLS.site}/ar/`, `${URLS.passport}/account/`]) {
      const p = await ctx.newPage(); watch(p, sink); await p.goto(url).catch(() => undefined); await p.waitForLoadState('networkidle').catch(() => undefined); await p.waitForTimeout(500); await p.close();
    }
    await ctx.close(); expect(sink, sink.join('\n')).toEqual([]);
  });

  for (const [persona, paths] of [
    ['patient', ['/', '/search', '/appointments', '/account', '/records', '/preferences']],
    ['ops', ['/home', '/providers', '/finance', '/leads']],
    ['pharmacyCashier', ['/', '/customers', '/catalogue', '/inventory']],
    ['labTech', ['/', '/orders', '/worklist']],
  ] as [PersonaName, string[]][]) {
    test(`signed in as ${persona}`, async ({ browser }) => {
      await ensureSession(browser, persona); const o = await openAs(browser, persona); const sink: string[] = []; watch(o.page, sink);
      const base = ({ patient: URLS.patientWeb, ops: URLS.ops, pharmacyCashier: URLS.pharmacy, labTech: URLS.lab } as Record<string, string>)[persona]!;
      for (const p of paths) { await o.page.goto(`${base}${p}`).catch(() => undefined); await o.page.waitForLoadState('networkidle').catch(() => undefined); await o.page.waitForTimeout(400); }
      await (o.context as BrowserContext).close(); expect(sink, sink.join('\n')).toEqual([]);
    });
  }
});
