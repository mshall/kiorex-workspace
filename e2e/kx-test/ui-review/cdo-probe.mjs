// CDO review: console errors (CSP, 4xx/5xx), overflow, fonts, h1, tap targets on public pages.
import { chromium } from '@playwright/test';
const T = process.env.URLS ? process.env.URLS.split(',') : ['https://test.kiorex.com/','https://test.kiorex.com/signin','https://test.kiorex.com/search','https://passport.test.kiorex.com/','https://test.kiorly.com/','https://app.test.kiorly.com/','https://clinics.test.kiorly.com/login','https://clinics.test.kiorly.com/pricing','https://pharmacies.test.kiorly.com/login','https://labs.test.kiorly.com/login','https://admin.test.kiorex.com/','https://admin.test.kiorly.com/'];
const b = await chromium.launch();
for (const url of T) for (const w of [360, 1440]) {
  const p = await b.newPage({ viewport: { width: w, height: 800 } }); const errs = new Set();
  p.on('console', (m) => m.type() === 'error' && errs.add(m.text().slice(0, 110)));
  p.on('response', (r) => r.status() >= 400 && errs.add(`HTTP ${r.status()} ${new URL(r.url()).pathname}`));
  try { await p.goto(url, { waitUntil: 'networkidle', timeout: 30000 }); await p.waitForTimeout(800); } catch (e) { errs.add('NAV ' + e.message.slice(0, 60)); }
  const m = await p.evaluate(() => ({ t: document.title, h1: document.querySelectorAll('h1').length, ov: document.documentElement.scrollWidth - innerWidth, f: getComputedStyle(document.body).fontFamily.split(',')[0], small: [...document.querySelectorAll('a,button,input,select')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height && (r.height < 24 || r.width < 24) && getComputedStyle(e).visibility !== 'hidden' && e.type !== 'hidden' && !e.classList.contains('sr-only'); }).length }));
  console.log(w, url.replace('https://', ''), JSON.stringify(m), [...errs].slice(0, 4).join(' | '));
  await p.close();
}
await b.close();
