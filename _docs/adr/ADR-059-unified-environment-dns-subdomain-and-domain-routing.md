# ADR-059: Unified Environment, DNS, Subdomain and Domain Routing Strategy

**Status: Accepted by the founder's instruction of 27 Nov 2026 ('do your recommendations on my behalf'); formal signature line still open.** (Originally written as Proposed.) Written from the founder brief `_docs/briefs/ENV_DOMAIN_STANDARD_BRIEF.md`. Nothing here is deployed and no DNS, certificate or AWS change has been made. Founder signature needed. **Supersedes in part ADR-019 (domain roles stay) and the host table of ADR-038** (`kiorex-account/config/domains.json`; ADR-038's sign-in design, Kiorly Home and password handoff stay in force).

**Numbering.** Highest used number is ADR-057 (growth block, scheme A). ADR-058 is a retired label ("unused", KX-01 Rev 2.7) and is deliberately NOT reused, so old text that still says ADR-058 cannot collide. This is therefore the next free number: ADR-059. Home of the file: the workspace `_docs/adr/` (the canonical documentation repository). No repository has an ADR index of its own that overrides this: KX-01 (`_docs/rev23/KX-01_Decision_Log_ADRs.md`) is the register, and `clinics-management/Docs/adr` and `kiorex-platform/Docs/adr` hold repository copies of single ADRs. Repository copies of this ADR are optional pointers to this file.

## Context

Domains `kiorex.com` and `kiorly.com` are bought (domain.com and namecheap.com). No host is delegated, certified or deployed. Four earlier sources disagree with the founder's standard:

1. ADR-038 `config/domains.json` hosts: `account.kiorex.com`, `www.kiorly.com/signin`, `clinic.kiorly.com`, `nurse.`, `pharmacy.`, `lab.kiorly.com`, `api.clinic|pharmacy|lab.kiorly.com`, `book.kiorex.com`, `kiorly.link`, staging as `*.staging.*`.
2. `AWS_DEV_ENV_PLAN.md`: random CloudFront and App Runner hostnames, an SSM URL registry (`/kxdev/url/<product>`) and a two-pass bootstrap.
3. The live Clinic at `https://d92iz83i79c05.cloudfront.net/` (AWS account 990597228737, eu-central-1, distribution `E1DE0H2K3M17YL`) with the real organisation Dr Ahmed Shall.
4. Code defaults for production hosts in the platform, Clinic and mobile apps (listed in `DNS_AND_DOMAIN_ARCHITECTURE.md` section 9).

## Decision

1. **Five environments with a fixed vocabulary:** `dev`, `test`, `staging`, `pilot`, `prod`. Founder tags: `kx-test` = `test`, `kx-pilot` = `pilot`, `kx-pro` = `prod` (`kx-dev`, `kx-staging` follow). Only `test`, `pilot` and `prod` are provisioned; `dev` and `staging` are reserved names with no cost.
2. **One DNS pattern:** `<service>.<environment>.<domain>`; production omits the environment label (`passport.test.kiorex.com`, `passport.kiorex.com`). An empty service label is the environment apex (`test.kiorex.com`). Never more than two labels below the registrable domain, so one wildcard level always covers an environment.
3. **Role of each domain:** `kiorex.com` = patients, identity and platform (marketplace, `api`, `admin`, `passport`, `ai`, `webhooks`, `cdn`, plus prod-only `developers`, `docs`, `status`, `support`). `kiorly.com` = providers (`app` = Kiorly Home, `clinics`, `pharmacies`, `labs`, `admin`, `api`) and the public marketing site on the apex. `kiorly.link` (ADR-040 short links) stays reserved and is not in the founder brief, so it needs founder confirmation.
4. **The registry is the only source of truth:** `_docs/registry/service-url-registry.yaml`. Hostnames, CORS allow-lists, OIDC redirect and back-channel URIs, certificate names and DNS records are generated from it by `_docs/registry/validate-registry.mjs`. Application code never contains a domain.
5. **Pilot is a controlled production release:** `plane: prod`. Pilot hostnames front the same data plane as production, and **pilot clients use the production issuer `https://passport.kiorex.com`** (`passport.pilot.kiorex.com` is a redirect only). This is what lets pilot customers move to canonical production URLs with no data migration, no account re-creation and no re-login. Detail and the tension with the no-real-patient-data rule: `PILOT_ENVIRONMENT_STRATEGY.md`.
6. **Certificates per environment, never one shared wildcard:** `*.kiorex.com` does not cover `api.test.kiorex.com`. Each environment and domain gets its own ACM certificate for `<env>.<domain>` and `*.<env>.<domain>` (production: `<domain>` and `*.<domain>`). A non-production host never relies on the production certificate.
7. **DNS hosting:** Route 53 hosted zones, introduced by delegation of the **`test` child zone only** (two NS record sets at the registrars) so existing registrar records, mail and the founder's manual control stay untouched. Full-zone delegation of the apex domains happens before pilot. Reasoning and the cheaper alternatives: `DNS_AND_DOMAIN_ARCHITECTURE.md` section 3.
8. **Backward compatibility:** the CloudFront default domain of the live Clinic is never removed. The custom domain is added to the same distribution as an alternate domain name. The `cloudfront.net` host stays in the kx-test CORS and OIDC allow-lists as a registry `legacy_hosts` entry until the founder retires it.
9. **Cookie and credential isolation:** Passport and every product use host-only cookies with the `__Host-` prefix. `Domain=.kiorex.com` or `.kiorly.com` is forbidden in every environment (already the rule of ADR-038). Non-production secrets, clients and databases are never shared with production.
10. **Non-production is closed, not just hidden:** invitation-only accounts, no public sign-up, `X-Robots-Tag: noindex` and `robots.txt` at the CDN as secondary controls, an edge gate for non-listed visitors, and no real patient data outside the production plane (see the pilot document for the one declared exception in `test`).
11. **International routing is configuration:** `kiorex.com/{cc}` short entry routes redirect to the existing canonical `/{locale}/{cc}/...` URLs; Kiorly resolves the country from the organisation, not the host (`INTERNATIONAL_DOMAIN_ROUTING.md`).
12. **Configuration standard:** every app reads its URLs from environment variables whose names are fixed in `ENVIRONMENT_CONFIGURATION_STANDARD.md`; the deploy pipeline fills them from the registry. The AWS DEV plan's SSM URL registry and two-pass bootstrap are retired in favour of this (they were a workaround for random hostnames).

