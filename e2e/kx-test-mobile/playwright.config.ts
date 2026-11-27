import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Mobile smoke suite against the DEPLOYED kx-test hosts: the two Expo apps (patient "Kiorex", staff "Kiorly") exported as web builds with the kx-test profile
 * (hosts from the URL registry, `config/env/test.env` of each app), served on private loopback ports, talking to the live API / Passport / product APIs.
 * Native-only behaviour (secure store, ASWebAuthenticationSession, push, deep links) is covered on device and by the testing guide, not here.
 *   build:  e2e/kx-test-mobile/scripts/build-web.sh        run:  npx playwright test -c e2e/kx-test-mobile
 */
const dir = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  testDir: path.join(dir, 'tests'),
  outputDir: path.join(dir, 'test-results'),
  timeout: 150_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1, // one-time codes are single use: sign-ins are serial
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: path.join(dir, 'playwright-report'), open: 'never' }]],
  use: {
    locale: 'en-US', viewport: { width: 412, height: 860 }, trace: 'retain-on-failure', screenshot: 'only-on-failure', actionTimeout: 20_000, navigationTimeout: 45_000,
    // the web build is served from a loopback origin that the deployed CORS allow-lists (correctly) do not contain; native apps have no CORS. Only this suite relaxes it.
    launchOptions: { args: ['--disable-web-security'] },
  },
  projects: [{ name: 'kx-test-mobile', use: { browserName: 'chromium' } }],
});
