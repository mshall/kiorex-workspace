import { chromium, shot, sanity, axe, URLS } from './lib.mjs';
import { opsSignIn } from './ops.mjs';
import { opsCtx } from './ops1.mjs';
import { FULL, STD, problems } from './common.mjs';
const kind = process.argv[2] ?? 'pharmacy'; const browser = await chromium.launch();
const adm = await opsSignIn(browser, 'admin'); const sup = await opsSignIn(browser, 'super');
const nameMatch = { pharmacy: 'Walk Pharmacy b', lab: 'Walk Lab b', clinic: 'Walk Clinic b|عيادة التجربة b' }[kind];
async function go(page) { await page.goto(URLS.ops + '/partner-onboarding'); await page.getByRole('link', { name: new RegExp(nameMatch) }).first().click(); await page.waitForSelector('[data-testid=pob-progress]'); await page.waitForTimeout(800); }
async function snaps(step, combos, who) {
  for (const c of combos) { const { page, context, logs } = await opsCtx(browser, who, c); await go(page); await shot(page, 'ops', c.lang, c.theme, c.width, `${kind}-${step}`);
    const probs = [...await sanity(page), ...(await axe(page)).map((a) => 'axe ' + a), ...logs.filter((l) => !/favicon|ERR_ABORTED/.test(l))]; if (probs.length) problems.push(`[ops ${c.lang} ${c.theme} ${c.width} ${kind}-${step}] ` + probs.join(' || ')); await context.close(); }
}
const st = async (page) => (await page.$$eval('[data-testid^=step-]', (e) => e.map((x) => x.getAttribute('data-testid').slice(5) + ':' + x.getAttribute('data-state')))).join(' ');
const toast = async (page) => (await page.locator('[data-sonner-toast]').allInnerTexts()).join(' | ');
let page, context, logs;
if (!process.env.RESUME) {
({ page, context, logs } = await opsCtx(browser, adm, { lang: 'en', theme: 'light', width: 1440 })); await go(page);
await page.click('[data-testid=act-rerun]'); await page.waitForTimeout(3000);
console.log('go-live disabled early:', await page.locator('[data-testid=act-go-live]').isDisabled().catch(() => 'n/a (locked)'));
// human steps
const licence = page.locator('[data-testid=step-verify_licence]');
console.log('record verification disabled with empty ref:', await licence.getByRole('button').isDisabled());
await page.click('[data-testid=step-review_documents] button'); await page.waitForTimeout(1200);
await licence.locator('input').fill('LIC-WALK-1'); await licence.getByRole('button').click(); await page.waitForTimeout(1200);
await page.click('[data-testid=step-fees] button'); await page.waitForTimeout(1500);
console.log('after human steps:', await st(page));
await shot(page, 'ops', 'en', 'light', 1440, `${kind}-2-human-steps-done`);
console.log('approval step text:', (await page.locator('[data-testid=step-approval]').innerText()).replace(/\n/g, ' | '));
await page.click('[data-testid=act-request]'); await page.waitForTimeout(1500);
console.log('after request-approval:', await st(page), '| approve btn present for admin:', await page.locator('[data-testid=act-approve]').count(), '| two-person note:', await page.locator('[data-testid=two-person-note]').count());
await context.close();
}
await snaps('3-awaiting-approval-as-requester', STD, adm);
// super admin approves
({ page, context } = await opsCtx(browser, sup, { lang: 'en', theme: 'light', width: 1440 })); await go(page);
console.log('super sees approve:', await page.locator('[data-testid=act-approve]').count(), 'disabled:', await page.locator('[data-testid=act-approve]').isDisabled().catch(() => 'n/a'));
await shot(page, 'ops', 'en', 'light', 1440, `${kind}-4-awaiting-approval-as-approver`);
await page.click('[data-testid=act-approve]'); await page.waitForTimeout(1500); console.log('after approve:', await st(page));
await context.close();
await snaps('5-approved-ready-to-go-live', STD, adm);
({ page, context } = await opsCtx(browser, adm, { lang: 'en', theme: 'light', width: 1440 })); await go(page);
console.log('go live enabled:', !(await page.locator('[data-testid=act-go-live]').isDisabled()));
await page.click('[data-testid=act-go-live]'); await page.waitForTimeout(3500); console.log('after go live:', await st(page), '| progress', await page.locator('[data-testid=pob-progress]').innerText().then((s) => s.replace(/\n/g, ' ')));
await context.close();
await snaps('6-live', FULL, adm);
console.log(problems.join('\n') || 'no problems'); await browser.close();
