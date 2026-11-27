# KX04 — Kiorex Account — Identity & Organizations PRD
Source: 1yBWJ39HQkbeYBohg41bvLBMGyGeSKK6s
Revision: Rev 2.8 · Reference Edition, updated 27 November 2026 (previous: Rev 2.4; ADR-059 accepted; Passport single sign-on diagram; issuers per environment; production IdP still open)

WHAT CHANGED IN REV 2.8: ADR-059 accepted (27 Nov 2026). New diagram of the single sign-on flow across Kiorly Home and the Kiorly modules, the issuer per environment (test, pilot and prod), and the open production IdP decision. Unchanged: protocol, clients, requirements.

> Cleaned from Drive text extraction; symbols restored where obvious; headers/footers removed. Owner: Principal Identity Architect. Audience: Founders, investors, engineering & operations leads. Tags: OIDC + PKCE · Patients first · Provider federation · Account linking · Build vs buy.

Subtitle: One login for every Kiorex and Kiorly product, contextual roles per organization, and a hard wall between identity and medical data.

## WHAT CHANGED IN REV 2.3
Profession, licences and patient addresses explicitly stay out of identity (ADR013, ADR029). Membership role hints add nurse, physiotherapist, dispatcher, assistant (KA09). New KA13 (patient address book lives in the Kiorex patient profile) and KA14 (multi-edition memberships).

## 01 Purpose and boundary
Kiorex Account (internally 'Passport') authenticates people and asserts who they are and where they belong. It never decides who may read a chart — or whether someone may practise.
Diagram: Kiorex Account (subject · credentials · sessions) —OIDC→ Kiorex app/web (patients); —OIDC (phase 2)→ Kiorly Clinic · Kiorly Nurse (providers; one client, edition-aware); —OIDC→ Kiorly Pharmacy providers; —OIDC→ Kiorly Lab providers.
Each product is an OIDC client with its own audience. Authorization (roles, chart access, dispensing rights, scope of practice) stays inside each product.
| Kiorex Account owns | Kiorex Account never owns |
|---|---|
| Opaque global subject ID (sub), never derived from phone/email | Encounters, prescriptions, results, diagnoses |
| Verified phone, email, passkeys, TOTP | Clinical relationships (which clinician may see which patient) |
| Sessions, devices, refresh-token rotation, revocation | Marketplace orders and payment ledgers |
| Organization and facility membership assertions | Product roles that grant medical access by themselves |
| Consent receipts for identity processing | Patient medical identity merges (done in each product, reviewed) |
| — | Professions, licences, verification evidence (kept in Kiorly, PRVER) |
| — | Patient addresses (kept in the Kiorex patient profile, KA13) |
(Last two rows are new; their left cells are empty in the extraction.)

## 02 Rollout strategy
Patients first, providers later — Kiorly's launch never waits for identity work (ADR012).
Timeline: Phase 1 · M1–M6 patients on Kiorex → Phase 2 · M7–M12 Kiorly staff SSO opt-in → Phase 3 · M13+ Nurse, Pharmacy & Lab native → Phase 4 enterprise SAML/OIDC federation.
| Phase | Scope | Kiorly impact | Exit criteria |
|---|---|---|---|
| 1 | Kiorex patient app/web authenticate via Kiorex Account (phone OTP + optional passkey) | None — Kiorly keeps JWT + refresh rotation + TOTP (ON02, SC04) | Patient sign-up p95 ≤ 60 s; OTP delivery ≥ 98% |
| 2 | 'Sign in with Kiorex' added to Kiorly as optional; account link via verified phone + password re-auth | New OIDC strategy alongside existing login; dual-auth window | ≥ 30% of active Kiorly users linked; zero lockouts |
| 3 | Kiorly Pharmacy and Lab ship with Kiorex Account only; Kiorly Nurse tenants created from M13 default to 'Sign in with Kiorex' | — | Single sign-on across Clinic/Nurse/Pharmacy/Lab for multi-business owners |
| 4 | Hospital/enterprise IdP federation; SCIM provisioning | Enterprise plan feature | First enterprise tenant on SSO |

