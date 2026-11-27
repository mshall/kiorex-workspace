# ADR-060: An organisation belongs to its country for life, and the Kiorly admin launches Kiorly markets through the Clinic

**Status: Accepted by the founder's instruction of 27 Nov 2026 (decisions A, B and C).** Implemented in the Clinic, Pharmacy, Lab and the Kiorex platform; tests green locally; deployment notes in section 8. Numbering: next free number after ADR-059.

## Context

1. The Clinic owns the `Market` table (DRAFT/LIVE/SUNSET and ACTIVE/PAUSED/DISABLED). Its Platform, Market launch screen could not create a market (the form sent only some of the fields the API requires), wrote no audit row or approval record for Go live, Pause, Disable or Enable, and showed no message when Go live failed (the go-live guide for Egypt, section 4.4, lists these gaps).
2. Nothing stopped a provider organisation from being associated with a different country than the one it was created in: the Kiorex provider sync did not carry the Clinic's market (a Saudi clinic would have been projected as `EG`, the column default), a partner re-registration overwrote the market, search listed every live market together, and the Kiorex booking did not compare the patient's and the provider's market.
3. The Kiorly admin edition of the Ops console (`admin.<env>.kiorly.com`, ADR-059 service `kiorly.admin`) had no market view.

## Decision A: an organisation belongs to its country for life

