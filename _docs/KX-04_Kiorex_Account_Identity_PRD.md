# KX04 — Kiorex Account — Identity & Organizations PRD
Source: 1-bm4f7Fq3xic13WAe6knLwDC7V5Qb0ii

> Note: transcribed from PDF text extraction. Symbols dropped by the extractor (≥, ≤, →, +) were restored by inference where obvious; page headers/footers removed.

Subtitle: One login for every Kiorex and Kiorly product, contextual roles per organization, and a hard wall between identity and medical data.

Kiorex v2 · ecosystem reference. Authored in the role of Principal Identity Architect. Owns authentication, sessions, organization membership and account linking.

Tags: OIDC + PKCE · Patients first · Provider federation · Account linking · Build vs buy

| Field | Value |
|---|---|
| DOCUMENT | KX04 |
| REVISION | Rev 2.1 · Reference Edition |
| DATE | 19 November 2026 |
| STATUS | Approved reference |
| AUDIENCE | Founders, investors, engineering & operations leads |
| OWNER ROLE | Principal Identity Architect |
| SUPERSEDES | Kiorex v2 draft volumes 19 Nov 2026, 00000106 |

## Contents
01 Purpose and boundary · 02 Rollout strategy · 03 Identity model · 04 Flows · 05 Requirements · 06 Build versus buy

## 01 Purpose and boundary

Kiorex Account (internally 'Passport') authenticates people and asserts who they are and where they belong. It never decides who may read a chart.

Diagram: Kiorex Account (subject · credentials · sessions) --OIDC--> Kiorex app/web (patients); --OIDC (phase 2)--> Kiorly Clinic (providers); --OIDC--> Kiorly Pharmacy; --OIDC--> Kiorly Lab.

Each product is an OIDC client with its own audience. Authorization (roles, chart access, dispensing rights) stays inside each product.

| Kiorex Account owns | Kiorex Account never owns |
|---|---|
| Opaque global subject ID (sub), never derived from phone/email | Encounters, prescriptions, results, diagnoses |
| Verified phone, email, passkeys, TOTP | Clinical relationships (which doctor may see which patient) |
| Sessions, devices, refresh-token rotation, revocation | Marketplace orders and payment ledgers |
| Organization and facility membership assertions | Product roles that grant medical access by themselves |
| Consent receipts for identity processing | Patient medical identity merges (done in each product, reviewed) |

## 02 Rollout strategy

Patients first, providers later — Kiorly's launch never waits for identity work (ADR012).

Timeline: Phase 1 · M1–M6 patients on Kiorex → Phase 2 · M7–M12 Kiorly staff SSO opt-in → Phase 3 · M13+ Pharmacy & Lab native → Phase 4 enterprise SAML/OIDC federation.

| Phase | Scope | Kiorly impact | Exit criteria |
|---|---|---|---|
| 1 | Kiorex patient app/web authenticate via Kiorex Account (phone OTP + optional passkey) | None — Kiorly keeps JWT + refresh rotation + TOTP (ON02, SC04) | Patient sign-up p95 ≤ 60 s; OTP delivery ≥ 98% |
| 2 | 'Sign in with Kiorex' added to Kiorly as optional; account link via verified phone + password re-auth | New OIDC strategy alongside existing login; dual-auth window | ≥ 30% of active Kiorly users linked; zero lockouts |
| 3 | Kiorly Pharmacy and Lab ship with Kiorex Account only | — | Single sign-on across Clinic/Pharmacy/Lab for multi-business owners |
| 4 | Hospital/enterprise IdP federation; SCIM provisioning | Enterprise plan feature | First enterprise tenant on SSO |

## 03 Identity model

| Entity | Key | Fields | Notes |
|---|---|---|---|
| Subject | sub (ULID) | status, createdAt, locale, assurance level | Immutable; one per human |
| Contact | sub + type | E.164 phone, email, verifiedAt | Changeable; never a foreign key |
| Credential | id | passkey, TOTP, password hash (providers only) | Patients default to OTP + passkey |
| Session | session_id | device, client_id, auth_time, amr, expiry | Refresh rotation; reuse detection |
| Organization | org_id | legal name, country, product tenancy refs | Mirrors Kiorly tenant / pharmacy / lab tenant IDs |
| Membership | sub + org + role + period | role hint, invitedBy, effective/expiry | Hint only; product decides permissions |
| Guardian link | guardian_sub + dependant_ref | relationship, evidence, expiry (age of majority) | Dependants are patient subjects, not login users |
| Patient link | sub + product + patient_id | match evidence, confidence, reviewer | Never auto-merge on conflict |

## 04 Flows

### Patient sign-up and booking link
Participants: Patient app · Kiorex Account · Kiorex API · Kiorly Clinic

1. authorize (PKCE) + phone
2. OTP via WhatsApp/SMS
3. verify OTP
4. code → tokens (aud=kiorex)
5. book (access token)
6. booking with patient phone/national ID (Kiorex API → Kiorly Clinic)
7. match patient (Kiorly Clinic)
8. appointment + patient ref returned
9. store patient link (sub ↔ Kiorly patient)

### Provider SSO into Kiorly (phase 2)
- Kiorly login page shows 'Continue with Kiorex'. OIDC code flow; aud=kiorly-clinic.
- First time: Kiorly asks for existing Kiorly password (or OTP to employee phone) to link sub to the Kiorly user. Link recorded in Kiorly with audit.
- Kiorly keeps authorization: roles, clinic privilege grants, money visibility, privileged MFA guard. A Kiorex session alone never unlocks finance roles — TOTP step-up still applies (SC04).
- Revocation: Kiorex back-channel logout event revokes Kiorly sessions bound to that sid.

## 05 Requirements

Stable IDs for tickets and tests.

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
| KA09 | Organization and membership API for products; invitations single-use, expiring (7 days). | P2 |
| KA10 | Step-up authentication signal (acr, amr) consumed by products for money and clinical actions. | P2 |
| KA11 | Enterprise federation (SAML/OIDC) and SCIM provisioning. | P3 |
| KA12 | Tamper-evident audit stream for auth events with 2-year retention. | M |

(Priority column is as printed: M = must/MVP, P2 = phase 2, P3 = later. Comparison symbols for KA04 token lifetime inferred as ≤.)

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
