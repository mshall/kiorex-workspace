# Service URL registry

ADR-059 (Proposed). The canonical, machine-readable registry is **`../registry/service-url-registry.yaml`**. This page explains it and shows a generated snapshot. If the snapshot and the YAML ever differ, the YAML wins; regenerate the snapshot with the commands below. No document, script or app may keep its own host list.

## 1. Files

| File | Purpose |
|---|---|
| `_docs/registry/service-url-registry.yaml` | the registry; the schema is documented in its header comment |
| `_docs/registry/validate-registry.mjs` | dependency-free validator and generator (Node 18+); never touches the network, AWS or DNS |
| `_docs/registry/samples/config.sample.ts`, `env.sample` | the pattern apps follow; the validator fails if a sample contains a domain |

## 2. How hosts are formed

`host = [service label, environment label, domain]` joined with dots, skipping empty parts. The environment label of `prod` is empty. Example: service `passport` (label `passport`, domain `kiorex`) in `test` gives `passport.test.kiorex.com`; the marketplace (empty label) in `prod` gives `kiorex.com`.

## 3. What the validator checks (`node _docs/registry/validate-registry.mjs`)

1. Founder tags: `test` = `kx-test`, `pilot` = `kx-pilot`, `prod` = `kx-pro`; prod label empty; pilot runs on the prod plane; `oidc.issuer_env.pilot` is `prod`.
2. Naming: every host matches `<service>.<env>.<domain>`, at most two labels below the registrable domain, service label is one DNS label and never equals an environment label.
3. Uniqueness across all environments, legacy and superseded hosts.
4. HTTPS: only registry-generated `https://` origins; client paths must start with `/`; no literal host or scheme inside any `env:` template; legacy hosts must be bare hostnames.
5. Coverage: every service marked `core` has a host in `test`, `pilot` and `prod`; OIDC clients resolve in all three.
6. Exposure: `gateway-only` and `internal` services have `dns: none`.
7. Certificates: every public host is covered by its own environment's certificate (`<env>.<domain>` plus one wildcard level), and the production certificate never covers a non-production service host.
8. Code samples: no domain in `_docs/registry/samples` (strict). Repositories are scanned in report mode; `--strict` makes the findings failures.

A negative run was verified on 27 Nov 2026 (bad label, literal host in a template, missing pilot coverage and a hardcoded host in a sample were all rejected).

## 4. Generating consumers

```
node _docs/registry/validate-registry.mjs --print                       # host table, every environment
node _docs/registry/validate-registry.mjs --emit cors --env test        # CORS_ORIGINS per service
node _docs/registry/validate-registry.mjs --emit redirects --env pilot  # OIDC redirect, post-logout, back-channel URIs (JSON)
node _docs/registry/validate-registry.mjs --emit env --env test --service kiorly.clinics   # env var values for one service
node _docs/registry/validate-registry.mjs --emit certs                  # ACM certificate names per environment
node _docs/registry/validate-registry.mjs --emit dns --env test         # records to create (never run by an agent)
node _docs/registry/validate-registry.mjs --scan                        # hardcoded host literals in the repositories
```

Rules of use: pilot output is the **production plane**: `--emit cors --env prod` already includes the pilot origins, and `--emit redirects` for either `pilot` or `prod` lists both (their clients share the production issuer). The legacy Clinic host appears in the `test` output only.

## 5. Snapshot (generated 27 Nov 2026)

Hosts for `dev` and `staging` follow the same pattern (`api.dev.kiorex.com`, `clinics.staging.kiorly.com`, ...) and are reserved, not provisioned. 83 names in total: dev 14, test 17, staging 14, pilot 17, prod 21.