## Options considered

| Option | Verdict |
|---|---|
| Keep ADR-038 hosts and add environments as `*.staging.*` | Rejected: contradicts the founder pattern (`passport.` vs `account.`, `clinics.` vs `clinic.`), uses three label depths for APIs (`api.clinic.staging.kiorly.com`) that no single wildcard covers |
| Separate registrable domain for non-production (for example a second domain for test) | Strongest cookie isolation. Rejected for now because the brief fixes `*.test.kiorex.com`; kept as the documented fallback if a cross-environment cookie or takeover finding appears (section "Security" of `DNS_AND_DOMAIN_ARCHITECTURE.md`) |
| Pilot as a separate full stack with its own database | Rejected: it makes the pilot to production move a data migration with account re-creation, which the brief forbids |
| Registrar DNS or Cloudflare free instead of Route 53 | Viable and cheaper by about USD 1 per month; not chosen because the project already standardises on Route 53 and OpenTofu (ADR-028, KX-21 HB08), ACM validation and apex aliases are automatable there, and it removes about 40 manual record edits from the founder |

## Consequences

- **Cost (estimates, verify in the AWS billing console):** Route 53 about USD 1 per month for two test child zones plus about USD 0.40 per million queries (negligible), ACM public certificates free, CloudFront alternate domain names free, CloudFront Functions inside the free tier. The additional spend for the kx-test domain layer is about USD 1 to 3 per month. The environment itself is costed in `AWS_DEV_ENV_PLAN.md` (about USD 80 to 105 per month for the other products, unchanged by this ADR).
- **Work in code (not done here, see `ENVIRONMENT_STRATEGY.md` section 9):** `domains.json` is regenerated from the registry, the Clinic Nurse edition host detection and several production default hosts move to configuration, the staff app universal-link host moves from `www.kiorly.com` to `app.kiorly.com` before the first store build.
- **Founder approvals needed** before any of it becomes real: DNS records at both registrars, ACM certificates, provisioning and deploys. The list is in `ENVIRONMENT_STRATEGY.md` section 10.
- **Rollback:** every change is additive until the cloudfront.net host is retired. Removing a custom domain from a distribution returns to today's state.

## Open

- Founder to confirm `book.*` (widget host from ADR-044) and `kiorly.link` stay, and that `app.kiorly.com` is Kiorly Home rather than a clinic alias.
- Passport production IdP choice (Cognito default) is still open. `kx-test` runs the hardened dev IdP; if production uses a different IdP product, identities created in `kx-test` do not carry over (see pilot document, gap G-IDP).
- Counsel: whether the one real organisation in `kx-test` is acceptable under the Egyptian personal data regime. This ADR does not give legal advice and writes no legal wording.
