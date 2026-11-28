# Configuration catalogue (configurability sweep, 25 Nov 2026)

Status: built and tested locally; nothing pushed, published or deployed. Contracts 1.13.0 is **unpublished**: the new kinds live on branch `contracts-1.13.0` and are mirrored in the platform (`apps/api/src/growth/policy/policy-schemas.generated.ts`, refreshed by `apps/api/scripts/sync-policy-schemas.mjs`) until the founder publishes. Mirror of this file: `_docs/CONFIGURATION_CATALOG.md`.

## How a number becomes configurable

1. **Policy number** (a business or tuning decision): a maker-checker config kind. A super admin drafts it, a **different** super admin approves it (the database refuses self-approval), it goes live at its effective time **without a redeploy** (registry refresh every 15 s and at once after any transition, `PolicyService`). Every kind has a JSON Schema with bounds and a `default` equal to the value that shipped in code, so an empty or missing key changes nothing. A stored payload that no longer validates is ignored (the defaults keep running) and logged by kind name.
2. **Safety control**: never a flag and never config (ADR-025). Floors are enforced in the schema (k at least 10, loss block at least 30 days, two-person rule, closed denylists that config may only extend). See "Deliberately not configurable".
3. **Deployment setting** (infrastructure, not policy): an environment variable, parsed and clamped; the Integrations Control Center and `/health/providers` show the effective value of the integration ones. Listed below with defaults.
4. **Per-market**: `MARKET_PROFILE`, `MARKET_GROWTH`, `CONSENT_DEFAULTS`, `ATTRIBUTION_POLICY`, `SEO` and the older kinds support MARKET scope. The nine kinds below are **GLOBAL scope only** on purpose: they are read by process-wide code, and a market row that is silently ignored is worse than a refused one (the API answers `GROWTH_INVALID_REQUEST`).

Who can change what: read = `super_admin, ops_admin, finance, support, growth_admin`; draft, edit, submit = `super_admin` (the maker); approve, reject, activate = a **different** `super_admin`; roll back = a new version through the same path. Money-policy kinds (`ATTRIBUTION_POLICY`, `COMMISSION`, `SPONSORED_PROMOTION_POLICY`) need 7 days notice and an announcement. `RECOMMENDATION_POLICY` and `INTEGRATION_MODES` need an announcement of 10+ characters (no notice period: neither changes what a provider is charged). All changes are audited (`growth.config.<transition>`, checksums only). Roll-back restores a number the same way.

## Kinds that already existed before the sweep (unchanged)

| Kind | Controls | Scope | Notes |
|---|---|---|---|
| `ATTRIBUTION_POLICY` | commission windows, precedence, retention, evidence | GLOBAL, MARKET | money policy: 7 days notice, window moves at most x2 per version |
| `COMMISSION` / `REWARDS` / `COMMS_CAPS` / `CAMPAIGN_GUARDRAILS` / `EXPERIMENT_GUARDRAILS` / `INTEGRATIONS` | legacy proposed names, kept for compatibility | | Phase 2 names below are used |
| `SEO` (+ package F extension keys) | canonical host, locales, sitemap shard, cache, templates, thresholds | GLOBAL, MARKET | |
| `SEO_AUTOMATION` | quality gate thresholds (thin content, similarity, parity, titles, links, vitals budgets), blocking checks, forbidden claims, alert targets | GLOBAL, MARKET | `autoNoindex` ships false |
| `WIDGET_POLICY` | origins per org, session token TTL, active holds per phone and IP, SDK cache | GLOBAL, MARKET | |
| `CONSENT_DEFAULTS` | regime, quiet hours, marketing per day and week, withdrawal propagation | GLOBAL, MARKET | |
| `CAMPAIGN_POLICY`, `REFERRAL_RULES`, `REWARD_RULES` (incl. credit block), `SPONSORED_PROMOTION_POLICY` | campaign approval thresholds and ceilings; referral qualification; reward amounts and caps (all 0 until set); sponsored discounts | GLOBAL, MARKET | amounts are NEEDS_HUMAN, never invented |
| `LIFECYCLE_POLICY` | message classes, frequency caps, quiet hours, journeys, segments, holdout bps | GLOBAL, MARKET | |
| `ASSISTANT_POLICY` | languages, tools per state, token and cost **budgets**, **rate limits**, retention, escalation SLA, model mode | GLOBAL, MARKET | |
| `FRAUD_RULES` | bands, diminishing, SLAs, hold days, per-rule weights, per-surface actions, touch/widget thresholds | GLOBAL, MARKET | `twoPersonOnMoney` cannot be false |
| `LTV_POLICY`, `LOYALTY_RULES`, `CORPORATE_POLICY`, `MARKET_PROFILE`, `MARKET_GROWTH`, `INTEGRATION` | cohort LTV (k floor 10), points rules, corporate rules, market facts, per-integration mode, secretRef, schedule, rate budget, retention | GLOBAL, MARKET | |

### New in this sweep

#### `RECOMMENDATION_POLICY`

Thresholds of the rule-based growth recommendations (GRW-P3-E). Aggregates only; k never below 10. Reporting and proposals only: a recommendation changes nothing by itself. Added in 1.13.0; defaults equal the values that shipped in code. PROPOSED_DEFAULT until ratified. Unknown keys rejected.

