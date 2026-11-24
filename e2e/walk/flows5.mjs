import { chromium, open, state, shot, loadAuth, saveAuth, URLS } from './lib.mjs';
import { snapAll, STD, FULL, problems } from './common.mjs';
import { opsSignIn } from './ops.mjs'; import { opsCtx } from './ops1.mjs';
const S = state(); const browser = await chromium.launch(); const R = '[data-testid=kiorex-connect]';
const adm = await opsSignIn(browser, 'admin');
// auth for C
{ const { page, context } = await open(browser, { product: 'clinic' }); await page.goto(URLS.clinic + '/login'); await page.getByTestId('signin-method-password').click().catch(() => {});
  await page.fill('#email', S.clinicC.email); await page.fill('#password', S.clinicC.password); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForFunction(() => localStorage.getItem('cms-auth')?.includes('accessToken":"ey'), null, { timeout: 15000 }); saveAuth('clinicC', { 'cms-auth': await page.evaluate(() => localStorage.getItem('cms-auth')) }); await context.close(); }
{ const { page, context } = await open(browser, { product: 'clinic', auth: loadAuth('clinicC') }); await page.goto(URLS.clinic + '/kiorex/connect'); await page.waitForSelector('[data-testid=connect-steps]'); await page.waitForTimeout(800);
  if (await page.locator('[data-testid=connect-ack]').count()) { await page.check('[data-testid=connect-ack]'); await page.click('[data-testid=connect-accept]'); await page.waitForSelector('[data-testid=connect-consent-done]'); await page.waitForTimeout(500); }
  await page.fill('[data-testid=connect-enrolment-input]', JSON.parse((await import('node:fs')).readFileSync(new URL('./codes.json', import.meta.url), 'utf8')).CLINIC); await page.click('[data-testid=connect-request]'); await page.waitForTimeout(2500); console.log('C status', await page.locator('[data-testid=connect-status]').innerText()); await context.close(); }
const go = async (page, re) => { await page.goto(URLS.ops + '/partner-onboarding'); await page.getByRole('link', { name: re }).first().click(); await page.waitForSelector('[data-testid=pob-progress]'); await page.waitForTimeout(800); };
const reC = /Walk Clinic c|عيادة التجربة c/; const reB = /Walk Clinic b|عيادة التجربة b/;
async function opsAct(re, fn, shotStep) { const { page, context } = await opsCtx(browser, adm, { lang: 'en', theme: 'light', width: 1440 }); await go(page, re); await fn(page); if (shotStep) await shot(page, 'ops', 'en', 'light', 1440, shotStep); await context.close(); }
// request changes (reason required)
await opsAct(reC, async (p) => { console.log('changes disabled w/o reason:', await p.locator('[data-testid=act-changes]').isDisabled(), 'reject disabled:', await p.locator('[data-testid=act-reject]').isDisabled());
  await p.fill('[data-testid=decision-reason]', 'Please upload a clearer licence scan'); await p.click('[data-testid=act-changes]'); await p.waitForTimeout(1500); }, 'clinic-8-changes-requested');
await snapAll(browser, { product: 'clinic', authKey: 'clinicC', path: '/kiorex/connect', step: '7-changes-requested', ready: R, combos: STD });
await opsAct(reC, async (p) => { await p.fill('[data-testid=decision-reason]', 'Licence could not be verified'); await p.click('[data-testid=act-reject]'); await p.waitForTimeout(1500); }, 'clinic-9-rejected');
await snapAll(browser, { product: 'clinic', authKey: 'clinicC', path: '/kiorex/connect', step: '8-rejected', ready: R, combos: STD });
// ops pauses live B, then resumes
await opsAct(reB, async (p) => { const reason = p.getByPlaceholder(/reason/i).first(); await reason.fill('Quality review'); await p.getByRole('button', { name: /^Pause/ }).click(); await p.waitForTimeout(2500); console.log('B after ops pause:', await p.locator('header, h1').first().innerText().catch(() => '')); }, 'clinic-10-paused-by-ops');
await snapAll(browser, { product: 'clinic', authKey: 'clinicB', path: '/kiorex/connect', step: '9-paused-by-kiorex', ready: R, combos: STD });
await opsAct(reB, async (p) => { await p.click('[data-testid=act-resume]'); await p.waitForTimeout(2500); }, 'clinic-11-resumed');
console.log(problems.join('\n') || 'no problems'); await browser.close();
