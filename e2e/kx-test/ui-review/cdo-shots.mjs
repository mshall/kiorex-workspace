// CDO review helper: public-surface screenshots (no sign-in, no phone codes).
// usage: node cdo-shots.mjs <outdir> [label]   (outdir e.g. _private/ui-review/cdo/<surface>/before)
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const out = process.argv[2]; const tag = process.argv[3] ?? '';
const T = [
  ['kiorex-landing', 'https://test.kiorex.com/'], ['kiorex-signin', 'https://test.kiorex.com/signin'], ['kiorex-search', 'https://test.kiorex.com/search'],
  ['passport', 'https://passport.test.kiorex.com/'], ['kiorly-landing', 'https://test.kiorly.com/'], ['kiorly-home', 'https://app.test.kiorly.com/'],
  ['clinic-login', 'https://clinics.test.kiorly.com/login'], ['pharmacy-login', 'https://pharmacies.test.kiorly.com/login'], ['lab-login', 'https://labs.test.kiorly.com/login'],
  ['ops-login', 'https://admin.test.kiorex.com/'], ['kadmin-login', 'https://admin.test.kiorly.com/'],
];
const only = process.env.ONLY?.split(',');
const b = await chromium.launch();
for (const [name, url] of T) {
  if (only && !only.includes(name)) continue;
  for (const [w, h, tagw] of [[390, 844, 'm'], [1440, 900, 'd']]) for (const scheme of (process.env.SCHEMES ?? 'light,dark').split(',')) for (const lang of (process.env.LANGS ?? 'en,ar').split(',')) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, locale: lang === 'ar' ? 'ar-EG' : 'en-US', deviceScaleFactor: 1 });
    await ctx.addCookies([{ name: 'kx-lang', value: lang, url }]);
    await ctx.addInitScript((l) => { try { localStorage.setItem('kx-lang', l); localStorage.setItem('i18nextLng', l); localStorage.setItem('kx-theme', 'system'); } catch {} }, lang);
    const p = await ctx.newPage();
    try { await p.goto(url, { waitUntil: 'networkidle', timeout: 30000 }); } catch (e) { console.log('ERR', name, e.message.slice(0, 80)); }
    await p.waitForTimeout(1200);
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 700)); });
    const dir = path.join(out, name); fs.mkdirSync(dir, { recursive: true });
    await p.screenshot({ path: path.join(dir, `${tagw}-${lang}-${scheme}${tag}.png`), fullPage: tagw === 'd' });
    await ctx.close();
  }
  console.log('done', name);
}
await b.close();