| Key | Default | Bounds | Meaning | Safety |
|---|---|---|---|---|
| `k` | 10 | min 10; max 1000 | k-anonymity floor of every number a recommendation rests on. Never below 10 (ADR-007). | floor 10 (ADR-007) |
| `spendFloorMinor` | 50000 | min 0; max 100000000 | A CAC below this spend (minor units) says nothing. Same floor as the channel performance report. |  |
| `expiryDays` | 14 | min 1; max 90 | An unanswered proposal expires after this many days. |  |
| `maxPerRun` | 10 | min 1; max 50 | Most proposals one nightly run may create. |  |
| `maxShiftBp` | 2000 | min 100; max 5000 | Most a reallocation may suggest moving, in basis points of the weaker channel spend. |  |
| `minRatioBp` | 15000 | min 10001; max 100000 | Stronger channel must beat the weaker by this ratio in basis points (15000 = 1.5 times). |  |
| `maxAiSummariesPerDay` | 20 | min 0; max 200 | AI-written summaries per day (0 = none). Aggregates only. |  |

#### `REWARD_GUARDS`

Issuance guards of the reward ledger (GRW-P2-D). The block after a recoverable loss cannot go below 30 days. Added in 1.13.0; defaults equal the values that shipped in code. PROPOSED_DEFAULT until ratified. Unknown keys rejected.

| Key | Default | Bounds | Meaning | Safety |
|---|---|---|---|---|
| `recoverableLossBlockDays` | 90 | min 30; max 365 | Days a person is blocked from new issuance after a recoverable loss (chargeback, reversed reward). Never below 30. | floor 30 |
| `maxActiveLots` | 50 | min 10; max 500 | Most active (unexpired, unspent) reward lots one patient may hold. |  |

#### `LIFECYCLE_STAGES`

Day thresholds that derive a patient lifecycle stage from booking and attendance timestamps (GRW-P2-E). Non-clinical. churnedDays must exceed dormantDays (checked by the platform). Added in 1.13.0; defaults equal the values that shipped in code. PROPOSED_DEFAULT until ratified. Unknown keys rejected.

| Key | Default | Bounds | Meaning | Safety |
|---|---|---|---|---|
| `dormantDays` | 180 | min 30; max 730 | Days without a booking before a person is DORMANT. |  |
| `churnedDays` | 365 | min 60; max 1460 | Days without a booking before a person is CHURNED. Must be greater than dormantDays. | must exceed dormantDays |
| `retainedAttendedMin` | 2 | min 1; max 20 | Attended visits inside the window to count as RETAINED. |  |
| `retainedWindowDays` | 365 | min 30; max 730 | Window for retainedAttendedMin. |  |

#### `CROSS_PRODUCT_POLICY`

Continuity prompts between Clinic visits and Pharmacy, Lab and Nurse (GRW-P4-A): how long a prompt lives and how far back the parent visit may be. No clinical data. Added in 1.13.0; defaults equal the values that shipped in code. PROPOSED_DEFAULT until ratified. Unknown keys rejected.

| Key | Default | Bounds | Meaning | Safety |
|---|---|---|---|---|
| `rxToPharmacy.ttlDays` | 30 | min 1; max 90 | Prompt lifetime in days. |  |
| `rxToPharmacy.lookbackDays` | 7 | min 1; max 90 | Parent visit window in days. |  |
| `labOrderToLab.ttlDays` | 30 | min 1; max 90 | Prompt lifetime in days. |  |
| `labOrderToLab.lookbackDays` | 7 | min 1; max 90 | Parent visit window in days. |  |
| `carePlanToHomeVisit.ttlDays` | 30 | min 1; max 90 | Prompt lifetime in days. |  |
| `carePlanToHomeVisit.lookbackDays` | 30 | min 1; max 90 | Parent visit window in days. |  |

#### `REFERRAL_FRAUD_THRESHOLDS`

Detection thresholds of the eight referral fraud rules (GRW-P2-B). Every number is bounded on both sides so a tuning change cannot switch a rule off (a count cannot exceed its ceiling, a share cannot exceed 0.95). Rule weights, bands and actions stay in FRAUD_RULES; the two-person rule and the never-reward-fraud actions are code. Added in 1.13.0; defaults equal the values that shipped in code. PROPOSED_DEFAULT until ratified. Unknown keys rejected.

| Key | Default | Bounds | Meaning | Safety |
|---|---|---|---|---|
| `signupsPerIpPrefix24h` | 5 | min 2; max 50 | Signups from one IP prefix in 24 hours above which the claim is held. | bounded both ways: no rule can be switched off by a number |
| `minSecondsClaimToSignup` | 3 | min 1; max 30 | Fewer seconds than this between claim and signup looks automated. | bounded both ways: no rule can be switched off by a number |
| `otpFailuresBot` | 5 | min 2; max 20 | OTP failures that mark a bot pattern. | bounded both ways: no rule can be switched off by a number |
| `refereesPerReferrerWindow` | 6 | min 2; max 50 | Referees one referrer may bring in the window before a hold. | bounded both ways: no rule can be switched off by a number |
| `refereesWithOneProvider` | 3 | min 2; max 20 | Referees of one referrer booking with the same provider before a hold. | bounded both ways: no rule can be switched off by a number |
| `firstBookingsWithinMinutes` | 10 | min 1; max 120 | Minutes inside which a cluster of first bookings looks coordinated. | bounded both ways: no rule can be switched off by a number |
| `firstBookingsClusterSize` | 3 | min 2; max 20 | First bookings inside that window that form a cluster. | bounded both ways: no rule can be switched off by a number |
| `paymentFingerprintCluster` | 2 | min 2; max 20 | Referees sharing one payment fingerprint before a hold. | bounded both ways: no rule can be switched off by a number |
| `neverBookedTwiceShare` | 0.8 | min 0.5; max 0.95 | Share of referees that never booked twice that looks like farming. | bounded both ways: no rule can be switched off by a number |
| `neverBookedTwiceMinReferees` | 5 | min 2; max 100 | Referees needed before the never-booked-twice share is judged. | bounded both ways: no rule can be switched off by a number |
| `minVisitMinutes` | 5 | min 1; max 60 | A visit shorter than this many minutes does not qualify. | bounded both ways: no rule can be switched off by a number |
| `providerShareOfReferees` | 0.6 | min 0.4; max 0.9 | Share of referees one provider may account for before a collusion review. | bounded both ways: no rule can be switched off by a number |
| `providerShareMinReferees` | 4 | min 2; max 100 | Referees needed before the provider share is judged. | bounded both ways: no rule can be switched off by a number |
| `cancelledRedemptionsRecent` | 3 | min 2; max 20 | Recent cancelled redemptions that block further redemption. | bounded both ways: no rule can be switched off by a number |

