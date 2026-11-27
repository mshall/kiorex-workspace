// Kiorly Clinic platform admin: Market launch tab on the PRIVATE stack (Clinic API :4952, web :4962). Needs KX_GOLIVE_CLINIC_EMAIL and KX_GOLIVE_CLINIC_PASSWORD (local seed, see _private/DEMO_ACCOUNTS.md); the password is masked in the screenshots.
import { browser, newCtx, shot, CLINIC } from './lib.mjs';
const b = await browser(); const c = await newCtx(b); const p = await c.newPage();
await p.goto(CLINIC + '/login'); await p.waitForTimeout(1800);
await p.click('#signin-tab-password'); await p.waitForTimeout(900);
await p.fill('#email', process.env.KX_GOLIVE_CLINIC_EMAIL); await p.fill('#password', process.env.KX_GOLIVE_CLINIC_PASSWORD); // local seed values from _private/DEMO_ACCOUNTS.md, never committed
await shot(p, 'kl-1-login');
await p.click('button[type=submit]'); await p.waitForTimeout(3500);
await shot(p, 'kl-2-platform-home');
await p.click('text=Market launch >> nth=0'); await p.waitForTimeout(2500);
await shot(p, 'kl-3-market-launch-eg');
await p.locator('tr:has-text("Egypt") >> text=Legal').click(); await p.waitForTimeout(1500);
await shot(p, 'kl-4-eg-legal-dialog');
await p.keyboard.press('Escape'); await p.waitForTimeout(500);
await p.locator('tr:has-text("Egypt") >> text=Flags').click(); await p.waitForTimeout(1500);
await shot(p, 'kl-5-eg-country-flags');
await p.keyboard.press('Escape').catch(()=>{});
await p.click('text=Initiate country launch'); await p.waitForTimeout(900);
await shot(p, 'kl-6-initiate-dialog');
const sel = p.locator('[role=dialog] select').first();
console.log((await sel.locator('option').allInnerTexts()).slice(0, 12));
await sel.selectOption({ label: (await sel.locator('option').allInnerTexts()).find((t) => /Saudi/i.test(t)) });
await p.locator('[role=dialog] input').first().fill('Saudi Arabia (sample draft)');
await p.locator('[role=dialog] input').nth(1).fill(''); // keep the screenshots free of the auto-filled Arabic name
await shot(p, 'kl-7-initiate-filled');
await p.click('text=Save as draft'); await p.waitForTimeout(2000);
await shot(p, 'kl-8-after-save-draft');
console.log((await p.innerText('body')).includes('Saudi') ? 'draft row present' : 'no draft row');
const err = await p.locator('[role=dialog] .text-destructive, [role=dialog] [role=alert]').allInnerTexts(); console.log('dialog errors:', err);
await b.close();
