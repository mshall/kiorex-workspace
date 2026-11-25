/* Browser-side enhancement: turns plain-Markdown HTML into rich components.
   Runs in headless Chromium before Paged.js paginates. Returns { warnings }. */
window.kxEnhance = async function kxEnhance(cfg) {
  const warnings = [];
  const main = document.getElementById('content');
  const $$ = (s, r = main) => [...r.querySelectorAll(s)];
  const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const txt = (e) => (e.textContent || '').replace(/\s+/g, ' ').trim();
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = (inner, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const ICON = {
    note: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
    warning: svg('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>'),
    decision: svg('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>'),
    risk: svg('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4M12 16h.01"/>'),
    question: svg('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>'),
    rule: svg('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>'),
    tip: svg('<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/>'),
    meta: svg('<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>'),
    changed: svg('<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>'),
    diagram: svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M10 6.5h4a3 3 0 0 1 3 3V14"/>'),
    chart: svg('<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>'),
    check: svg('<path d="M20 6 9 17l-5-5"/>', 'ic tick'),
    cross: svg('<path d="M18 6 6 18M6 6l12 12"/>', 'ic crossx'),
    needs: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>'),
    arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 'ic'),
  };

  /* ---------- helpers ---------- */
  function splitTop(s, seps) {            // split on separators outside parentheses
    const out = []; let depth = 0, cur = '';
    for (const ch of s) {
      if (ch === '(') depth++; else if (ch === ')') depth = Math.max(0, depth - 1);
      if (depth === 0 && seps.includes(ch)) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur); return out.map((x) => x.trim()).filter(Boolean);
  }
  const VAL = /^(.*?)[\s:]+((?:(?:EGP|USD|SAR|AED|[≥≤~≈<>+])\s*)*\d[\d.,]*(?:\s?[–-]\s?\d[\d.,]*)?\s?(?:[A-Za-z%×+]{1,3})?)(?:\s*\((.*)\))?\.?$/;
  function parseKpi(part, needUpper) {
    const m = VAL.exec(part.trim()); if (!m) return null;
    let label = m[1].replace(/[:\s]+$/, '').trim(); if (!label || label.length > 60) return null;
    if (needUpper) { const letters = label.replace(/[^A-Za-z]/g, ''); if (letters.length < 3 || letters.replace(/[^A-Z]/g, '').length / letters.length < 0.7) return null; }
    return { value: m[2].trim(), label, note: (m[3] || '').trim() };
  }
  function kpiCards(items) {
    const w = mk('div', 'kpis n' + (items.length <= 3 ? items.length : items.length === 5 ? 5 : items.length === 6 ? 6 : 4));
    for (const it of items) w.appendChild(mk('div', 'kpi', `<div class="kv">${esc(it.value)}</div><div class="kl">${esc(it.label)}</div>${it.note ? `<div class="kn">${esc(it.note)}</div>` : ''}`));
    return w;
  }
  function stripLeadText(e, re) {          // remove regex-matched prefix from first text node(s)
    const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
    const n = w.nextNode(); if (!n) return;
    n.nodeValue = n.nodeValue.replace(re, '');
    if (!n.nodeValue.trim() && n.nextSibling == null && n.parentNode !== e) n.parentNode.remove();
  }

  const STATUS = [
    ['good', /^(done|shipped|complete[d]?|live|passed?|accepted|approved|built|ready|resolved|green|available|enabled|active|met|yes|ga)\b/i],
    ['bad', /^(stop|blocked|failed?|red|missing|not started|overdue|rejected|critical|gap|no)\b/i],
    ['warn', /^(open|amber|at risk|partial|pending|review|needs?|to confirm|in review)\b/i],
    ['info', /^(in progress|wip|building|pilot|next|started|beta|scheduled)\b/i],
    ['plan', /^(planned|backlog|later|roadmap|todo|to do|p[123])\b/i],
    ['prop', /^(proposed|draft|v2-draft|not yet|tbd)\b/i],
    ['dead', /^(superseded|deprecated|retired|withdrawn|n\/a|none)\b/i],
  ];
  const statusKind = (t) => { for (const [k, re] of STATUS) if (re.test(t)) return k; return 'info'; };
  main.style.width = '176mm';

  /* ---------- 1. lede ---------- */
  {
    const ps = $$('p'); const a = ps.find((p) => txt(p) === 'KXMARK-LEDE'); const b = ps.find((p) => txt(p) === 'KXMARK-LEDE-END');
    if (a && b) {
      const lede = mk('div', 'lede'); a.before(lede);
      let n = a.nextElementSibling; while (n && n !== b) { const nx = n.nextElementSibling; lede.appendChild(n); n = nx; }
      a.remove(); b.remove();
    }
  }

  /* ---------- 2. KPI lists after <!-- kpis --> marker or "key numbers" heading ---------- */
  for (const p of $$('p').filter((p) => txt(p) === 'KXMARK-KPIS')) {
    const ul = p.nextElementSibling; p.remove();
    if (!ul || !/^(UL|OL)$/.test(ul.tagName)) continue;
    const items = [];
    for (const li of $$('li', ul)) {
      const strong = li.querySelector('strong');
      if (strong && li.firstElementChild === strong || (strong && li.textContent.startsWith(strong.textContent))) {
        const value = txt(strong); const rest = txt(li).slice(value.length).replace(/^[\s:—–-]+/, ''); const m = /^(.*?)\s*\((.*)\)\s*$/.exec(rest);
        items.push({ value, label: m ? m[1] : rest, note: m ? m[2] : '' });
      } else { const k = parseKpi(txt(li), false); if (k) items.push(k); else { const [l, ...r] = txt(li).split(/:\s+/); items.push({ value: r.join(': ') || '·', label: l, note: '' }); } }
    }
    if (items.length) ul.replaceWith(kpiCards(items));
  }
  for (const h of $$('h2,h3,h4').filter((h) => /key numbers|key figures|at a glance/i.test(txt(h)))) {
    const ul = h.nextElementSibling; if (!ul || ul.tagName !== 'UL') continue;
    const items = $$('li', ul).map((li) => parseKpi(txt(li), false));
    if (items.length >= 2 && items.every(Boolean)) ul.replaceWith(kpiCards(items));
  }

  /* ---------- 3. blockquotes -> callouts / pull-quotes ---------- */
  const CALL = [
    [/^needs[_ ]human\b/i, 'needs', 'Needs human'], [/^open questions?\b/i, 'question', 'Open question'], [/^decision\b/i, 'decision', 'Decision'], [/^rule\b/i, 'rule', 'Rule'],
    [/^(warning|caution|important)\b/i, 'warning', null], [/^watch\b/i, 'warning', 'Watch'], [/^risk\b/i, 'risk', 'Risk'],
    [/^extraction note\b/i, 'meta', 'Extraction note'], [/^note\b/i, 'note', 'Note'], [/^evidence\b/i, 'note', 'Evidence'], [/^tip\b/i, 'tip', 'Tip'],
  ];
  function callout(type, title, nodes) {
    const a = mk('aside', 'callout c-' + type);
    a.innerHTML = `<div class="c-icon">${ICON[type] || ICON.note}</div><div class="c-body"><div class="c-title">${esc(title)}</div><div class="c-text"></div></div>`;
    const t = a.querySelector('.c-text'); nodes.forEach((n) => t.appendChild(n)); return a;
  }
  for (const bq of $$('blockquote')) {
    const first = bq.firstElementChild; const ft = first ? txt(first) : '';
    const strong = first && first.firstElementChild && first.firstElementChild.tagName === 'STRONG' && first.textContent.startsWith(first.firstElementChild.textContent) ? first.firstElementChild : null;
    const probe = (strong ? txt(strong) : ft).replace(/^[*_\s]+/, '');
    const hit = CALL.find(([re]) => re.test(probe) && (strong || /^\w[\w ]*\s*[:.—–-]/.test(ft)));
    if (hit) {
      const [, type, name] = hit; const kw = (/^[A-Za-z ]+/.exec(probe) || [''])[0].trim();
      const title = name || (kw[0].toUpperCase() + kw.slice(1).toLowerCase());
      if (strong) { strong.remove(); stripLeadText(first, /^\s*[:.—–-]?\s*/); } else stripLeadText(first, new RegExp('^\\s*' + kw + '\\s*[:.—–-]?\\s*', 'i'));
      if (!txt(first)) first.remove();
      bq.replaceWith(callout(type, title, [...bq.childNodes]));
    } else if (/extraction/i.test(ft)) { bq.replaceWith(callout('meta', 'Extraction note', [...bq.childNodes])); }
    else { bq.classList.add('pullquote'); bq.insertAdjacentHTML('afterbegin', '<span class="qmark">&ldquo;</span>'); }
  }

  /* ---------- 4. paragraph-level callouts, KPI tiles, diagrams, captions ---------- */
  const PCALL = /^(RULE|WATCH|NOTE|WARNING|CAUTION|IMPORTANT|DECISION|RISK|NEEDS_HUMAN|OPEN QUESTIONS?|EVIDENCE|TIP)\s*[:—–]\s*/;
  const PCALL2 = /^(Note|Warning|Decision|Rule|Risk|Open questions?|Extraction note|Evidence|Tip|Needs human)\s*:\s+/;
  for (const p of $$('p')) {
    if (p.closest('.callout,.kpis,.lede,.flow,td,th,li')) continue;
    const t = txt(p);
    let m = PCALL.exec(t) || PCALL2.exec(t);
    if (m) {
      const kw = m[1]; const hit = CALL.find(([re]) => re.test(kw)); if (!hit) continue;
      stripLeadText(p, new RegExp('^\\s*' + kw.replace(/\s/g, '\\s') + '\\s*[:—–]\\s*'));
      { const c = callout(hit[1], hit[2] || (kw[0] + kw.slice(1).toLowerCase()), []); p.before(c); c.querySelector('.c-text').appendChild(p); } continue;
    }
    m = /^(Extraction note|\(Extraction note)/i.exec(t);
    if (m) { stripLeadText(p, /^\(?Extraction note:\s*/i); const c = callout('meta', 'Extraction note', []); p.before(c); c.querySelector('.c-text').appendChild(p); continue; }
    // KPI tiles: "Tiles: A 1 (x) · B 2 (y)" / "Headline stats: ..." / UPPERCASE label runs
    const kp = /^(Tiles|Headline stats|Counters|Stats|Key numbers|KPIs?)\s*[:—–]\s*(.*)$/i.exec(t);
    const body = kp ? kp[2] : t;
    const parts = splitTop(body, kp ? ['·', ';'] : ['·']);
    if (parts.length >= (kp ? 2 : 3)) {
      const items = parts.map((x) => parseKpi(x.replace(/\.$/, ''), !kp));
      if (items.every(Boolean)) {
        if (kp && /\.\s+\S/.test(body.replace(/\([^)]*\)/g, '')) && false) continue;
        p.replaceWith(kpiCards(items)); continue;
      }
      // tolerate one trailing explanatory fragment (e.g. "(pairing of labels ... unverified)")
      if (kp && items.slice(0, -1).every(Boolean) && items.length > 2) { const w = kpiCards(items.slice(0, -1)); p.replaceWith(w); continue; }
    }
    // ADR cards: "**ADR001** Accepted · Area. Why: ... Consequence: ..."
    {
      const ah = p.innerHTML;
      const am = /^<strong>(ADR-?\d{3})(?:\s*·\s*([^<]*))?<\/strong>\s*(Accepted|Proposed|Superseded|Rejected|Deprecated|Draft)\b/.exec(ah);
      if (am) {
        let rest = ah.slice(am[0].length); let area = '';
        const ar = /^\s*·\s*([^.<]{2,44})\.\s*/.exec(rest); if (ar) { area = ar[1].trim(); rest = rest.slice(ar[0].length); } else rest = rest.replace(/^\s*[.]?\s*/, '');
        rest = rest.replace(/(^|[\s>])(Why|Context|Decision|Consequences?|Options|Alternatives|Supersedes|Replaces|Cost|Reversal|Trigger):/g, (m0, a, b) => `${a}<b class="lbl">${b}</b>`);
        const card = mk('article', 'adrcard' + (txt(p).length > 900 ? ' long' : ''));
        card.innerHTML = `<header><span class="idb adr">${esc(am[1].replace(/^ADR(\d)/, 'ADR-$1'))}</span><span class="pill p-${statusKind(am[3])}"><i></i>${esc(am[3])}</span>${area ? `<span class="area">${esc(area)}</span>` : ''}${am[2] ? `<span class="atitle">${esc(am[2].trim())}</span>` : ''}</header><div class="adr-body">${rest}</div>`;
        p.replaceWith(card); continue;
      }
    }
    // capability rows: "Group — Shipped: item; item; item"
    const cp = /^([A-Z][^—:]{2,52}?)\s+—\s+((?:Shipped|Planned|Built|Live|Done|Partial|In progress|Open|Proposed|Supported|Available|Tested)[^:]{0,26}):\s+(.+)$/.exec(t);
    if (cp) {
      const items = splitTop(cp[3], [';']);
      if (items.length >= 2) {
        const row = mk('div', 'caprow');
        row.innerHTML = `<div class="cap-h"><div class="cap-name">${esc(cp[1])}</div><span class="pill p-${statusKind(cp[2])}"><i></i>${esc(cp[2])}</span></div><ul class="cap-items">${items.map((i) => `<li>${esc(i.replace(/\.$/, ''))}</li>`).join('')}</ul>`;
        p.replaceWith(row); continue;
      }
    }
    const cp2 = /^([A-Z][^:(]{2,48}?)\s+\(((?:built|shipped|tested|ready|live|planned|proposed|in progress|pilot)[^)]{0,24})\):\s+(.+)$/i.exec(t);
    if (cp2) {
      const items = splitTop(cp2[3], [';']);
      if (items.length >= 2) {
        const row = mk('div', 'caprow');
        row.innerHTML = `<div class="cap-h"><div class="cap-name">${esc(cp2[1])}</div><span class="pill p-${statusKind(cp2[2])}"><i></i>${esc(cp2[2])}</span></div><ul class="cap-items">${items.map((i) => `<li>${esc(i.replace(/\.$/, ''))}</li>`).join('')}</ul>`;
        p.replaceWith(row); continue;
      }
    }
    // Diagram: A —label→ B; C —label→ D
    const dg = /^Diagram\s*:\s*(.*)$/i.exec(t);
    if (dg) {
      const segs = splitTop(dg[1], [';']);
      const rows = segs.map((s) => /^(.+?)\s*[—–-]+\s*([^→]*?)\s*→\s*(.+)$/.exec(s)).filter(Boolean);
      if (rows.length === segs.length && rows.length >= 2) {
        const f = mk('figure', 'edges');
        f.innerHTML = `<figcaption><span class="tag">Diagram</span></figcaption>` + rows.map((r) => `<div class="edge"><span class="node">${esc(r[1])}</span><span class="elabel"><span>${esc(r[2])}</span>${ICON.arrow}</span><span class="node">${esc(r[3].replace(/\.$/, ''))}</span></div>`).join('');
        p.replaceWith(f); continue;
      }
    }
    if (/^(Figure|Chart)(\s*\d+)?\s*[—–:-]/i.test(t)) { p.classList.add('figcap'); const mm = /^(Figure|Chart)(\s*\d+)?/i.exec(t); const lab = (/^Chart/i.test(t) ? 'Chart' : 'Figure') + (mm[2] ? ' ' + mm[2].trim() : ''); p.innerHTML = `<span class="tag">${lab}</span>` + p.innerHTML.replace(/^(Figure|Chart)(\s*\d+)?\s*[—–:-]\s*/i, ''); continue; }
    // short "Label. Sentence" lead-ins (Problem. Solution. Why now.)
    const lead = /^([A-Z][A-Za-z']*(?: [A-Za-z']+){0,2})\.\s+(?=[A-Z])/.exec(t);
    if (lead && lead[1].length <= 22 && p.firstChild && p.firstChild.nodeType === 3 && p.firstChild.nodeValue.startsWith(lead[1] + '.')) {
      p.firstChild.nodeValue = p.firstChild.nodeValue.slice(lead[0].length - 1); p.insertAdjacentHTML('afterbegin', `<span class="lead-in">${esc(lead[1])}</span>`);
    }
  }

  /* ---------- 5. flow chains ("A → B → C") ---------- */
  function flowify(e) {
    if (e.closest('.callout,.kpis,table,pre,figure')) return false;
    const html = e.innerHTML; if ((html.match(/→/g) || []).length < 2) return false;
    const t = txt(e); if (t.length > 520) return false;
    let label = ''; let rest = html; const lm = /^\s*(Flow|Process|Sequence|Path|Journey|Lifecycle|Pipeline)\s*(\([^)]*\))?\s*:\s*/i.exec(html);
    if (lm) { label = lm[1]; rest = html.slice(lm[0].length); }
    const segs = rest.split(/\s*→\s*/).map((s) => s.trim()).filter(Boolean);
    if (segs.length < 3 || segs.some((s) => s.replace(/<[^>]+>/g, '').length > 150)) return false;
    if (!lm && segs.some((s) => s.replace(/<[^>]+>/g, '').length > 80) ) return false;
    const f = mk('div', 'flow' + (e.tagName === 'LI' ? ' in-li' : ''));
    if (label) f.appendChild(mk('span', 'flow-label', esc(label)));
    segs.forEach((s, i) => { if (i) f.appendChild(mk('span', 'arrow', ICON.arrow)); f.appendChild(mk('span', 'chip c' + (i % 4), s)); });
    e.innerHTML = ''; e.classList.add('has-flow'); e.appendChild(f); return true;
  }
  $$('p,li').forEach(flowify);
  for (const li of $$('li.has-flow')) { li.style.listStyle = 'none'; }

  /* ---------- 6. timelines / ordered lists ---------- */
  for (const ol of $$('ol')) {
    if (ol.closest('table,.callout')) continue;
    const prev = ol.previousElementSibling; const ptxt = prev ? txt(prev) : '';
    const li = ol.children.length;
    if (li >= 3 && /(steps?|flow|sequence|procedure|timeline|process|runbook|walk-?through|stages?)\b/i.test(ptxt.slice(-140)) ) ol.classList.add('timeline');
    else ol.classList.add('numbered');
  }

  /* ---------- 7. list lead-in labels ("Clinician in control: ...") ---------- */
  for (const e of $$('li,p')) {
    if (e.closest('table,.callout,.kpis,.flow,.lede,.edges,pre,.figcap') || e.classList.contains('has-flow')) continue;
    const f = e.firstChild; if (!f || f.nodeType !== 3) continue;
    const m = /^([A-Z][^:.!?()]{1,38}?):\s+/.exec(f.nodeValue);
    if (!m || /^https?/i.test(m[1]) || m[1].split(' ').length > 5) continue;
    if (e.tagName === 'P' && txt(e).length < 60) continue;
    f.nodeValue = f.nodeValue.slice(m[0].length); e.insertBefore(mk('span', 'label-in', esc(m[1])), f);
  }

  /* ---------- 8. tables ---------- */
  const STRONG = /^(stop|done|shipped|blocked|planned|superseded|accepted|proposed|in progress|completed|deprecated|not started)\b/i;
  const LEVEL = { critical: 'bad', high: 'high', medium: 'warn', med: 'warn', low: 'good' };
  const HEADSTAT = /status|state|severity|level|likelihood|impact|priority|rag|gate|result|readiness|ready|phase/i;
  for (const t of $$('table')) {
    const heads = $$('thead th', t).map(txt);
    const wrap = mk('div', 'tablewrap'); t.replaceWith(wrap); wrap.appendChild(t);
    const cols = heads.length; wrap.dataset.cols = cols;
    if (cols >= 6) t.classList.add('dense');
    $$('tbody tr', t).forEach((tr) => [...tr.children].forEach((td, i) => {
      const s = txt(td); if (!s || s.length > 28) { return; }
      const isStatCol = HEADSTAT.test(heads[i] || '');
      const lv = LEVEL[s.toLowerCase().replace(/\.$/, '')];
      let kind = null;
      if (lv && isStatCol) kind = lv;
      else for (const [k, re] of STATUS) if (re.test(s) && (isStatCol || STRONG.test(s))) { kind = k; break; }
      if (kind) { td.classList.add('stat'); td.innerHTML = `<span class="pill p-${kind}"><i></i>${esc(s)}</span>`; }

    }));
    $$('tbody td:first-child', t).forEach((td) => td.classList.add('first'));
    const NUMRX = /^[\d.,%\s≥≤<>~+×x–/-]+[A-Za-z%]{0,3}$/;
    heads.forEach((_, ci) => {
      if (ci === 0) return; const cells = $$('tbody tr', t).map((tr) => tr.children[ci]).filter(Boolean);
      const numeric = cells.filter((c) => { const s = txt(c); return s && NUMRX.test(s) && /\d/.test(s); });
      if (cells.length && numeric.length / cells.length >= 0.85) cells.forEach((c) => c.classList.add('num'));
    });
  }

  for (const w of $$('.tablewrap')) { const h = w.getBoundingClientRect().height; w.dataset.h = Math.round(h); if (h < 520 && !w.closest('.callout')) w.classList.add('keep'); }

  /* ---------- 9. mermaid diagrams ---------- */
  const mer = $$('.mermaid-src');
  if (mer.length && window.mermaid) {
    window.mermaid.initialize({
      startOnLoad: false, securityLevel: 'loose', theme: 'base', fontFamily: 'Inter, "IBM Plex Sans Arabic", sans-serif',
      themeVariables: { primaryColor: '#F1F1F9', primaryTextColor: '#1A1D36', primaryBorderColor: '#3730A3', lineColor: '#535B7B', secondaryColor: '#EDF5F8', tertiaryColor: '#FDF5F4', noteBkgColor: '#FEF3C7', noteBorderColor: '#B45309', actorBkg: '#3730A3', actorTextColor: '#FFFFFF', actorBorder: '#221E62', signalColor: '#3F4663', activationBkgColor: '#CFE2ED', fontSize: '16px' },
      flowchart: { htmlLabels: false, curve: 'basis', padding: 12 }, sequence: { useMaxWidth: true, mirrorActors: false },
    });
    let n = 0;
    for (const src of mer) {
      try { const { svg: out } = await window.mermaid.render('kxm' + (n++), src.textContent); const box = mk('div', 'mermaid-out', out); src.replaceWith(box); }
      catch (err) { warnings.push('mermaid: ' + String(err.message || err).slice(0, 160)); src.outerHTML = `<pre class="mermaid-fail">${esc(src.textContent)}</pre>`; }
    }
    for (const s of $$('.mermaid-out svg')) {
      const vb = (s.getAttribute('viewBox') || '').split(/\s+/).map(Number); const w = vb[2] || 600;
      s.removeAttribute('height'); s.removeAttribute('width'); s.style.maxWidth = 'none'; s.style.width = Math.min(w * 0.72, 640) + 'px'; s.style.height = 'auto'; s.style.maxHeight = '215mm';
    }
  }

  /* ---------- 10. text-node pass: ID badges, check marks, Arabic ---------- */
  const AR = '\\u0600-\\u06FF\\u0750-\\u077F\\uFB50-\\uFDFF\\uFE70-\\uFEFF';
  const RX = new RegExp(`(«?[${AR}]+(?:[\\s\\u200c\\u200d\\u060C\\u061B\\u061F\\u0640.,:()/«»\\-]*[${AR}\\d]+)*»?)|(\\bADR-?\\d{3}(?:\\s?[.…]{2,3}\\s?\\d{3})?\\b|\\bKX-?\\d{2}(?:-\\d{2})?\\b)|([✓✔✕✗✘])|(#[0-9A-Fa-f]{6}\\b)|(\\bNEEDS_HUMAN\\b)`, 'g');
  const skip = (n) => n.parentElement && n.parentElement.closest('pre,code,svg,script,style,.mermaid-out,h1,.no-enhance,.pill,.nhb,.c-needs .c-title,.kxfig');
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT); const nodes = []; for (let n; (n = walker.nextNode());) nodes.push(n);
  for (const n of nodes) {
    if (skip(n)) continue; const s = n.nodeValue; RX.lastIndex = 0; if (!RX.test(s)) continue; RX.lastIndex = 0;
    const frag = document.createDocumentFragment(); let last = 0, m;
    while ((m = RX.exec(s))) {
      if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index)));
      if (m[1]) { const sp = mk('span', 'ar'); sp.setAttribute('dir', 'rtl'); sp.setAttribute('lang', 'ar'); sp.textContent = m[1]; frag.appendChild(sp); }
      else if (m[2]) { const b = mk('span', 'idb ' + (/^ADR/.test(m[2]) ? 'adr' : 'kx')); b.textContent = m[2].replace(/^(ADR|KX)(\d)/, '$1-$2'); frag.appendChild(b); }
      else if (m[5]) { const b = mk('span', 'nhb'); b.textContent = 'NEEDS_HUMAN'; frag.appendChild(b); }
      else if (m[4]) { const sw = mk('span', 'swatch'); sw.style.background = m[4]; frag.appendChild(sw); frag.appendChild(document.createTextNode(m[4].toUpperCase())); }
      else { const ok = /[✓✔]/.test(m[3]); frag.appendChild(mk('span', ok ? 'yes' : 'no', ok ? ICON.check : ICON.cross)); }
      last = m.index + m[0].length;
    }
    if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
    n.replaceWith(frag);
  }
  for (const c of $$('code')) {
    if (c.closest('pre')) continue; const s = txt(c); c.classList.add('ic-code');
    if (/^(ADR-?\d{3}|KX-?\d{2}|[A-Z]{1,5}-?\d{1,4}[A-Z]{0,3}|[A-Z]{2,6}\d{2,4}[A-Z]{0,4}|H\d+|R\d+|Q\d+|BR\d+|NH\d+)$/.test(s)) c.classList.add('idb', /^ADR/.test(s) ? 'adr' : /^KX/.test(s) ? 'kx' : /^(R|H|Q)\d+$/.test(s) ? 'risk' : 'gen');
  }
  // RTL blocks
  for (const b of $$('p,li,td,th,h3,h4,.c-text,.chip,.node')) {
    const letters = (b.textContent.match(/\p{L}/gu) || []); if (letters.length < 2) continue;
    const ar = letters.filter((c) => new RegExp(`[${AR}]`).test(c)).length;
    if (ar / letters.length > 0.6) { b.setAttribute('dir', 'rtl'); b.classList.add('ar-block'); }
  }

  /* ---------- 11. wide tables -> landscape pages ---------- */
  const probe = mk('div', 'probe'); main.appendChild(probe);
  const PORTRAIT = 176 * 3.7795 - 2; // px content width (A4 minus margins)
  let wideCount = 0;
  for (const wrap of $$('.tablewrap')) {
    const t = wrap.querySelector('table'); if (wrap.closest('.callout')) continue;
    const clone = t.cloneNode(true); clone.style.cssText = 'width:min-content;max-width:none;table-layout:auto'; probe.innerHTML = ''; probe.appendChild(clone);
    const minW = clone.getBoundingClientRect().width; probe.innerHTML = '';
    wrap.dataset.minw = Math.round(minW);
    if (minW > PORTRAIT) {
      const rows = t.querySelectorAll('tbody tr').length;
      const pg = mk('div', 'wide-page'); wrap.replaceWith(pg); pg.appendChild(wrap); wideCount++;
      if (minW > 269 * 3.7795) { wrap.classList.add('tight'); warnings.push(`table "${heads0(t)}" is very wide (${Math.round(minW)}px); shrunk on landscape page`); }
      if (rows > 40) t.classList.add('dense');
    }
  }
  function heads0(t) { return txt(t.querySelector('th') || t).slice(0, 30); }
  probe.remove();

  /* ---------- 12. headings, chapters, dividers ---------- */
  const slug = (s, i) => 'h' + i + '-' + s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  let hi = 0; $$('h2,h3,h4').forEach((h) => { h.id = slug(txt(h), hi++); });
  const kids = [...main.children]; const chapters = []; let cur = null;
  const preface = mk('div', 'preface'); main.innerHTML = ''; main.appendChild(preface);
  for (const k of kids) {
    if (k.tagName === 'H2') { cur = mk('section', 'chapter'); cur.appendChild(k); main.appendChild(cur); chapters.push(cur); }
    else (cur || preface).appendChild(k);
  }
  if (!preface.children.length) preface.remove();
  for (const ch of chapters) {
    const h2 = ch.querySelector('h2'); const m = /^(\d{1,2})\s+(.+)$/.exec(txt(h2));
    const rest = document.createElement('div'); rest.className = 'chapter-body'; [...ch.children].forEach((c) => { if (c !== h2) rest.appendChild(c); }); ch.appendChild(rest);
    if (m) { h2.dataset.num = m[1]; h2.textContent = m[2]; } else { ch.classList.add('nonum'); }
    const h3s = $$('h3', rest); const height = rest.getBoundingClientRect().height;
    const useDivider = !!m && (height > 1000 || h3s.length >= 5) && cfg.dividers !== false;
    ch.classList.add(useDivider ? 'has-divider' : 'has-banner');
    if (useDivider) {
      const dv = mk('div', 'divider');
      const nTables = $$('.tablewrap', rest).length, nCall = $$('.callout', rest).length;
      const stats = [h3s.length ? `${h3s.length} section${h3s.length > 1 ? 's' : ''}` : '', nTables ? `${nTables} table${nTables > 1 ? 's' : ''}` : '', nCall ? `${nCall} callout${nCall > 1 ? 's' : ''}` : ''].filter(Boolean).join('  ·  ');
      dv.innerHTML = `<div class="d-top"><span class="d-eyebrow">${esc(cfg.code)} &nbsp;·&nbsp; Chapter ${esc(m[1])}</span></div><i class="d-mark"></i><div class="d-num">${esc(m[1])}</div><div class="d-main"></div>`;
      dv.querySelector('.d-main').appendChild(h2);
      if (h3s.length) { const ul = mk('ol', 'd-list'); h3s.slice(0, 12).forEach((h) => ul.appendChild(mk('li', '', esc(txt(h))))); dv.querySelector('.d-main').appendChild(ul); }
      if (stats) dv.querySelector('.d-main').appendChild(mk('div', 'd-stats', esc(stats)));
      ch.insertBefore(dv, rest);
    } else if (m) {
      const bn = mk('div', 'banner', `<span class="b-num">${esc(m[1])}</span>`); bn.appendChild(h2); ch.insertBefore(bn, rest);
    }
    h2.classList.add('str-sec');
  }

  /* ---------- 13. TOC ---------- */
  const toc = document.getElementById('toc');
  if (toc) {
    const hs = [...main.querySelectorAll('h2,h3')]; const useH3 = hs.length <= 95;
    let html = ''; for (const h of hs) {
      if (h.tagName === 'H3' && !useH3) continue; const lv = h.tagName === 'H2' ? 'l2' : 'l3';
      const num = h.tagName === 'H2' && h.dataset.num ? `<span class="tn">${esc(h.dataset.num)}</span>` : '<span class="tn"></span>';
      html += `<li class="${lv}"><a href="#${h.id}">${num}<span class="tt">${esc(txt(h))}</span><span class="tl"></span></a></li>`;
    }
    toc.innerHTML = html;
    const gl = mk('div', 'glance');
    const stat = (n, l) => `<div><b>${n}</b><span>${l}</span></div>`;
    const nCh = $$('section.chapter').length, nSec = $$('h3').length, nTab = $$('.tablewrap').length, nDia = $$('figure.kxfig,.mermaid-out').length, nCall = $$('.callout').length, nNh = $$('.nhb').length;
    const tiles = [[nCh, 'Chapters'], [nSec, 'Sections'], [nTab, 'Tables'], [nDia, 'Diagrams'], [nCall, 'Callouts'], [nNh, 'Needs human']].filter((t) => t[0] > 0);
    gl.style.gridTemplateColumns = `repeat(${Math.max(tiles.length, 1)},1fr)`; gl.innerHTML = tiles.map((t) => stat(t[0], t[1])).join('');
    toc.parentNode.insertBefore(gl, toc);
  }
  for (const id of cfg.breakIds || []) { const h = document.getElementById(id); if (h) (h.closest('.banner') || h).classList.add('kx-pb'); }
  main.style.width = '';
  return { warnings, wideCount, chapters: chapters.length };
};