#### `INTEGRATION_RUNTIME`

Circuit breaker and retry parameters shared by the growth integration jobs (GRW-P2-F). Added in 1.13.0; defaults equal the values that shipped in code. PROPOSED_DEFAULT until ratified. Unknown keys rejected.

| Key | Default | Bounds | Meaning | Safety |
|---|---|---|---|---|
| `breakerThreshold` | 5 | min 2; max 20 | Consecutive failed runs that open the circuit. |  |
| `breakerCooldownMinutes` | 30 | min 5; max 720 | Minutes before one probe run is allowed (HALF_OPEN). |  |
| `maxAttempts` | 3 | min 1; max 5 | Attempts per run on timeout, 5xx and 429 (never on 4xx or parse errors). |  |

#### `INTEGRATION_MODES`

The mode the founder approved for each external integration (mock or real). A switch to real is a maker-checker change: it is the approval record and audit trail, and the Integrations Control Center shows any drift against the deployed environment. It never carries a credential. Added in 1.13.0. PROPOSED_DEFAULT until ratified. Unknown keys rejected.

| Key | Default | Bounds | Meaning | Safety |
|---|---|---|---|---|
| `modes.<INTEGRATION_KEY>` | mock | one of mock, real | Approved mode per integration; keys: PAYMOB, FAWRY, INSTAPAY, SMS, EMAIL, WHATSAPP_CLOUD, PUSH_FCM, PUSH_APNS, PUSH_EXPO, GOOGLE_ADS, GA4, SEARCH_CONSOLE, META_ADS, TIKTOK, PLAY_CONSOLE, APP_STORE_CONNECT, CRUX, LLM_ASSISTANT, LLM_RECOMMENDATIONS, LLM_AI_GATEWAY, TURN_VIDEO, PASSPORT_IDP, MAPS_GEOCODING, OBJECT_STORAGE, ERROR_MONITORING | approval record only; carries no credential |

### Existing in contracts 1.13.0, now read by the platform

#### `EXPERIMENT_POLICY`

Experiment guardrails (GRW-P3-A): run length, SRM alpha, concurrency, k-anonymity. First-party funnel facts only; no health surface, no money surface. Added in 1.13.0. PROPOSED_DEFAULT until ratified. Unknown keys rejected.

| Key | Default | Bounds | Meaning | Safety |
|---|---|---|---|---|
| `minRunDays` | 7 | min 1; max 90 | Shortest run. PROPOSED_DEFAULT 7. |  |
| `srmAlpha` | 0.001 | > 0; max 0.05 | p-value under which results are hidden. PROPOSED_DEFAULT 0.001. |  |
| `maxConcurrentPerSurface` | 1 | min 1; max 5 | PROPOSED_DEFAULT 1 |  |
| `maxVariants` | 5 | min 2; max 8 | PROPOSED_DEFAULT 5 |  |
| `kAnonymity` | 10 | min 10; max 1000 | Smallest cell a result may show; never below 10. | floor 10 |
| `assignmentTtlSeconds` | 600 | min 60; max 86400 | Cacheable assignment time |  |
| `maxRunFactor` | 2 | min 1; max 10 | An experiment short of its sample at this multiple of its planned days is stopped |  |
| `guardrailMinEvents` | 20 | min 5; max 1000 | Events in the treatment arm before a guardrail breach can be declared |  |
| `conversionWindowDays` | 7 | min 1; max 30 | Conversions are attributed within this many days after exposure |  |
| `maxCookieExperiments` | 3 | min 0; max 10 | Experiments a single visitor key may be in |  |
| `deniedTags` | — | list, max 50 | Surface tags that may never be experimented on (health, price, fees) | list can only ADD to the code deny list |

#### `AUTOMATION_POLICY`

Journey builder limits (GRW-P3-E extension). Frequency caps for custom journeys; they sit on top of COMMS_CAPS and LIFECYCLE_POLICY and can only tighten them. Holdout 0 until set. Added in 1.13.0. PROPOSED_DEFAULT until ratified. Unknown keys rejected.

