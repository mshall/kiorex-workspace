# Kiorly Mobile: App Store / Google Play Policy Note

Status: research note, not legal advice. Prepared 2026-11-20. Apple guidelines page shows "last updated October 16, 2026".
Sources (all accessed 2026-11-20):
- Apple App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines/ (first ~100k of 114k chars read; section 5.1.1 demo-account wording and 5.1.3 only via summary)
- Google Play Payments policy: https://support.google.com/googleplay/android-developer/answer/10281818
- Google Play health content / Health apps declaration: https://support.google.com/googleplay/android-developer/answer/13996367
- Google US external content links program: https://support.google.com/googleplay/android-developer/answer/15582165
- Epic v. Apple coverage: https://www.macrumors.com/2026/04/29/epic-games-wins-reversal-app-store-fee-battle/ and https://www.macrumors.com/2025/12/11/apple-app-store-fees-external-payment-links/

> ## VERDICT
> 1. **iOS:** Selling plans to organizations on the web/via sales is plausibly covered by 3.1.3(c) (Enterprise Services), but approval depends on App Review accepting that Kiorly is sold to organizations. The conservative design must not rely on that alone: the app shows **no prices, no purchase/upgrade calls to action, no links to pay or to pricing pages**, and neutral locked-state text.
> 2. **Android:** Play Billing scope covers app features/cloud software bought in-app. B2B is **not** a stated exemption. Selling only outside the app with no in-app purchase path or link is the safe posture. Same neutral wording as iOS.
> 3. **Recommended (most conservative) option:** a "consumption-only" app. Plans are purchased and managed on the web/with sales; the app only reflects entitlements. Owner "Plan & billing" screen is informational text, with no link, no price, no button.
> 4. Health/AI: submit under the legal entity (clinic-services company), clinician-review wording for the AI scribe, no diagnostic claims, accurate privacy labels, in-app account deletion, working demo account.

## 1. What is allowed

| Topic | Apple (iOS) | Google Play (Android) |
|---|---|---|
| Buying digital features in-app | Must use IAP (3.1.1) | Must use Play Billing (Payments policy lists app functionality, subscriptions, cloud/business software) |
| Selling outside the app | Allowed, but in-app calls to action are restricted. Outside the US storefront, no buttons/links/CTAs to non-IAP purchase unless entitled (3.1.1(a), 3.1.3 intro). US storefront: link-outs currently permitted without entitlement; commission question is unresolved in Epic v. Apple (Ninth Circuit Dec 2025, district court to set any rate; April 2026 rulings). Do not rely on this: Kiorly ships globally (incl. Arabic markets) | In-app steering to other payment methods generally prohibited unless an exemption/program applies. US external-content-links program (court-ordered, in effect since Oct 2025) and EEA External Offers require enrollment. Administrative links (account, help, privacy) are allowed if they do not lead to payment |
| Selling to organizations | 3.1.3(c): apps sold directly to organizations/employees/students may give access to previously purchased content; consumer, single-user, or family sales must use IAP | No stated B2B exemption (page does not address it; business productivity/cloud software is named as in scope). Treat as not exempt |
| Users accessing what was bought elsewhere (consumption-only) | 3.1.3(b)/(c) allow it; 3.1.3(a) reader-app link entitlement applies only to media readers, not Kiorly | Consumption-only apps (nothing purchasable in app) do not need Play Billing; may mention that options exist, without direct links |
| Locked-feature messaging | Neutral "not available for your organization" is safe. Any "Upgrade", price, or plan-with-price CTA risks 3.1.1 | Same; avoid anything that leads to payment |
| Mention plan names | Low risk if purely informational (name of current plan). Higher risk if shown with price or as a ladder with "buy" intent | Same |
| Link to the web | Link to a generic login/help/docs page is low risk; link to pricing, checkout, or a "manage subscription" billing page is the risk | Administrative links OK if they do not lead to payment |
| Account deletion | Required in-app if account creation exists (5.1.1(v)) | Required: in-app path plus a web deletion URL in Data safety (see Google "account deletion requirements"; not fully read, VERIFY) |
| Health app by legal entity | 5.1.1(ix): healthcare apps must be submitted by the legal entity providing the service, not an individual | Health apps declaration on Play Console App content page; org developer account recommended |

