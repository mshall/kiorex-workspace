// request-to-go-live walk for pharmacy B and lab B (one per product, real clicks)
import { chromium, open, state, shot, URLS } from './lib.mjs';
import { snapAll, FULL, STD, problems } from './common.mjs';
const S = state(); const browser = await chromium.launch(); const R = '[data-testid=kiorex-connect]';
const phTok = async (a) => (await (await fetch('http://localhost:3100/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: a.email, password: a.password }) })).json()).accessToken;
const cfg = { pharmacy: { auth: { 'kiorly.token': await phTok(S.pharmB) } }, lab: { auth: { 'kiorly.lab.token': S.labB.token } } };
for (const product of (process.argv[2] ? [process.argv[2]] : ['pharmacy', 'lab'])) {
  const { page, context, logs } = await open(browser, { product, auth: cfg[product].auth });
  await page.goto(URLS[product] + '/kiorex-connect'); await page.waitForSelector(R); await page.waitForTimeout(800);
  const steps = await page.$$eval('[data-testid^=connect-step-]', (e) => e.map((x) => x.getAttribute('data-testid').replace('connect-step-', '') + ':' + x.getAttribute('data-status')));
  console.log(product, steps.join(' '));
  const codes = JSON.parse((await import('node:fs')).readFileSync(new URL('./codes.json', import.meta.url), 'utf8'));
  const enr = page.locator('[data-testid=connect-enrolment-input]'); if (await enr.count()) { await enr.fill('wrong-code'); await page.waitForTimeout(200); }
  const btn = page.locator('[data-testid=connect-request]');
  console.log(product, 'request disabled:', await btn.isDisabled());
  
  if (await enr.count()) { await btn.click(); await page.waitForTimeout(2500); await shot(page, product, 'en', 'light', 1440, '3a-request-with-wrong-code'); console.log(product, 'wrong code ->', (await page.locator('[role=alert],[role=status],.text-destructive').allInnerTexts()).join(' | ').slice(0, 200)); await enr.fill(codes[product.toUpperCase()]); }
  await btn.click().catch((e) => console.log('click failed', String(e).slice(0, 100))); await page.waitForTimeout(3000);
  console.log(product, 'status after request:', await page.locator('[data-testid=connect-status]').innerText(), logs);
  await context.close();
  await snapAll(browser, { product, auth: cfg[product].auth, path: '/kiorex-connect', step: '3-requested-waiting-for-kiorex', ready: R, combos: FULL });
}
console.log(problems.join('\n') || 'no problems'); await browser.close();