| Key | Default | Bounds | Meaning | Safety |
|---|---|---|---|---|
| `maxNodes` | 12 | min 2; max 50 | PROPOSED_DEFAULT 12 |  |
| `minWaitMinutes` | 15 | min 1; max 1440 | PROPOSED_DEFAULT 15 |  |
| `maxWaitMinutes` | 129600 | min 60; max 525600 | PROPOSED_DEFAULT 129600 (90 days) |  |
| `cycleMinWaitMinutes` | 1440 | min 60; max 525600 | A loop needs at least this wait. PROPOSED_DEFAULT 1440. |  |
| `maxSendsPerJourney` | 3 | min 1; max 10 | PROPOSED_DEFAULT 3 |  |
| `maxSendsPer30Days` | 4 | min 1; max 30 | Across every builder journey for one person. PROPOSED_DEFAULT 4 |  |
| `maxCompiledSteps` | 24 | min 1; max 100 | PROPOSED_DEFAULT 24 |  |
| `maxBranchArms` | 3 | min 2; max 5 | PROPOSED_DEFAULT 3 |  |
| `holdoutPercent` | 0 (reserved, not consumed yet) | min 0; max 50 | Share of eligible people never messaged by builder journeys, for measurement. PROPOSED_DEFAULT 0. |  |

#### `ATTRIBUTION_MODELS`

Reporting models only (GRW-P3-B): windows, half-life, position shares and the data-driven gate. NEVER read by the money decision (ATTRIBUTION_POLICY owns that); no model changes a commission. Added in 1.13.0. PROPOSED_DEFAULT until ratified. Unknown keys rejected.

| Key | Default | Bounds | Meaning | Safety |
|---|---|---|---|---|
| `windows.webAppDays` | 30 | min 1; max 90 | Web and app touch window. PROPOSED_DEFAULT 30. |  |
| `windows.campaignDays` | 7 | min 1; max 90 | Campaign window. PROPOSED_DEFAULT 7. |  |
| `windows.providerLinkDays` | 30 | min 1; max 90 | Provider link window. PROPOSED_DEFAULT 30. |  |
| `halfLifeDays` | 7 | > 0; max 90 | Time-decay half-life. PROPOSED_DEFAULT 7. |  |
| `positionFirstBp` | 4000 | min 0; max 10000 | Position-based first-touch share in basis points. PROPOSED_DEFAULT 4000. |  |
| `positionLastBp` | 4000 | min 0; max 10000 | Position-based last-touch share. positionFirstBp + positionLastBp must not exceed 10000. PROPOSED_DEFAULT 4000. |  |
| `dataDriven.minConversions` | 1000 | min 100; max 10000000 | Attended new patients needed in the lookback before the data-driven model runs. PROPOSED_DEFAULT 1000. |  |
| `dataDriven.minNodeK` | 10 | min 10; max 10000 | Paths a node must occur in before it is shown; smaller nodes are folded. Never below 10. | floor 10 |

All nine kinds: env override **none** (a stored version is the only way); who can change: super admin maker plus a different super admin checker; consumers read them live (`livePolicy`, `policyNow`).

## Commission rates (COM-2, founder decision 25 Nov 2026)

Fees and commission rates are set **by default per organisation type** and can be **customised per organisation** by the super admin. Stored in `CommissionRatePolicy` (not a growth config kind: it is a money table with its own maker-checker, append-only and effective-dating rules), edited in the ops console (Commissions > Rates and the per-organisation rate panel). **No number is shipped.**

| Setting | Scope | Controls | Default |
|---|---|---|---|
| Default rate | per organisation type (`CLINIC`, `PHARMACY`, `LAB`) | `feeType` PERCENT (`percentBps` 0 to 10000) or FLAT (`flatMinor`), `minMinor`, `maxMinor`, `mode` (`NET_FROM_PAYOUT`, `AUTO_CHARGE_SAVED_METHOD`, `INVOICE_AND_COLLECT` or follow the collection settings), `effectiveFrom` | **unset = no charge, "Rate not set"** |
| Organisation override | per organisation | the same fields, plus a mandatory `reason`; `kind` INHERIT returns the organisation to the default | none: the organisation follows its type default |
| Collection settings (COM-1) | market, organisation | cycle, cut-off day, grace, retry days, minimum, invoice due days, mode | null = not configured |
| Marketplace daily cap | per doctor (Clinic) | `ClinicianAvailabilityTemplate.marketplaceDailyCap`, enforced on the slot list, on holds, on bookings and on reschedules | 20 per day |
| `PHARMACY_TAKE_RATE_BPS`, `LAB_TAKE_RATE_BPS` | environment (legacy) | the take at release when **no** rate is set | 0 |

Rules: a different super admin decides every change; decided rows are never edited or deleted; a change applies from its start (never in the past); a charge, order or booking keeps the rate it was created with; the organisation sees its effective rate, the default, any override and the history read only. Humans: launch guide rows `LG-COM-11` to `LG-COM-15`.

## Commission policy (COM-3, founder decisions 26 Nov 2026)

Everything that was a "numbers and counsel" decision is **configurable in the Ops console (Commission policy, `/commission-policy`, linked from Commissions > Rates and from the Integrations Control Center)** and is never hardcoded. **No number and no wording is shipped**; every default below is empty or the safe state. A different super admin approves every change (append-only, effective-dated, audited); super admin and finance read, only a super admin proposes.

