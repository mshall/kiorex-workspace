import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { URLS, here } from '../lib/hosts';
import { passportSignIn } from '../lib/passport';
import { PERSONAS } from '../lib/session';

/** CDO review: signs the demo patient in to the Passport account site (ONE phone code) and captures the redesigned pages (EN light, AR dark; 1440 and 390). Set KX_CDO_OUT. */
const OUT = process.env.KX_CDO_OUT;
test.skip(!OUT, 'KX_CDO_OUT not set');
test('passport account site screenshots', async ({ browser }) => {
  fs.mkdirSync(OUT!, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('kx-lang', 'en'); localStorage.setItem('kx-theme', 'light'); } catch { /* */ } });
  await page.goto(`${URLS.passport}/account`);
  await page.screenshot({ path: path.join(OUT!, 'signedout-d-en.png') });
  await page.getByRole('button', { name: /sign in/i }).first().click();
  await passportSignIn(page, { phone: PERSONAS.patient.phone, returnsToPassport: true });
  await page.waitForLoadState('networkidle');
  for (const [lang, theme, w, h, tag] of [['en', 'light', 1440, 900, 'd'], ['ar', 'dark', 1440, 900, 'd'], ['en', 'light', 390, 844, 'm'], ['ar', 'dark', 390, 844, 'm']] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(([l, t]) => { localStorage.setItem('kx-lang', l); localStorage.setItem('kx-theme', t); }, [lang, theme]);
    await page.emulateMedia({ colorScheme: theme });
    for (const [p, n] of [['/account', 'home'], ['/account/security', 'security'], ['/account/apps', 'apps']] as const) {
      await page.goto(`${URLS.passport}${p}`); await page.waitForLoadState('networkidle'); await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(OUT!, `${n}-${tag}-${lang}-${theme}.png`) });
    }
  }
  await ctx.close();
});
