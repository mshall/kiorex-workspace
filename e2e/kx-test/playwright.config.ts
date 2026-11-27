import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Optional env file (git-ignored): e2e/kx-test/.env, see .env.example. Real environment variables win.
const dir = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(dir, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trimStart().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export default defineConfig({
  testDir: path.join(dir, 'tests'),
  outputDir: path.join(dir, 'test-results'),
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1, // one-time codes and TOTP steps are single use: sign-ins are serial
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: path.join(dir, 'playwright-report'), open: 'never' }]],
  use: { locale: 'en-US', ignoreHTTPSErrors: false, trace: 'retain-on-failure', screenshot: 'only-on-failure', actionTimeout: 20_000, navigationTimeout: 45_000 },
  // KX_E2E_HOST_RESOLVER_RULES (optional): Chrome --host-resolver-rules, for a workstation whose resolver still caches a negative answer for a brand new host name (for example "MAP app.test.kiorly.com 18.161.97.36").
  projects: [{ name: 'kx-test', use: { browserName: 'chromium', launchOptions: process.env.KX_E2E_HOST_RESOLVER_RULES ? { args: [`--host-resolver-rules=${process.env.KX_E2E_HOST_RESOLVER_RULES}`] } : {} } }],
});