| Setting | Scope | Controls | Default |
|---|---|---|---|
| Rate parameters | per organisation type (`CommissionRatePolicy` default) and per organisation (override) | on top of the COM-2 fields: `currency`, `rounding` (HALF_UP, DOWN, UP), `minCollectMinor` (minimum to collect in a period), `graceDays`, `retryDays` (dunning), `invoiceDueDays`, `reminderDays` (cadence relative to the due date, negative = before), `disputeWindowDays` (days after confirmation; replaces the deadline the product reported), `savedMethodChargeAllowed` (provider token charge permitted; false falls back to an invoice with reason `SAVED_METHOD_NOT_PERMITTED`). An override row states its own full set; a null field follows the collection settings (COM-1) | all null: follow the collection settings; rounding null = half up (what always shipped) |
| `COMMISSION_COUNSEL_SIGNOFF` | growth config kind, MARKET scope (`scopeId` = country) | `status` NOT_REVIEWED / APPROVED_WITH_CONDITIONS / APPROVED / REJECTED, `reviewerName`, `documentId`, `reviewedOn`, `conditions`, `collectionModes[]`, `payoutRoutes[]` (PAYMOB, FAWRY, INSTAPAY, CARD_GATEWAY, BANK_IPN). Gates which collection modes and payout / settlement routes may run in REAL mode; mock is always allowed. A blocked run creates nothing, claims wait, the reason is shown in Ops and in the Integrations Control Center | NOT_REVIEWED: every real-money mode and route blocked |
| `COMMISSION_DISCLOSURE` | growth config kind, MARKET scope | `rateDisclosure` and `termsSummary` (free text, `en` and `ar`, 4000 characters, no markup), `showOverrideReason` (boolean). Pushed read only to Clinic, Pharmacy and Lab with the rate view (`disclosure`, `counsel.status`; additive fields) | all texts empty ("wording not set": the provider page hides the text block and still shows the numbers); override reason hidden |
| `tender` on a commission charge | per charge, reported by the product | `CASH` or `ONLINE`. A commission on a cash visit is accrued, shown to both sides and netted in the next bank-transfer settlement (or invoiced when no payout is due) | null = not reported |

Still in code (not business numbers): the 15-minute job interval, the dunning bounds (retry days 1..60, at most 6), grace 0..30, invoice due 1..90, dispute window 0..365, the aging buckets 30/60/90 days in the console, the 7-day notice before a money policy takes effect (counsel decides, 13.15), the one-minute clock skew for effective dates. Clinic-side constants are listed in the COM-3 report, not changed here.

## Deployment settings (environment, clamped; effective value visible on the Integrations Control Center where it concerns an integration)

| Variable | Default | Bounds / rule | Controls | Who |
|---|---|---|---|---|
| `GROWTH_CONFIG_CACHE_TTL_MS` | 5000 (0 in tests) | integer >= 0 | cache of config reads | deployer |
| `GROWTH_CONFIG_DAILY_VERSION_BUDGET` | 10 | integer >= 1 | versions per kind per day (a guard on the config system itself, so not config) | deployer |
| `RATE_LIMIT_STORE` | postgres | `memory` only for throw-away runs | cross-instance limiter store | deployer |
| `DB_POOL_MAX` | per service | integer | connection pool | deployer |
| `DEFAULT_MARKET` | EG | ISO code | default market | deployer |
| `SAFETY_SLO_SECONDS`, `SAFETY_ACK_ESCALATE_MINUTES` | 60, 10 | numbers | safety alert delivery and escalation (KX-09 section 08) | deployer; **safety** |
| `ADDRESS_MASK_HOURS` | 24 | number | home-visit address hidden after the visit (KXMHV10) | deployer; **privacy** |
| `HOME_COMPLAINT_SLA_MINUTES`, `FAMILY_SHARE_MAX`, `HOME_GATE_MIN_PROVIDERS` | 60, 3, 50 | numbers | home-visit complaint SLA, family share limit, home gate | deployer (candidate for a market kind, owner decision) |
| `WHATSAPP_SESSION_MINUTES`, `WAITLIST_OFFER_MINUTES`, `WAITLIST_HORIZON_DAYS` | 30, 15, 30 | numbers | assistant session, waitlist offer, horizon | deployer |
| `QUIET_HOURS_START`, `QUIET_HOURS_END`, `MARKET_TZ_OFFSET_HOURS` | 22, 8, 2 | hours | fallback quiet hours (the market profile and `CONSENT_DEFAULTS` win where set) | deployer |
| `HOLD_MINUTES`, `SLOT_CACHE_TTL_MS`, `SLOT_INDEX_TTL_MS`, `SLOT_INDEX_DEADLINE_MS` | 5, 60000, 300000, 6000 | numbers | Kiorex slot hold and slot caches | deployer |
| `INTAKE_RATE_IP_PER_MIN`, `INTAKE_STATUS_RATE_IP_PER_MIN`, `INTAKE_RATE_ORG_PER_HOUR`, `INTAKE_RATE_FAILED_PER_10MIN` | 30, 120, 20, 12 | numbers | partner intake rate limits (abuse protection) | deployer; **security** |
| `AI_DAILY_QUOTA` | 20 | number | AI gateway calls per user per day | deployer |
| `ANALYTICS_MAX_BATCH`, `POLICY_CACHE_SECONDS`, `VAULT_MAX_BYTES` | 20, 30, 5 MiB | numbers | batch size, policy cache, vault upload limit | deployer |
| `PSP_FEE_BPS`, `DEPOSIT_DEFAULT_MINOR`, `HOME_DEPOSIT_DEFAULT_MINOR`, `PHARMACY_TAKE_RATE_BPS`, `LAB_TAKE_RATE_BPS`, `TELE_CONSULT_FEE_MINOR`, `FEE_STATEMENT_VAT_BPS`, `PHARMACY_DELIVERY_FEE_MINOR` | 0 | numbers | **prices and fees: all 0 until the founder sets them (KX-12). Never invented.** | founder decision |
| `SMS_MODE`, `EMAIL_MODE`, `WHATSAPP_MODE`, `PUSH_MODE`, `PAYMENT_MODE`, `MAPS_MODE`, `VIDEO_MODE`, `AI_PROVIDER`, `RECOMMENDATION_MODEL_MODE` | mock | mock or real | integration modes; approval recorded in `INTEGRATION_MODES`, drift shown | deployer after approval |
| `<KIND>_TIMEOUT_MS`, `<KIND>_MAX_RETRIES` | 8000, 2 | integers | provider HTTP timeout and retries | deployer |
| Clinic: `CLINIC_SLOT_HOLD_MINUTES` | 5 | 2 to 15, else default | marketplace slot hold | deployer |
| Clinic: `CLINIC_TELEHEALTH_JOIN_OPENS_BEFORE_MINUTES`, `CLINIC_TELEHEALTH_JOIN_CLOSES_AFTER_END_MINUTES` | 10, 60 | 5 to 30, 15 to 180, else default | telehealth join window (ADR-039) | deployer |
| Clinic: market config | n/a | validated by market-pack validation | `Market.providerConfig`, `taxConfig`, `paymentMethods`, weekend days, currency, timezone, commercial config (PA02), legal config (SC01); changed by the platform super admin | platform super admin |

