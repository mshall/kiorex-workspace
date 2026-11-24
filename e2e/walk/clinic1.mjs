import { chromium, open, state, shot, sanity, axe, loadAuth, saveAuth, URLS } from './lib.mjs';
const S = state(); const browser = await chromium.launch();
const FULL = []; for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) FULL.push({ lang, theme, width });
const STD = [{ lang: 'en', theme: 'light', width: 1440 }, { lang: 'ar', theme: 'light', width: 390 }, { lang: 'en', theme: 'dark', width: 768 }, { lang: 'ar', theme: 'dark', width: 1440 }];
const problems = [];
const only = process.argv[2];
async function ensureAuth(key, acct) {
  if (Object.keys(loadAuth(key)).length) return;
  const { page, context } = await open(browser, { product: 'clinic' });
  await page.goto(URLS.clinic + '/login'); await page.getByTestId('signin-method-password').click().catch(() => {});
  await page.fill('#email', acct.email); await page.fill('#password', acct.password); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForFunction(() => localStorage.getItem('cms-auth')?.includes('accessToken":"ey'), null, { timeout: 15000 });
  saveAuth(key, { 'cms-auth': await page.evaluate(() => localStorage.getItem('cms-auth')) }); await context.close();
}
await ensureAuth('clinicA', S.clinicA); await ensureAuth('clinicB', S.clinicB);
async function matrix(product, key, step, path, combos, after) {
  for (const c of combos) {
    const { page, context, logs } = await open(browser, { product, ...c, auth: loadAuth(key) });
    await page.goto(URLS[product] + path); await page.waitForSelector('[data-testid=kiorex-connect]', { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(800);
    if (after) await after(page);
    await shot(page, product, c.lang, c.theme, c.width, step);
    const probs = [...await sanity(page), ...(await axe(page)).map((a) => 'axe ' + a), ...logs.filter((l) => !/favicon/.test(l))];
    if (probs.length) problems.push(`[${product} ${c.lang} ${c.theme} ${c.width} ${step}] ` + probs.join(' || '));
    await context.close();
  }
}
await matrix('clinic', 'clinicA', '1-checklist-standalone', '/kiorex/connect', FULL);
console.log(problems.join('\n') || 'no problems');
await browser.close();
