# KX04 — Kiorex Account — Identity & Organizations PRD
Source: 1yBWJ39HQkbeYBohg41bvLBMGyGeSKK6s
Revision: Rev 2.3 · Reference Edition (20 November 2026, Approved reference; supersedes KX04 Rev 2.1, 19 Nov 2026)

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
