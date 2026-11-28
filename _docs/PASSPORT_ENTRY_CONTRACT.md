# Kiorex patient web <-> Passport entry contract (28 Nov 2026)

Owner of the Kiorex side: patient web (`kiorex-platform/apps/web`). Owner of the Passport page: the Passport agent (`kiorex-account/apps/passport-ui` and the hosted interaction pages of `dev-idp`). This file is the agreement between them. The patient web does not edit Passport; Passport may adopt the optional parts at its own pace.

## Flow

```
Kiorex landing / any private page
  -> /signin or /join   (Kiorex entry page: Sign in | Join us, provider link, browse link)
  -> Passport authorize  (OIDC code + PKCE, client kiorex-web)   <- the only hand-off
       phone number -> one-time code -> (optional second factor by policy)
  -> /auth/callback      (Kiorex)
  -> /welcome?next=...   (Kiorex: existing members are redirected on at once; new members get onboarding)
  -> next (the page they came from, "/" by default), or the personalised home
```

## Parameters Kiorex sends on the authorize request

| Parameter | Value | Meaning | Passport must |
|---|---|---|---|
| `ui_locales` | `ar` or `en` | the language the visitor already chose on Kiorex | honour it (it already does) |
| `intent` | `register` (came from Join us, an invite link) or `signin` | what the visitor clicked | OPTIONAL: may use it for wording ("Create your account" vs "Sign in") and the first screen. It is NOT security relevant and Kiorex never relies on it: verifying a phone number creates the account when none exists, whichever intent was sent. node-oidc-provider drops unknown parameters unless they are listed in `extraParams`; add `intent` there to read it. Unknown values must be treated as `signin`. |
| `redirect_uri` | `<origin>/auth/callback` | registered per environment (registry `oidc-redirects.json`) | unchanged |
| return-to | NOT sent to Passport | Kiorex keeps the target in its own `sessionStorage` (`kx-return-to`) and only follows same-origin paths (`safeNext`) | nothing |

## What Kiorex does with the answer

| Passport answer | Kiorex behaviour |
|---|---|
| `code` + `state` | exchange, then `/welcome?next=<return-to>` |
| `error=access_denied` (also `login_required`, `interaction_required`, `consent_required`) | `/signin?reason=cancelled`: calm message, nothing changed, retry possible |
| any other `error`, or a failed token exchange | `/signin?reason=error`: "Something went wrong while signing you in" |
| the visitor presses Back on Passport | back on the Kiorex entry page, still signed out (tested live) |
| the session expires or the refresh token dies | the next private page opens `/signin?reason=expired` (or `required`) and returns to where they were |
| Passport unreachable when clicking Continue | the entry page stays and says sign-in is unavailable |

Passport's own error pages ("Session expired, start again from the app") have no way back to Kiorex today. Request to the Passport agent (optional): link that page to the client's origin when the interaction is lost.

## Who is "new"

Kiorex decides from its own API after the return, never from Passport (`apps/web/src/lib/onboarding.ts`, unit tested):

1. a recorded decision in `/me/preferences` (reminders or analytics `updatedAt` set; the last onboarding step and "Skip setup" always write one, an explicit "no" is a decision), or
2. an account created more than 120 minutes ago, or
3. this device finished it for this account.

Onboarding saves through existing endpoints only: `PUT /me/profile` (name, language, market) and `PUT /me/preferences` (analytics, reminders, per-channel marketing; nothing is ticked for the person). Interests are device-only (`kx-interests`) and said so on screen. No medical data is requested anywhere. No new API or migration.

## Egypt gate

`market.eg.live` is recorded only by the founder. The landing page, entry page and onboarding read `GET /markets`; while it is closed they say "Pilot: booking opens when Egypt launches" and "Launching soon". Browsing and account creation stay possible.
