// Sample: how any Kiorex or Kiorly app resolves its URLs. No host name is written in code.
// Every value comes from the environment (generated from service-url-registry.yaml by the deploy pipeline).
export interface EnvConfig {
  envId: "dev" | "test" | "staging" | "pilot" | "prod";
  envTag: string;
  publicBaseUrl: string;
  oidcIssuer: string;
  corsOrigins: string[];
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set; generate it from the service URL registry`);
  return v;
}

export function loadEnvConfig(): EnvConfig {
  const publicBaseUrl = required("PUBLIC_BASE_URL");
  const oidcIssuer = required("OIDC_ISSUER");
  for (const u of [publicBaseUrl, oidcIssuer]) {
    const url = new URL(u);
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error(`${u} must be https`);
  }
  return {
    envId: required("KX_ENV") as EnvConfig["envId"],
    envTag: required("KX_ENV_TAG"),
    publicBaseUrl,
    oidcIssuer,
    corsOrigins: required("CORS_ORIGINS").split(",").map((s) => s.trim()).filter(Boolean),
  };
}

// A link is built from configuration, never from a literal host.
export const bookingLink = (cfg: EnvConfig, slug: string) => new URL(`/b/${encodeURIComponent(slug)}`, cfg.publicBaseUrl).toString();
