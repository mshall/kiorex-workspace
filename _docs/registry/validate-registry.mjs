#!/usr/bin/env node
// Validates and expands _docs/registry/service-url-registry.yaml (ADR-059). No dependencies, Node 18+.
//   node _docs/registry/validate-registry.mjs                 validate (exit 1 on any error)
//   node _docs/registry/validate-registry.mjs --print         host table per environment
//   node _docs/registry/validate-registry.mjs --emit cors|redirects|backchannel|env|certs|dns --env test [--service kiorly.clinics]
//   node _docs/registry/validate-registry.mjs --strict        also fail on hardcoded domains found in report_paths (repos)
// It never touches AWS, DNS or the network.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.resolve(here, "../..");
const REGISTRY = process.env.REGISTRY_FILE ?? path.join(here, "service-url-registry.yaml");

// ---------------------------------------------------------------- tiny YAML subset parser
function stripComment(s) {
  let q = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '"') q = !q;
    if (s[i] === "#" && !q && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i);
  }
  return s;
}
function splitFlow(s) {
  const out = []; let cur = ""; let q = false;
  for (const ch of s) {
    if (ch === '"') q = !q;
    if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch;
  }
  if (cur.trim() !== "" || out.length) out.push(cur);
  return out;
}
function scalar(raw) {
  const s = raw.trim();
  if (s === "") return null;
  if (s.startsWith("[") && s.endsWith("]")) return splitFlow(s.slice(1, -1)).map(scalar).filter((v) => v !== null || s.slice(1, -1).trim() !== "");
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null" || s === "~") return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (s.startsWith("{") || s.startsWith("|") || s.startsWith(">") || s.startsWith("&") || s.startsWith("*")) throw new Error(`unsupported YAML construct: ${s}`);
  return s;
}
export function parseYaml(text) {
  const lines = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const noc = stripComment(raw).replace(/\s+$/, "");
    if (noc.trim() === "") return;
    if (/\t/.test(noc.match(/^\s*/)[0])) throw new Error(`line ${i + 1}: tabs are not allowed`);
    lines.push({ indent: noc.match(/^ */)[0].length, text: noc.trim(), n: i + 1 });
  });
  let pos = 0;
  function block(indent) {
    if (pos >= lines.length) return null;
    return lines[pos].text.startsWith("- ") || lines[pos].text === "-" ? list(indent) : map(indent);
  }
  function map(indent) {
    const obj = {};
    while (pos < lines.length && lines[pos].indent === indent && !(lines[pos].text.startsWith("- ") || lines[pos].text === "-")) {
      const { text, n } = lines[pos];
      const m = text.match(/^("[^"]*"|[A-Za-z0-9_.\-/]+):(?:\s+(.*))?$/);
      if (!m) throw new Error(`line ${n}: cannot parse "${text}"`);
      const key = m[1].startsWith('"') ? m[1].slice(1, -1) : m[1];
      pos++;
      if (m[2] !== undefined && m[2] !== "") obj[key] = scalar(m[2]);
      else if (pos < lines.length && (lines[pos].indent > indent || (lines[pos].indent === indent && lines[pos].text.startsWith("- ")))) {
        obj[key] = block(lines[pos].indent);
      } else obj[key] = null;
    }
    return obj;
  }
  function list(indent) {
    const arr = [];
    while (pos < lines.length && lines[pos].indent === indent && (lines[pos].text.startsWith("- ") || lines[pos].text === "-")) {
      const cur = lines[pos];
      const rest = cur.text === "-" ? "" : cur.text.slice(2);
      if (rest === "") { pos++; arr.push(block(lines[pos].indent)); continue; }
      if (/^("[^"]*"|[A-Za-z0-9_.\-/]+):(\s|$)/.test(rest)) {
        lines[pos] = { indent: indent + 2, text: rest, n: cur.n };
        arr.push(map(indent + 2));
      } else { pos++; arr.push(scalar(rest)); }
    }
    return arr;
  }
  const result = block(lines[0].indent);
  if (pos < lines.length) throw new Error(`line ${lines[pos].n}: unexpected indentation`);
  return result;
}

