import { chromium, shot, URLS } from './lib.mjs';
import { opsSignIn } from './ops.mjs'; import { opsCtx } from './ops1.mjs';
const kind = process.argv[2] ?? 'pharmacy'; const nameMatch = { pharmacy: 'Walk Pharmacy b', lab: 'Walk Lab b', clinic: 'Walk Clinic b' }[kind];
const browser = await chromium.launch(); const adm = await opsSignIn(browser, 'admin');
for (const c of [{ lang: 'en', theme: 'light', width: 1440 }, { lang: 'ar', theme: 'dark', width: 390 }]) {
  const { page, context } = await opsCtx(browser, adm, c);
  await page.goto(URLS.ops + '/partner-onboarding'); await page.getByRole('link', { name: new RegExp(nameMatch) }).first().click(); await page.waitForSelector('[data-testid=rotation]'); await page.waitForTimeout(600);
  await shot(page, 'ops', c.lang, c.theme, c.width, `${kind}-7-rotation-pending`);
  if (c.width === 1440) { await page.locator('[data-testid=rotation] button').click(); await page.waitForTimeout(2500); console.log('rotation card after apply:', await page.locator('[data-testid=rotation]').count()); }
  await context.close();
}
await browser.close();
