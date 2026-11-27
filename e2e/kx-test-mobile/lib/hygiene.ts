import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

/** Hosts a mobile web build may talk to on kx-test: only registry hosts (never localhost, never a literal typed in the app). */
export const collect = (page: Page) => {
  const hosts = new Set<string>(); const bad: string[] = []; const errors: string[] = [];
  page.on('request', (r) => { try { const u = new URL(r.url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname) && u.protocol.startsWith('http')) hosts.add(u.hostname); } catch { /* data: */ } });
  page.on('response', (r) => { if (r.status() >= 500) bad.push(`HTTP ${r.status()} ${r.url().slice(0, 120)}`); });
  page.on('pageerror', (e) => errors.push((e.stack ?? e.message).slice(0, 400)));
  return { hosts, bad, errors };
};

/** Every string of the exported JS bundles (the shipped code). */
export const bundleText = (dir: string): string => {
  const js = path.join(dir, '_expo/static/js/web');
  return fs.readdirSync(js).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(js, f), 'utf8')).join('\n');
};
