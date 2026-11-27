// Usage: KX_GOLIVE_OPS_PHONE=... KX_GOLIVE_SA_PHONE=... node capture-kiorex.mjs [before|ops|super]
// Captures the Kiorex ops console go-live screens from the PRIVATE stack (scripts/golive-stack.sh up + the three Vite servers). Sample evidence values only.
import { browser, newCtx, passportSignIn, shot, OPS, PATIENT, API } from './lib.mjs';
const need = (n) => { if (!process.env[n]) throw new Error(`set ${n} (local seed value from _private/DEMO_ACCOUNTS.md; never commit it)`); return process.env[n]; };
const b = await browser();
const toEnglish = async (p) => { const el = p.locator('text=/^English$/').first(); if (await el.count()) { await el.click(); await p.waitForTimeout(1200); } const rej = p.locator('button:has-text("رفض"), button:has-text("Reject")'); if (await rej.count()) { await rej.first().click(); await p.waitForTimeout(500); } };
async function patient(tag) {
  const c = await newCtx(b, 1366, 820); const p = await c.newPage();
  await p.goto(PATIENT + '/'); await p.waitForTimeout(2200); await toEnglish(p);
  await shot(p, `pat-${tag}-1-home`, { wait: 1200 });
  await p.goto(PATIENT + '/search'); await p.waitForTimeout(2500); await toEnglish(p);
  await shot(p, `pat-${tag}-2-search`, { wait: 1200 });
  await c.close();
}
async function gotoFlag(p) { await p.goto(OPS + '/flags'); await p.waitForSelector('#f-q'); await p.fill('#f-q', 'market.eg.live'); await p.waitForTimeout(700); }
const sections = process.argv.slice(2);
const want = (s) => !sections.length || sections.includes(s);

if (want('before')) { console.log('API markets before:', await (await fetch(API + '/markets')).text()); await patient('before'); }

if (want('ops')) {
  const c = await newCtx(b); const p = await c.newPage();
  await p.goto(OPS + '/'); await p.waitForTimeout(1500);
  await shot(p, 'ops-00-passport-landing');
  await passportSignIn(p, need('KX_GOLIVE_OPS_PHONE'), 'ops');
  await p.waitForSelector('#f-q', { timeout: 20000 });
  await shot(p, 'ops-05-flags-landing');
  await gotoFlag(p); await shot(p, 'ops-06-flag-row');
  await p.click('[data-testid=tab-gates]'); await p.waitForTimeout(800); await shot(p, 'ops-07-gates-tab');
  await p.click('[data-testid=tab-audit]'); await p.waitForTimeout(800); await shot(p, 'ops-08-audit-tab');
  await c.close();
}

if (want('super')) {
  const c = await newCtx(b); const p = await c.newPage();
  await p.goto(OPS + '/'); await p.waitForTimeout(1500);
  await passportSignIn(p, need('KX_GOLIVE_SA_PHONE'), 'sa');
  await p.waitForSelector('#f-q', { timeout: 20000 });
  await gotoFlag(p); await shot(p, 'sa-05-flag-row-before');
  await p.click('[data-testid="gate-market.eg.live"]'); await p.waitForSelector('[data-testid=gate-dialog]'); await shot(p, 'sa-06-gate-dialog-empty');
  await p.fill('#g-id', 'EG-GATE-SAMPLE-001'); await p.fill('#g-ap', 'Sample Approver (test stack)'); await p.fill('#g-on', '2026-11-28'); await p.fill('#g-doc', 'https://example.com/sample-evidence/eg-market-pack.pdf');
  await shot(p, 'sa-07-gate-dialog-filled');
  await p.click('[data-testid=gate-submit]'); await p.waitForTimeout(500); await shot(p, 'sa-08-recorded-toast', { wait: 200 });
  await p.waitForTimeout(2500); await gotoFlag(p); await shot(p, 'sa-09-flag-row-after');
  await p.click('[data-testid=tab-audit]'); await p.waitForTimeout(900); await shot(p, 'sa-10-audit-after');
  await p.click('[data-testid=tab-propagation]'); await p.waitForTimeout(900); await shot(p, 'sa-11-propagation');
  console.log('API markets after:', await (await fetch(API + '/markets')).text());
  await patient('after');
  // toggle dialog (market scope OFF) shown, not applied
  await gotoFlag(p); await p.click('[data-testid="toggle-market.eg.live"], button:has-text("Toggle") >> nth=0'); await p.waitForSelector('[data-testid=toggle-dialog]');
  await shot(p, 'sa-12-toggle-dialog');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  // revoke
  await p.click('[data-testid="gate-market.eg.live"]'); await p.waitForSelector('[data-testid=gate-dialog]'); await shot(p, 'sa-13-revoke-dialog');
  await p.click('button:has-text("Revoke")'); await p.waitForTimeout(2500); await gotoFlag(p); await shot(p, 'sa-14-flag-row-revoked');
  await patient('revoked');
  await c.close();
}
await b.close();
