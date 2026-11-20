# KX19 · Brand Architecture, Domains & Store Accounts
Source: 1aTb7g8qsYtcLMTS1muWTRHCXfQKTluxs
Revision: Rev 2.3 · Reference Edition (20 November 2026, Approved reference). Supersedes: KX19 Rev 2.1 19 Nov 2026

> Extraction note: symbols restored by inference; Arabic names for Kiorly Nurse came out as scrambled presentation-form glyphs (text layer reversed); the PDF shows the Arabic product name "كيورلي نرس" (Proposed; alternative "كيورلي للتمريض" — per scrambled glyphs; confirm in PDF).

Section 08 — BRAND, DOMAINS & ACCOUNTS. Owner: Chief Brand Officer. Audience: founders, marketing, engineering, legal.

WHAT CHANGED IN REV 2.3 (as printed): Kiorly Nurse added to the Kiorly suite (singular name), with Nurse Rose accent and Arabic name (Proposed, Q12). Patients see care types (Doctors · Physiotherapy · Home nursing), never Kiorly product names. Domains add kiorly.com/nurse and nurse.kiorly.com; the Kiorly app becomes edition-aware; no new store account or app.

## 01 Brand architecture
Endorsed-brand model: two master brands; Kiorly products carry a 'by Kiorex' endorsement. Kiorex (company, legal & corporate brand) endorses Kiorex (patients · marketplace · app; Kiorex Account · Kiorex Pay) and Kiorly by Kiorex (provider software suite): Kiorly Clinic, Kiorly Nurse, Kiorly Pharmacy, Kiorly Lab.

| Name | Use it for | Never use it for |
|---|---|---|
| Kiorex | Company, patient marketplace, patient app, investor materials | Provider software product names |
| Kiorly | Provider software suite and its marketing | Patient-facing booking (that is Kiorex) |
| Kiorly Clinic / Nurse / Pharmacy / Lab | Product names in UI, pricing, sales | Plurals ('Labs', 'Pharmacies', 'Nurses', 'Nursing'); 'Kiorex Labs' |
| Doctors · Physiotherapy · Home nursing | Care-type labels patients see on Kiorex | Provider product names ('Kiorly Nurse' never appears to patients) |
| Kiorex Account | Sign-in button and account settings | 'Passport' in any user-facing text |
| Kiorex Pay | Patient deposits and prepayments | Provider SaaS billing (that is Kiorly billing) |
| Kiorly Lite / Pro / Clinic / Enterprise | Plan names (Clinic edition) | Pharmacy/Lab plans may use Lite / Pro / Chain; Kiorly Nurse uses Nurse Lite / Nurse Pro / Nurse Agency |

## 02 Identity system
The stethoscope-heart mark is the parent symbol. Kiorex uses it in a sky/teal gradient; Kiorly uses it in violet with a product accent colour. Arabic and Latin wordmarks are designed as a pair with equal visual weight.

| Colour | Hex | Role |
|---|---|---|
| Kiorex Navy | #0B1F3A | text, dark UI |
| Kiorex Sky | #0284C7 | patient primary |
| Care Teal | #14B8A6 | success, identity |
| Kiorly Violet | #6D28D9 | provider primary |
| Nurse Rose | #E11D48 | Kiorly Nurse accent |
| Pharmacy Green | #059669 | Kiorly Pharmacy accent |
| Lab Amber | #D97706 | Kiorly Lab accent |

| Element | Rule |
|---|---|
| Typography | Inter / Inter Display for Latin; IBM Plex Sans Arabic or Noto Sans Arabic for Arabic; numerals per user setting (Arabic or Latin) |
| Endorsement | 'by Kiorex' in 60% size under Kiorly lock-ups on marketing and app splash |
| Kiorly Nurse | Lock-up "Kiorly Nurse" with Nurse Rose accent; Arabic name (Proposed; alternative given; decision Q12) |
| Iconography | Rounded 2 px stroke; medical symbols only where clinically accurate |
| Photography | Real Egyptian clinics, home-care visits and patients with consent; no stock 'doctor with stethoscope' clichés |
| Accessibility | WCAG AA contrast; RTL mirrored layouts |