## 2. Does 3.1.3(c) plausibly cover Kiorly?
Plausibly yes. Plans are bought by organization owners (businesses) on the web or through sales; staff are users of an organization account. Limits and caveats:
- Applies only to sales made directly to organizations; any consumer/single-user purchase path (self-serve sign-up of a solo user with a card, family use) must use IAP. A one-person clinic buying a Lite plan on the web is an ambiguity: expect questions.
- Covers access to previously purchased content/services; it does not authorize in-app purchase CTAs or links to pay. Apple's intro to 3.1.3 still bars encouraging other purchase methods in-app outside the US/exceptions.
- Summary text I read had no explicit "multiple-user" or single sign-on clause; older versions of 3.1.3(c) described enterprise sales as multiple-user and SSO-style access. VERIFY the exact current wording with counsel/App Review.
- No equivalent exemption exists for Google; the consumption-only posture is what keeps Android clear.

## 3. Free-tier risk
A free-tier user who sees locked features can be treated by reviewers as in a "free tier with paid unlock", which is exactly what 3.1.1 targets (unlocking features must use IAP). Mitigations: (a) the locked state says the feature is not enabled for the organization and to contact the account owner/administrator; (b) no price, no tier ladder, no "Upgrade" button; (c) explain in App Review Notes that all accounts belong to organizations, plans are sold by contract/web to businesses, no individual signs up or pays in-app; (d) if a self-serve free plan for individuals exists, flag it to counsel (3.1.3(c) would not cover that user).

## 4. Plan & billing entry (recommendation)
- Keep the entry for owners only. It shows: current plan name (optional, can be omitted for maximum conservatism), seat usage, and the text "Plans and billing are managed by your organization on the Kiorly website. Contact your account manager for changes."
- It opens nothing payable: no external browser, no pricing URL, no checkout, no invoice link carrying payment. If a link is wanted later, it may point only to a non-commercial help article, and only after counsel review.
- Do not show the price, renewal cost, or payment method anywhere in the app. Invoices stay on the web.

## 5. AI scribe, medical claims, health data
- 1.4.1: medical apps that could support diagnosis/treatment get extra scrutiny; do not claim accuracy or diagnosis. Describe the scribe as documentation assistance whose output is reviewed and approved by a licensed clinician. Add an in-app reminder. Keep regulatory-status wording accurate; Kiorly makes no clearance claim unless it holds one (VERIFY with regulatory counsel whether AI note drafting triggers device rules in target markets).
- Google: health claims require disclosure of purpose, basis, intended users, risks, and disclaimers; complete the Health apps declaration. Not a research app, so consent/IRB duties do not apply unless it is used for research.
- 5.1.3 (HealthKit etc.): not relevant unless HealthKit/Health Connect is integrated; if not, state so in the declaration. Never use health data for advertising or data mining; no third-party analytics SDK receiving PHI.
- Privacy labels / Data safety: declare health and medical info, name, contact, user content (audio recordings and transcripts if the scribe records), identifiers, diagnostics. State whether linked to the user (yes), used for tracking (no), and sharing with processors (AI/transcription vendor: disclose; Play treats service-provider processing as not "sharing" under conditions, VERIFY). Match the privacy policy and the in-app consent for audio recording.
- Apple 5.1.1(ix): submit from the Kiorly legal entity, not an individual account.

## 6. Account deletion and demo account
- In-app "Delete account" flow reachable from settings (Apple 5.1.1(v)); web deletion URL for Google Data safety. For org-managed accounts: define what happens when the sole owner deletes (organization data retention vs. user deletion; clinical record retention laws). Document this in Review Notes.
- Provide App Review with a working demo account (owner and staff roles) with seeded, fictional data, an active plan with all features, and a second org with locked features if you want to show the neutral state. Explain AI scribe availability, any hardware/region dependencies, and that signup is by organization. Google also requires sign-in details for restricted-access apps.
- 4.2: the app must be more than a web wrapper; native clinical workflows satisfy this.

## 7. Wording examples

