// Markdown -> { meta, bodyHtml, whatChangedHtml } for one Kiorex document.
import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import hljs from 'highlight.js';
import { renderDiagram, hasDiagram } from './design/diagrams.mjs';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function makeMd() {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: false, breaks: false });
  md.use(taskLists, { enabled: false, label: false });
  md.renderer.rules.fence = (tokens, idx) => {
    const t = tokens[idx];
    const lang = (t.info || '').trim().split(/\s+/)[0].toLowerCase();
    if (lang === 'mermaid') return `<figure class="diagram"><div class="mermaid-src">${esc(t.content)}</div></figure>\n`;
    let html;
    let shown = lang || 'text';
    if (lang && hljs.getLanguage(lang)) html = hljs.highlight(t.content, { language: lang, ignoreIllegals: true }).value;
    else if (!lang && /^(GET|POST|PUT|DELETE|PATCH|X-[A-Za-z-]+:|HTTP\/)/m.test(t.content)) { html = hljs.highlight(t.content, { language: 'http', ignoreIllegals: true }).value; shown = 'http'; }
    else html = esc(t.content);
    const lines = t.content.replace(/\n$/, '').split('\n').length;
    return `<figure class="code${lines > 22 ? ' long' : ''}"><figcaption><span class="dots"><i></i><i></i><i></i></span><span class="lang">${esc(shown)}</span></figcaption><pre><code class="hljs">${html.replace(/\n$/, '')}</code></pre></figure>\n`;
  };
  return md;
}

