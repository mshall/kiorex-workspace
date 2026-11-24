import { patientLogin } from '../src/clients.js';
const BASE = process.env.TARGET ?? 'http://localhost:4300';
const spec: any = await (await fetch('http://localhost:4000/api/docs-json')).json();
const p1 = (await patientLogin('+201000001001')).accessToken; const p2 = (await patientLogin('+201000001004')).accessToken;
const call = async (m: string, url: string, tok?: string) => { const r = await fetch(BASE + url, { method: m, headers: { ...(tok ? { authorization: `Bearer ${tok}` } : {}), 'content-type': 'application/json', 'Idempotency-Key': 'idor-' + Math.random() }, body: m === 'GET' || m === 'DELETE' ? undefined : '{}' }).catch(() => null); let j: any = null; try { j = await r!.json(); } catch {} return { s: r?.status ?? 0, j }; };
const ids = new Map<string,string>();
const harvest = (src: string, o: any, d = 0) => { if (d > 6 || o == null) return; if (Array.isArray(o)) o.slice(0, 30).forEach((x) => harvest(src, x, d + 1)); else if (typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (typeof v === 'string' && /(^id$|Id$|^token$)/.test(k) && v.length > 5 && v.length < 80) ids.set(v, src); else harvest(src, v, d + 1); } };
const noParam = Object.keys(spec.paths).filter((p) => !p.includes('{') && spec.paths[p].get && !/\/(dev|ops|admin|control)\//.test(p));
for (const p of noParam) { const r = await call('GET', p, p1); if (r.s === 200) harvest(p, r.j); }
const out: string[] = [];
for (const [path, item] of Object.entries<any>(spec.paths)) for (const m of ['post','put','patch','delete']) {
  if (!item[m] || /\/(dev|ops|admin|control|webhooks)\b/.test(path)) continue;
  const params = path.match(/\{[^}]+\}/g) ?? []; if (params.length !== 1) continue;
  for (const [id, src] of ids) {
    if (/providers|search|specialt/.test(src)) continue;
    const url = path.replace(/\{[^}]+\}/, encodeURIComponent(id));
    const o = await call(m.toUpperCase(), url, p2);
    if (![400, 401, 403, 404, 409, 422, 429].includes(o.s)) out.push(`${m.toUpperCase()} ${path} id=${id.slice(0,22)} (from ${src}) as OTHER -> ${o.s} ${JSON.stringify(o.j).slice(0,90)}`);
  }
}
console.log(out.join('\n') || 'no unexpected cross-patient write acceptance'); console.log('ids', ids.size);