| Don't (English) | Do (English) | Don't (Arabic) | Do (Arabic) |
|---|---|---|---|
| "Upgrade to Pro to unlock this" | "This feature isn't enabled for your organization." | "قم بالترقية إلى Pro لفتح الميزة" | "هذه الميزة غير مفعّلة لمؤسستك." |
| "Pro plan, $49/month, Buy now" | (show nothing) | "باقة Pro بسعر 49$ شهرياً، اشترِ الآن" | (لا شيء) |
| "Manage subscription / Pay invoice" button | "Plans are managed by your organization on the Kiorly website." | "إدارة الاشتراك / ادفع الفاتورة" | "تُدار الباقات من خلال مؤسستك على موقع كيورلي." |
| "Visit kiorly.com/pricing to upgrade" | "Contact your account owner or Kiorly support for access." | "زر kiorly.com/pricing للترقية" | "تواصل مع مالك الحساب أو دعم كيورلي للحصول على الوصول." |
| "Free plan" / "Trial" badges | "Your organization's plan" (name only, optional) | "الباقة المجانية / تجربة" | "باقة مؤسستك" |
| "AI diagnoses / detects conditions" | "AI drafts notes for clinician review. The clinician is responsible for the final record." | "الذكاء الاصطناعي يشخّص الحالات" | "يساعد الذكاء الاصطناعي في صياغة الملاحظات لمراجعة الطبيب، والطبيب مسؤول عن السجل النهائي." |

Also avoid on store listings/screenshots: prices, plan comparison tables, "free", "premium", "subscribe".

## 8. Pre-submission checklist
- [ ] No prices, currency, billing periods, "Upgrade/Buy/Subscribe/Trial/Free plan" strings in any locale (grep en + ar bundles, push notifications, emails opened in-app, store screenshots)
- [ ] No in-app link/button/QR to pricing, checkout, or billing; external links audited (help/privacy/terms only)
- [ ] Locked state uses the neutral string; Plan & billing is informational and owner-only
- [ ] Review Notes explain the organization-only B2B model and 3.1.3(c); demo credentials (owner + staff) attached
- [ ] In-app account deletion works; Play web deletion URL set
- [ ] Privacy policy URL live; App Privacy labels and Data safety form match actual SDKs and AI vendor flows
- [ ] Health apps declaration complete (Play); developer account is the legal entity (Apple 5.1.1(ix))
- [ ] AI scribe disclaimer and recording consent present; no diagnosis/accuracy claims
- [ ] Re-read current 3.1.3(c) and Play Payments pages on submission day (policies shift; Epic v. Apple commission rules still moving)

## 9. Open questions for counsel
1. Does 3.1.3(c) as currently worded require multi-user/SSO access, and does an organization with one seat qualify?
2. Is a self-serve web sign-up by a solo practitioner (card payment) a "consumer/single-user" sale needing IAP?
3. Is B2B SaaS exempt on Google Play in any form, or is consumption-only the only safe path?
4. Do any target markets (e.g. EU, GCC, UK, US FDA) classify the AI scribe as a regulated medical device or require specific disclosures?
5. Data protection basis for audio/transcript processing by AI vendors (HIPAA BAA, GDPR, local health-data laws); storage location.
6. Retention versus deletion conflict for clinical records when a user or organization requests account deletion.
7. If the US storefront link-out route is wanted later: current commission status after the district court's remand, and Google US external-links program fees.

## 10. Not verified
Full text of 3.1.3(c) multi-user wording; Apple 5.1.1 demo-account text (page excerpt truncated); Google account deletion page content; commission amounts for US link-outs; exact effective dates of 2026 changes.


## Kiorly store listing: brand colours (24 Nov 2026)
Icon: solid Indigo `#3730A3` tile, white chevrons, coral `#E8735E` pulse line (artwork `_brand/dist/products/kiorly/expo/icon.png`, adaptive background `#3730A3`). In-app and web marks on light surfaces: Indigo `#3730A3` + Periwinkle `#818CF8` chevrons with the coral pulse; on dark/indigo surfaces white + `#A5B4FC`. Screenshots for the listing must show the light-surface header (no gradient banner) and the single language menu. Kiorex (patient app) keeps Indigo + Ocean.
