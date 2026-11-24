// ops detail walk: admin prepares the pharmacy B connection, super approves; stepper screenshots
import { chromium, shot, sanity, axe, URLS, state } from './lib.mjs';
import { opsSignIn } from './ops.mjs';
import { opsCtx } from './ops1.mjs';
import { FULL, STD, problems } from './common.mjs';
const kind = process.argv[2] ?? 'pharmacy'; const browser = await chromium.launch();
const adm = await opsSignIn(browser, 'admin'); const sup = await opsSignIn(browser, 'super');
const nameMatch = { pharmacy: 'Walk Pharmacy b', lab: 'Walk Lab b', clinic: 'Walk Clinic b' }[kind];
async function go(page) { await page.goto(URLS.ops + '/partner-onboarding'); await page.getByRole('link', { name: new RegExp(nameMatch) }).first().click(); await page.waitForSelector('[data-testid=pob-progress]'); await page.waitForTimeout(800); }
async function snaps(step, combos = STD, who = adm) {
  for (const c of combos) { const { page, context, logs } = await opsCtx(browser, who, c); await go(page); await shot(page, 'ops', c.lang, c.theme, c.width, `${kind}-${step}`);
    const probs = [...await sanity(page), ...(await axe(page)).map((a) => 'axe ' + a), ...logs.filter((l) => !/favicon|ERR_ABORTED/.test(l))]; if (probs.length) problems.push(`[ops ${c.lang} ${c.theme} ${c.width} ${kind}-${step}] ` + probs.join(' || ')); await context.close(); }
}
const info = async (page) => ({ status: (await page.locator('header, h1').first().innerText()).replace(/\n/g, ' ').slice(0, 80), steps: await page.$$eval('[data-testid^=step-]', (e) => e.map((x) => x.getAttribute('data-testid').slice(5) + ':' + x.getAttribute('data-state'))) });
// 1. run again + human steps
let { page, context, logs } = await opsCtx(browser, adm, { lang: 'en', theme: 'light', width: 1440 }); await go(page);
console.log('initial', JSON.stringify(await info(page)));
await page.click('[data-testid=act-rerun]'); await page.waitForTimeout(3500); console.log('after Run again', JSON.stringify(await info(page)));
console.log('human banner:', await page.locator('[data-testid=human-banner]').innerText().catch(() => 'none'), '| highlighted:', await page.locator('[data-testid=action-needed]').count());
await context.close();
await snaps('1-stepper-after-checks', FULL);
console.log(problems.join('\n') || 'no problems'); await browser.close();
