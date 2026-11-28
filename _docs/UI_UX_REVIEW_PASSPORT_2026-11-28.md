# Passport sign-in, create account and Go back: design review (28 Nov 2026)

Scope: the server-rendered Passport pages of `kiorex-account/apps/dev-idp` (sign in, create account, one-time code, "you already have an account", "no account yet", second factor, passkey offer, session expired, sign-out). The self-service account site (`/account/*`, React) was NOT redesigned in this change; only its sign-in helper in the e2e suite was adapted.
Pictures: `_private/ui-review/passport/before/signin-*` and `after/signin-*` and `after/register-*` (en and ar, light and dark, widths 360, 390, 768, 1024, 1440, 1920). Contract and behaviour: `kiorex-account/Docs/SIGNIN_REGISTER_BACK.md`.

## What the founder asked for, and what it is now

| Ask | Result |
|---|---|
| Passport is THE identity place: registration, not only sign-in | **Sign in / Create account** tabs on the same page. `intent=register` (Kiorex "Join us" sends it) opens the Create tab; `login` or `signin` or nothing opens Sign in. Create needs the terms and privacy consent (checked on the server too: without it no code is sent). Phone number with a verified code, optional name, language switch. Passport e-mail stays optional and is added later in the account site (not part of the sign-in flow). |
| Duplicate account handling | After the verified code (so nothing is revealed to a stranger): a number that already has an account on the Create tab sees "You already have an account" with a Sign in button; a number without an account on the Sign in tab is offered "Create account" (name, consent) instead of being registered silently. |
| Client types (patients, providers/staff) | Product context chip "Signing in to Kiorex / Kiorly Pharmacy ..." from the client. Staff products show on the Create tab that an account grants no access to an organisation (ADR-061: binding stays with the products; Passport only ever creates the `patient` role). Ops console has no Create tab. |
| Redesign, world class, brand-true | Split layout on desktop: a calm animated brand panel (Indigo to Ocean gradient, three slow blurred orbs, the Kiorex mark from the logo spec drawn on load: bars grow in, the coral pulse is traced; three trust points), the form on the other side. Phones: a slim brand band on top and the card under it. Tabs as a segmented control, pill language and theme switchers, "Secure sign-in with Kiorex Passport", product chip with a living coral dot. |
| Micro-interactions | Mark draw-in, card rise, button press and hover lift, busy spinner on submit, error shake, one-time code drawn as six cells (ONE real input underneath: paste, SMS autofill, screen readers), cell pop on typing, focus moves to Verify when the sixth digit arrives, resend button with a 30 second countdown, animated check on the notice pages, passkey and federation buttons kept. |
| Mobile first, EN/AR RTL, light/dark | Layouts checked at six widths in four combinations. RTL mirrors the stage, the Go back chevron and the tabs; the lockup stays LTR (brand). Plus Jakarta Sans with IBM Plex Sans Arabic. |
| Accessible, fast | axe (WCAG 2.1 A and AA tags) clean on every screen in the four combinations, keyboard order and focus rings tested, reduced motion removes every animation and shows the finished state, 44 px targets. About 39 KB of HTML (10.7 KB gzipped) with inline CSS and the shared fonts, no extra request except the two woff2 files used. |
| Go back on every screen | See below. |
| No dev/demo content in hosted builds | The "Development identity provider" line shows only on non-public builds; live page checked (0 occurrences). |
| e2e selectors | `#phone`, `#code`, `#totp`, `#totp-skip`, `#finish button` and the form actions are unchanged. `e2e/kx-test/lib/passport.ts` and the Passport suite helpers also handle the two new notices (`#create-account`, `#dup-signin`); every spec that signs in a NEW number through Passport was adapted in the same change. |

## Go back

