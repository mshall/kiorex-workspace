import { chromium, state, URLS, saveAuth } from './lib.mjs';
import { snapAll, FULL, STD, problems } from './common.mjs';
const S = state(); const browser = await chromium.launch();
const R = '[data-testid=kiorex-connect]';
const phTok = async (a) => (await (await fetch('http://localhost:3100/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: a.email, password: a.password }) })).json()).accessToken;
const phA = { 'kiorly.token': await phTok(S.pharmA) }; const phB = { 'kiorly.token': await phTok(S.pharmB) };
const labA = { 'kiorly.lab.token': S.labA.token }; const labB = { 'kiorly.lab.token': S.labB.token };
for (const t of [phA, phB]) await fetch('http://localhost:3100/api/v1/onboarding/complete', { method: 'POST', headers: { authorization: 'Bearer ' + t['kiorly.token'] } });
const which = process.argv[2] ?? 'all';
if (which === 'all' || which === 'pharmacy') {
  await snapAll(browser, { product: 'pharmacy', auth: phA, path: '/kiorex-connect', step: '1-checklist-standalone', ready: R, combos: FULL });
  await snapAll(browser, { product: 'pharmacy', auth: phB, path: '/kiorex-connect', step: '2-ready-to-request', ready: R, combos: FULL });
}
if (which === 'all' || which === 'lab') {
  await snapAll(browser, { product: 'lab', auth: labA, path: '/kiorex-connect', step: '1-checklist-standalone', ready: R, combos: FULL });
  await snapAll(browser, { product: 'lab', auth: labB, path: '/kiorex-connect', step: '2-ready-to-request', ready: R, combos: FULL });
}
console.log(problems.join('\n') || 'no problems'); await browser.close();
