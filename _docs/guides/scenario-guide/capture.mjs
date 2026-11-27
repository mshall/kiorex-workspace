// Captures for the scenario test guide from the PRIVATE go-live stack only (scripts/golive-stack.sh up; ops Vite :4960, patient Vite :4961, API :4953, Passport :4950).
// Local seed values only; nothing secret is printed or written. The market gate is recorded on the PRIVATE stack with sample evidence (never on a shared environment).
// Usage: node capture.mjs <out-dir> [ops|patient|all]
import { browser, newCtx, passportSignIn, OPS, PATIENT } from '../golive/lib.mjs';
const OUT = process.argv[2]; const which = process.argv[3] || 'all';
const b = await browser();
const shot = async (p, name, wait = 900, full = false) => { await p.waitForTimeout(wait); await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); console.log('shot', name); };
const tryDo = async (name, fn) => { try { await fn(); } catch (e) { console.log('FAIL', name, String(e.message).split('\n')[0]); } };
const lang = async (p) => { const el = p.locator('text=/^English$/').first(); if (await el.count()) { await el.click(); await p.waitForTimeout(1000); } };
if (which === 'ops' || which === 'all') {
  const c = await newCtx(b, 1366, 860); const p = await c.newPage();
  await p.goto(OPS + '/'); await p.waitForTimeout(1500);
  await passportSignIn(p, '+201000000099');
  await p.waitForTimeout(2500); await lang(p);
  await tryDo('flags-gate', async () => {
    await p.goto(OPS + '/flags'); await p.waitForSelector('#f-q'); await p.fill('#f-q', 'market.eg.live'); await p.waitForTimeout(700);
    await p.click('[data-testid="gate-market.eg.live"]'); await p.waitForSelector('[data-testid=gate-dialog]');
    await p.fill('#g-id', 'EG-GATE-SAMPLE-001'); await p.fill('#g-ap', 'Sample Approver (private stack)'); await p.fill('#g-on', '2026-11-28'); await p.fill('#g-doc', 'https://example.com/sample-evidence/eg-market-pack.pdf');
    await p.click('[data-testid=gate-submit]'); await p.waitForTimeout(2500);
  });
  const pages = [['providers','/providers'],['bookings','/bookings'],['finance','/finance'],['fees','/fees'],['orders','/orders'],['messaging','/messaging'],['outbox','/outbox'],['reconciliation','/reconciliation'],['commission-policy','/commission-policy'],['partner-onboarding','/partner-onboarding'],['safety','/safety'],['held-deposits','/held-deposits'],['integrations','/integrations'],['payments-connection','/payments-connection'],['pay-ops','/pay-ops'],['leads','/leads'],['leads-settings','/leads/settings'],['kiorly-markets','/kiorly-markets'],['onboarding','/onboarding']];
  for (const [n, path] of pages) await tryDo(n, async () => { await p.goto(OPS + path); await p.waitForTimeout(2200); await shot(p, 'ops-' + n); });
  for (const t of ['overview','ledger','collections','payouts','aging','disputes','recon','orgs','rates','config']) await tryDo('com-' + t, async () => { await p.goto(OPS + '/commissions'); await p.waitForTimeout(1500); await p.click(`[data-testid=com-tab-${t}]`); await shot(p, 'ops-commissions-' + t, 1500); });
  await c.close();
}
if (which === 'patient' || which === 'all') {
  const c = await newCtx(b, 1366, 860); const p = await c.newPage();
  await p.goto(PATIENT + '/'); await p.waitForTimeout(2200); await lang(p);
  await shot(p, 'pat-home');
  await tryDo('search', async () => { await p.goto(PATIENT + '/search'); await p.waitForTimeout(3000); await lang(p); await shot(p, 'pat-search', 1500); });
  await tryDo('signin', async () => { await p.goto(PATIENT + '/'); await p.waitForTimeout(1500);
    const btn = p.locator('a:has-text("Sign in"), button:has-text("Sign in")').first(); await btn.click(); await p.waitForTimeout(1500);
    await passportSignIn(p, '+201000001001'); await p.waitForTimeout(2500); await lang(p); await shot(p, 'pat-signedin-home'); });
  for (const [n, path] of [['appointments','/appointments'],['records','/records'],['pharmacy','/pharmacy'],['pharmacy-orders','/pharmacy/orders'],['lab','/lab'],['lab-bookings','/lab/bookings'],['telemedicine','/telemedicine'],['waitlist','/waitlist'],['family','/account/family'],['account','/account'],['addresses','/account/addresses'],['care-plans','/care-plans'],['referral','/referral']]) await tryDo(n, async () => { await p.goto(PATIENT + path); await p.waitForTimeout(2500); await shot(p, 'pat-' + n); });
  await tryDo('doctor', async () => { await p.goto(PATIENT + '/search'); await p.waitForTimeout(3000); const a = p.locator('a[href*="/doctors/"]').first(); await a.click(); await p.waitForTimeout(3000); await shot(p, 'pat-doctor', 1200); });
  await c.close();
}
await b.close();
