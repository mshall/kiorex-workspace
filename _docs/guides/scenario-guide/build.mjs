// Builds _docs/guides/KIOREX_KIORLY_SCENARIO_TEST_GUIDE.html (self-contained: inline CSS/JS/SVG, images embedded as data URIs).
// Usage: node build.mjs            (images are resized once into ./assets by `sips` and cached; delete ./assets to refresh)
// No secret is ever written here: credentials live only in the git-ignored private register.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GROUPS, SCENARIOS, IMAGES, FRONT } from './content/index.mjs';
import { seq, flow } from './diagrams.mjs';
import { DIAGRAMS } from './content/diagrams.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const OUT = resolve(HERE, '../KIOREX_KIORLY_SCENARIO_TEST_GUIDE.html');
mkdirSync(resolve(HERE, 'assets'), { recursive: true });

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ids = new Set(SCENARIOS.map((s) => s.id));
const inline = (s) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/\{(S\d+)\}/g, (m, id) => (ids.has(id) ? `<a href="#${id}" class="xref" data-ref="${id}">${id}</a>` : (() => { throw new Error('unknown ref ' + id); })()));
const list = (arr, cls = '') => (arr && arr.length ? `<ul class="${cls}">${arr.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>` : '<p class="none">None.</p>');

// ---- images: resize to <=1000px wide jpeg with sips, cache in ./assets, embed as base64
const imgCache = new Map();
function img(key) {
  const def = IMAGES[key]; if (!def) throw new Error('unknown image ' + key);
  if (imgCache.has(key)) return imgCache.get(key);
  const dst = resolve(HERE, 'assets', key + '.jpg');
  if (!existsSync(dst)) { if (!def.src) throw new Error('no source for ' + key); if (!existsSync(resolve(ROOT, def.src))) throw new Error('missing source ' + def.src); }
  const src = def.src ? resolve(ROOT, def.src) : null;
  if (!existsSync(dst)) execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '48', '--resampleWidth', String(def.w || 780), src, '--out', dst], { stdio: 'ignore' });
  const uri = 'data:image/jpeg;base64,' + readFileSync(dst).toString('base64');
  imgCache.set(key, uri); return uri;
}
const used = new Set();
const PIX = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
const fig = (key, n) => { const d = IMAGES[key]; const first = !used.has(key); used.add(key); const srcAttr = first ? `src="${img(key)}" data-k="${key}"` : `src="${PIX}" data-same="${key}"`; return `<figure class="shot${d.narrow ? ' narrow' : ''}"><img loading="lazy" decoding="async" ${srcAttr} alt="${esc(d.alt || d.cap)}"><figcaption><b>Screenshot.</b> ${inline(d.cap)} <span class="src">Real capture from a private local stack${d.origin ? ' (' + esc(d.origin) + ')' : ''}; synthetic data only.</span></figcaption></figure>`; };

const svgUri = (f) => 'data:image/svg+xml;base64,' + readFileSync(resolve(ROOT, f)).toString('base64');
const KIOREX_LOGO = svgUri('_brand/dist/svg/kiorex-logo-full.svg');
const KIORLY_LOGO = svgUri('_brand/dist/svg/kiorly-lockup.svg');
const FONT = 'data:font/woff2;base64,' + readFileSync(resolve(ROOT, 'kiorex-account/apps/kiorly-site/assets/vendor/PlusJakartaSans-SemiBold-latin.woff2')).toString('base64');

const VER = {
  ran: ['Ran on private stack', 'Steps were run by the author of this guide on a private local stack on 27-28 Nov 2026 (screenshots prove it).'],
  auto: ['Covered by automated test', 'The behaviour is asserted by the named automated suite (cited in the scenario); steps are taken from that suite and the docs. Not re-run by hand for this guide.'],
  docs: ['From code and docs', 'Derived from the code, seeds and docs named in the scenario. Not executed by the author. Treat as a test to run, and report any difference.'],
  blocked: ['Blocked or human-only', 'Cannot be completed until a human action, an account or a real provider exists (see Known gaps).'],
};