## Deliberately not configurable (safety, privacy, legal or abuse controls)

Consent gates and quiet hours enforcement; PHI and health-targeting filters (`assertAdSafe`, aggregate-only recommendation inputs, the experiment and journey deny lists, which config may only **extend**); k-anonymity floors (10); the two-person rule and maker-checker itself; launch locks and gate evidence (ADR-024); the never-reward-fraud actions and fraud rule ids; no-tax-authority guard; OTP send and verify limits, MFA grace, HMAC skew windows, upload and body size limits (`TOUCH_MAX_BODY_BYTES` 4096, intake body, 8 MB JSON, 52 MB raw), price-change notice days (contractual), secret handling. Changing these is a code change reviewed as a security change.

## Honest gaps

1. The nine policy kinds cannot be **created** through the vendored contracts 1.12.0 client; they are validated locally and the schemas are byte-copies of the contracts branch. When 1.13.0 is vendored, delete the sync script and generated file and import from `@kiorex/contracts`.
2. `AUTOMATION_POLICY.holdoutPercent` exists in the contract but nothing consumes it yet (reserved).
3. `EXPERIMENT_POLICY.deniedTags` can only add tags; the registry still ships the code list.
4. Lifecycle journey step delays (for example the 30 day second re-engagement step) and the per-journey frequency parameters remain code; `LIFECYCLE_POLICY` has no place for them. Candidate for a later kind.
5. Rate limits, body-size limits and OTP limits stay deployment settings or code (abuse controls). Reserve and queue sizes (`GrowthLimiter`, batch sizes `CHUNK`, `BULK_MAX`) are engineering constants, not policy.
6. Clinic policy settings are env-only: the Clinic has no maker-checker console. Price-change notice days, dispute deadline days and dispute SLA are contractual and remain code until counsel decides.
7. The mode switch is an approval record plus drift display. Adapters still read `<KIND>_MODE` from the environment; nothing yet **blocks** a real mode that was not approved (enforcement at startup is a go-live decision).

## Commission policy on the provider side (COM-3 provider lane, 26 Nov 2026; read only, nothing shipped)

What Clinic, Pharmacy and Lab show of the commission policy above. They hold **no number and no wording of their own**: everything comes from the platform rate view (`disclosure`, `counsel.status`, the rate spec) and statement. Counsel has not signed off and real money stays blocked; this is business policy of the founder (two-way visibility, bank-transfer-only payouts, cash visits accrued and netted), not legal clearance.

| Setting | Where | Controls | Default |
|---|---|---|---|
| `KIOREX_STATEMENT_MODE` | Clinic API env | `mock` mirrors the settlement statement from the Clinic's own rows (`source: LOCAL_MIRROR`); `real` fetches `GET {KIOREX_API_BASE_URL}/partner/commissions/settlement-statement` (platform partner route, LG-COM-19; the tenant id goes in `X-Kiorly-Org-Ref`) with the partner request HMAC (`KIOREX_OUTBOX_WEBHOOK_SECRET`, `KIOREX_EVIDENCE_CLIENT_KEY`). Failures are 503 `STATEMENT_UNAVAILABLE` / `STATEMENT_NOT_CONFIGURED`, never invented figures | `mock` |
| `KIOREX_MODE` | Pharmacy and Lab API env (existing) | `real` fetches `GET /api/v1/partner/commissions/settlement-statement` with the integration client's key and webhook secret (the platform answers the organisation of that registration; `X-Kiorly-Org-Ref`, when sent, must be Kiorex's own reference stored with the rate view); `mock` answers 503 `STATEMENT_NOT_CONNECTED` | `mock` |
| Rate parameters read by the Clinic | pushed rate spec | `disputeWindowDays` (new charge dispute deadline, was market pack / 30), `invoiceDueDays` (due date of an invoice that collects commission, was 7), `retryDays` (auto-charge retries of such an invoice, was 1 / 3 / 7), `savedMethodChargeAllowed=false` (no saved-method auto charge of such an invoice, it stays an invoice), `graceDays` and `reminderDays` (dunning grace end and reminder offsets, were 14 and 3 / 0 days before due). Absent = the old default. No parameter can pause or hide the listing (SB-05) | all absent: defaults above |
| `COMMISSION_STATEMENT_RATE_PER_MIN` / `COMMISSION_STATEMENT_RATE_IP_PER_MIN` | Platform API env | Requests per minute to the partner settlement statement route (`/api/v1/partner/commissions/settlement-statement`): per organisation, and per rotating IP hash before authentication. Over the limit: 429 `PARTNER_RATE_LIMITED` with `Retry-After` | `30` / `120` |
| `tender` on a Clinic claim | Clinic, per charge | `ONLINE` when the visit has a held / applied Kiorex Pay deposit, `CASH` when collected in cash at check-in; otherwise not reported (direct bank transfer or card terminal to the clinic: LG-COM-20) | not reported |
| Disclosure texts, counsel status chip | provider web | texts shown only when Kiorex set wording (EN and / or AR; the other language, marked, when only one is written); the chip shows the status only, never reviewer, document or conditions | hidden / not shown |