| Where you are | Go back (button, and browser Back where it is a step) |
|---|---|
| First step (phone) | To the app that sent you: `return_to` when its origin is one of the client's registered redirect or post-logout origins (http(s) only, no credentials); otherwise the OAuth answer `error=access_denied` plus `state` at the registered redirect URI for `kiorex-web` (its entry contract: calm "cancelled" message on its own entry page), the booking widget and native apps, and the home of the redirect URI's origin for the other web products. A hostile `return_to` (`https://evil.example`, `//evil.example`, `javascript:`, look-alike hosts, credentials) is never followed (unit test and live spec). |
| Code step | To the phone step. The pending code is abandoned (it can no longer be used), the number is not kept in the form and never appears in the address. |
| Second factor, "already have an account", "no account yet", passkey offer | To the code step: the same still-valid code is entered again (attempt limits and lockouts unchanged), so nothing can be skipped. |
| Session expired, sign-out confirmation | Browser history (or the account site). |

The browser Back button on the step pages posts the same step (a `popstate` hook), so it never breaks the OIDC state and never leaves Passport half-way.

## Findings made while building (all fixed unless noted)

1. **Arabic rendered in Times.** The shared stack `--kx-font` put the metric fallback (a local Arial/Inter, which also has Arabic letters) before the Arabic companion, and the `dir=rtl` rule pointed at a circular custom property. The fonts agent fixed the shared sheet (`f4e8693`); the pages also set the Arabic stack explicitly (IBM Plex Sans Arabic first). The Playwright live spec asserts the computed font.
2. **axe caught two real issues** during the work: the language pill's `aria-label` differed from its visible text (WCAG 2.5.3, label in name; the label was removed, the `lang` attribute stays) and a transient contrast failure while the card was fading in (opacity animation). All entrance animations are now transform only.
3. **A registration was called a duplicate** right after creating the account (the account existed when the next screen was drawn). Fixed with an acknowledgement stored when the registration itself creates the account; covered by a test.
4. **Sign-in with a new number used to register silently.** It now asks (consent). This changes the behaviour for any client that signs in a never-seen number on the Sign in tab; clients that post no tab (the API-level tests and the older e2e framework) keep the former behaviour.
5. The consent tick was lost when a code request failed (rate limit). Fixed.
6. Open: the Passport self-service site (`/account/*`) still has the older look; same tokens and fonts, so it is consistent in colour but not in layout. Open: the legal wording and links (see decisions below).

## Checks run

| Check | Result |
|---|---|
| dev-idp unit tests (`apps/dev-idp`) | 209 passed (12 new in `register-and-back.test.ts`: tabs and intent, consent gate, new account, duplicate after code, create-on-sign-in, Arabic digits, step back, MFA back, return_to and hostile values, access_denied for native and kiorex-web) |
| Passport Playwright (local throwaway IdP, own database) | 01 to 09 unchanged and passing with the adapted helper, new 10 (axe at six widths in en/ar, light/dark for sign-in, code, error, passkey, create notice; keyboard; code paste and Arabic digits; Back flows; reduced motion) |
| Whole `kiorex-account` vitest | 505 passed, 1 flaky under machine load in `apps/passport-ui/test/mfa-policy.test.tsx` (passes alone, not touched by this change) |
| Live (kx-test) | see the deploy log entry "Passport sign-in redesign" for what ran in which hour |

Not covered: real Safari and Chrome on physical phones, a screen reader pass (NVDA, VoiceOver), Arabic proof-reading by a native speaker (all new Arabic strings are drafts), Lighthouse numbers.

## Decisions for the founder

1. Terms of Use and Privacy Notice: the consent line, the version tag `draft-1` and the links are placeholders. Set `KX_TERMS_URL` and `KX_PRIVACY_URL` (https) on Passport when the pages exist; the wording is the founder's and counsel's to approve.
2. Should signing in with a number that has no account still be allowed to create one (it now asks for consent first), or should it stop and send the person to Create account? Today it offers both on the spot.
3. Go back for `kiorex-web` ends in Kiorex's "cancelled" message because that is its documented contract; if you prefer the previous page (for example the Kiorex entry page without a message), Kiorex only needs to send `return_to`.
