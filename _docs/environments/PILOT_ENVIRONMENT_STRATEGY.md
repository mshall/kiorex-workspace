# Pilot environment strategy (kx-pilot)

ADR-059 (Proposed). Hostnames: `../registry/service-url-registry.yaml` (environment `pilot`, `plane: prod`). Nothing here is built or deployed.

## 1. What pilot is

Founder brief: pilot is a controlled production release for real customers, in larger numbers than kx-test, that must later become public production **without data migration, account re-creation or disruption**. Production-grade infrastructure, security, encryption, tenant-level access restrictions, invitation-based onboarding, tenant-level flags, release cohorts, production-grade backups and DR, full observability and audit logging, and separate pilot analytics.

Design that satisfies this with the least moving parts: **pilot is a hostname set plus a tenant cohort on the production plane, not a second stack.**

| Concern | Pilot | Why |
|---|---|---|
| Databases, object storage, KMS keys, backups | the production ones | A second copy would make pilot to production a data migration |
| Identity provider | `https://passport.kiorex.com` (the production issuer) | The issuer string is inside every token and every subject; a different pilot issuer means every pilot person is a different account |
| Hostnames | `*.pilot.kiorex.com`, `*.pilot.kiorly.com` served by the same distributions and services as production (alternate domain names), with their own ACM certificate | Pilot names can be retired without touching the production certificate |
| Who can sign in | invitation-only; tenant cohort `pilot` required (gap G-COHORT) | "Controlled release" |
| Release | feature flags per tenant and cohort (ADR-023 mechanism; super admin owns every flag; maker-checker) | "Release cohorts", no new mechanism needed except the cohort attribute |
| Indexing | `noindex` and edge gate until general availability | Real people but not public |
| Analytics | events carry `cohort=pilot`; separate dashboard; k >= 10 floors and no PHI in growth events stay (handoff rule 10) | "Separate pilot analytics" |
| Observability and audit | the production alarms, dashboards and audit logs, filterable by cohort | one pipeline to trust |
| Money | real-money modes stay blocked until counsel sign-off is recorded per market (never marked approved on the founder's behalf) | hard rule, unchanged |

## 2. Transition: pilot URLs to canonical production URLs

Goal: the pilot customer notices nothing except a new address. Everything below is reversible until the pilot hostnames are retired.

**Before pilot starts (so the transition is trivial later)**
1. Register the production redirect URIs in the same Passport clients from day one (the registry already emits pilot and prod URIs together for the production issuer). No client change at cutover.
2. Mobile apps shipped to the stores always use the canonical production hosts and the production issuer; pilot customers are recognised by cohort, not by host. Then no app update is needed at cutover and universal links are never associated with `*.pilot.*` hosts.
3. Every outgoing link (WhatsApp, e-mail, SMS, calendar, booking links) is built from the configured public base URL of the environment (`ENVIRONMENT_CONFIGURATION_STANDARD.md`), never typed. Calendar UIDs (`<id>@kiorex.com`) are identifiers and are never changed.
4. Partners and providers integrate against `api.pilot.*` and `webhooks.pilot.*` only as long as the founder wants them to; give them the canonical names from the start where possible.

**Cutover runbook (about one working day, outside clinic hours)**
1. Lower TTL of the pilot and canonical records to 300 seconds seven days earlier.
2. Open the canonical hosts for pilot tenants (they already serve the same plane; pilot tenants are allowed because the cohort gate is lifted for general availability, or kept on for a staged release).
3. **Web pages:** configure `pilot.*` web hosts (`pilot.kiorex.com`, `clinics.pilot.kiorly.com`, `app.pilot.kiorly.com`, ...) to answer **301 Moved Permanently** for GET and HEAD to the same path on the canonical host (CloudFront Function, toggle without a deploy). Bookmarks and old links keep working; search engines never saw them (`noindex`). Keep the redirect at least 12 months.
4. **Authentication:** nothing to migrate. Passport sessions live on `passport.kiorex.com` and are untouched; a user landing on a canonical host with no host-only session cookie does one silent authorization-code round trip (a redirect, no password) and is signed in. Session cookies are host-only by design, so they cannot be carried across hosts: this single redirect is the only visible effect. Refresh tokens and subjects are unchanged because the issuer is unchanged.
5. **APIs and webhooks (do not redirect):** POST bodies and signed requests do not survive redirects reliably. `api.pilot.*` and `webhooks.pilot.*` keep serving as full aliases of the canonical services for a published deprecation window (recommended six months minimum) and answer every response with `Deprecation` and `Sunset` headers (RFC 9745 and RFC 8594) naming the canonical host. Before the window ends, a report lists which partners still call the pilot names. **To verify before pilot:** that the HMAC canonical string of signed partner requests does not include the Host header; if it does, both hosts must be accepted.
6. **OIDC:** unchanged. After the retirement of the pilot hostnames, remove the pilot redirect URIs from the clients (the registry output shrinks; the validator keeps it consistent).
7. **Cohort:** tenants leave the `pilot` cohort when their flags are promoted; analytics keep the `pilot` tag in history.
8. **Verification:** row counts and checksums are unchanged because nothing was moved (there is no migration job to run); smoke tests run against both host families; the issuer discovery document is identical.
9. **Rollback:** turn the redirect function off; pilot hosts serve again. No data step to undo.
10. **Retire:** after the window, remove the alternate domain names and the pilot certificate, delete the pilot records (the registry marks the environment `retired`; DNS removal is a founder-approved change).

## 3. The tension: "pilot = production-grade with real patient data" versus "no real patient data outside production"

The two statements pull apart:
- The founder brief (section 7 and section 3) says pilot onboards real provider and patient accounts, and also says there must be no real patient data in non-production environments.
- The repository's practice is that only the production environment carries real data: KX-21 makes staging synthetic, the AWS DEV plan builds a public-RDS, synthetic-data-only test stack, and handoff rule 7 holds every deploy.
- Reality today contradicts the rule in the other direction: the live Clinic in kx-test already holds a real organisation (Dr Ahmed Shall), with real staff and possibly real patients, on a stack that is production-grade only by accident of how the Clinic was first deployed.

Options:

| Option | Meaning | Assessment |
|---|---|---|
| **A (recommended)** | Redefine the rule by **plane**: real patient data may live only on the *production plane*, which has two hostname sets, `pilot` and `prod`. Pilot is production, with a cohort gate. kx-test keeps one declared, minimal exception (the existing Clinic organisation) until that organisation moves to pilot | Consistent with the brief's goal of no migration; one set of controls to build and audit; makes the existing reality explicit |
| B | Pilot as a separate stack with its own database, real people, then migrate to prod | Violates "no data migration, no account re-creation"; two production-grade stacks cost about double; real data in a second place doubles the audit surface |
| C | Pilot with synthetic data only until GA | Safe, but then it is not a pilot of real customers; contradicts the brief |

**Recommendation: A, with these conditions (all must be true before the first real pilot customer, and they are the same gates as for production):**
1. The production plane exists: separate AWS account (HB05), Multi-AZ database with backups and a tested restore, KMS keys, WAF, alarms, budgets (KX-21 HB01 to HB09), least-privilege deploy roles (not the AdministratorAccess role used for kx-test).
2. Counsel confirms the legal basis, consent texts and data-residency position per market; this standard writes no legal wording. The counsel gate for real-money modes stays NOT_REVIEWED until counsel signs.
3. External penetration test and the open pentest findings closed (handoff section 7, NH017); production IdP chosen (gap G-IDP).
4. Pilot tenants are invited, flagged and listed; patient-facing consent and a documented incident process exist (PDPC breach runbook already in the Clinic repo).
5. The founder records the rule change in the decision log (an amendment to this ADR); until signed, the rule "no real patient data outside production" is read literally and the pilot start is blocked.
6. Honest note about kx-test: the existing real organisation is a declared exception, not a precedent. Do not add further real clinics or patients to kx-test; they go to pilot. If counsel says the exception is not acceptable, the fallback is to freeze that clinic's real usage until pilot exists (a business decision for the founder, not for this document).

## 4. Gaps specific to pilot

| Id | Gap | Needed |
|---|---|---|
| G-IDP | The IdP running today is the hardened dev IdP, which refuses `NODE_ENV=production`; production IdP choice (Cognito default) is open. Accounts created in kx-test on the dev IdP would not become pilot accounts if the product changes | Decide the production IdP before pilot; plan an import of the few kx-test identities (a one-off, for the designated organisation only) |
| G-COHORT | A tenant `cohort` attribute (pilot, ga) is not a documented field today; flags exist per scope and per tenant (ADR-023, ADR-047) | Confirm an existing tenant flag can carry the cohort, otherwise add a configuration kind through maker-checker |
| G-HOST | Whether signed partner requests bind the Host header | Verify in `kiorex-contracts` and the three provider clients |
| G-SHARED-CERT | CloudFront alternate domain names require the certificate in the same account as the distribution | Pilot and prod distributions in one account; DNS in Route 53 of that account |
| G-ANALYTICS | `cohort` tag on growth and operational events and a pilot dashboard | Add to the event envelope as additive field (contracts minor version) |
| G-RETENTION | Pilot data is production data: retention, deletion and export rules apply from day one | Use the existing retention volumes (KX-25) |
