# Security tools (pentest 2026-11)

Exploration scripts used during the penetration test (run with `npx tsx security-tools/<file>.ts` from `e2e/`, Node 26 on PATH). They are read-mostly and
are meant for the **isolated sec stack** (`scripts/sec-stack.sh up --prod`, ports 4300-4303, throw-away `sec_*` databases), never the shared dev stack:

| Script | What it does |
|---|---|
| `matrix-kiorex.ts` | role x endpoint matrix from the Kiorex OpenAPI document: anonymous / patient / ops status per operation (flags unexpected 2xx and 5xx) |
| `matrix-clinic.ts <out.txt>` | same for Kiorly Clinic with five staff roles plus a second tenant, and a cross-tenant GET-by-id sweep |
| `idor-kiorex.ts`, `idor-write.ts` | harvest ids owned by patient A, replay them as patient B / anonymous on every GET and every single-id write |
| `jwt.ts`, `oidc.ts`, `hmac.ts` | token forgery matrix, Passport authorization-endpoint abuse (PKCE, redirect_uri, code and refresh reuse), marketplace HMAC replay / skew |
| `races.ts`, `money.ts`, `money2.ts` | parallel holds / confirms / cancels, deposit capture and refund races, partial-refund math |

The asserted, repeatable subset lives in `test/30-security.e2e.ts` (`npm run test:security`).
