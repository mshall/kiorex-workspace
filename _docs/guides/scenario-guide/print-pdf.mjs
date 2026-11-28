// Renders the built scenario guide HTML to a stamped A4 PDF. Usage: node print-pdf.mjs [out.pdf]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stampPdf } from '../shared/kx-doc.mjs';
import { launch } from '../../pdf/lib/pdf.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(HERE, '../KIOREX_KIORLY_SCENARIO_TEST_GUIDE.pdf');
const browser = await launch();
const page = await browser.newPage();
await page.goto('file://' + path.join(HERE, '../KIOREX_KIORLY_SCENARIO_TEST_GUIDE.html'), { waitUntil: 'load' });
await page.emulateMedia({ media: 'print' });
await page.evaluate(async () => {
  document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; });
  document.querySelectorAll('.scn details').forEach((d) => { d.open = true; });
  window.dispatchEvent(new Event('beforeprint'));
  await Promise.all([...document.images].map((i) => i.complete ? 1 : new Promise((r) => { i.onload = i.onerror = r; })));
  await document.fonts.ready;
});
await page.waitForTimeout(800);
const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
await page.close();
const stamped = await stampPdf(browser, pdf, () => 'Scenario test guide', 'Public document. Contains no secrets. Credentials stay in the private register.', path.join(HERE, '.build'));
await browser.close();
fs.writeFileSync(out, stamped);
console.log('written', out);
