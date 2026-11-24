import { open, shot, sanity, axe, loadAuth, URLS } from './lib.mjs';
export const FULL = []; for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) FULL.push({ lang, theme, width });
export const STD = [{ lang: 'en', theme: 'light', width: 1440 }, { lang: 'ar', theme: 'light', width: 390 }, { lang: 'en', theme: 'dark', width: 768 }, { lang: 'ar', theme: 'dark', width: 1440 }];
export const problems = [];
export async function snapAll(browser, { product, authKey, auth, path, step, combos = STD, ready, after }) {
  for (const c of combos) {
    const { page, context, logs } = await open(browser, { product, ...c, auth: auth ?? loadAuth(authKey) });
    await page.goto(URLS[product] + path); if (ready) await page.waitForSelector(ready, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(700);
    if (after) await after(page);
    await shot(page, product, c.lang, c.theme, c.width, step);
    const probs = [...await sanity(page), ...(await axe(page)).map((a) => 'axe ' + a), ...logs.filter((l) => !/favicon/.test(l))];
    if (probs.length) problems.push(`[${product} ${c.lang} ${c.theme} ${c.width} ${step}] ` + probs.join(' || '));
    await context.close();
  }
}
