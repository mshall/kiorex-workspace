import { test } from '@playwright/test';
import { ensureSession, type PersonaName } from '../lib/session';

/** CDO review helper: refreshes saved sessions (a phone code each, only when the saved one is stale) for the personas named in KX_CDO_PERSONAS (comma list). Budget: max 8 codes per hour shared. */
const names = (process.env.KX_CDO_PERSONAS ?? '').split(',').filter(Boolean) as PersonaName[];
test.skip(names.length === 0, 'KX_CDO_PERSONAS not set');
for (const n of names) test(`session ${n}`, async ({ browser }) => { await ensureSession(browser, n); });