## 03 Identity model
| Entity | Key | Fields | Notes |
|---|---|---|---|
| Subject | sub (ULID) | status, createdAt, locale, assurance level | Immutable; one per human |
| Contact | sub + type | E.164 phone, email, verifiedAt | Changeable; never a foreign key |
| Credential | id | passkey, TOTP, password hash (providers only) | Patients default to OTP + passkey |
| Session | session_id | device, client_id, auth_time, amr, expiry | Refresh rotation; reuse detection |
| Organization | org_id | legal name, country, product tenancy refs, edition hint | Mirrors Kiorly tenant / pharmacy / lab tenant IDs; edition CLINIC/NURSE is a display hint only |
| Membership | sub + org + role + period | role hint, invitedBy, effective/expiry | Hint only; product decides permissions and scope of practice |
| Guardian link | guardian_sub + dependant_ref | relationship, evidence, expiry (age of majority) | Dependants are patient subjects, not login users |
| Patient link | sub + product + patient_id | match evidence, confidence, reviewer | Never auto-merge on conflict |

## 04 Flows
### Patient sign-up and booking link
Participants: Patient app · Kiorex Account · Kiorex API · Kiorly Clinic. Steps: 1 authorize (PKCE) + phone → 2 OTP via WhatsApp/SMS → 3 verify OTP → 4 code → tokens (aud=kiorex) → 5 book (access token) → 6 Kiorex API → Kiorly with patient phone/national ID → 7 Kiorly matches patient → 8 appointment + patient ref returned → 9 store patient link (sub ↔ Kiorly patient).
### Provider SSO into Kiorly (phase 2)
- Kiorly login page (app.kiorly.com and nurse.kiorly.com) shows 'Continue with Kiorex'. OIDC code flow; aud=kiorly-clinic for both editions.
- First time: Kiorly asks for the existing Kiorly password (or OTP to the employee phone) to link sub to the Kiorly user. Link recorded in Kiorly with audit.
- Kiorly keeps authorization: roles, clinic privilege grants, money visibility, privileged MFA guard, scope of practice. A Kiorex session alone never unlocks finance roles — TOTP step-up still applies (SC04). Multi-edition: a nurse who works solo and for an agency has two memberships; the Kiorly app context switch shows each organization's edition name and branding (KA14).
- Revocation: Kiorex back-channel logout event revokes Kiorly sessions bound to that sid.

## 05 Requirements
| ID | Requirement | Pri |
|---|---|---|
| KA01 | OIDC Authorization Code + PKCE for public clients; confidential clients for servers; exact redirect URIs. | M |
| KA02 | Phone OTP (WhatsApp first, SMS fallback) with rate limits: 5 sends/phone/hour, 20/IP/hour, 5 attempts/challenge. | M |
| KA03 | Passkeys (WebAuthn) as optional second login method; TOTP for provider privileged roles. | M |
| KA04 | Access tokens ≤ 15 min; refresh 30 days with rotation and reuse detection; audience-specific tokens. | M |
| KA05 | Session list and remote revoke; back-channel logout to all clients. | M |
| KA06 | Guardian ↔ dependant links with evidence and automatic expiry at age of majority. | M |
| KA07 | Account deletion and export; deletion propagates subject.deleted event; products retain legally required records. | M |
| KA08 | Account linking with dual verification; reversible merge workflow with operator review. | P2 |
| KA09 | Organization and membership API for products; invitations single-use, expiring 7 days. Role hints: owner, admin, finance, doctor, physiotherapist, nurse, dispatcher, assistant, front desk — hints only. | P2 |
| KA10 | Step-up authentication signal (acr, amr) consumed by products for money and clinical actions. | P2 |
| KA11 | Enterprise federation (SAML/OIDC) and SCIM provisioning. | P3 |
| KA12 | Tamper-evident audit stream for auth events with 2-year retention. | M |
| KA13 | Patient address book (KXMHV01) lives in the Kiorex patient profile, encrypted at rest; never in tokens or claims. | P2 |
| KA14 | One subject may hold memberships in organizations of different editions; token carries org list only, edition shown by the product. | P2 |

## 06 Build versus buy
Do not hand-write identity. Choose a managed or proven open-source IdP using this scorecard.
| Criterion | Weight | What good looks like |
|---|---|---|
| Protocol correctness & security record | 25% | Certified OIDC, PKCE, passkeys, refresh rotation, no custom crypto |
| Phone-OTP and WhatsApp extensibility | 20% | Custom SMS/WhatsApp sender hooks; Arabic templates |
| Hosting region & data control | 15% | Runs in our AWS account/region; export of all user data |
| Operations & availability | 15% | Multi-AZ, backups, upgrade path, observability |
| Cost at 1M patients | 15% | Predictable; no per-MAU cliff that breaks unit economics |
| Migration fit | 10% | Import hashed credentials; custom claims; back-channel logout |
| Option | Fit | Notes |
|---|---|---|
| AWS Cognito | Good cost, native to stack | Customisation of OTP via Lambda triggers; passkeys support to verify |
| Keycloak (self-hosted) | Full control | Ops burden on a small team |
| Zitadel / Ory (managed or self-hosted) | Modern, passkey-first | Evaluate WhatsApp OTP extension and pricing |
**DECISION** Run a two-week spike with the top two options against the scorecard in month 1; record the result as an amendment to ADR012 (open question Q3).

