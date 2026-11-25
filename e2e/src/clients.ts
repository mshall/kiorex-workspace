import { KIOREX_API, KIORLY_API } from './env.js';
import { loginWithPhone, type Login } from './passport.js';
import { q, resetOtpLimits } from './db.js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Res<T = any> { status: number; body: T; headers: Headers }
async function call(base: string, method: string, path: string, token?: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res> {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, body: json, headers: res.headers };
}
export const kiorex = (token: string | undefined, method: string, path: string, body?: unknown, headers?: Record<string, string>) => call(KIOREX_API, method, path, token, body, headers);
export const kiorly = (token: string | undefined, method: string, path: string, body?: unknown, headers?: Record<string, string>) => call(KIORLY_API, method, path, token, body, headers);

export async function staffLogin(email: string, password = 'demo'): Promise<string> {
  const r = await kiorly(undefined, 'POST', '/auth/login', { email, password });
  if (r.status !== 200) throw new Error(`staff login ${email}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.accessToken;
}

const cache = new Map<string, Promise<Login>>();
/** Phone-OTP login (cached per process, per phone+client). */
export function patientLogin(phone: string, clientId = 'kiorex-web'): Promise<Login> {
  const k = `${phone}|${clientId}`;
  if (!cache.has(k)) cache.set(k, resetOtpLimits().then(() => loginWithPhone(phone, { clientId })));
  return cache.get(k)!;
}
/**
 * Ops super admin (kiorex-ops). Passport requires TOTP for this role and accepts each time step once, so the login is cached on disk
 * (.cache/ops-login.json, gitignored) and reused across test files while the token still works against the Kiorex API.
 */
export async function opsLogin(): Promise<Login> {
  const file = new URL(process.env.E2E_OPS_CACHE ? `file://${process.env.E2E_OPS_CACHE}` : '../.cache/ops-login.json', import.meta.url);
  try {
    const c = JSON.parse(readFileSync(file, 'utf8')) as Login;
    if (c.claims?.exp * 1000 - Date.now() > 120_000 && (await kiorex(c.accessToken, 'GET', '/admin/flags?product=kiorex')).status === 200) return c;
  } catch { /* no cache */ }
  const fresh = await patientLogin('+201000000099', 'kiorex-ops');
  try { mkdirSync(dirname(fileURLToPath(file)), { recursive: true }); writeFileSync(file, JSON.stringify(fresh)); } catch { /* cache is optional */ }
  return fresh;
}

export async function waitFor<T>(what: string, fn: () => Promise<T | undefined | false | null>, timeoutMs = 30_000, everyMs = 500): Promise<T> {
  const end = Date.now() + timeoutMs; let last: unknown;
  while (Date.now() < end) {
    try { const v = await fn(); if (v) return v; } catch (e) { last = e; }
    await new Promise((r) => setTimeout(r, everyMs));
  }
  throw new Error(`timeout waiting for ${what}${last ? `: ${(last as Error).message}` : ''}`);
}
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Kiorex pulls providers from Kiorly (admin sync) and returns the provider directory. */
export async function syncProviders(ops: string) {
  const r = await kiorex(ops, 'POST', '/admin/providers/sync?full=true');
  if (r.status !== 200) throw new Error(`sync ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}
export { q };
