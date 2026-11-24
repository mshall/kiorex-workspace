import { chromium, shot, sanity, axe, URLS } from './lib.mjs';
import { opsSignIn } from './ops.mjs';
import { opsCtx } from './ops1.mjs';
import { FULL, problems } from './common.mjs';
const browser = await chromium.launch(); const auth = await opsSignIn(browser, 'admin');
for (const c of FULL) {
  const { page, context, logs } = await opsCtx(browser, auth, c);
  await page.goto(URLS.ops + '/partner-onboarding'); await page.waitForSelector('[data-testid=pob-enrolments]'); await page.waitForTimeout(1200);
  await shot(page, 'ops', c.lang, c.theme, c.width, '2-queue');
  const probs = [...await sanity(page), ...(await axe(page)).map((a) => 'axe ' + a), ...logs.filter((l) => !/favicon|ERR_ABORTED/.test(l))];
  if (probs.length) problems.push(`[ops ${c.lang} ${c.theme} ${c.width} queue] ` + probs.join(' || '));
  await context.close();
}
console.log(problems.join('\n') || 'no problems'); await browser.close();
