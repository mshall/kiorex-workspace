# Founder brief: unified environment, domain and subdomain standard (27 Nov 2026)

Written by the founder (pasted into the session) and condensed here without changing the meaning. This is the source brief for the ADR and the documents it asks for. Domains: `kiorex.com` and `kiorly.com`, both bought (domain.com and namecheap.com); DNS is NOT controlled by agents; the founder edits registrar records.

## Founder additions (same day)
- Environment tags the founder uses: **kx-test** (current on-the-ground testing with a few pharmacies, labs and clinics), **kx-pilot** (pilot phase, bigger number), **kx-pro** (major release / production). Map to identifiers `test`, `pilot`, `prod`; document the mapping.
- kx-test links to the already deployed AWS Clinic (https://d92iz83i79c05.cloudfront.net/, AWS account 990597228737, eu-central-1). The Clinic must work with Passport and the other products. What matters most now: the real organisation **Dr Ahmed Shall** on the AWS Clinic must keep working; it is an actual clinic being tested; more labs, clinics, pharmacies and patients follow. Minimum cost.
- Full end-to-end testing over AWS is the goal.

## 1. Objective
Establish a unified, production-grade environment, domain and subdomain naming standard across the Kiorex and Kiorly ecosystem: the official architectural reference for all current and future repositories, applications, services, infrastructure, integrations and CI/CD.

## 2. Discovery and assessment (before any change)
Scan all Kiorex and Kiorly GitHub repos; review architecture docs, PRDs, ADRs, infrastructure configs and deployment workflows; review the latest Kiorex V2 documentation on Google Drive; find existing URLs, hardcoded domains, env vars, API endpoints and cross-platform dependencies; find conflicts between the standard and existing decisions; preserve backward compatibility with working deployments.

## 3. Environment names
dev (development and CI), test (QA, automated and integration testing), staging (UAT, performance, release validation), pilot (controlled onboarding of real customers), prod (public commercial operations). DNS pattern `<service>.<environment>.<domain>`; production omits the environment label. Domains stay configurable, never hardcoded in business logic.

## 4. Kiorex URL registry (test / pilot / prod)
Marketplace test.kiorex.com / pilot.kiorex.com / kiorex.com. API gateway api.test.kiorex.com / api.pilot.kiorex.com / api.kiorex.com. Super Admin admin.*. AI gateway ai.*. Passport passport.*. Same pattern for dev and staging. AI and other internal services are not publicly exposed except through an authenticated gateway.

## 5. Kiorly URL registry (test / pilot / prod)
Main app app.test.kiorly.com / app.pilot.kiorly.com / app.kiorly.com. Clinics clinics.*. Pharmacies pharmacies.*. Labs labs.*. Super Admin admin.*. API gateway api.*. Reserve kiorly.com for the public marketing site, product info, plans, lead generation and provider onboarding. Kiorly modules work standalone and integrated with the Kiorex marketplace. Future modules follow the same convention.

## 6. Shared ecosystem services (production)
Passport/SSO passport.kiorex.com; developers.kiorex.com; docs.kiorex.com; status.kiorex.com; support.kiorex.com; webhooks.kiorex.com; cdn.kiorex.com. Passport stays the unified IdP (standards-based auth, cross-domain SSO). Do not duplicate shared capabilities. Databases, brokers, caches, observability, secrets and internal comms stay private.

## 7. Pilot environment
Treat pilot as a controlled production release: production-grade infra, security, encryption, real provider and patient accounts, tenant-level access restrictions, invitation-based onboarding, tenant-level flags, release cohorts, production-grade backups and DR, full observability and audit logging, separate pilot analytics, no real patient data in non-production environments. Prefer logical isolation inside production infra where appropriate. Goal: pilot customers move to public production without data migration, account recreation or disruption. Document how pilot URLs transition to canonical production URLs preserving authentication, bookmarks and integrations.

## 8. International expansion
Launch new countries by configuration, not separate codebases. Kiorex marketplace country routing: kiorex.com/eg, /sa, /ae, /kw, /qa, /bh, /om, /gb. Kiorly resolves country configuration through organisation and tenant configuration, not country subdomains. Country-specific: language, currency and tax, payment providers, communication providers, healthcare regulation, licensing, data residency and regional infra, subscription pricing, marketplace commission models, feature availability, working days and time zones, legal agreements and consent. Public domain names are independent of the physical hosting region.

## 9. DNS, networking and security (document the recommended approach)
DNS management; wildcard records; TLS certificate management and auto renewal (note `*.kiorex.com` does NOT cover `api.test.kiorex.com`: define per-environment certificates); CDN and WAF; API gateways and ingress; private DNS and service discovery; DDoS; rate limiting; CORS; OAuth/OIDC redirect URIs; cross-domain authentication; environment-specific secrets; network and environment isolation; DNS failover and DR; mobile universal links and deep links; search-engine indexing restrictions for non-production (real authentication and access controls, not only robots.txt/noindex); sibling-subdomain and cookie security so a compromised non-production app cannot affect production authentication.

## 10. Environment configuration and CI/CD
A centralised, provider-agnostic configuration standard: environment identifiers, app base URLs, API endpoints, Passport endpoints, OAuth client IDs and redirect URLs, webhook endpoints, CDN URLs, allowed origins, feature flags, country and regional configuration, environment-specific infrastructure references. Every app resolves its URLs and integration endpoints through environment configuration. Document integration with GitHub Actions, IaC, Terraform, containers, Kubernetes where applicable, cloud secret management, deployment approvals, release promotion, rollback, environment-specific integration testing. Avoid unnecessary cost: cost-efficient initial launch in Egypt, scalable to regional and international expansion.

## 11. Documentation deliverables
ADR "Unified Environment, DNS, Subdomain and Domain Routing Strategy" (next available number per the repo convention). Reference documents, adapting names and locations to the existing documentation structure: ENVIRONMENT_STRATEGY.md, DNS_AND_DOMAIN_ARCHITECTURE.md, SERVICE_URL_REGISTRY.md, PILOT_ENVIRONMENT_STRATEGY.md, INTERNATIONAL_DOMAIN_ROUTING.md, ENVIRONMENT_CONFIGURATION_STANDARD.md. A centralised machine-readable URL registry (YAML or JSON) consumable by deployment automation and config validation. One source of truth: other repos reference the canonical docs.

## 12. Update Kiorex V2 documentation
Update the real repository docs and the Google Drive documents (architecture, infrastructure, deployment and operational readiness, international expansion, Passport identity, pilot and production launch, master index and repository mapping). Preserve unrelated content. If access is unavailable, name the documents that could not be updated.

## 13. Execution boundaries
Authorised: assess configurations, create and update architecture documents, establish the canonical URL registry, document implementation requirements, identify gaps, prepare a migration plan. NOT without the founder's explicit approval: modify live DNS records, provision cloud infrastructure, purchase certificates, domains or cloud services, deploy to any environment, modify live production configuration, break existing integrations, migrate healthcare or customer data, perform destructive infrastructure changes. Anything needing those is proposed separately for approval.

## 14. Final deliverables
Final recommended architecture; complete environment and service URL registry; architecture diagrams; decisions and rationale; security and compliance considerations; conflicts and technical gaps; required future changes by repository; infrastructure and operational cost implications; documentation files created or updated; Google Drive documents updated; recommended implementation sequence; actions requiring approval. Act as Principal Enterprise Architect, Platform Engineering Architect, DevSecOps Lead and Healthcare SaaS Architect; production-grade, security-first, cost-efficient, cloud-provider-agnostic.