## 07 Build status: OTP providers and clients (23 Nov 2026)
| Item | Status | Evidence and caveat |
|---|---|---|
| Phone OTP over WhatsApp with SMS fallback (KA-02) | Done (not live) | `kiorex-account` has env-driven real SMS and WhatsApp HTTP channels, delivery-status webhooks (`/webhooks/sms`, `/webhooks/whatsapp`) and dev simulators; when both are real the order is WhatsApp first, SMS second; the code is never logged in real mode and the dev inbox is off |
| Real vendor, sender id and WhatsApp authentication template | Blocked | Human: vendor contract, sender registration, Meta approval |
| Passport on the shared notification layer | Planned (step 2 of 5) | One SECURITY template, adapters over `provider.ts`; OTP bodies sent but never audited (KX24 §11) |
| Secret injection for the Cognito Lambda | Open | The Lambda reads secrets from environment variables; no deploy-time injection mechanism and no AWS route for status webhooks to `DeliveryStatus.handleWebhook` exist |
| Patient client `kiorex-mobile` (PKCE) | Done (dev) | Used by the Expo app |
| Staff app sign-in | Done (product login) / Planned (Passport) | Kiorly (the staff app) signs in per product with that product's own login; Passport sign-in for the staff app is not registered (the public client for the Kiorly app is part of ADR-033, Proposed, and NEEDS_HUMAN) |
| Dev demo logins | Done (DEV ONLY) | Phone OTP, staff and ops TOTP values live in `TEST_DATA.md`, never in this volume |

> **Risk** A Clinic user is linked to one Clinic tenant per Passport subject today; multi-organization staff switching in the app needs a schema change first (mobile risk R9, ADR-033).

## What changed in this revision (23 Nov 2026)
- Added §07 build status for OTP providers, Passport readiness and the mobile client.
- Identity model, flows and build-versus-buy are unchanged.
- Not verified: any real SMS or WhatsApp delivery.

## Growth Engine update (24 Nov 2026)
Labels: **As-built** (in code today), **Approved target** (Accepted ADR or FD), **Proposed** (ADR-041 to ADR-047, unsigned), **Roadmap**, **Open decision**, **Regulatory dependency**. Full legend in KX-27. Source: `_docs/growth/` reports of 24 Nov 2026. Nothing here is implemented unless marked As-built. Rev 2.4: where this section differs from the Rev 2.4 as-built update at the end of the volume, the end section wins.