// ---------------------------------------------------------------- expansion
export function load(file = REGISTRY) { return parseYaml(fs.readFileSync(file, "utf8")); }

export function expand(reg) {
  const envs = new Map(reg.environments.map((e) => [e.id, e]));
  const hosts = [];
  for (const s of reg.services) {
    for (const envId of s.envs) {
      const env = envs.get(envId);
      if (!env) continue;
      const parts = [s.label, env.label].filter((p) => p && p !== "");
      parts.push(reg.domains[s.domain]);
      let status = s.status;
      if (status === "live" && !(s.live_envs ?? []).includes(envId)) status = "planned";
      if (s.id === reg.oidc.issuer_service && reg.oidc.issuer_env[envId] !== envId) status = "redirect-only";
      hosts.push({ host: parts.join("."), service: s.id, env: envId, plane: env.plane, dns: s.dns, kind: s.kind, status, core: !!s.core, alias_of: s.alias_of ?? null });
    }
  }
  return hosts;
}
const byId = (reg) => new Map(reg.services.map((s) => [s.id, s]));
export function hostOf(reg, serviceId, envId) {
  const h = expand(reg).find((x) => x.service === serviceId && x.env === envId);
  return h ? h.host : null;
}
function urlOf(reg, id, envId) { const h = hostOf(reg, id, envId); return h ? `https://${h}` : null; }
export function issuerFor(reg, envId) {
  const ienv = reg.oidc.issuer_env[envId];
  return urlOf(reg, reg.oidc.issuer_service, ienv);
}
function resolveTemplate(reg, tpl, envId) {
  const env = reg.environments.find((e) => e.id === envId);
  return tpl.replace(/\{([a-z_]+)(?::([a-z0-9.\-]+))?\}/g, (_, k, arg) => {
    if (k === "url") return urlOf(reg, arg, envId) ?? `<${arg} missing in ${envId}>`;
    if (k === "host") return hostOf(reg, arg, envId) ?? `<${arg} missing in ${envId}>`;
    if (k === "issuer") return issuerFor(reg, envId);
    if (k === "env") return envId;
    if (k === "env_tag") return env.tag;
    if (k === "provider_sign_in") return env.provider_sign_in ?? "oidc";
    if (k === "provider_phone_link") return String(env.provider_phone_link ?? "false");
    if (k === "plane") return env.plane;
    if (k === "cors") return "{cors}"; // resolved per service by the caller
    return `<unknown ${k}>`;
  });
}
export function corsFor(reg, serviceId, envId) {
  const ids = reg.cors?.[serviceId] ?? [];
  const out = ids.map((id) => urlOf(reg, id, envId)).filter(Boolean);
  // pilot runs on the production plane: also allow the pilot origins of the same services on the prod API, and the reverse is not needed
  if (envId === "prod") for (const id of ids) { const p = urlOf(reg, id, "pilot"); if (p) out.push(p); }
  const legacy = (reg.legacy_hosts ?? []).filter((l) => l.env === envId && ids.includes(l.service) && l.status === "live").map((l) => `https://${l.host}`);
  return [...new Set([...out, ...legacy])].sort();
}
export function redirectsFor(reg, issuerEnv) {
  const rows = [];
  const envsUsing = Object.entries(reg.oidc.issuer_env).filter(([, v]) => v === issuerEnv).map(([k]) => k);
  for (const c of reg.oidc_clients) {
    for (const envId of envsUsing) {
      const base = urlOf(reg, c.service, envId);
      if (!base) continue;
      const bases = [base, ...(reg.legacy_hosts ?? []).filter((l) => l.env === envId && l.service === c.service && l.status === "live").map((l) => `https://${l.host}`)];
      for (const b of bases) rows.push({ client: c.id, env: envId, redirect_uris: c.redirect_paths.map((p) => b + p), post_logout_redirect_uris: c.post_logout_paths.map((p) => b + p), backchannel_logout_uri: c.backchannel_service && envId === issuerEnv ? urlOf(reg, c.backchannel_service, envId) + c.backchannel_path : (c.backchannel_service ? urlOf(reg, c.backchannel_service, envId) + c.backchannel_path : null) });
    }
  }
  return rows;
}
export function certsFor(reg) {
  // one certificate per environment and domain (us-east-1 for CloudFront): apex of the env zone plus one wildcard level
  const out = [];
  const hosts = expand(reg).filter((h) => h.dns !== "none");
  const groups = new Map();
  for (const h of hosts) {
    const env = reg.environments.find((e) => e.id === h.env);
    const dom = Object.values(reg.domains).find((d) => h.host === d || h.host.endsWith("." + d));
    const zone = env.label ? `${env.label}.${dom}` : dom;
    const k = `${h.env}|${zone}`;
    if (!groups.has(k)) groups.set(k, { env: h.env, zone, sans: [zone, `*.${zone}`], hosts: [] });
    groups.get(k).hosts.push(h.host);
  }
  return [...groups.values()];
}
const covers = (san, host) => san === host || (san.startsWith("*.") && host.endsWith(san.slice(1)) && !host.slice(0, -(san.length - 1)).includes("."));

