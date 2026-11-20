# KX19 · Brand Architecture, Domains & Store Accounts
Source: 1MNT7e2izLI06TxRG9_tYdZqix2FRqOab

> Extraction note: some symbols (→, ≥, ·) lost in PDF text layer were restored by inference.

Section 08 of the Kiorex v2 ecosystem reference — BRAND, DOMAINS & ACCOUNTS.

The naming system, visual identity rules, domain and DNS plan, email domains, app-store accounts and trademark plan for Kiorex and Kiorly.

- Authored in the role of Chief Brand Officer. Owns brand architecture, identity system and digital estate.
- Topics: Endorsed brand model · Naming rules · Domains & DNS · Store accounts · Trademarks

| Field | Value |
|---|---|
| DOCUMENT | KX19 |
| REVISION | Rev 2.1 · Reference Edition |
| DATE | 19 November 2026 |
| STATUS | Approved reference |
| AUDIENCE | Founders, marketing, engineering, legal |
| OWNER ROLE | Chief Brand Officer |
| SUPERSEDES | Kiorex v2 draft volumes 19 Nov 2026, 00000106 |

## Contents
01 Brand architecture
02 Identity system
03 Domains and DNS plan
04 App-store accounts and listings
05 Trademarks and handles
06 Sources & evidence

## 01 Brand architecture

Endorsed-brand model: two master brands, each with clear audiences; Kiorly products carry a 'by Kiorex' endorsement.

Diagram: Kiorex (company) — legal & corporate brand — endorses → Kiorex (patients · marketplace · app) and Kiorly by Kiorex (provider software suite). Kiorex Account = sign-in for everything. Kiorly Clinic · Kiorly Pharmacy · Kiorly Lab sit under Kiorly.

| Name | Use it for | Never use it for |
|---|---|---|
| Kiorex | Company, patient marketplace, patient app, investor materials | Provider software product names |
| Kiorly | Provider software suite and its marketing | Patient-facing booking (that is Kiorex) |
| Kiorly Clinic / Pharmacy / Lab | Product names in UI, pricing, sales | Plurals ('Labs', 'Pharmacies'); 'Kiorex Labs' |
| Kiorex Account | Sign-in button and account settings | 'Passport' in any user-facing text |
| Kiorex Pay | Patient deposits and prepayments | Provider SaaS billing (that is Kiorly billing) |
| Kiorly Lite / Pro / Clinic / Enterprise | Plan names (Pharmacy/Lab plans may use Lite / Pro / Chain) | — |

## 02 Identity system

The stethoscope-heart mark is the parent symbol. Kiorex uses it in a sky/teal gradient; Kiorly uses it in violet with a product accent colour. Arabic and Latin wordmarks are designed as a pair with equal visual weight.

| Colour | Hex | Role |
|---|---|---|
| Kiorex Navy | #0B1F3A | text, dark UI |
| Kiorex Sky | #0284C7 | patient primary |
| Care Teal | #14B8A6 | success, identity |
| Kiorly Violet | #6D28D9 | provider primary |
| Pharmacy Green | #059669 | Kiorly Pharmacy accent |
| Lab Amber | #D97706 | Kiorly Lab accent |

| Element | Rule |
|---|---|
| Typography | Inter / Inter Display for Latin; IBM Plex Sans Arabic or Noto Sans Arabic for Arabic; numerals per user setting (Arabic or Latin) |
| Endorsement | 'by Kiorex' in 60% size under Kiorly lock-ups on marketing and app splash |
| Iconography | Rounded 2 px stroke; medical symbols only where clinically accurate |
| Photography | Real Egyptian clinics and patients with consent; no stock 'doctor with stethoscope' clichés |
| Accessibility | WCAG AA contrast; RTL mirrored layouts |

## 03 Domains and DNS plan

| Hostname | Purpose | Hosting |
|---|---|---|
| kiorex.com | Patient marketplace web + company pages (AR/EN via /ar, /en paths) | CloudFront → Kiorex web |
| account.kiorex.com | Kiorex Account IdP for all products | IdP |
| api.kiorex.com | Kiorex public/mobile API | App Runner |
| ops.kiorex.com | Operations console (VPN/SSO only) | CloudFront + WAF IP rules |
| pay.kiorex.com | Kiorex Pay hosted checkout / deposit links | Kiorex |
| kiorly.com | Provider marketing: /clinic, /pharmacy, /lab, /pricing, /help | CloudFront → marketing site |
| app.kiorly.com | Kiorly Clinic web app (PWA) | Clinic stack |
| pharmacy.kiorly.com / lab.kiorly.com | Pharmacy POS / Lab console when deployed separately | Product stacks |
| api.kiorly.com | Kiorly provider APIs incl. /marketplace/v1 | Clinic stack |
| kiorly.link | Short clinic booking links /<slug> (commission-free channel) | Redirect/web (NH-008) |
| mail.kiorly.com · mail.kiorex.com | Transactional email sending domains | SES DKIM/SPF/DMARC (NH-016) |
| docs.kiorly.com | Developer & help documentation | Docs site |

**WHY:** Separate registrable domains for patient and provider surfaces isolate session cookies (a cookie scoped to .kiorex.com is never sent to provider apps) and keep search authority focused per audience.

- Defensive registrations: kiorex.com.eg, kiorly.com.eg, kiorex.eg, kiorly.eg, .ae, .sa, .net → 301 to the .com.
- Arabic IDN equivalents registered where available.
- Registrar lock, DNSSEC, CAA records; DNS in Route 53 under the company AWS organization.

## 04 App-store accounts and listings

| Item | Decision |
|---|---|
| Apple | One Apple Developer Program organization account, legal entity with DUNS; health apps must be submitted by the legal entity providing the service (Guideline 5.1.1(ix)) |
| Google Play | One organization Play Console account; complete Health apps declaration |
| Seller name | The IP-holding entity — ideally 'Kiorex …' so listings read consistently |
| Kiorex app | Patients & families; category Medical; account deletion in-app |
| Kiorly app | Doctors & clinic staff; context switch across organizations; PWA remains primary at launch |
| Field apps (later) | Kiorly Lab Collect (phlebotomists), Kiorly Pharmacy Rider — only when a mobile workflow exists |
| Review readiness | Demo accounts or demonstration mode; regulatory documentation attached in App Review Information |

## 05 Trademarks and handles

| Mark | Jurisdictions | Classes | Priority |
|---|---|---|---|
| KIOREX (word + logo) | Egypt, UAE, KSA, EU (Madrid) | 9, 35, 42, 44 | Now |
| KIORLY (word + logo) | Egypt, UAE, KSA, EU | 9, 42, 44 | Now |
| Arabic wordmarks | Egypt, UAE, KSA | 9, 42, 44 | Now |

Social handles: @kiorex and @kiorly on Instagram, Facebook, TikTok, LinkedIn, X and YouTube; WhatsApp Business verified numbers for Kiorex support and Kiorly support.

## 06 Sources & evidence

Every external figure in this document traces to one of these sources; internal facts trace to the Kiorly repository (mshall/clinics-management, commit 6b24a79, 19 Nov 2026) or to founder decisions recorded in KX01.

- Apple App Review Guidelines 5.1.1(ix): apps in highly regulated fields such as healthcare should be submitted by a legal entity providing the services; regulated apps must provide documentation of authorization.