## 03 Domains and DNS plan
| Hostname | Purpose | Hosting |
|---|---|---|
| kiorex.com | Patient marketplace web + company pages (AR/EN via /ar, /en paths) | CloudFront → Kiorex web |
| account.kiorex.com | Kiorex Account IdP for all products | IdP |
| api.kiorex.com | Kiorex public/mobile API | App Runner |
| ops.kiorex.com | Operations console (VPN/SSO only) | CloudFront + WAF IP rules |
| pay.kiorex.com | Kiorex Pay hosted checkout / deposit links | Kiorex |
| kiorly.com | Provider marketing: /clinic (incl. /clinic/physiotherapy), /nurse, /pharmacy, /lab, /pricing, /help | CloudFront → marketing site |
| app.kiorly.com | Kiorly Clinic web app (PWA) — both editions after login | Clinic stack |
| nurse.kiorly.com | Kiorly Nurse sign-up and app entry (alias of the Clinic stack; loads Nurse branding) | Clinic stack |
| pharmacy.kiorly.com / lab.kiorly.com | Pharmacy POS / Lab console when deployed separately | Product stacks |
| api.kiorly.com | Kiorly provider APIs incl. /marketplace/v1 | Clinic stack |
| kiorly.link | Short provider booking links /<slug> (commission-free channel) | Redirect/web (NH008) |
| mail.kiorly.com · mail.kiorex.com | Transactional email sending domains | SES DKIM/SPF/DMARC (NH016) |
| docs.kiorly.com | Developer & help documentation | Docs site |

WHY: Separate registrable domains for patient and provider surfaces isolate session cookies (a cookie scoped to .kiorex.com is never sent to provider apps) and keep search authority focused per audience. nurse.kiorly.com stays under kiorly.com so Clinic and Nurse share sessions for people who work in both.
- Defensive registrations: kiorex.com.eg, kiorly.com.eg, kiorex.eg, kiorly.eg, .ae, .sa, .net → 301 to the .com. Arabic IDN equivalents registered where available.
- Registrar lock, DNSSEC, CAA records; DNS in Route 53 under the company AWS organization.

## 04 App-store accounts and listings
| Item | Decision |
|---|---|
| Apple | One Apple Developer Program organization account, legal entity with DUNS; health apps must be submitted by the legal entity providing the service (Guideline 5.1.1(ix)) |
| Google Play | One organization Play Console account; complete Health apps declaration |
| Seller name | The IP-holding entity — ideally 'Kiorex …' so listings read consistently |
| Kiorex app | Patients & families; category Medical; account deletion in-app |
| Kiorly app | Doctors, physiotherapists, nurses & clinic staff; context switch across organizations; shows Kiorly Nurse branding for Nurse-edition organizations; screenshots include a nurse set; PWA remains primary at launch |
| Field apps (later) | Kiorly Lab Collect (phlebotomists), Kiorly Pharmacy Rider — only when a mobile workflow exists. No separate Kiorly Nurse app (avoids duplicate-app review risk; ADR018) |
| Review readiness | Demo accounts or demonstration mode (incl. a demo Nurse agency); regulatory documentation attached in App Review Information |

## 05 Trademarks and handles
| Mark | Jurisdictions | Classes | Priority |
|---|---|---|---|
| KIOREX (word + logo) | Egypt, UAE, KSA, EU (Madrid) | 9, 35, 42, 44 | Now |
| KIORLY (word + logo) | Egypt, UAE, KSA, EU | 9, 42, 44 | Now |
| Arabic wordmarks | Egypt, UAE, KSA | 9, 42, 44 | Now |
| KIORLY NURSE (optional) | Egypt first | 9, 42, 44 | After traction; covered by KIORLY meanwhile |
Social handles: @kiorex and @kiorly on Instagram, Facebook, TikTok, LinkedIn, X and YouTube; WhatsApp Business verified numbers for Kiorex support and Kiorly support (Kiorly Nurse support uses the Kiorly number with a nurse menu).

## 06 Sources & evidence
Every external figure traces to these sources; internal facts trace to mshall/clinics-management (commit 6b24a79, 19 Nov 2026) or founder decisions in KX01. Apple App Review Guidelines 5.1.1(ix): apps in highly regulated fields such as healthcare should be submitted by a legal entity providing the services; regulated apps must provide documentation of authorization.
