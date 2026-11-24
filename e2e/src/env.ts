export const PASSPORT = process.env.E2E_PASSPORT_URL ?? 'http://localhost:4400';
export const KIORLY = process.env.E2E_KIORLY_URL ?? 'http://localhost:3010';
export const KIOREX = process.env.E2E_KIOREX_URL ?? 'http://localhost:4000';
export const KIORLY_API = `${KIORLY}/api/v1`;
export const KIOREX_API = `${KIOREX}/api/v1`;
export const MKT = `${KIORLY}/marketplace/v1`;
/** E2E_SEC_STACK=1 points every DB helper at the throw-away sec_* clones (scripts/sec-stack.sh) used by the destructive security suite. */
/** E2E_DB_MAP="kiorex_platform=my_clone,kiorly=other" points single helpers at private clones (a lane running its own API instance); it wins over the sec_ prefix. */
const DB_MAP = new Map((process.env.E2E_DB_MAP ?? '').split(',').filter(Boolean).map((p) => p.split('=') as [string, string]));
export const DB = (name: string) => `postgresql://postgres:postgres@127.0.0.1:5433/${DB_MAP.get(name) ?? `${process.env.E2E_SEC_STACK && name !== 'kiorex_account' ? 'sec_' : ''}${name}`}`; // Passport (:4400) is shared, never cloned
export const MKT_KEY = 'kx_dev_client';
export const MKT_SECRET = 'kx_dev_secret_change_me';
export const WEBHOOK_SECRET = 'kx_dev_webhook_secret';
export const FLAGS_SECRET = 'ff_dev_secret_change_me';
export const PATIENT_1 = '+201000000001';
export const PATIENT_2 = '+201000000002';
export const SUPER_ADMIN = '+201000000099';
export const OTP = '000000';

// ---- vertical partners (kiorex-contracts 1.4.0, INTEGRATION.md "Vertical partners")
export const PHARMACY = process.env.E2E_PHARMACY_URL ?? 'http://localhost:3100';
export const LAB = process.env.E2E_LAB_URL ?? 'http://localhost:3200';
export const PHARMACY_API = `${PHARMACY}/api/v1`;
export const LAB_API = `${LAB}/api/v1`;
/** Dev partner registrations (kiorex-contracts PARTNER_DEV_DEFAULTS; seeded on both sides, local only). */
export const PH_PARTNER = { key: 'kx_dev_pharmacy_client', secret: 'kx_dev_pharmacy_secret_change_me', webhookSecret: 'kx_dev_pharmacy_webhook_secret', apiPath: '/marketplace/v1' };
export const LAB_PARTNER = { key: 'kl_dev_kiorex', secret: 'dev_kiorex_secret_change_me', webhookSecret: 'kx_dev_lab_webhook_secret', apiPath: '/api/v1/integration/v1' };
export const PHARMACY_PASSWORD = 'Demo@12345';
