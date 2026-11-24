import { chromium, open, state, shot, sanity, axe, loadAuth, URLS } from './lib.mjs';
const S = state(); const browser = await chromium.launch();
const { page, logs } = await open(browser, { product: 'clinic', auth: loadAuth('clinicA') });
await page.goto(URLS.clinic + '/kiorex/connect'); await page.waitForSelector('[data-testid=connect-steps]');
const n = await page.locator('[data-testid=connect-steps] a, [data-testid=connect-doctors] a').count();
for (let i = 0; i < n; i++) {
  await page.goto(URLS.clinic + '/kiorex/connect'); await page.waitForSelector('[data-testid=connect-steps]');
  const a = page.locator('[data-testid=connect-steps] a, [data-testid=connect-doctors] a').nth(i);
  const li = await a.evaluate((e) => (e.closest('[data-testid]')?.getAttribute('data-testid') ?? '') + ' ' + e.getAttribute('href'));
  await a.click(); await page.waitForTimeout(1500);
  console.log(li, '->', page.url().replace(URLS.clinic, ''), '|', (await page.locator('h1').first().innerText().catch(() => '(no h1)')).slice(0, 60));
  await shot(page, 'clinic', 'en', 'light', 1440, `deeplink-${i + 1}`);
}
// passport card link /team
console.log(logs.join('\n'));
await browser.close();
