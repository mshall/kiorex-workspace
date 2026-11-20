# KX11 — AI Strategy, Architecture & Governance

Source: 1LYFxWtIA7exJ_T40E_pR-QzOB1AnH2un

Where AI creates value in the ecosystem, how it is built and paid for, and the governance that keeps it safe, honest and affordable.

Authored in the role of Chief AI Officer. Owns AI portfolio, model choices, evaluation, cost and AI governance.

Tags: Use-case portfolio · Honest labels · Provider abstraction · Evaluation · Cost per clinic

| Field | Value |
|---|---|
| DOCUMENT | KX11 (03 — Technical documents / AI docs) |
| REVISION | Rev 2.2 · Reference Edition |
| DATE | 19 November 2026 |
| STATUS | Approved reference |
| AUDIENCE | Product, engineering, clinical governance, investors |
| OWNER ROLE | Chief AI Officer |
| SUPERSEDES | Kiorex v2 draft volumes 19 Nov 2026 |

## Contents

01 Position · 02 Use-case portfolio · 03 Reference architecture · 04 Model strategy and cost · 05 Governance · 06 AI risk register

## 01 Position

AI is a feature that earns its place by saving clinician time or reducing no-shows — never a marketing claim. The 2025 plan of 168 AI services is retired in favour of a short, measurable portfolio.

RULE: Honest AI (AI03) — the AI badge appears only on model-backed features. Rule-based features are called 'smart summary' or 'risk estimate'. The no-show chip is labelled rule-based until a trained model ships.

NOTE: The 2025 repository kiorex-ai-services is empty and will be archived; the 2025 *AI Services Roadmap* (15 categories, in kiorex-backend/docs) is superseded by this portfolio. AI is built inside each product behind its AI gateway — there is no separate AI repository (KX22).

## 02 Use-case portfolio

| Use case | Product | Type today | Value metric | Stage |
|---|---|---|---|---|
| Role assistant (how-to, data questions) | Kiorly Clinic | LLM (OpenAI EU endpoint) with redaction | Support tickets avoided | Shipped, Pro+ |
| Chart scribe (SOAP + Rx draft) | Kiorly Clinic | STT + LLM workflow; clinician approves | Minutes saved per visit | Pilot — production STT provider pending |
| Pre-visit smart summary | Kiorly Clinic | Rule-based | Time to orient | Shipped |
| No-show risk | Kiorly Clinic | Rule-based score (prior no-shows, deposit, lead time) | No-show rate in high band | Shipped → model M12 |
| WhatsApp AI receptionist (Egyptian Arabic) | Kiorly Clinic | LLM + booking tools | Bookings handled without staff | Phase 1b |
| Search intent → specialty | Kiorex | Classifier | Search-to-book conversion | MVP |
| Demand & expiry forecasting | Kiorly Pharmacy | Time-series | Write-off reduction | P2 |
| Lab delta checks & QC anomaly hints | Kiorly Lab | Rules + statistics | QC failures caught | P2 |
| Patient navigation / triage | Kiorex | LLM with clinical guardrails | Correct routing | P3 — clinical evaluation first |

## 03 Reference architecture

- Product features: Assistant · Scribe · Receptionist · Search intent · Forecasting
- AI gateway (per product): Consent check · Entitlement + quota · Market redaction · Prompt registry · Audit + metering
- Providers: OpenAI EU (now) · STT provider (Arabic) · Self-hosted open model on AWS (scale)
- Evaluation: Golden sets AR/EN · Clinician review · Drift + cost dashboards

Every model call passes the same gateway: consent → entitlement → redaction → provider → audit → meter.

| Control in code (Kiorly) | Where |
|---|---|
| Consent AI_PROCESSING before scribe recording | AI_SCRIBE, SC03 |
| Plan gates and quotas (AI_ASSISTANT_REQUESTS, AI_SCRIBE_MINUTES) | AI04, PL05 |
| Market-specific redaction incl. person names; EU OpenAI host for Egypt | MULTI_MARKET |
| Audio deleted on sign-off unless retention opted in | AI02 |
| No OpenAI secrets in git (CI check) | scripts/check-no-openai-secrets-in-git.sh |

## 04 Model strategy and cost

OpenAI EU now (ADR-016); move to a self-hosted open model on AWS when volume makes it cheaper and evaluation shows parity.

| Phase | Trigger | Approach |
|---|---|---|
| Now | Launch | Hosted API via provider abstraction; prompts versioned; quotas per plan |
| Hybrid | AI COGS > USD 3 per active doctor/month or data-control requirement | Self-host an open model for summarisation/assistant on GPU instances; keep hosted for hardest tasks |
| Owned | Proven eval parity on AR/EN golden sets | Fine-tune on consented, de-identified data with CMO approval |

NOTE: Planning assumption in KX13: AI inference ≈ USD 1.50 per active doctor per month blended. Scribe is priced as an add-on (EGP 400/doctor test point) so heavy users pay for heavy usage.

## 05 Governance

| Gate | Required before production | Approver |
|---|---|---|
| Intended use | Written scope, users, prohibited uses, human-in-the-loop design | CMO + CEO |
| Data | Consent path, redaction, retention, no training on PHI without approval | CEO + counsel |
| Evaluation | AR/EN golden set, clinician review of ≥ 100 outputs, error taxonomy | CMO |
| Safety | Hazard log entry (KX16), kill switch per tenant and global | CMO |
| Labelling | AI badge + 'review before use' copy in AR/EN | Product |
| Monitoring | Acceptance rate, edit distance, complaints, cost per tenant | Product + CFO |

## 06 AI risk register

| Risk | Mitigation |
|---|---|
| Hallucinated medication or dose in draft | Rx drafts pass CL02 safety checks; clinician must approve; no auto-sign |
| PHI leaves the market's processing boundary | EU endpoint, redaction, consent, DPA with provider |
| Over-claiming in marketing | AI03 registry; marketing copy reviewed against registry |
| Cost overrun | Quotas per plan; add-on pricing; monthly cost per tenant review |
| Bias in no-show scoring | Transparent factors; no protected attributes; periodic fairness review |