Roles that see the statement: Clinic finance, owner, group admin (and administrators when `kiorexCommissions.adminView` is on); Pharmacy owner, branch manager, chain operations; Lab owner, lab director, branch manager, finance.

## Admin-UI sweep (28 Nov 2026): what is configurable where, and what stays env or infra

Audit of the three admin surfaces for business values that were hard-coded or env-only. Rule used: a number or text that a business owner could reasonably change is a **maker-checker, audited setting with a default equal to today's behaviour**; anything that protects people or money, or that describes the deployment, stays **code or environment**.

### Where each business setting lives today

| Setting family | Surface | Screen | Control |
|---|---|---|---|
| Feature flags, release cohorts, market go-live gates | Kiorex ops console | Flags, Home gate, Kiorly markets | flag registry with evidence for launch-locked keys; cohorts per release; a human records gate evidence |
| Growth, attribution, consent, lifecycle, assistant, fraud, LTV, experiment, journey, integration modes (all kinds in this catalogue) | Kiorex ops console | Policy | maker-checker, versioned, effective-dated, rollback by new version |
| Commission rates, tender treatment (cash vs cash-transfer), dunning and collection parameters, disclosure wording, counsel status | Kiorex ops console | Commissions, Rates, Commission policy | maker-checker, append-only, effective-dated, per organisation type and per organisation |
| Site join form: picklists, consent text version, retention, response promise, notifications | Kiorex ops console and Kiorly admin edition | Join requests, settings | versioned, saved by a super admin (no maker-checker by design, audited) |
| Messaging channels and templates, integration status | Kiorex ops console | Messaging, Messaging channels, Integrations center | per channel, mock or real recorded as an approval |
| Market launch (Kiorly markets), second approver, tax pack | Kiorly admin edition | Market launch | reason, audit, append-only, optional second approver |
| Second-factor policy (who must use TOTP or a passkey) | Passport web | Ops, MFA policy | maker-checker, audited, default OFF |
| **Sign-in limits (new, 28 Nov 2026)**: codes per phone per hour, codes per address per hour, guesses per code, code lifetime, lock-out minutes | Passport web | Ops, Sign-in limits (`/account/ops/limits`) | maker-checker (a different ops admin or super admin approves; a super admin may apply directly, audited), live within 5 s, EN and AR, axe clean |

### Sign-in limits (new)

Defaults are exactly the values of `config/idp.json` `passwordless.otp` (5 per phone per hour, 20 per address per hour, 5 guesses, 300 s, 15 minutes lock-out). Nothing stored means the file applies. **The ranges are code, not settings**, re-checked when a change is applied and when a value is read (a row written by hand is clamped): codes per phone 1 to 10, per address 5 to 60, guesses 3 to 8, lifetime 60 to 600 s, lock-out 5 to 240 minutes. An abuse control can be tuned but never switched off or opened wide. Not configurable on purpose: code length, channels and the development bypass (deployment facts), the TOTP attempt limits, the baseline `mfaPolicy.requiredForRoles`. API: `GET /api/ops/signin-limits`, `POST /api/ops/signin-limits/changes` (propose; `apply: true` for a super admin), `POST /api/ops/signin-limits/changes/{id}/(approve|reject|withdraw)`; audit events `signin.limits.proposed|applied|applied_direct|rejected|withdrawn`. Code: `kiorex-account/apps/dev-idp/src/signin-limits.ts`, page `apps/passport-ui/src/pages/OpsLimits.tsx`. Tests: `apps/dev-idp/test/signin-limits.test.ts` (8), `apps/passport-ui/test/signin-limits.test.tsx` (4).

## Site plans (landing page) (28 Nov 2026)