// ---------------------------------------------------------------- checks
function checkAll(reg) {
  const errors = []; const warnings = [];
  const err = (m) => errors.push(m);
  if (reg.schema_version !== 1) err("schema_version must be 1");
  const envIds = reg.environments.map((e) => e.id);
  for (const need of ["test", "pilot", "prod"]) if (!envIds.includes(need)) err(`environment ${need} missing`);
  const tags = { test: "kx-test", pilot: "kx-pilot", prod: "kx-pro" };
  for (const [id, tag] of Object.entries(tags)) { const e = reg.environments.find((x) => x.id === id); if (e && e.tag !== tag) err(`environment ${id} must carry founder tag ${tag}`); }
  const pilot = reg.environments.find((e) => e.id === "pilot"); const prod = reg.environments.find((e) => e.id === "prod");
  if (pilot && prod && pilot.plane !== prod.plane) err("pilot must run on the prod plane (no data migration at go-live)");
  if (prod && prod.label !== "") err("prod must have an empty environment label");
  for (const e of reg.environments) { if (e.provider_sign_in !== undefined && !["oidc", "both"].includes(e.provider_sign_in)) err(`environment ${e.id}: provider_sign_in must be oidc or both`); if (e.id === "prod" && e.provider_sign_in === "both") err("environment prod: provider_sign_in both is refused until the founder decides (safe default is oidc)"); }
  for (const e of reg.environments) if (e.id !== "prod" && !/^[a-z]+$/.test(e.label)) err(`environment ${e.id}: label must be lowercase letters`);
  if (reg.oidc.issuer_env.pilot !== "prod") err("oidc.issuer_env.pilot must be prod (accounts survive the pilot to production move)");
  for (const [k, v] of Object.entries(reg.oidc.issuer_env)) if (!envIds.includes(k) || !envIds.includes(v)) err(`oidc.issuer_env ${k}: ${v} unknown environment`);

  const svc = byId(reg);
  if (svc.size !== reg.services.length) err("duplicate service id");
  const labels = new Set(reg.environments.map((e) => e.label).filter(Boolean));
  for (const s of reg.services) {
    for (const f of ["id", "domain", "kind", "exposure", "dns", "repo", "envs", "status"]) if (s[f] === undefined) err(`service ${s.id}: missing ${f}`);
    if (!(s.domain in reg.domains)) err(`service ${s.id}: unknown domain ${s.domain}`);
    if (typeof s.label !== "string" && s.label !== null) err(`service ${s.id}: label must be a string ("" for the apex)`);
    if (s.label && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(s.label)) err(`service ${s.id}: label "${s.label}" must be a single DNS label`);
    if (s.label && labels.has(s.label)) err(`service ${s.id}: label "${s.label}" collides with an environment label`);
    if (s.core) for (const need of ["test", "pilot", "prod"]) if (!s.envs.includes(need)) err(`core service ${s.id} missing from ${need}`);
    for (const e of s.envs) if (!envIds.includes(e)) err(`service ${s.id}: unknown env ${e}`);
    if (s.alias_of && !svc.has(s.alias_of)) err(`service ${s.id}: alias_of ${s.alias_of} unknown`);
    if (s.exposure === "internal" || s.exposure === "gateway-only") { if (s.dns !== "none") err(`service ${s.id}: ${s.exposure} services must have dns: none (no public record)`); }
    for (const [k, v] of Object.entries(s.env ?? {})) {
      if (/^https?:\/\//.test(v) || /\b[a-z0-9-]+\.(com|link)\b/.test(v)) err(`service ${s.id}: env ${k} contains a literal host, use a template`);
      for (const m of v.matchAll(/\{(url|host):([a-z0-9.\-]+)\}/g)) if (!svc.has(m[2])) err(`service ${s.id}: env ${k} references unknown service ${m[2]}`);
    }
  }
  if (!svc.has(reg.oidc.issuer_service)) err("oidc.issuer_service unknown");

  const hosts = expand(reg);
  const seen = new Map();
  const domainRe = Object.values(reg.domains).map((d) => d.replace(/\./g, "\\.")).join("|");
  const pattern = new RegExp(`^(?:[a-z0-9-]+\\.)?(?:(?:${[...labels].join("|")})\\.)?(?:${domainRe})$`);
  for (const h of hosts) {
    if (!pattern.test(h.host)) err(`host ${h.host} violates <service>.<env>.<domain>`);
    const depth = h.host.split(".").length - (h.host.endsWith(".link") || h.host.endsWith(".com") ? 2 : 2);
    if (depth > 2) err(`host ${h.host} has more than two labels below the registrable domain`);
    if (seen.has(h.host)) err(`duplicate host ${h.host} (${seen.get(h.host)} and ${h.service}@${h.env})`); else seen.set(h.host, `${h.service}@${h.env}`);
    if (h.host.includes("localhost") || /^\d+\.\d+\.\d+\.\d+$/.test(h.host)) err(`host ${h.host} is not a public name`);
  }
  // coverage matrix: every core service has a host in test, pilot and prod; the three environments expose the same core service set
  for (const e of ["test", "pilot", "prod"]) {
    const set = new Set(hosts.filter((h) => h.env === e && h.core).map((h) => h.service));
    for (const s of reg.services.filter((x) => x.core)) if (!set.has(s.id)) err(`coverage: ${s.id} has no host in ${e}`);
  }
  // legacy
  for (const l of reg.legacy_hosts ?? []) {
    if (!envIds.includes(l.env)) err(`legacy ${l.id}: unknown env`);
    if (!svc.has(l.service)) err(`legacy ${l.id}: unknown service`);
    if (!/^[a-z0-9.-]+$/.test(l.host) || /^https?:/.test(l.host)) err(`legacy ${l.id}: host must be a bare hostname`);
    if (seen.has(l.host)) err(`legacy ${l.id}: collides with a canonical host`);
  }
  // https everywhere: templates carry no scheme other than the generated https; native schemes are listed separately
  for (const c of reg.oidc_clients) {
    if (!svc.has(c.service)) err(`oidc client ${c.id}: unknown service ${c.service}`);
    if (c.backchannel_service && !svc.has(c.backchannel_service)) err(`oidc client ${c.id}: unknown backchannel service`);
    for (const p of [...c.redirect_paths, ...c.post_logout_paths, ...(c.backchannel_path ? [c.backchannel_path] : [])]) if (!p.startsWith("/") || /^[a-z]+:/.test(p)) err(`oidc client ${c.id}: path ${p} must start with / (host and https come from the registry)`);
    for (const e of ["test", "pilot", "prod"]) if (!hostOf(reg, c.service, e)) err(`oidc client ${c.id}: service ${c.service} has no host in ${e}`);
  }
  for (const r of ["prod", "test"]) for (const x of redirectsFor(reg, r)) for (const u of [...x.redirect_uris, ...x.post_logout_redirect_uris]) if (!u.startsWith("https://")) err(`non-https redirect ${u}`);
  for (const [sid, list] of Object.entries(reg.cors ?? {})) { if (!svc.has(sid)) err(`cors: unknown service ${sid}`); for (const x of list) if (!svc.has(x)) err(`cors ${sid}: unknown service ${x}`); }
  for (const k of ["staff_app_host_service", "patient_app_host_service"]) if (!svc.has(reg.app_links[k])) err(`app_links.${k} unknown`);
  for (const n of reg.native_clients ?? []) for (const u of n.redirect_paths) if (/^https?:\/\//.test(u) && !u.startsWith("https://")) err(`native client ${n.id}: ${u} must be https or a custom scheme`);
  for (const sup of reg.superseded_hosts ?? []) { if (!svc.has(sup.replaced_by)) err(`superseded ${sup.host}: unknown replacement`); if (seen.has(sup.host)) err(`superseded ${sup.host} is also a canonical host`); }
  // certificates: every public host of an environment is covered by that environment's own certificate (one wildcard level)
  for (const c of certsFor(reg)) for (const h of c.hosts) if (!c.sans.some((s) => covers(s, h))) err(`certificate ${c.env}/${c.zone} does not cover ${h}`);
  // the production wildcard must NOT be (mis)used to cover a non-production host
  // (the environment apex such as test.kiorex.com is a single label and is covered by *.kiorex.com; that is accepted, service hosts are not)
  const prodCert = certsFor(reg).filter((c) => c.env === "prod");
  const apexHosts = new Set(hosts.filter((x) => !byId(reg).get(x.service).label).map((x) => x.host));
  for (const c of prodCert) for (const h of seen.keys()) { const he = seen.get(h).split("@")[1]; if (he !== "prod" && !apexHosts.has(h) && c.sans.some((s) => covers(s, h))) err(`production certificate ${c.zone} would also cover non-production host ${h}`); }
  return { errors, warnings, hosts };
}

// ---------------------------------------------------------------- hardcoded-domain scan
const DOMAIN_RE = /(?:https?:\/\/|["'`])((?:[a-z0-9-]+\.)*(?:kiorex\.com|kiorly\.com|kiorly\.link))\b/gi;
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".api-dist", ".e2e-dist", "dist-seed", "dist-w9a3", "e2e", "test", "tests", "__tests__", "infra", "Docs", "docs", "vendor", "cdk.out", ".expo", "coverage", "build", "playwright-report"]);
const SKIP_FILE = /(\.test\.|\.spec\.|\.d\.ts$|openapi|\.gen\.|seed|personas|dev-test-users|package-lock|\.json$|\.md$|\.html$|\.map$)/;
export function scanDir(dir, max = 4000) {
  const hits = []; let files = 0;
  (function walk(d) {
    if (files > max) return;
    let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !e.name.startsWith(".wt-")) walk(p); continue; }
      if (!/\.(ts|tsx|js|mjs|cjs|env|example|sample)$/.test(e.name) && !e.name.endsWith(".env.sample")) continue;
      if (SKIP_FILE.test(e.name)) continue;
      files++;
      const lines = fs.readFileSync(p, "utf8").split("\n");
      lines.forEach((line, i) => {
        const t = line.trim();
        if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("#")) return; // comments
        for (const m of line.matchAll(DOMAIN_RE)) {
          const host = m[1].toLowerCase();
          if (host.startsWith("schemas.")) continue; // immutable event-type identifiers, not network hosts
          hits.push({ file: path.relative(WORKSPACE, p), line: i + 1, host });
        }
      });
    }
  })(dir);
  return hits;
}

