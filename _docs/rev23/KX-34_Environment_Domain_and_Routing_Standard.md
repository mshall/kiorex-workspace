# KX34 — Environment, Domain and Routing Standard
Revision: Rev 2.8 · Reference Edition, 27 November 2026 (new volume; ADR-059 accepted by the founder on 27 Nov 2026)


Authored in the role of Chief Software Architect. Also acting Head of Platform.

Tags: Environments · DNS and certificates · URL registry · Passport SSO · OpenTofu · AWS and Huawei Cloud · Promotion rule

| Field | Value |
|---|---|
| DOCUMENT | KX34 (03 — Technical documents) |
| REVISION | Rev 2.8 · Reference Edition (27 Nov 2026) |
| DATE | 27 November 2026 |
| STATUS | Approved reference (ADR-059 accepted) |
| AUDIENCE | Founder, engineering, security reviewers, operations, counsel |
| OWNER ROLE | Chief Software Architect |
| SUPERSEDES | Host table of ADR-038 and the random-URL parts of the AWS dev plan |

## What changed in Rev 2.8

- New volume. It consolidates the environment, DNS, subdomain and domain routing standard (ADR-059) that lived in six Markdown files under `_docs/environments/`, and adds the founder decisions of 27 Nov 2026.
- ADR-059 is accepted. Environment tags: kx-test is `test`, kx-pilot is `pilot`, kx-pro is `prod`.
- Hosting: AWS for kx-test now; the founder's initial production decision is Huawei Cloud. Every environment is configurable through OpenTofu with one switch, `provider_name = aws | huawei`.
- The promotion rule: before moving to the next environment, ask whether to carry the previous one over or keep the two separate.
- Five new diagrams: environment and domain map, URL registry layout, DNS delegation and certificate flow, Passport single sign-on, CI/CD and provider switch.

## 01 Summary and decisions

One page for the founder: what is decided, what is built and what still needs a human.

<!-- kpis -->
- **3** Provisioned environments (test, pilot, prod; dev and staging are reserved names)
- **83** Registry hosts (17 test, 17 pilot, 21 prod, 14 dev, 14 staging)
- **2** Domains (kiorex.com, kiorly.com; kiorly.link pending)
- **1** Provider switch (aws or huawei) per environment

> **Decision** ADR-059 is ACCEPTED by the founder (27 Nov 2026). Pattern `<service>.<environment>.<domain>`; production omits the environment label. The registry file `_docs/registry/service-url-registry.yaml` is the only host list.

> **Decision** Hosting. kx-test runs on AWS today. The founder's initial decision for production (kx-pro) is Huawei Cloud, chosen for Egyptian data residency. Test or pilot may move to Huawei at any time, which is why each environment is configured through OpenTofu behind one provider switch.

> **Risk** Huawei Cloud region availability for Egypt, data residency and the Central Bank of Egypt (CBE) position are NOT asserted anywhere in this repository. The founder, with counsel, verifies them. The Huawei region variable is a placeholder on purpose so that a plan cannot run by accident.

> **Action needed** Founder: add the NS record sets for the `test` child zones at the two registrars after the zones exist; answer the open decisions in section 10; approve every apply and every deploy. No DNS record, certificate, zone or cloud resource has been created for the new environments yet.

| Area | State | What it means |
|---|---|---|
| ADR-059 standard | Accepted | Decided 27 Nov 2026; formal signature line still open |
| URL registry and validator | Done | Local; `validate-registry.mjs` passes; hosts not yet deployed |
| OpenTofu tree (`infra/tofu`) | Built, not applied | Validated only; AWS and Huawei modules share one interface |
| Clinic on AWS (kx-test) | Live | Deploys on 24 and 25 Nov 2026; deploy of `main` succeeded 27 Nov 2026 |
| DNS delegation, certificates | Planned | Founder-gated; nothing created |
| Production identity provider | Open | Cognito is the default; undecided |
| Huawei region and CBE check | Open | Founder and counsel |

## 02 Environments and planes

Three environments are provisioned. Two names are reserved. A **plane** is the set of databases, identity provider and keys that real data lives on.

<!-- kx-diagram: env-domain-map -->

| Founder tag | Environment id | DNS label | Data plane | Data class | Cloud today |
|---|---|---|---|---|---|
| kx-dev | dev | dev | dev | synthetic only | Reserved |
| **kx-test** | test | test | test | real at small scale: the real organisation Dr Ahmed Shall on the AWS Clinic, plus tagged dummy data | AWS (account 990597228737, eu-central-1) |
| kx-staging | staging | staging | staging | synthetic only | Reserved |
| **kx-pilot** | pilot | pilot | **prod** | real, larger cohort | Not provisioned |
| **kx-pro** | prod | none | prod | real, public | Huawei Cloud (initial decision), not provisioned |

> **Note** The real Clinic organisation Dr Ahmed Shall already runs on the AWS Clinic at its CloudFront address. That host stays valid permanently; the custom name `clinics.test.kiorly.com` is added to the same distribution later, after the founder approves. Kiorly Clinic was deployed to AWS on 24 and 25 Nov 2026 and the deploy of `main` succeeded on 27 Nov 2026. Only the Clinic is deployed; Kiorex, Passport, Pharmacy and Lab are not.