| Service id | Kind, exposure | test (kx-test) | pilot (kx-pilot) | prod (kx-pro) | Status |
|---|---|---|---|---|---|
| `kiorex.marketplace` | web, public | `test.kiorex.com` | `pilot.kiorex.com` | `kiorex.com` | planned |
| `kiorex.api` | gateway, public | `api.test.kiorex.com` | `api.pilot.kiorex.com` | `api.kiorex.com` | planned |
| `kiorex.admin` | web, public | `admin.test.kiorex.com` | `admin.pilot.kiorex.com` | `admin.kiorex.com` | planned |
| `kiorex.passport` | idp, public | `passport.test.kiorex.com` | `passport.pilot.kiorex.com` (redirect only) | `passport.kiorex.com` | planned |
| `kiorex.ai` | internal, gateway-only | `ai.test.kiorex.com` (no DNS) | `ai.pilot.kiorex.com` (no DNS) | `ai.kiorex.com` (no DNS) | reserved |
| `kiorex.webhooks` | gateway, public-signed | `webhooks.test.kiorex.com` | `webhooks.pilot.kiorex.com` | `webhooks.kiorex.com` | planned |
| `kiorex.cdn` | assets, public | `cdn.test.kiorex.com` | `cdn.pilot.kiorex.com` | `cdn.kiorex.com` | reserved |
| `kiorex.widget` | web, public | `book.test.kiorex.com` | `book.pilot.kiorex.com` | `book.kiorex.com` | planned |
| `kiorex.developers` | static, public | n/a | n/a | `developers.kiorex.com` | reserved |
| `kiorex.docs` | static, public | n/a | n/a | `docs.kiorex.com` | reserved |
| `kiorex.status` | static, public | n/a | n/a | `status.kiorex.com` | reserved |
| `kiorex.support` | static, public | n/a | n/a | `support.kiorex.com` | reserved |
| `kiorly.marketing` | static, public | `test.kiorly.com` | `pilot.kiorly.com` | `kiorly.com` | reserved |
| `kiorly.app` | web, public | `app.test.kiorly.com` | `app.pilot.kiorly.com` | `app.kiorly.com` | planned |
| `kiorly.clinics` | web, public | `clinics.test.kiorly.com` | `clinics.pilot.kiorly.com` | `clinics.kiorly.com` | planned |
| `kiorly.pharmacies` | web, public | `pharmacies.test.kiorly.com` | `pharmacies.pilot.kiorly.com` | `pharmacies.kiorly.com` | planned |
| `kiorly.labs` | web, public | `labs.test.kiorly.com` | `labs.pilot.kiorly.com` | `labs.kiorly.com` | planned |
| `kiorly.admin` | web, public | `admin.test.kiorly.com` | `admin.pilot.kiorly.com` | `admin.kiorly.com` | reserved |
| `kiorly.api` | gateway, public | `api.test.kiorly.com` | `api.pilot.kiorly.com` | `api.kiorly.com` | planned |
| `kiorly.nurse` | alias, public | `nurse.test.kiorly.com` | `nurse.pilot.kiorly.com` | `nurse.kiorly.com` | alias |
| `kiorly.link` | web, public | `test.kiorly.link` | `pilot.kiorly.link` | `kiorly.link` | reserved |

Notes on the snapshot:
- `kiorex.passport` in pilot is a **redirect only**; pilot clients use `https://passport.kiorex.com` as issuer.
- `kiorex.ai` has no DNS record in any environment.
- `kiorly.nurse` is an alias of `kiorly.clinics` (the Nurse edition is detected by host today).
- `kiorex.widget` and `kiorly.link` are not in the founder brief and are not marked core; they need confirmation.
- `kiorly.admin`, `kiorly.marketing`, `kiorex.cdn` and the production-only shared hosts are reserved names with nothing behind them.

## 6. Legacy and superseded hosts

| Host | Environment | State |
|---|---|---|
| `d92iz83i79c05.cloudfront.net` | test | **live**: the Clinic with the real organisation Dr Ahmed Shall, distribution `E1DE0H2K3M17YL`, account 990597228737, eu-central-1. Kept permanently (`keep_until: never-without-founder-approval`); allowed in kx-test CORS and OIDC lists; the custom name is added to the same distribution |
| ADR-038 hosts (`account.kiorex.com`, `account.staging.kiorex.com`, `www.staging.kiorex.com`, `www.kiorly.com`, `clinic.kiorly.com`, `pharmacy.kiorly.com`, `lab.kiorly.com`, `api.clinic|pharmacy|lab.kiorly.com`, `ops.kiorex.com`, `staging.kiorly.link`) | none | never went live, so no compatibility is needed; each maps to a registry service in `superseded_hosts` |

## 7. Changing the registry

1. Edit the YAML in a branch of the workspace repository; run the validator.
2. The pull request shows the generated diffs for CORS, redirects and DNS (`--emit`); the founder approves anything that adds a public host, an issuer redirect URI or a DNS record.
3. Generated files in each product repository are refreshed from the registry (see `ENVIRONMENT_CONFIGURATION_STANDARD.md`). Never edit a generated file by hand.
4. Never put a secret, credential, account id other than the documented AWS account ids, or an internal IP in the registry.
