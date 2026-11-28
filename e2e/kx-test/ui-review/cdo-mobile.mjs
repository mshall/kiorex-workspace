import { chromium } from '@playwright/test';
const out = process.argv[2];
const b = await chromium.launch();
for (const [name, port] of [['kiorex-app', 8671], ['kiorly-app', 8672]]) for (const lang of ['en', 'ar']) for (const scheme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, locale: lang === 'ar' ? 'ar-EG' : 'en-US' });
  await ctx.addInitScript(([l, s]) => { try { localStorage.setItem('kx-lang', l); localStorage.setItem('kiorly.lang', l); localStorage.setItem('kx-theme', s); } catch {} }, [lang, scheme]);
  const p = await ctx.newPage(); const errs = []; p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 120))); p.on('pageerror', (e) => errs.push('pageerror ' + e.message.slice(0, 120)));
  await p.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' }).catch(() => {}); await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/${name}-${lang}-${scheme}.png` });
  console.log(name, lang, scheme, p.url().replace(/^http:\/\/127.0.0.1:\d+/, ''), errs.slice(0, 2).join(' | '));
  await ctx.close();
}
await b.close();