> **Risk** kx-test is declared as "synthetic plus one designated real organisation". It is a declared exception, not a loophole: one organisation, in the Clinic database that already has production-grade protection. Counsel has not yet said whether this fits the Egyptian personal data regime. Nothing here is legal advice.

### Environment rules

| Rule | kx-test | kx-pilot | kx-pro |
|---|---|---|---|
| Real data | one designated organisation plus dummy | yes, production controls | yes |
| Providers | mock by default; real mode only per `INTEGRATION_MODES` approval | per go-live runbook | per go-live runbook |
| Sign-up | invitation only | invitation only, tenant cohort | open per product rules |
| Indexing | noindex and edge gate | noindex until general availability | indexable |
| Deploy approval | the founder presses the button | required reviewers | required reviewers |
| Cookies | host-only | host-only | host-only |

## 03 Hostnames and the URL registry

Hostnames are derived, never typed. The registry lists domains, environments, services, CORS allow-lists, OIDC clients, app links and legacy hosts; the validator checks it and generates every dependent file.

<!-- kx-diagram: url-registry -->

| Domain | Roles in every environment | Production only |
|---|---|---|
| kiorex.com | marketplace (environment apex), `api`, `admin`, `passport`, `ai` (no DNS), `webhooks`, `cdn`, `book` (widget) | `developers`, `docs`, `status`, `support` |
| kiorly.com | marketing (apex), `app` (Kiorly Home), `clinics`, `pharmacies`, `labs`, `admin`, `api`, `nurse` (alias of `clinics`) | none |
| kiorly.link | reserved short links | none |

Examples: `passport.test.kiorex.com` and `passport.kiorex.com`; `clinics.test.kiorly.com` and `clinics.kiorly.com`. At most two labels sit below the registrable domain, so one wildcard level covers an environment. Internal services such as `ai` get no public DNS record.

> **Rule** No domain in application code. Applications read URLs from environment variables with fixed names; the deploy pipeline fills them from the registry. When `KX_ENV` is not local, an application refuses to start if a required URL is missing, is not https or points at localhost.

> **Needs human** Founder decisions still open on hosts: confirm `app.kiorly.com` is Kiorly Home, and confirm the widget host `book.*` and the short-link domain `kiorly.link` stay.

## 04 DNS, delegation and certificates

Route 53 is introduced by delegating only the `test` child zones; the same shape applies to the Huawei DNS service when a Huawei environment is used.

<!-- kx-diagram: dns-cert-flow -->

Steps (each reversible, none done yet):

1. Founder signs or amends ADR-059 (accepted 27 Nov 2026; signature line open).
2. The registry stays canonical; repositories add the generator and read-only validation in CI.
3. Create the two child zones for `test` (plan only); the founder adds one NS record set named `test` at each registrar.
4. Request one certificate per environment and domain; the validation CNAMEs live in the child zone.
5. Add `clinics.test.kiorly.com` as an alternate domain name on the existing Clinic distribution.
6. Stand up the other kx-test products using the registry names.
7. Before pilot: production IdP decision, production account, apex delegation, CAA, DNSSEC, pilot certificates, WAF and backups.

| Topic | Policy |
|---|---|
| Wildcard DNS records | Not used; only explicit records generated from the registry. Wildcards are for certificates only |
| TTL | 300 seconds for non-production and the first 30 days of a new host, then 3600 |
| Certificates | One per environment and domain, never one shared wildcard; a production wildcard never covers a non-production host |
| Mail | Existing mail records stay in the `kiorly.com` zone; never delegate a child zone that holds mail records |
| CAA, DNSSEC | At apex delegation, before pilot |
| Registrar edits | Founder only; agents never edit DNS |

> **Warning** Do not request or apply any DNS, certificate or cloud change without the founder in that moment. A push to Clinic `main` deploys; keep `[skip ci]` unless the founder asks for a deploy.

## 05 Edge, access and security

| Control | Where | State |
|---|---|---|
| Host-only cookies with the `__Host-` prefix; never `Domain=.kiorex.com` | Passport and every product | Planned code change |
| Invitation-only accounts, no public sign-up in test | Passport | Rule |
| Edge gate for non-listed visitors, `noindex` header and `robots.txt` | CDN, non-production | Planned |
| WAF, rate rules, backups, Multi-AZ | kx-pilot and kx-pro | Before pilot |
| HMAC-signed partner calls; mTLS only on partner demand | Products | Built |
| Private databases, no public database port | All environments | Rule; encoded in the OpenTofu database module |

> **Rule** Non-production and production never share secrets, OIDC clients, JWT keys, KMS keys, databases or buckets. The one deliberate overlap is pilot, which uses the production issuer on purpose.

## 06 Identity: Passport single sign-on

<!-- kx-diagram: passport-sso -->

