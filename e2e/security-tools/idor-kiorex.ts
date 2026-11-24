import { PATIENT_1, PATIENT_2 } from '../src/env.js';
import { patientLogin } from '../src/clients.js';
const BASE = process.env.TARGET ?? 'http://localhost:4300';
const spec: any = await (await fetch('http://localhost:4000/api/docs-json')).json();
const p1 = (await patientLogin('+201000001001')).accessToken; // Hoda: rich data
const p2 = (await patientLogin('+201000001004')).accessToken; // Nourhan
const get = async (url: string, tok?: string) => { const r = await fetch(BASE + url, { headers: tok ? { authorization: `Bearer ${tok}` } : {} }).catch(() => null); let j: any = null; try { j = await r!.json(); } catch {} return { s: r?.status ?? 0, j }; };
const ids = new Set<string>();
const harvest = (o: any, d = 0) => { if (d > 6 || o == null) return; if (Array.isArray(o)) o.slice(0, 20).forEach((x) => harvest(x, d + 1)); else if (typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (typeof v === 'string' && /(^id$|Id$|^token$|Ref$|^code$)/.test(k) && v.length > 5 && v.length < 80) ids.add(v); else harvest(v, d + 1); } };
const noParam = Object.keys(spec.paths).filter((p) => !p.includes('{') && spec.paths[p].get && !/\/(dev|ops|admin|control)\//.test(p));
for (const p of noParam) { const r = await get(p, p1); if (r.s === 200) harvest(r.j); }
console.log('harvested ids', ids.size);
const withParam = Object.keys(spec.paths).filter((p) => /\{[^}]+\}/.test(p) && spec.paths[p].get && !/\/(dev|ops|admin|control)\//.test(p));
const hits: string[] = [];
for (const p of withParam) {
  const params = p.match(/\{[^}]+\}/g)!; if (params.length > 1) continue;
  for (const id of ids) {
    const url = p.replace(/\{[^}]+\}/, encodeURIComponent(id));
    const a = await get(url, p1); if (a.s !== 200) continue;
    const b = await get(url, p2); const c = await get(url);
    if (b.s === 200 || c.s === 200) hits.push(`${p}  id=${id.slice(0, 24)}  owner=200 other=${b.s} anon=${c.s} bodyBytes=${JSON.stringify(a.j).length}`);
  }
}
console.log(hits.join('\n'));