let nShots = 0;
function renderScenario(s) {
  const v = VER[s.ver]; if (!v) throw new Error('bad ver ' + s.id);
  const apps = (s.apps || []).join(' ');
  const where = (s.where || []).map(([app, url]) => `<tr><th scope="row">${esc(app)}</th><td>${inline(url)}</td></tr>`).join('');
  const steps = s.steps.map((t, i) => `<li><label class="chk"><input type="checkbox" data-step="${s.id}-${i + 1}"><span>${inline(t)}</span></label></li>`).join('');
  const shots = (s.shots || []).map((k) => { nShots++; return fig(k); }).join('');
  let dia = '';
  if (s.diagram) { const d = DIAGRAMS[s.diagram]; if (!d) throw new Error('no diagram ' + s.diagram); dia = `<figure class="dia" tabindex="0" role="group" aria-label="Diagram: ${esc(d.cap)}">${d.type === 'seq' ? seq(d) : flow(d)}<figcaption><b>Diagram.</b> ${inline(d.cap)}</figcaption></figure>`; }
  const text = [s.id, s.title, s.purpose, (s.actors || []).join(' '), apps, (s.steps || []).join(' '), (s.expect || []).join(' '), (s.edge || []).join(' '), (s.data || []).join(' '), (s.check || []).join(' '), s.note || ''].join(' ').toLowerCase();
  return `<article class="scn" id="${s.id}" data-group="${s.group}" data-apps="${esc(apps)}" data-ver="${s.ver}" data-text="${esc(text)}">
<details>
<summary><span class="sid">${s.id}</span><span class="stitle">${esc(s.title)}</span><span class="pill ver-${s.ver}" title="${esc(v[1])}">${v[0]}</span><span class="prog" data-prog="${s.id}" aria-label="progress">0/${s.steps.length}</span></summary>
<div class="sbody">
<p class="purpose"><b>Purpose.</b> ${inline(s.purpose)}</p>
<div class="cols"><div><h4>Roles and actors</h4>${list(s.actors)}</div><div><h4>App and URL</h4><table class="where"><tbody>${where}</tbody></table></div></div>
<h4>Preconditions</h4>${list(s.pre)}
<h4>Test data to use</h4>${list(s.data, 'data')}
${dia}
<h4>Steps</h4><ol class="steps">${steps}</ol>
<h4>Expected results</h4>${list(s.expect, 'expect')}
<h4>Edge cases to try</h4>${list(s.edge)}
<h4>What to check in the admin consoles</h4>${list(s.check)}
${s.related && s.related.length ? `<p class="related"><b>Related scenarios.</b> ${s.related.map((r) => inline(`{${r}}`) + ' ' + esc(SCENARIOS.find((x) => x.id === r).title)).join(' &middot; ')}</p>` : ''}
${shots ? `<div class="shots">${shots}</div>` : ''}
<p class="vnote"><b>Verification status: ${v[0]}.</b> ${inline(s.note || v[1])}</p>
</div>
</details>
</article>`;
}

const groupsHtml = GROUPS.map((g) => {
  const sc = SCENARIOS.filter((s) => s.group === g.id);
  return `<section class="grp" id="g-${g.id}" data-grp="${g.id}"><h2><span class="gnum">${g.id}</span>${esc(g.title)}</h2><p class="glead">${inline(g.lead)}</p>${sc.map(renderScenario).join('\n')}</section>`;
}).join('\n');

const nav = GROUPS.map((g) => `<li><a href="#g-${g.id}" data-nav="${g.id}"><span>${g.id}. ${esc(g.title)}</span><small data-gprog="${g.id}">0/0</small></a></li>`).join('');
const chips = GROUPS.map((g) => `<button type="button" class="chip" data-filter-group="${g.id}" aria-pressed="false">${g.id}</button>`).join('');
const appSet = [...new Set(SCENARIOS.flatMap((s) => s.apps || []))].sort();
const appOpts = appSet.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join('');

const front = FRONT.map((sec) => `<section class="front" id="${sec.id}"><h2>${esc(sec.title)}</h2>${sec.html(inline, esc).replace(/\{(S\d+)\}/g, (m, id) => (ids.has(id) ? `<a href="#${id}" class="xref" data-ref="${id}">${id}</a>` : m))}</section>`).join('\n');

const total = SCENARIOS.length; const totalSteps = SCENARIOS.reduce((a, s) => a + s.steps.length, 0);
const stepIndex = JSON.stringify(Object.fromEntries(SCENARIOS.map((s) => [s.id, s.steps.length])));
const groupIndex = JSON.stringify(Object.fromEntries(GROUPS.map((g) => [g.id, SCENARIOS.filter((s) => s.group === g.id).map((s) => s.id)])));