// ---------------------------------------------------------------- CLI
function main() {
  const args = process.argv.slice(2);
  const flag = (n) => args.includes(n);
  const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  let reg;
  try { reg = load(); } catch (e) { console.error(`registry parse error: ${e.message}`); process.exit(2); }
  const { errors, hosts } = checkAll(reg);

  if (flag("--print")) {
    for (const e of reg.environments) {
      console.log(`\n# ${e.id} (${e.tag}) plane=${e.plane} state=${e.state} data=${e.data_class}`);
      for (const h of hosts.filter((x) => x.env === e.id)) console.log(`  ${h.host.padEnd(34)} ${h.service.padEnd(20)} ${h.status}${h.dns === "none" ? " (no DNS)" : ""}`);
    }
  }
  const emit = val("--emit");
  if (emit) {
    const env = val("--env") ?? "test";
    if (emit === "cors") for (const s of Object.keys(reg.cors)) console.log(`${s}: CORS_ORIGINS=${corsFor(reg, s, env).join(",")}`);
    else if (emit === "redirects") console.log(JSON.stringify(redirectsFor(reg, reg.oidc.issuer_env[env]), null, 2));
    else if (emit === "certs") console.log(JSON.stringify(certsFor(reg), null, 2));
    else if (emit === "dns") for (const h of hosts.filter((x) => x.env === env && x.dns !== "none")) console.log(`${h.host}\t${h.service}\t${h.alias_of ? "alias of " + h.alias_of : h.kind}`);
    else if (emit === "env") {
      for (const s of reg.services) {
        if (val("--service") && s.id !== val("--service")) continue;
        if (!s.env || !s.envs.includes(env)) continue;
        for (const [k, v] of Object.entries(s.env)) console.log(`${s.id}\t${k}=${resolveTemplate(reg, v, env).replace("{cors}", corsFor(reg, s.id, env).join(","))}`);
      }
    } else { console.error(`unknown --emit ${emit}`); process.exit(2); }
  }

  // strict scan of samples, report scan of repos
  const sampleHits = [];
  for (const p of reg.code_scan.strict_paths) sampleHits.push(...scanDir(path.join(WORKSPACE, p)));
  for (const h of sampleHits) errors.push(`hardcoded domain ${h.host} in ${h.file}:${h.line} (samples must resolve URLs from configuration)`);
  const report = {};
  for (const p of reg.code_scan.report_paths) { const hits = scanDir(path.join(WORKSPACE, p)); if (hits.length) report[p] = hits; }
  if (flag("--scan")) {
    for (const [repo, hits] of Object.entries(report)) { console.log(`\n${repo}: ${hits.length} hardcoded host literal(s)`); for (const h of hits) console.log(`  ${h.file}:${h.line}  ${h.host}`); }
  }
  if (flag("--strict")) for (const [repo, hits] of Object.entries(report)) for (const h of hits) errors.push(`hardcoded domain ${h.host} in ${h.file}:${h.line}`);

  const counts = Object.fromEntries(reg.environments.map((e) => [e.id, hosts.filter((h) => h.env === e.id).length]));
  const reposWithHits = Object.entries(report).map(([r, h]) => `${r}:${h.length}`).join(" ") || "none";
  if (errors.length) { console.error(`\nregistry INVALID, ${errors.length} problem(s):`); for (const e of errors) console.error("  - " + e); process.exit(1); }
  console.log(`registry OK: ${hosts.length} hosts (${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")}); ${reg.services.length} services; ${reg.oidc_clients.length} OIDC clients; samples clean; repo literals (informational): ${reposWithHits}`);
}
// compare REAL paths: on macOS /tmp is a symlink to /private/tmp and a symlinked invocation path made main() silently not run (empty --emit output, empty deploy url files)
const real = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) main();
