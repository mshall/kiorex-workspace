# Kiorly-only ops role: where it stands and what the founder has to decide (28 Nov 2026)

Status: NOT implemented on purpose. Closing it needs a Passport role design decision, so nothing was guessed (task rule: no Passport schema or role design guesses).

## What exists today (verified in code)

- The Kiorly admin (`admin.<env>.kiorly.com`) is the same Ops console as the Kiorex admin, served on another host. The "edition" (`kiorex-platform/apps/ops/src/lib/edition.ts`) only decides brand and which routes the UI offers (`KIORLY_ROUTES`). It is a presentation choice, as `Docs/KIORLY_ADMIN.md` says.
- Roles come from the Passport access token claim `kx_roles` (`kiorex-platform/apps/api/src/auth/jwt-auth.guard.ts`, line 28). The guard is an any-of allow-list: an endpoint with `@Roles('ops_admin','super_admin')` refuses every role not listed (`FORBIDDEN_ROLE`). The roles used on the Ops API are `ops_admin`, `super_admin`, `finance`, `growth_admin` (28 controller files carry `@Roles`).
- Both editions sign in with the same Passport client `kiorex-ops` and the same roles, and call the same `/api/*`. So a person with `ops_admin` who signs in on the Kiorly host can call every Kiorex-only endpoint directly (bookings, moderation, liquidity, safety, held deposits, growth and acquisition, market policy): the Kiorly host just does not show them. Only a `super_admin` can change Kiorly markets; `ops_admin` reads (ADR-060), which is a role split by privilege, not by product.
- Passport declares the allowed values of the claim in `kiorex-account/config/idp.json` (`kx_roles.allowed`), maps it to the Cognito custom attribute `custom:kx_roles` through the pre-token trigger, requires TOTP for the baseline roles in `mfaPolicy.requiredForRoles`, and the Passport ops screens test for `ops_admin`/`super_admin` literally (`apps/dev-idp/src/routes.ts`, `requireOps`). A new role therefore touches the Passport schema, Cognito, the MFA baseline and the ops guard there.

## Why no small safe change exists

1. A guard by edition cannot be a security boundary. The API sees the same token and the same origin for both hosts; `Host`, `Origin` and `X-Forwarded-Host` are caller-controlled headers on a direct API call, and a CDN may rewrite them. A host check would stop only the honest UI.
2. The only enforceable key is the token: a role (or scope) claim. A new role is deny-by-default on every existing endpoint, which is safe, but it is useless until each Kiorly route is listed, and some Kiorly views read data that mixes products (orders carry patient identifiers, commissions and finance span the three provider types, flags, operations and outbox are global). Whether Kiorly ops may see those is a business and privacy decision, not a code detail.
3. The claim itself needs the Passport change above, plus who may grant it (a super admin only? maker-checker?).

## Options

| | What | Isolation | Cost | Risk |
|---|---|---|---|---|
| A. New role `kiorly_ops` (recommended) | Passport role, allowed in `idp.json`, Cognito attribute, MFA baseline; platform adds it to the `@Roles` of the Kiorly routes only (an explicit list of about 20 route groups, see `KIORLY_ROUTES`); everything else stays refused by default. Console: the Kiorly edition shows the role-limited views; the Kiorex edition refuses sign-in for it. | Endpoint level (strong) | Small to medium; Passport, platform, ops console, tests | Shared lists still contain Kiorex rows unless filtered (see phase 2) |
| B. Role plus scope claim (`kx_scope=kiorly`) | As A, plus a claim the API uses to filter rows by organisation type (clinic, pharmacy, lab) and by market | Endpoint and row level | Medium to large | More claims to maintain in Cognito |
| C. Host check in the API | Reject Kiorex-only routes when the Host is a Kiorly admin host | None (spoofable) | Small | False sense of security: rejected |
| D. Separate Kiorly admin API deployment | Own service exposing only the Kiorly routes | Strongest | Large (second deployment, signing, ops) | Duplicated operations |

## Recommendation

A in two phases. Phase 1: role `kiorly_ops` (read) and `kiorly_admin` (changes, never the Kiorly market launch which stays `super_admin`), deny-by-default, allow-list limited to the Kiorly routes that carry no patient identifiers (providers, onboarding, partner onboarding and leads, join requests, commission policy read, fees, markets read, plans). Phase 2 (only if the founder wants Kiorly ops to see finance and orders): row filters by organisation type and market, and a PHI review of the orders views. Keep `flags`, `operations`, `outbox`, `integrations`, `messaging` super_admin until decided.

## Founder decisions needed

1. Option A, B, C or D (recommended: A).
2. Role names and who may grant them (recommended: a `super_admin` grants, audited, MFA mandatory as for `ops_admin`).
3. Which Kiorly views a Kiorly-only ops person may open: the list above is the conservative default; orders, finance, reconciliation, payments connection, messaging, integrations, flags, operations and outbox need an explicit yes or no each.
4. Whether such a person may act as maker or checker in the commission maker-checker flow (recommended: no, `super_admin` only).
5. Whether the same person may also hold Kiorex roles (recommended: separate accounts, so one sign-in is never both).

## Tests to add once decided

Platform: a request with `kx_roles=['kiorly_ops']` gets 403 `FORBIDDEN_ROLE` on every route not on the list (generated from the OpenAPI route table, so a new route is refused by default) and 200 on the list. Passport: the role is accepted by the schema, appears in the token, is covered by the MFA baseline. Ops: the Kiorex edition refuses the role, the Kiorly edition shows only the allowed views.