- **Passport stays out of growth data.** No growth event and no visitor key is created in Passport (Proposed, ADR-045). Growth reads the Passport `sub` only after consent and links visitor touches to a `sub` only with consent.
- **Erasure**: the `subject.deleted` event (As-built) is the trigger for the Proposed growth erasure consumer (touchpoints, events, preferences; decisions reduced to origin and reason where a provider's financial record needs it, counsel to confirm).
- **Registration events**: `PatientRegistered` is a growth view derived from patient profile creation; no new Passport event (Proposed).
- **Widget sign-in**: Passport popup with PKCE inside the widget (Proposed); third-party cookies are not relied on.
- **Phone OTP verification** is the referee check for the Phase 2 referral programme (Roadmap).
- Not verified: any growth consumer of `subject.deleted` implemented.

## Rev 2.4 as-built update (24 Nov 2026)
Rev 2.4 verification (24 Nov 2026): checked against the repositories, with the suites re-run the same day (counts in KX-33 section 04). As-built means in code with a passing test on the local stack; that verification deployed and pushed nothing, and every provider is mocked. This section wins over the Growth Engine update above wherever they differ.

- **Passport clients (As-built, `config/idp.json`):** `kiorex-web`, `kiorex-widget` (public PKCE popup client of the booking widget), `kiorex-ops`, `kiorex-mobile`, `kiorly` (the staff app, scheme `kiorly://`), `kiorly-team` (legacy name, still accepted), `kiorex-passport-web`, `kiorly-clinic`, `kiorly-pharmacy-web`, `kiorly-lab-web`, and `kiorly-home` (public PKCE client of the one web sign-in at `www.kiorly.com/signin`, ADR-038). Staging and production registrations are config only.
- **Back-channel logout (As-built).** Passport posts a signed `logout_token` to the Clinic (`/api/v1/auth/kiorex/backchannel-logout`), Pharmacy and Lab (`/api/v1/auth/oidc/backchannel-logout`) and Kiorex. Receivers verify signature, issuer, audience, `typ`, events, `sid` or `sub`, store the `jti` against replay and end the matching sessions. **Defect found and fixed in Rev 2.4 work:** the Kiorex handler read every logout token as a plain session revoke, so `subject.deleted` never ran the patient and growth anonymisers after a Passport account deletion; the Kiorex event is now checked first (unit spec and e2e 28).
- **Kiorly Home handoff (As-built).** Product choice by tile; Method Passport opens `<product>/login?sso=passport&from=kiorly-home[&edition=NURSE]` and the product completes its own silent code flow; Method Password uses a single-use handoff code (256 random bits, SHA-256 stored, 30 seconds, bound to the product and the Home origin, never a token) through `POST /auth/handoff/login` and `/auth/handoff/exchange`; the fallback is the product's own login with a reason notice.
- **Per-organisation default sign-in (As-built, ADR-038 second amendment).** `defaultSignInMethod` is a tenant setting (migration `20261124150000_default_signin_method`); the Connect wizard offers to make Passport the default after Go live. e2e 20 and 21 cover staff Passport sign-in and web session revocation.
- **Staff phone linking (As-built, off by default in production).** The first Passport login links the unique active staff row with the same verified E.164 phone (Clinic `Employee.phone`, Pharmacy and Lab `StaffUser.phone`); no match, several matches or an unverified phone gives 401 or 403 `PASSPORT_NOT_LINKED`; never auto-created. `OIDC_PHONE_LINK=true` or `KIOREX_OIDC_PHONE_LINK=true` opts in. Owners can set the staff phone (strict E.164, unique per tenant, audited without the number).
- **Security (As-built):** the dev OTP master code is refused in production and codes are CSPRNG, stored only as a salted HMAC (Passport security test); production uses the managed IdP (Cognito) and the dev IdP is a reference only. Open from the edge sweep: a replayed authorization code is refused but the tokens of its first redemption stay valid (RFC 6749 advises revoking them).
- **Domains used by identity:** the staff app association claims `/open/*` only, so a Passport redirect to the web callback `/signin/callback` is never captured by the app.
- Tests: Passport 314 passing; real-stack specs for Kiorly Home and the staff app exist. Not verified: production Passport client, DNS and certificates.

## Rev 2.8: environments, issuers and single sign-on (27 Nov 2026, ADR-059 Accepted)

Passport hosts follow the pattern `passport.<env>.kiorex.com`: `passport.test.kiorex.com` for kx-test and `passport.kiorex.com` for production. **Pilot clients use the production issuer**, so pilot accounts, subjects and sessions carry into production with no migration; `passport.pilot.kiorex.com` is a redirect only. Redirect, post-logout and back-channel URIs of every client are generated from `_docs/registry/service-url-registry.yaml` (replacing the `TODO_NEEDS_HUMAN` values and the `account.kiorex.com` host of ADR-038). Session and CSRF cookies are host-only with the `__Host-` prefix; `Domain=.kiorex.com` is forbidden in every environment.

<!-- kx-diagram: passport-sso -->

| Environment | Issuer | Identity provider | State |
|---|---|---|---|
| kx-test | `passport.test.kiorex.com` | hardened dev IdP | Planned |
| kx-pilot | `passport.kiorex.com` | production IdP | Planned |
| kx-pro | `passport.kiorex.com` | production IdP | Planned |

> **Needs human** The production-capable identity provider is still an open decision (Cognito is the default). Identities created in kx-test on the dev IdP may not carry over to pilot or production (ADR-059 gap G-IDP).

> **Risk** The AWS dev plan puts the Passport test database in a public, SSL-only, password-protected shared RDS. That is not acceptable for real staff identities: either move it to the private network (a small cost) or keep real staff off the kx-test Passport until pilot. Founder decision pending.

> **Rule** Passport is called "Kiorex Account" in user-facing text; "Passport" stays an internal product name. Single sign-on across Kiorly Home, Clinic (and Nurse edition), Pharmacy and Lab uses the standard authorization code flow with PKCE; products never share a cookie.

