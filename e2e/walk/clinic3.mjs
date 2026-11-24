import { chromium, open, state, shot, loadAuth, URLS } from './lib.mjs';
import { snapAll, STD, FULL, problems } from './common.mjs';
const S = state(); const browser = await chromium.launch();
const R = '[data-testid=kiorex-connect]';
// 1. no published fee schedule: mocked response, accept stays disabled
{
  const { page, context } = await open(browser, { product: 'clinic', auth: loadAuth('clinicB') });
  await page.route('**/api/v1/kiorex/connect?*', async (r) => { const j = await (await r.fetch()).json(); j.feeCard = null; await r.fulfill({ json: j }); });
  await page.goto(URLS.clinic + '/kiorex/connect'); await page.waitForSelector('[data-testid=connect-ack]');
  await page.check('[data-testid=connect-ack]');
  console.log('no-fee: text=', await page.locator('[data-testid=connect-fee-text]').innerText(), '| accept disabled=', await page.locator('[data-testid=connect-accept]').isDisabled());
  await shot(page, 'clinic', 'en', 'light', 1440, '2-consent-no-fee-schedule'); await context.close();
}
await snapAll(browser, { product: 'clinic', authKey: 'clinicB', path: '/kiorex/connect', step: '2-ready-before-consent', ready: R, combos: FULL });
// 2. consent
{
  const { page, context, logs } = await open(browser, { product: 'clinic', auth: loadAuth('clinicB') });
  await page.goto(URLS.clinic + '/kiorex/connect'); if (!(await page.locator('[data-testid=connect-ack]').count())) { await page.waitForSelector('[data-testid=connect-steps]'); await page.waitForTimeout(500); }
  if (await page.locator('[data-testid=connect-ack]').count()) {
  console.log('before ack: accept disabled=', await page.locator('[data-testid=connect-accept]').isDisabled(), '| request disabled=', await page.locator('[data-testid=connect-request]').isDisabled().catch(() => 'n/a'));
  await page.check('[data-testid=connect-ack]'); console.log('after ack disabled=', await page.locator('[data-testid=connect-accept]').isDisabled());
  await shot(page, 'clinic', 'en', 'light', 1440, '3-consent-ticked');
  await page.click('[data-testid=connect-accept]'); await page.waitForSelector('[data-testid=connect-consent-done]');
  console.log('consent done:', await page.locator('[data-testid=connect-consent-done]').innerText(), '| status', await page.locator('[data-testid=connect-status]').innerText()); }
  await page.waitForTimeout(600);
  console.log('request disabled=', await page.locator('[data-testid=connect-request]').isDisabled(), logs);
  await context.close();
}
await snapAll(browser, { product: 'clinic', authKey: 'clinicB', path: '/kiorex/connect', step: '3-consent-accepted-ready-to-request', ready: R, combos: FULL });
// 3. request
{
  const { page, context, logs } = await open(browser, { product: 'clinic', auth: loadAuth('clinicB') });
  await page.goto(URLS.clinic + '/kiorex/connect'); await page.waitForSelector('[data-testid=connect-request]');
  const enr = page.locator('[data-testid=connect-enrolment-input]'); if (await enr.count()) await enr.fill(JSON.parse((await import('node:fs')).readFileSync(new URL('./codes.json', import.meta.url), 'utf8')).CLINIC);
  await page.click('[data-testid=connect-request]'); await page.waitForTimeout(2500);
  console.log('after request status:', await page.locator('[data-testid=connect-status]').innerText(), await page.locator('[data-testid=connect-step-request]').getAttribute('data-status'), logs);
  await context.close();
}
await snapAll(browser, { product: 'clinic', authKey: 'clinicB', path: '/kiorex/connect', step: '4-requested-waiting-for-kiorex', ready: R, combos: FULL });
console.log(problems.join('\n') || 'no problems'); await browser.close();
