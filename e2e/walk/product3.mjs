import { chromium, open, state, shot, URLS } from './lib.mjs';
import { snapAll, FULL, STD, problems } from './common.mjs';
const S = state(); const browser = await chromium.launch(); const R = '[data-testid=kiorex-connect]';
const phTok = async (a) => (await (await fetch('http://localhost:3100/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: a.email, password: a.password }) })).json()).accessToken;
const cfg = { pharmacy: { auth: { 'kiorly.token': await phTok(S.pharmB) } }, lab: { auth: { 'kiorly.lab.token': S.labB.token } } };
const product = process.argv[2] ?? 'pharmacy'; const auth = cfg[product].auth;
await fetch(`http://localhost:${product === 'pharmacy' ? 3100 : 3200}/api/v1/kiorex-connect/refresh`, { method: 'POST', headers: { authorization: 'Bearer ' + Object.values(auth)[0] } });
await snapAll(browser, { product, auth, path: '/kiorex-connect', step: '4-live-passport-prompt', ready: R, combos: FULL });
{
  const { page, context, logs } = await open(browser, { product, auth });
  await page.goto(URLS[product] + '/kiorex-connect'); await page.waitForSelector(R); await page.waitForTimeout(800);
  console.log(product, 'status', await page.locator('[data-testid=connect-status]').innerText(), '| passport card', await page.getByText(/Passport/i).count());
  await page.click('[data-testid=connect-rotate]'); await page.waitForSelector('[data-testid=connect-secrets]'); await page.waitForTimeout(500);
  console.log('secrets shown:', (await page.locator('[data-testid=connect-secrets]').innerText()).replace(/\n/g, ' ').replace(/(?<=: |\s)[A-Za-z0-9_\-]{12,}/g, '<redacted>').slice(0, 160));
  await shot(page, product, 'en', 'light', 1440, '5-rotation-secrets-shown-once');
  await page.reload(); await page.waitForSelector(R); await page.waitForTimeout(800);
  console.log('after reload secrets present:', await page.locator('[data-testid=connect-secrets]').count(), logs.filter((l) => !/ERR_ABORTED/.test(l)));
  await context.close();
}
await snapAll(browser, { product, auth, path: '/kiorex-connect', step: '5-rotation-pending-after-reload', ready: R, combos: STD });
console.log(problems.join('\n') || 'no problems'); await browser.close();
