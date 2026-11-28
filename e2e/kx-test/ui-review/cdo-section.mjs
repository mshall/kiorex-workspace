import { chromium } from '@playwright/test';
const [url, sel, out, w = '1440'] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +w, height: 900 } });
await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
const el = p.locator(sel).first(); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(1200);
await el.screenshot({ path: out }); await b.close();
