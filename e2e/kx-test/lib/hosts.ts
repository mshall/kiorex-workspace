import path from 'node:path';
import { fileURLToPath } from 'node:url';
// The canonical host list is the URL registry (never type a host into code). The registry module is plain ESM next to the docs.
// @ts-expect-error no types for the registry helper
import { load, hostOf, issuerFor } from '../../../_docs/registry/validate-registry.mjs';

export const ENV_ID: string = process.env.KX_E2E_ENV ?? 'test';
const registry = load();

const host = (service: string): string => {
  const h = hostOf(registry, service, ENV_ID) as string | null;
  if (!h) throw new Error(`registry has no host for ${service} in ${ENV_ID}`);
  return h;
};
const url = (service: string): string => process.env[`KX_E2E_URL_${service.replace(/\W/g, '_').toUpperCase()}`] ?? `https://${host(service)}`;

/** Every deployed origin the suite talks to, resolved from the registry (override one with KX_E2E_URL_<SERVICE_ID>, for example KX_E2E_URL_KIOREX_API). */
export const URLS = {
  patientWeb: url('kiorex.marketplace'),
  api: url('kiorex.api'),
  ops: url('kiorex.admin'),
  passport: url('kiorex.passport'),
  pharmacy: url('kiorly.pharmacies'),
  lab: url('kiorly.labs'),
  issuer: issuerFor(registry, ENV_ID) as string,
};
export const HOSTS = Object.fromEntries(Object.entries(URLS).map(([k, v]) => [k, new URL(v).host]));
export const NON_PRODUCTION = ENV_ID !== 'prod' && ENV_ID !== 'pilot';
export const here = path.dirname(fileURLToPath(import.meta.url));