- **No market switch exists for Pharmacy, Lab or Clinic organisations.** The country is chosen when the organisation is created and never changes. If the organisation is connected to Kiorex it appears **only** in the Kiorex market of its own country (Egypt organisations only in Kiorex Egypt).
- Enforced in depth, per product:
  - **Clinic**: no API changes `Tenant.marketId`; a clinic's `country` is refused when it differs from the organisation's market on create (`409 ORG_MARKET_MISMATCH`) and on update (`409 ORG_COUNTRY_IMMUTABLE`, the same value is accepted so forms may resend it); the data explorer has the same rule; the web form shows the country read-only and never sends it; database trigger `Tenant_market_immutable` (a first binding of an organisation without a market stays allowed; the foreign key's own SET NULL after a market row was deleted is not a move). The published provider carries `market` (additive field); a Kiorex hold or booking that names another market than the organisation's is refused (`409 CROSS_MARKET_BOOKING`).
  - **Pharmacy and Lab**: there never was an API to change `Tenant.marketCode`; sign-up and onboarding now validate a two-letter country code and store it in upper case; trigger `Tenant_marketCode_immutable` refuses any change.
  - **Kiorex platform**: the provider sync takes the market from the Clinic (additive `market` field of the published provider; absent or malformed = ignored) and **never rewrites it**: a listing that arrives under another market than the one it was projected under is refused, counted (`refused` in the sync result), audited once per day (`provider.market_change_refused`) and the sync cursor moves on; partner registration (`PartnerConnection`) answers `409 MARKET_IMMUTABLE` on a changed market (a re-submit may repeat it or omit it); triggers `Provider_market_immutable` and `PartnerConnection_market_immutable`; search returns only the market being browsed (`?market=`, default the platform default market, `400 INVALID_MARKET` for a malformed code); the out-of-coverage suggestions stay in the provider's market; a booking whose patient market differs from the provider's market is refused (`403 CROSS_MARKET_BOOKING`) before any hold, and the Clinic is told the market on the hold and the booking.
- **A correction is a documented super-admin data fix, not a feature.** Procedure (counsel or the founder approves it in writing first; one person does it, a second reads the result):
  1. Write the reason, the approval reference and the organisation id in the incident record.
  2. Take a database snapshot.
  3. In one SQL session: `ALTER TABLE "<table>" DISABLE TRIGGER "<trigger>"; UPDATE ...; ALTER TABLE "<table>" ENABLE TRIGGER "<trigger>";` for every table that carries the market (Clinic `Tenant` with `Tenant_market_immutable`; Pharmacy and Lab `Tenant` with `Tenant_marketCode_immutable`; Kiorex `Provider` and `PartnerConnection`). Check the triggers are enabled again (`select tgname, tgenabled from pg_trigger where tgname like '%immutable'`).
  4. Re-run the Kiorex provider sync with `full=true` and read the audit rows. Existing bookings and money records are never rewritten by this procedure; a booking made under the old market stays under it.
- Existing data stays valid: every existing organisation already has exactly one market (Egypt organisations are `EG`), the triggers only fire on a change, and a Kiorex listing without a `market` keeps the market it has (older Clinics keep working). Dr Ahmed Shall's organisation is `EG` on both sides and is not touched by any migration.

## Decision B: the Kiorly admin edition launches Kiorly markets, one source of truth

Options weighed:

| Option | Verdict |
|---|---|
| The admin web calls the Clinic API directly | Rejected: a second identity system (Clinic JWT versus Passport), new CORS and browser-held Clinic credentials. |
| A read model of the markets in the Kiorex platform | Rejected: duplicate state that can disagree with the table that decides who may onboard; every change would still have to reach the Clinic. |
| **A role-gated, audited proxy in the Kiorex API over a signed `MARKET_ADMIN` route of the Clinic** | **Chosen.** Reuses the existing HMAC marketplace channel, the Passport roles of the console and the Clinic's own rules (tax pack, cross-border approval, data residency). The Market table and its audit trail stay in the Clinic; the platform keeps no market state. |

- Clinic: `GET|POST|PUT|PATCH /marketplace/v1/markets...` (`kiorly-admin-markets.controller.ts`), needs the `MARKET_ADMIN` scope which only the configured Kiorex platform client receives (`KIOREX_MARKET_ADMIN=off` withholds it); every change carries an `actor` that the Clinic validates and records as `KIORLY_ADMIN`.
- Kiorex API: `/api/v1/admin/kiorly-markets...` (`kiorly-markets` module). `ops_admin` and `super_admin` read; **only `super_admin` changes** (Kiorly ops is read-only). The actor is the verified token subject, never a body field; only whitelisted fields are forwarded; an unreachable Clinic is `503 CLINIC_UNAVAILABLE` and nothing changes; each change also writes the platform's own audit row. The read-only Kiorex state of the same country (`market.<cc>.live`) is merged into the answer and is never changed from here.
- Ops console: Market launch view in the Kiorly edition (list with state and operability, prerequisites, Kiorex state, initiate country launch, Go live, Pause, Disable, Enable, tax pack and cross-border approval, second-approver setting and requests, audit history), English and Arabic.

## Decision C: the Clinic bugs

- **Initiate country launch** now fills currency, timezone, locale, phone region, weekend days and languages from a per-country table (editable starting values, not legal advice) and validates them on the form and in the API (`400 MARKET_INVALID` with a field list); the API also fills missing values from the country, so an older client works; a duplicate country is `409 MARKET_EXISTS` (it was a 500); an unknown host cell is `400 HOST_CELL_UNKNOWN` at Go live (it was a 500 for any region that is not in `platform/data-cells.json`).
- **Go live, Pause, Disable and Enable** need a reason (3 to 1000 characters) and record an **append-only** `MarketAuditEvent` (actor, source, time, reason, approval reference, approval link, from and to state, second approver) in the same transaction as the state change. A database trigger forbids UPDATE and DELETE. The state change is conditional on the state it was decided from, so a double click or two administrators produce exactly one change and one row. Enable and Disable are idempotent (nothing changes, nothing is audited again). The Go live gate now really checks the tax pack (the old guard returned for any market that was not yet LIVE).
- **Optional second approver** (`Market.requireSecondApprover`, default off): the change becomes a pending request (`MarketChangeRequest`); a different person approves (`SECOND_APPROVER_MUST_DIFFER`, also matched by e-mail), approval applies it as the maker's change with the checker recorded; a request that cannot be applied is put back.
- **The Go live button shows a clear error** (translated EN/AR, from the API code) instead of failing silently.

## Consequences

- One new Clinic migration (`20270307090000_market_audit_second_approver`), one Pharmacy and one Lab migration (`20270312090000_tenant_market_immutable`), one platform migration (`20270311120000_market_immutable_triggers`): all additive plus triggers; snapshot the Clinic RDS before the Clinic deploy.
- The Clinic App Runner needs no new variable: the configured Kiorex platform client gains the `MARKET_ADMIN` scope at the next boot.
- The Egypt go-live guide section 4 (Part B) describes the screen before these changes; read it together with this ADR.
- Open: a Kiorly-only role split (a Kiorly ops role that cannot reach Kiorex-only data) is still a Passport and API change; a second approver for the Kiorex gate itself is unchanged.