// Source extracts put each logical paragraph on its own line (single newlines). Turn those into real paragraphs.
function normalizeLines(raw) {
  const L = raw.split('\n'); const out = []; let fence = false;
  const isBlock = (l) => /^\s*([-*+]|\d+[.)])\s/.test(l) || /^\s*\|/.test(l) || /^>/.test(l) || /^\s{2,}\S/.test(l) || /^#{1,6}\s/.test(l) || /^```/.test(l);
  for (let i = 0; i < L.length; i++) {
    const l = L[i]; out.push(l);
    if (/^```/.test(l)) { fence = !fence; continue; }
    if (fence) continue;
    const n = L[i + 1];
    if (n === undefined || !l.trim() || !n.trim()) continue;
    if (isBlock(l) && isBlock(n)) continue;           // list/table/quote runs stay together
    if (/^\s{2,}\S/.test(n) && isBlock(l)) continue;  // list continuation
    out.push('');
  }
  return out.join('\n');
}

const OWN = /Owner(?: role)?:\s*(.+?)(?=\.\s+(?:Audience|Supersedes|Tags|Owner|Extraction|Written)\b|\.\s*$|$)/;
const AUD = /Audience:\s*(.+?)(?=\.\s+(?:Owner|Supersedes|Tags|Extraction|Written)\b|\.\s*$|$)/;
const KV = /^[-*]?\s*(Source|Revision|Subtitle|Tags|Topics|Owner role|Owner|Audience|Status|Supersedes|Date|Document)\s*:\s*(.*)$/i;

// Some sources put the lede, role line, tags and Field/Value table after the "What changed" heading.
// Move everything from the first preamble marker back in front of that heading, so only the change text stays in the panel.
function hoistPreamble(lines) {
  const wc = lines.findIndex((l) => /^## what changed\b/i.test(l));
  if (wc < 0) return lines;
  let end = lines.findIndex((l, i) => i > wc && /^## /.test(l)); if (end < 0) end = lines.length;
  let cut = -1;
  for (let i = wc + 1; i < end; i++) if (/^(Authored in the role|Tags:\s|\|\s*Field\s*\|)/.test(lines[i])) { cut = i; break; }
  if (cut < 0) return lines;
  // include the lede paragraph that sits directly before the role line (but never the first paragraph = the change text)
  let start = cut;
  let j = cut - 1; while (j > wc && !lines[j].trim()) j--;
  let k = j; while (k > wc && lines[k].trim()) k--;
  if (k > wc && j >= k) start = k + 1;
  const moved = lines.slice(start, end);
  return [...lines.slice(0, wc), ...moved, '', ...lines.slice(wc, start), '', ...lines.slice(end)];
}

export function parseDoc(raw, md = makeMd()) {
  raw = raw.replace(/\r\n/g, '\n').replace(/<!--\s*kpis\s*-->/gi, '\nKXMARK-KPIS\n').replace(/<!--\s*kx-diagram:\s*([\w-]+)\s*-->/gi, '\n\nKXDIAGRAM:$1\n\n');
  const lines = hoistPreamble(normalizeLines(raw).split('\n').filter((l) => !/^Contents:\s/.test(l)));
  const meta = { tags: [], kv: {}, extraction: '', whatChanged: '', eyebrow: '', authored: '' };
  let title = '';
  // split preamble / body at first H2 (outside fences)
  let fence = false, firstH2 = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^```/.test(lines[i])) fence = !fence;
    if (!fence && /^## /.test(lines[i])) { firstH2 = i; break; }
  }
  if (firstH2 < 0) firstH2 = lines.length;
  const pre = lines.slice(0, firstH2);
  let body = lines.slice(firstH2);
  const keep = [];
  let tableState = 0;
  for (let i = 0; i < pre.length; i++) {
    const ln = pre[i];
    const h1 = /^# (.+)$/.exec(ln);
    if (h1) { title = h1[1].trim(); continue; }
    if (!ln.trim()) { keep.push(ln); continue; }
    if (/^\|/.test(ln)) {
      const cells = ln.split('|').slice(1, -1).map((c) => c.trim());
      if (/^[-: ]+$/.test(cells[0] || '')) continue;
      if (/^field$/i.test(cells[0])) { tableState = 1; continue; }
      if (cells.length >= 2) { const k0 = cells[0].toLowerCase(); if (meta.kv[k0] === undefined) meta.kv[k0] = cells[1]; continue; }
    }
    if (/\|/.test(ln) && /^[-*]?\s*[A-Z ]{4,}:\s/.test(ln) && (ln.match(/ \| [A-Z ]+:/g) || []).length >= 2) {
      for (const part of ln.replace(/^[-*]\s*/, '').split(/\s+\|\s+/)) {
        const m = /^([A-Z ]+):\s*(.*)$/.exec(part);
        if (m && meta.kv[m[1].trim().toLowerCase()] === undefined) meta.kv[m[1].trim().toLowerCase()] = m[2].trim();
      }
      continue;
    }
    if (/^>/.test(ln)) {
      const t = ln.replace(/^>\s?/, '');
      const own = OWN.exec(t); if (own) meta.kv.owner = own[1].trim();
      const aud = AUD.exec(t); if (aud) meta.kv.audience = aud[1].trim();
      const sup = /Supersedes:\s*([^.]+(?:\d{4})?)\./.exec(t); if (sup) meta.kv.supersedes = sup[1].trim();
      const tg = /Tags:\s*(.*)$/.exec(t); if (tg) meta.tags = tg[1].split(/\s*[·;]\s*/).filter(Boolean);
      if (/extraction|cleaned from/i.test(t)) { meta.extraction += (meta.extraction ? ' ' : '') + t.replace(/^Extraction note:\s*/i, '').replace(/\s*Owner(?: role)?:.*$/i, '').trim(); continue; }
      if (/WHAT CHANGED/i.test(t)) { meta.whatChanged += t.replace(/^WHAT CHANGED IN REV [\d.]+( \(as printed\))?:?\s*/i, '') + '\n\n'; continue; }
      keep.push(ln); continue;
    }
    if (/^Extraction note:/i.test(ln) || /^\(Extraction note:/i.test(ln)) { meta.extraction += (meta.extraction ? ' ' : '') + ln.replace(/^\(?Extraction note:\s*/i, '').replace(/\)$/, ''); continue; }
    if (/^WHAT CHANGED IN REV/i.test(ln) || /^What changed in Rev [\d.]+:/i.test(ln)) { meta.whatChanged += ln.replace(/^(WHAT CHANGED IN REV [\d.]+( \(as printed\))?|What changed in Rev [\d.]+):\s*/i, '') + '\n\n'; continue; }
    const kv = KV.exec(ln);
    if (kv) {
      let [, k, v] = kv; k = k.toLowerCase();
      const tg = / Tags:\s*(.*)$/.exec(v);
      if (tg) { meta.tags = tg[1].replace(/\.$/, '').split(/\s*[·;]\s*/).filter(Boolean); v = v.slice(0, tg.index); }
      if (k === 'tags' || k === 'topics') meta.tags = v.replace(/\.$/, '').split(/\s*[·;]\s*/).filter(Boolean);
      else if (k === 'owner role') meta.kv.owner = v;
      else meta.kv[k] = v;
      continue;
    }
    if (/^Authored in the role of/i.test(ln) || /^[-*]\s*Authored in the role of/i.test(ln)) { meta.authored += ln.replace(/^[-*]\s*/, '') + ' '; continue; }
    if (/^[-*]\s*(Audience|Owner)/i.test(ln)) continue;
    let m = ln;
    const sec = /^((?:Part|Section) \d+ [—–-] [^.]+)\.\s*(.*)$/.exec(m);
    if (sec) { meta.eyebrow = sec[1]; m = sec[2]; if (!m.trim()) continue; }
    const aud2 = AUD.exec(m); if (aud2 && !meta.kv.audience) meta.kv.audience = aud2[1].trim();
    const own2 = OWN.exec(m); if (own2 && !meta.kv.owner) meta.kv.owner = own2[1].trim();
    m = m.replace(/\s*(Author role|Owner role|Owner|Audience|Supersedes):\s*.+?(?=\.\s+[A-Z][a-z]+:|\.\s*$)\.?/g, '').trim();
    if (m) keep.push(m);
  }
  // fix: "Authored in the role of X. Owns Y." -> owner
  const au = /Authored in the role of (.+?)(?=\.\s+(?:Owns|Also|Written|Audience|Owner)|\.\s*$)/.exec(meta.authored);
  const ao = OWN.exec(meta.authored); if (ao && !meta.kv.owner) meta.kv.owner = ao[1].trim();
  const aa = AUD.exec(meta.authored); if (aa && !meta.kv.audience) meta.kv.audience = aa[1].trim();
  if (au && !meta.kv.owner) meta.kv.owner = au[1].trim();
  if (meta.kv.owner && /Audience:/.test(meta.kv.owner)) { const [o, a] = meta.kv.owner.split(/\.?\s*Audience:\s*/); meta.kv.owner = o; if (!meta.kv.audience) meta.kv.audience = a.replace(/\.$/, ''); }
  meta.title = title.replace(/^KX-?\d{2}\s*[—–·:-]?\s*/, '').trim();

  // extract "What changed" H2 section from the body
  let whatChangedMd = meta.whatChanged;
  const outBody = [];
  fence = false;
  let skipping = false;
  for (const ln of body) {
    if (/^```/.test(ln)) fence = !fence;
    if (!fence && /^## /.test(ln)) {
      skipping = /^## (what changed|contents)\b/i.test(ln);
      if (skipping && /what changed/i.test(ln)) { skipping = 'wc'; if (!meta.wcRev) { const wr = /rev\s*(\d+(?:\.\d+)?)/i.exec(ln); if (wr) meta.wcRev = 'Rev ' + wr[1]; } continue; }
      if (skipping) continue;
    }
    if (skipping === 'wc') { whatChangedMd += ln + '\n'; continue; }
    if (skipping) continue;
    outBody.push(ln);
  }
  const preMd = keep.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const bodyMd = (preMd ? `KXMARK-LEDE\n\n${preMd}\n\nKXMARK-LEDE-END\n\n` : '') + outBody.join('\n');

  // revision / date / status
  const rev = meta.kv.revision || '';
  const rl = /Rev\s*\d+(?:\.\d+)?/.exec(rev);
  meta.revisionLabel = rl ? rl[0].replace(/\s+/, ' ') : '';
  const dm = /\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+20\d\d/.exec(rev) || /\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+20\d\d/.exec(meta.kv.date || '');
  meta.date = dm ? dm[0].replace('Nov ', 'November ').replace(/^(\d+) Nov$/, '$1 November') : (meta.kv.date || '');
  if (/^\d+ Nov /.test(meta.date)) meta.date = meta.date.replace(' Nov ', ' November ');
  meta.status = (/Approved reference|Superseded|Draft|Proposed/i.exec(rev + ' ' + (meta.kv.status || '')) || [''])[0];
  meta.revisionNote = (/(?:—|-)\s*(NOTE:.*|not (?:re-issued|revised).*|cover.*)$/i.exec(rev) || ['', ''])[1];
  meta.revisionNote = meta.revisionNote.replace(/^NOTE:\s*/i, '').slice(0, 360);

  let n = 0;
  const bodyHtml = md.render(bodyMd).replace(/<p>KXDIAGRAM:([\w-]+)<\/p>/g, (m0, name) => { if (!hasDiagram(name)) throw new Error('Unknown kx-diagram: ' + name); return renderDiagram(name, ++n, meta.fam); });
  return {
    meta,
    bodyHtml,
    whatChangedHtml: whatChangedMd.trim() ? md.render(whatChangedMd.trim()) : '',
  };
}
