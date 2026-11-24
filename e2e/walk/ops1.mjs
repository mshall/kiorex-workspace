import { chromium, open, shot, sanity, axe, URLS } from './lib.mjs';
import { opsSignIn } from './ops.mjs';
import { writeFileSync } from 'node:fs';
import { problems } from './common.mjs';
const browser = await chromium.launch(); const auth = await opsSignIn(browser, 'admin');
export async function opsCtx(browser, auth, c) {
  const o = await open(browser, { product: 'ops', ...c });
  await o.context.addInitScript(([k, v]) => { try { sessionStorage.setItem(k, v); } catch {} }, [auth.key, auth.value]);
  return o;
}
if (process.argv[1].endsWith('ops1.mjs')) {
  const codes = {};
  const { page, context } = await opsCtx(browser, auth, { lang: 'en', theme: 'light', width: 1440 });
  await page.goto(URLS.ops + '/partner-onboarding'); await page.waitForSelector('[data-testid=pob-enrolments]'); await page.waitForTimeout(800);
  for (const kind of (process.env.KINDS ?? 'PHARMACY,LAB').split(',')) {
    await page.selectOption('[data-testid=enrol-kind]', kind); await page.fill('[data-testid=enrol-label]', `Walk ${kind} ${Date.now() % 10000}`); await page.click('[data-testid=enrol-create]');
    await page.waitForSelector('[data-testid=enrol-code]'); codes[kind] = await page.locator('[data-testid=enrol-code]').innerText();
    if (kind === 'LAB') await shot(page, 'ops', 'en', 'light', 1440, '1-enrolment-code-shown-once');
    await page.getByRole('button', { name: /hide|إخفاء/i }).first().click().catch(() => {}); await page.waitForTimeout(300);
  }
  const { readFileSync, existsSync } = await import('node:fs'); const f = new URL('./codes.json', import.meta.url); const old = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {}; writeFileSync(f, JSON.stringify({ ...old, ...codes })); console.log(codes);
  await context.close();
}
await browser.close();
