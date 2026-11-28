// Builds MOBILE_TESTING_GUIDE.html and .pdf from ../MOBILE_TESTING_GUIDE.md with the shared theme. Usage: node build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { buildDoc } from '../shared/kx-doc.mjs';
import { css } from '../shared/kx-theme.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const MarkdownIt = createRequire(path.join(ROOT, '_docs/pdf/package.json'))('markdown-it');
const md = new MarkdownIt({ html: false, linkify: false });
const src = fs.readFileSync(path.join(HERE, '../MOBILE_TESTING_GUIDE.md'), 'utf8');
const parts = src.split(/^## /m); const pre = parts.shift();
const callouts = { Warning: ['warn', 'Warning'], Note: ['note', 'Note'], Rule: ['rule', 'Rule'], Tip: ['ok', 'Tip'] };
const post = (h) => h
  .replace(/<blockquote>\s*<p><strong>(Warning|Note|Rule|Tip)<\/strong>\s*(.*?)<\/p>\s*<\/blockquote>/gs, (m, k, t) => `<div class="callout ${callouts[k][0]}"><div class="ct">${callouts[k][1]}</div><div>${t}</div></div>`)
  .replace(/<table>/g, '<table>');
const secs = parts.map((p) => {
  const nl = p.indexOf('\n'); const head = p.slice(0, nl); const m = /^(\d+)\.\s+(.*)$/.exec(head);
  return { n: +m[1], title: m[2].replace(/\(28 Nov 2026\)/, '').trim(), html: post(md.render(p.slice(nl + 1))) };
});
const groups = [['01', 'Overview and sign-in', 'GET STARTED', [0, 1, 6]], ['02', 'Install the apps', 'INSTALL', [2, 3]], ['03', 'What to test', 'TEST', [4, 5]], ['04', 'Limits, follow-ups and automation', 'REFERENCE', [7, 8, 9, 10]]];
const chapters = groups.map(([num, title, eyebrow, ns]) => ({ id: 'g' + num, num, title, eyebrow, html: ns.map((n) => { const x = secs.find((q) => q.n === n); return `<h2>${x.title}</h2>${x.html}`; }).join('') }));
const intro = md.render(pre.replace(/^# .*\n/, '')).replace(/<p>/g, '<p>');
const first = `<div class="kpis"><div class="kpi"><b>2</b><span>apps: Kiorex patients, Kiorly staff</span></div><div class="kpi"><b>15 / 15</b><span>mobile web smoke tests pass on kx-test</span></div><div class="kpi"><b>0</b><span>real providers: push, SMS, WhatsApp, payments are mock</span></div><div class="kpi"><b>5</b><span>kx-test hosts, from the URL registry</span></div></div>` + intro;
chapters[0].html = first + chapters[0].html;
const out = process.argv[2] || path.join(HERE, 'MOBILE_TESTING_GUIDE.pdf');
await buildDoc({
  slug: 'mobile', out, title: 'Mobile testing guide', eyebrow: 'TESTING GUIDE',
  subtitle: 'Install and test the Kiorex patient app and the Kiorly staff app against kx-test on Android, the iOS Simulator and the web build: sign-in codes, what works, what is gated, and the automated smoke.',
  meta: [['Kiorex and Kiorly', 'Apps com.kiorex.app and com.kiorly.app'], ['28 November 2026', 'kx-test, mock providers'], ['Edition 2', 'Contains no secrets']],
  footer: 'Mobile testing guide. Contains no secrets. Accounts live in the private register.',
  chapters, keywords: ['Kiorex', 'Kiorly', 'mobile', 'testing'],
});
// designed HTML (same theme, screen layout)
const body = `<header class="cover-h"><h1>Mobile testing guide</h1><p>Kiorex patient app and Kiorly staff app against kx-test. Updated 28 November 2026.</p></header>` + chapters.map((c) => `<section id="${c.id}"><div class="opener"><div class="num">${c.num}</div><div class="eyebrow">CHAPTER ${c.num}</div><h1>${c.title}</h1><div class="bar"></div></div>${c.html}</section>`).join('');
const screenCss = `body{background:#F4F6FC;padding:0 16px}main{max-width:900px;margin:0 auto;background:#fff;padding:24px 32px 48px;border-radius:16px;box-shadow:0 2px 24px rgba(55,48,163,.1)}@media(max-width:640px){main{padding:16px}.opener .num{display:none}table{display:block;overflow-x:auto}}html{font-size:15px}.cover-h{background:linear-gradient(135deg,#3730A3,#0369A1);color:#fff;border-radius:12px;padding:28px;margin:0 0 24px}.cover-h h1{color:#fff;font-size:30px;margin:0 0 8px}.cover-h p{margin:0;color:#E7E8FA}.opener{margin-top:32px}pre{overflow-x:auto}`;
fs.writeFileSync(path.join(HERE, '../MOBILE_TESTING_GUIDE.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mobile testing guide - Kiorex</title><style>${css.replace(/file:\/\/[^')]*\/_brand\//g, '../../_brand/').replace(/file:\/\/[^')]*\/_docs\//g, '../')}${screenCss}</style></head><body><main>${body}</main></body></html>`);