const css = readFileSync(resolve(HERE, 'guide.css'), 'utf8').replace('__FONT__', FONT);
const js = readFileSync(resolve(HERE, 'guide.js'), 'utf8').replace('__STEPS__', stepIndex).replace('__GROUPS__', groupIndex);

const html = `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="light">
<title>Kiorex and Kiorly scenario test guide</title>
<meta name="description" content="Manual test scenarios for the whole Kiorex and Kiorly ecosystem: sign-in, booking, money, growth, clinic, pharmacy, lab, admin consoles, site, mobile, security. No secrets.">
<style>${css}</style>
</head>
<body>
<a class="skip" href="#main">Skip to the scenarios</a>
<header class="top" role="banner">
  <div class="brand"><img class="logo-kx" src="${KIOREX_LOGO}" alt="Kiorex" width="132" height="39"><span class="sep" aria-hidden="true"></span><img class="logo-kl" src="${KIORLY_LOGO}" alt="Kiorly" width="120" height="29"></div>
  <div class="title"><b>Scenario test guide</b><span>${total} scenarios, ${totalSteps} steps &middot; 28 Nov 2026</span></div>
  <div class="tools">
    <label class="srch"><span class="sr">Search scenarios</span><input id="q" type="search" placeholder="Search (for example refund, CASH_TRANSFER, MFA)" autocomplete="off"></label>
    <button type="button" id="menuBtn" class="btn menu" aria-expanded="false" aria-controls="side">Contents</button>
  </div>
  <div class="overall" role="group" aria-label="Overall progress"><div class="bar"><i id="barAll"></i></div><span id="txtAll">0 of ${totalSteps} steps</span></div>
</header>
<div class="layout">
<nav id="side" class="side" aria-label="Guide contents">
  <ul class="navlist"><li><a href="#start" data-nav="start">Start here</a></li><li><a href="#env" data-nav="env">Environments and URLs</a></li><li><a href="#people" data-nav="people">Test data matrix</a></li></ul>
  <p class="navh">Scenarios</p>
  <ul class="navlist">${nav}</ul>
  <ul class="navlist"><li><a href="#gaps" data-nav="gaps">Known gaps and human actions</a></li><li><a href="#verify" data-nav="verify">What was verified</a></li></ul>
  <p class="navh">Tools</p>
  <div class="sidebtns"><button type="button" class="btn" id="expand">Expand all</button><button type="button" class="btn" id="collapse">Collapse all</button><button type="button" class="btn" id="reset">Reset my progress</button><button type="button" class="btn" id="printBtn">Print</button></div>
</nav>
<main id="main" tabindex="-1">
${front}
<section id="scenarios" class="filters" aria-label="Filters">
  <h2>Scenarios</h2>
  <div class="frow"><div class="chips" role="group" aria-label="Filter by group">${chips}</div></div>
  <div class="frow">
    <label>App <select id="fApp"><option value="">All apps</option>${appOpts}</select></label>
    <label>Status <select id="fVer"><option value="">All</option><option value="ran">Ran on private stack</option><option value="auto">Covered by automated test</option><option value="docs">From code and docs</option><option value="blocked">Blocked or human-only</option></select></label>
    <label class="inl"><input type="checkbox" id="fOpen"> Only not finished</label>
    <button type="button" class="btn" id="clearF">Clear filters</button>
    <span id="count" role="status" aria-live="polite"></span>
  </div>
</section>
${groupsHtml}
<p id="noRes" class="nores" hidden>No scenario matches. Clear the filters or change the search.</p>
</main>
</div>
<footer class="foot"><p>Public document: it holds no password, token, authenticator secret or real personal data. Credentials for the synthetic personas are in the private register <code>_private/DEMO_ACCOUNTS.md</code> (git-ignored, on the founder's machine only). Progress ticks are stored only in this browser (localStorage).</p></footer>
<script>${js}</script>
</body>
</html>`;
writeFileSync(OUT, html);
console.log('wrote', OUT, Math.round(html.length / 1024) + ' KB', total + ' scenarios', nShots + ' screenshots (figure uses)', imgCache.size + ' unique images', 'steps', totalSteps);