| Environment | OIDC issuer | Note |
|---|---|---|
| kx-test | `passport.test.kiorex.com` | hardened dev IdP; identities may not carry over to production |
| kx-pilot | `passport.kiorex.com` | the production issuer; `passport.pilot.kiorex.com` is a redirect only |
| kx-pro | `passport.kiorex.com` | production issuer |

> **Decision** Pilot uses the production issuer. The issuer string is inside every token and every subject, so a different pilot issuer would turn every pilot user into a different account.

> **Needs human** The production-capable identity provider is still an open decision (Cognito is the default). The dev IdP refuses production mode, so identity carry-over from kx-test depends on this choice.

## 07 From pilot to production

Pilot is a hostname set plus a tenant cohort on the production plane, not a second stack. The move to canonical production URLs needs no data migration and no account re-creation.

Cutover steps (about one working day, outside clinic hours):

1. Lower the TTL of the pilot and canonical records seven days earlier.
2. Open the canonical hosts for pilot tenants.
3. Answer web GET and HEAD on `pilot.*` with a 301 to the canonical host; keep it at least 12 months.
4. Authentication: nothing to migrate; a user does one silent sign-in redirect.
5. APIs and webhooks keep serving as aliases for a published deprecation window (six months minimum) with Deprecation and Sunset headers.
6. Verify, with smoke tests against both host families. Rollback is turning the redirect function off.

> **Action needed** Counsel has not yet confirmed the pilot rule (real data on the production plane under a cohort gate). Real-money modes stay blocked until the counsel sign-off is recorded per market.

## 08 Infrastructure as code and the cloud switch

<!-- kx-diagram: cicd-provider-switch -->

The OpenTofu tree `infra/tofu` has one thin root per environment (`envs/test`, `envs/pilot`, `envs/prod`) that calls one composition, `modules/stack`. Each capability is a module with an identical interface on AWS and on Huawei Cloud. Hosts, certificate names and DNS records come from the registry.

### kx-test infrastructure plan

| Item | Plan |
|---|---|
| Compute | one cost-minimal host running docker compose: platform API and jobs, Passport, Pharmacy API, Lab API, Caddy; ARM; no SSH, access by SSM |
| Database | PostgreSQL never publicly reachable; on the host with data on its own encrypted volume, or a private managed instance |
| Backups | daily volume snapshots plus a daily dump to an encrypted bucket with lifecycle; a restore drill is documented |
| Edge | CDN in front of the host; origin port reachable from the CDN only; web apps from object storage |
| Secrets | containers only; values never in the repository or in state |
| Live Clinic | read-only reference; never managed, imported or destroyed by this tree |
| Cost | estimate of about USD 45 per month for the planned resources (an estimate, to be verified in Billing); not a quote |

| Step | Owner | State |
|---|---|---|
| `tofu validate` for every module on both clouds | Engineering | Done |
| State bucket, `tofu plan`, `tofu apply` for test | Founder | Open (never applied) |
| Huawei region, residency and CBE verification | Founder, counsel | Open |
| Switch an environment to Huawei: separate state, data dump and restore, DNS repoint | Founder | Procedure written |

> **Warning** Switching a cloud is a migration, not a rename. The old stack keeps running until the new one is healthy; decommission only on the founder's word.

## 09 The promotion rule

> **Decision** Whenever the founder asks to move to the next environment (test to pilot, pilot to prod), stop and ask first: "Do you want to carry the previous environment over (identities in Passport, organisations, patients, bookings, files) or keep the two separate?" Record the answer. Never promote data without that answer.

| Choice | What happens |
|---|---|
| Carry over | choose the data classes; dry-run report; backup and rollback first; identity carry-over needs a production-capable IdP; demo records are excluded unless the founder says otherwise |
| Keep separate | fresh accounts in the new environment; the old one stays as it is |

Demo (dummy) records are tagged for removal and removed from the user interfaces; the founder will say when they are deleted.

## 10 Open decisions and gates

| # | Item | Owner | State |
|---|---|---|---|
| 1 | Sign the ADR-059 signature line | Founder | Open |
| 2 | `app.kiorly.com` = Kiorly Home; keep `book.*` and `kiorly.link` | Founder | Open |
| 3 | Real identities in kx-test Passport: private network or keep real staff off it | Founder | Open |
| 4 | Production identity provider | Founder | Open |
| 5 | Counsel position on the real organisation in kx-test and on the pilot rule | Counsel | Open |
| 6 | Huawei Cloud region availability, residency and CBE rules | Founder, counsel | Open |
| 7 | NS delegation at the registrars, certificates, provisioning, every deploy | Founder | Blocked on approval |
| 8 | Production cloud account and apex delegation before pilot | Founder | Planned |

## 11 International routing

A new country is a configuration publication, not a new host. For Kiorex (patients) the country sits in the path: canonical `/{locale}/{cc}/...` (for example `/ar/eg/doctor/<slug>`), with short entry routes `/{cc}` answering 302 to the canonical URL. For Kiorly (providers) the country comes from the organisation and tenant configuration, never from the host. Only Egypt is live. Language, currency, tax lines, providers, communication channels, regulation and data residency are all country configuration.