| Setting | Where | Meaning | Default |
|---|---|---|---|
| Clinic plan names, order, public flag and effective-dated price versions | Clinic `Plan` / `PlanPrice` (edited in the Kiorly admin `/kiorly-plans`, `super_admin`; ops reads) | the Clinic plans the landing page shows; a plan without an active price shows "Pricing to be announced" | the Clinic catalogue (seeded EG list prices exist; see founder question in `KIORLY_ADMIN.md`) |
| Pharmacy and Lab edition wording (visible, name, summary, limits, features, EN and AR) | platform table `SitePlanSetting` key `content` (edited in the same screen, `super_admin`, versioned, audited, no price key accepted) | the wording of the two products' editions; **never a price** (their `PlanPrice` tables are empty and have no editing surface yet) | the editions as defined in code (`LITE`, `PRO`, `CHAIN`) |
| `PLANS_PUBLIC_ORIGINS` | Kiorex API env (optional) | extra origins allowed to READ `GET /api/v1/public/plans` (route-scoped CORS, GET only, no credentials) | falls back to `LEADS_PUBLIC_ORIGINS` (the site origin from the registry) |
| `LEAD_ONBOARDING_DRAFT_ON` | Kiorex API env (optional) | lead statuses that create the DRAFT onboarding request: `WON` (default) or `WON,ONBOARDING`; LOST never creates one | `WON` (founder decision 28 Nov 2026) |
| `KIORLY_PLANS_ENDPOINT` | Kiorly site build (from the registry, `kiorex.api` + `/api/v1/public/plans`) | where the landing page reads the plans at load; unset = static "plans are being finalised" text only | emitted by `env:emit --env <env>` |
| Plan prices (Clinic, Pharmacy, Lab) | the product's own `PlanPrice` table (Pharmacy and Lab: additive migration `20270314090000_plan_price_versions`, empty, append-only trigger), proposed and approved in the Kiorly admin (`/kiorly-plans`, platform table `KiorlyPlanPriceProposal`, `ops_admin` proposes, a different `super_admin` approves, audited `kiorly.plans.price_*`) | effective-dated, versioned per edition, market and billing interval (monthly, annual), with an impact preview and advisory warnings; no price is seeded | none: the landing page says "Pricing to be announced" |
| `KIORLY_PLANS_ADMIN_CLIENT_KEY/SECRET` (platform) and `KIOREX_PLANS_ADMIN_CLIENT_KEY/SECRET` (Pharmacy, Lab) | secret bags `/kx/<env>/platform`, `/pharmacy`, `/lab` (same pair; secret at least 24 characters) | the signed platform-level credential of the product price routes; the routes do not exist when unset; the platform reaches the products at `KIORLY_PLANS_ADMIN_PHARMACY_URL` and `KIORLY_PLANS_ADMIN_LAB_URL` (from the URL registry, kiorex.api env) | unset |
| Public cache | code | platform memory 60 s (stale copy up to 24 h when the Clinic is down), `max-age=60` for browsers | not a setting |

### Found and deliberately NOT moved (with the reason)

| Value | Where it is | Why it stays there |
|---|---|---|
| Rate limits of public routes (intake, statement, leads), body-size limits, batch sizes | env or code | abuse and capacity controls: a mistaken setting is an outage or an opening; tuning is an engineering decision with a deploy |
| Consent gates, quiet-hours enforcement, PHI and health-targeting filters, k-anonymity floor, two-person rule, loss-block floor | code | safety and privacy rules (ADR-025); never a flag |
| Commission counsel sign-off status | growth config kind, human only | a lawyer's decision, never inferred or defaulted |
| Money-affecting defaults (fees, deposits, take rates) | env, all 0 | numbers are a founder decision and are not invented; the rate tables are the configurable home |
| Maintenance banner and support contacts | not built | no user-facing surface reads them yet; adding a setting nothing reads is worse than none. Next step: a `PUBLIC_NOTICES` kind (contracts change, maker-checker, EN and AR, plain text only) once the three web apps have a banner slot |
| Retention periods of operational logs | infra (log groups, backup timer) and the lead settings | storage-lifecycle facts; the lead retention is already a setting |
| Hosts, URLs, registries, regions, secrets | `_docs/registry` and the secret bags | infrastructure: changing them is a deployment, never a console action |
| Notification template wording of safety messages (OTP, safety alerts) | code | must stay reviewed and fixed-form; marketing and lifecycle wording is already managed under Messaging |

## Dual sign-in and Passport binding (28 Nov 2026, ADR-061)

| Setting | Where | Meaning | Default |
|---|---|---|---|
| `AUTH_MODE` | Pharmacy and Lab API env (from the URL registry `provider_sign_in`) | `oidc` Passport only; `both` Passport AND e-mail + password (allowed in production, privileged roles still use Passport); `local` / `dev` local only (non-production) | `oidc` on every hosted environment except test (`both`) |
| `OIDC_PHONE_LINK` | Pharmacy and Lab API env (registry `provider_phone_link`) | first Passport sign-in binds the unique active staff row with the same OTP-verified phone | `false` hosted, `true` on test |
| `KIOREX_PASSPORT_PHONE_LINK` | Clinic API env | same for exactly one active staff member (`Employee.phone`) | off (not set on the live Clinic) |
| `SIGNIN_RATE_PER_MINUTE`, `SIGNIN_RATE_PER_IP_PER_MINUTE` | Pharmacy and Lab API env | password attempts per e-mail (10) and per client address (30) per minute | 10 / 30 |
| `LAB_LOGIN_LOCK_THRESHOLD`, `LAB_LOGIN_LOCK_MINUTES` | Lab API env | wrong passwords before lockout (3 to 20) and lock minutes (1 to 240); hard ranges | 5 / 15 |
| `kx_roles` values `kiorly_ops`, `kiorly_admin` | Passport `config/idp.json` `claimsMapping.kx_roles.allowed`, `mfaPolicy.requiredForRoles` | the two Kiorly-only roles (ADR-062); MFA mandatory like `ops_admin`; granted only by a `super_admin` at Passport `/account/ops/kiorly-roles` (reason required, audited); a sign-in never holds Kiorex and Kiorly roles | no holder until a super admin grants |
| `KIORLY_ALLOW` | platform code `apps/api/src/auth/kiorly-roles.ts` (a code rule, not a setting) | the only routes the two Kiorly roles may call; every other route answers `403 FORBIDDEN_ROLE`; a mixed token `403 FORBIDDEN_MIXED_ROLES` | deny by default |
| Console role access table | ops console `apps/ops/src/lib/roleAccess.ts` (code) | which roles see and may open which console routes, and which dashboard each role lands on (`/home`) | see ADR-062 |
