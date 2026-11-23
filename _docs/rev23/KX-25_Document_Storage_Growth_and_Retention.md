# KX-25 — Document Storage Growth, Cost Control and Retention

Revision: Rev 2.3 · Reference Edition, updated 23 November 2026 (new volume in this set; owner: Chief Software Architect; supersedes: none)

Subtitle: How Kiorly Clinic keeps patient documents from growing without bound: lifecycle rules, per-plan quotas, server-side compression, medical-record retention, direct-to-storage uploads and a ready-to-run Cursor build prompt.

Tags: Object storage · Lifecycle · Quotas · Compression · Retention and legal hold · Presigned uploads · Deduplication (Proposed)

> **Note** Status of this volume. Everything in §03 to §09 is **Proposed, not built** (ADR-036). §02 describes what exists today and was verified in the code on 23 Nov 2026. Retention periods and plan storage limits are **proposals** and are marked NEEDS_HUMAN until the DPO and the founder confirm them.

| Field | Value |
|---|---|
| DOCUMENT | KX-25 |
| REVISION | Rev 2.3 · Reference Edition (updated 23 November 2026) |
| STATUS | Today: partial (per-file cap, client resize, S3). Target: Proposed (ADR-036) |
| OWNER ROLE | Chief Software Architect |
| AUDIENCE | Engineering, build agents, DPO, finance, product |
| RELATED | KX-01 ADR-036; KX-05 §14; KX-10 §09; KX-12 §08; KX-15 §07; KX-21 §20; `_docs/prompts/CURSOR_PROMPT_document_storage_growth.md` |

## Key numbers (verified 23 Nov 2026)
- **15 MB** maximum per uploaded file today (`MAX_UPLOAD_BYTES`); no limit on the number of files or on total bytes per tenant.
- **4** document tables carry `sizeBytes` and a storage path: PatientDocument, EncounterDocument, OperationDocument, PatientClinicalPhoto.
- **0** lifecycle rules, **0** storage quotas, **0** server-side compression, **0** thumbnails, **0** retention rules for medical documents today.
- **7** build phases in the plan, each shippable behind a flag that defaults to off in production.
- **40 to 70 percent** expected size reduction on scanned images from server-side recompression (to be measured on real fixtures in Phase 3).

## 01 The problem
Clinics upload scans, photos, lab PDFs and consent forms for every patient, every visit. A single busy clinic can add several gigabytes a month. Storage cost is small per gigabyte but never stops growing, and three things make it risky: (1) nothing caps it, so one tenant can cost more than it pays; (2) versioned S3 keeps every overwritten or deleted file forever; (3) deleting a medical record from the screen currently hard-deletes it, which can be unlawful inside the retention period.

## 02 What exists today
| Area | Today | Where |
|---|---|---|
| Per-file size cap | Done, 15 MB, one value for every kind | `apps/api/src/common/upload-errors.ts` |
| Client-side image shrink | Done, long edge 1,600 px, JPEG 0.8, files under 2 MB skipped; PDFs untouched | `apps/web/src/lib/enhance-image.ts` |
| Storage adapter | Done, `UPLOAD_STORAGE=local or s3`, port with put, assertExists, getReadStream, deleteObject | `apps/api/src/storage/` |
| S3 bucket | Done, private, versioned, SSE-S3 | `infra/tofu/modules/aws/object-storage` |
| Size recorded per document | Done, `sizeBytes`, never summed | Prisma schema |
| Total bytes per tenant, quotas | Missing | usage meter covers WhatsApp, SMS, AI minutes, clinicians only |
| Lifecycle rules, thumbnails, retention, dedup, direct upload | Missing | none found |

## 03 Target design
Flow: Browser → API authorises and issues a presigned URL → Browser uploads straight to S3 → API verifies, records, meters → Worker compresses and thumbnails → Lifecycle tiers it → Retention purges it.

| Phase | Capability | Outcome |
|---|---|---|
| 1 | S3 lifecycle rules | Intelligent-Tiering after 30 days, old versions expire after 90 days, instant retrieval always |
| 2 | Metering and per-plan quotas | Exact bytes per tenant, warning at 80 percent, grace, hard stop for non-clinical uploads |
| 3 | Server-side processing | Recompression, EXIF removal, thumbnails, lossless PDF optimisation |
| 4 | Retention, legal hold, soft delete | No early loss, no forever-keeping by accident |
| 5 | Presigned direct upload and download | Large files stop passing through the API |
| 6 | Tenant-scoped deduplication | Optional saving, off by default |
| 7 | Backfill, reconcile, rollout, observability | Existing data brought in, numbers proven |

## 04 Storage lifecycle (Phase 1)
| Rule | Default | Note |
|---|---|---|
| Abort incomplete multipart uploads | 7 days | stops invisible cost |
| Expire non-current versions | 90 days, keep newest 3 | safety net for accidental overwrite |
| Tier current objects to Intelligent-Tiering | 30 days | medical prefixes only; objects under 128 KB excluded |
| Expire staging imports | 30 days | `imports/` prefix only |
| Expire current medical documents | Never by lifecycle | only the application purge job may delete |

> **Decision** No Glacier Flexible Retrieval or Deep Archive. They need an asynchronous restore, and a clinician must open any document instantly. Intelligent-Tiering keeps millisecond access in all its automatic tiers.

## 05 Quotas and metering (Phase 2)
| Plan | Proposed storage | Behaviour |
|---|---|---|
| Lite | 2 GB | per plan, overridable per tenant |
| Pro | 20 GB | |
| Clinic | 100 GB | |
| Enterprise | 1 TB | negotiable |

Rules: warn owners at 80 percent; between 100 and 110 percent allow only clinical uploads; above that return STORAGE_QUOTA_EXCEEDED. Never block downloads, deletes, upgrades, exports or offboarding. Extra storage is sold as packs. Counters are updated atomically in the same transaction as the document row and reconciled nightly.

## 06 Processing (Phase 3)
Images: auto-rotate, strip EXIF and GPS, cap the long edge (2,400 px photos, 2,000 px scans), re-encode, keep the original only if the clinic asks. Thumbnails at 256 and 1,024 px. PDFs above 3 MB: lossless qpdf optimisation, optional lossy Ghostscript behind a flag. Uploads are validated by magic bytes, never by the client mime alone. Work runs in a database-backed queue with SKIP LOCKED, so no new infrastructure is needed.

## 07 Retention and legal hold (Phase 4)
> **Warning** Retention periods are legal facts that differ by country. The values below are proposals. NEEDS_HUMAN: the DPO must confirm them before anything is switched on.

| Document class | Proposed minimum | Rule |
|---|---|---|
| Clinical | 10 years from last clinical activity | soft delete only, purge after retention and a 30-day grace |
| Financial proofs | 7 years | same |
| Identity | Retention of the patient record | same |
| Marketing and logos | None | removable at once |

Deletion becomes a soft delete with a reason; restore is possible until purge; legal hold blocks purge; erasure requests create a DPO task and never delete inside the retention period. Every step is audited without file or patient names.

## 08 Direct upload and download (Phase 5) and deduplication (Phase 6)
Presigned POST with a content-length-range and content-type condition; the API completes the record after a HEAD check and a magic-byte sniff. Downloads use 60-second presigned URLs after authorisation and are audited. Deduplication is per tenant and per patient by default, behind a flag, with a dry-run report first.

## 09 Cost and rollout
| Step | Switch | Rollback |
|---|---|---|
| Phase 1 lifecycle | Deploy infra | remove rule |
| Phase 2 metering | Flag on for internal tenants first | flag off, data kept |
| Phase 3 processing | Shadow mode two weeks, then replace originals | flag off, originals kept in shadow mode |
| Phase 4 retention | After DPO confirms numbers | flag off, rows stay valid |
| Phase 5 direct upload | Per tenant | old multipart endpoint stays |
| Phase 6 dedup | After dry-run review | flag off |

Indicative cost for 1,000 clinics at 5 GB each (5 TB): Standard about USD 115 a month; with Intelligent-Tiering after 30 days and a 50 percent compression saving on images the same estate trends toward USD 40 to 60 a month. Assumptions are in KX-21 §20; prices must be re-checked against the current AWS price list before any commitment.

## 10 Decision and open items
> **Decision** ADR-036 (Proposed): add lifecycle, quotas, processing, retention and direct upload to the document store, in the phase order above.

| Item | Owner | Status |
|---|---|---|
| Confirm retention periods per market and class | DPO | Open |
| Confirm per-plan storage limits and pack prices | Founder / CRO | Open |
| Keep original uploads by default or not | Founder, Clinical lead | Open |
| Enable lossy PDF compression | Clinical lead | Open |
| Malware scanning (GuardDuty for S3) | Security | Planned |

## Appendix A The Cursor build prompt
The complete, ordered prompt used to implement ADR-036. It is stored in the repository at `_docs/prompts/CURSOR_PROMPT_document_storage_growth.md`.

### 0. Role, repo and hard rules

You are a senior TypeScript/NestJS engineer working in the Kiorly Clinic repository `clinics-management` (NestJS API in `apps/api`, React web app in `apps/web`, Prisma + PostgreSQL, AWS infrastructure in `infra`). This is a medical product, so every change must be additive, tenant-isolated, audited and reversible.

**Hard rules (do not break any of them):**

1. Work on a new branch cut from `kiorex` (for example `feat/storage-growth`). Never commit to `main`. Never force-push. Do not merge anything yourself.
2. Do **not** run `tofu apply`, `cdk deploy`, or anything that changes real AWS resources. You may run `tofu fmt`, `tofu validate`, `tofu plan` against the staging stack only if credentials already exist locally; otherwise just validate. Write infrastructure as code and stop.
3. Every database change is an **additive** Prisma migration (new nullable columns, new tables, new indexes). No column drops, renames or type changes. Existing rows must keep working with no backfill required to boot.
4. Every new behaviour sits behind a feature flag (use the existing `apps/api/src/feature-flags` module) that defaults to **off** in production and **on** in local and tests, so each phase can ship dark and be switched on per tenant.
5. Keep the current public API contract working. You may add fields and endpoints; you may not remove or change existing fields. Mobile apps (Kiorly Team, patient app) and the web app all consume these endpoints.
6. Tenant isolation is non-negotiable: every query and every storage key includes `tenantId`. Deduplication and quotas are per tenant. Never share a blob across tenants.
7. Never log file contents, file names with patient names, or presigned URLs. Log ids, sizes, kinds and outcomes only.
8. Every phase ships with unit tests, integration tests and an updated doc section (see section 9). A phase is not finished until `npm run build`, lint, and the relevant test suites pass. Do not skip or delete failing tests.
9. English and Arabic user-facing strings both go through the existing i18n files (`messageKey` pattern as in `apps/api/src/common/upload-errors.ts`). No hard-coded user text.
10. Ask before you invent: if a number below is a proposal (marked **PROPOSAL**), implement it as a configuration value with that default, never as a magic constant.

### 1. Context you must read first (do this before writing code)

Read these files completely and summarise in a short comment block at the top of your working notes what each does:

- `apps/api/src/storage/upload-blob.storage.ts` (the `UploadBlobStorage` port: `put`, `assertExists`, `getReadStream`, `deleteObject`), `local-upload-blob.storage.ts`, `storage.module.ts`, `upload-kind.ts`.
- `apps/api/src/platform/adapters/object-storage.s3.adapter.ts` (`S3UploadBlobStorage`: key layout is `<kind>/<relativeKey>`, `ServerSideEncryption: AES256`).
- `apps/api/src/common/upload-errors.ts` (`MAX_UPLOAD_BYTES = 15 MB`, the error helpers).
- `apps/api/src/patients/patients.service.ts`: the document flows around the lines that call `this.uploads.put("patients", ...)` (create, about line 757), download (about 786-808), delete (about 827 hard-deletes the blob and the row), crop/replace (about 873). Also `uploadNationalIdDocument` (about 702) and the encounter document flows (`this.uploads.put("encounters", ...)`, about 912).
- `apps/api/prisma/schema.prisma`: the four models that carry `sizeBytes` and `relativePath`: `PatientDocument` (about line 2089), `EncounterDocument` (about 2274), `OperationDocument` (about 2573), `PatientClinicalPhoto` (about 3027). Also the other places that store a `*RelativePath` (invoice and prescription logos, user avatars, expense proofs, employee ids, clinician verification documents, marketplace profile photos, imports).
- `apps/api/src/usage/usage-limits.ts`, `usage-meter.service.ts`, `usage.controller.ts` and the `UsageMetric` enum and `UsageCounter` model in the schema (monthly counters keyed by `periodKey`; plan limits for LITE, PRO, CLINIC, ENTERPRISE; warning at 80 percent; `assert*Quota` methods that throw `USAGE_QUOTA_EXCEEDED`).
- `apps/web/src/lib/enhance-image.ts` (client-side resize with `pica`: profile "document" long edge 1600 px, JPEG quality 0.8, files under 2 MB skipped).
- Infrastructure: `infra/tofu/modules/aws/object-storage/` (`main.tf`, `variables.tf`, `outputs.tf`), the live stacks in `infra/tofu/live/staging` and `infra/tofu/live/prod`, and the legacy CDK stack `infra/src/kiorly-clinics-management-stack.ts` (the uploads bucket is created there with versioning).
- The audit module (`apps/api/src/audit`), the scheduler pattern (look at `plans/price-indexation.scheduler.ts` for how a `@nestjs/schedule` job is written and tested) and the existing notification/push modules, so you reuse them instead of adding new mechanisms.
- Existing tests next to the code you touch (`*.node.test.ts`, `*.integration.test.ts`) and the cross-product e2e suite in the workspace repo `e2e/` (read `e2e/README.md`).

**The problem we are solving.** Patients upload documents, scans, photos and PDFs with no limit on how many. Today there is a 15 MB cap per file, client-side image shrinking, and S3 with versioning, and nothing else: no total quota per tenant, no lifecycle rules (overwritten and deleted objects keep costing money because versioning is on), no server-side compression, no thumbnails, no deduplication, no retention policy for medical records (deleting a document hard-deletes it, which may be illegal inside the retention period), and every upload streams through the API process. Storage will grow without bound, so we need cost control, limits, and safe retention.

### 2. Target design in one page

Build these seven capabilities, in this order, each shippable on its own:

| Phase | Capability | Why it comes here |
|---|---|---|
| 1 | S3 lifecycle rules and bucket hygiene | Pure infrastructure, zero app risk, saves money immediately |
| 2 | Storage metering and per-plan quotas | Gives visibility and a hard ceiling before anything else changes |
| 3 | Server-side processing: image recompression, thumbnails, PDF optimisation | Cuts bytes at the source and fixes slow previews |
| 4 | Retention policy, legal hold, soft delete, purge job | Makes deletion safe and legal before we add more automation |
| 5 | Direct-to-S3 presigned uploads and downloads | Removes large files from the API process |
| 6 | Content-hash deduplication (tenant-scoped) | Optional saving, only after 2 and 3 are stable |
| 7 | Backfill, reconcile job, rollout, dashboards, docs | Brings existing data into the new model and proves the numbers |

### 3. Phase 1: S3 lifecycle rules and bucket hygiene (infrastructure only)

**Goal:** stop paying for data we do not need and make old data cheap automatically, without changing application code.

Edit `infra/tofu/modules/aws/object-storage` and expose everything as variables with the defaults below. Mirror the same rules in the legacy CDK stack only if that stack is still the one deployed for staging; otherwise leave CDK untouched and note it.

1. Add an `aws_s3_bucket_lifecycle_configuration` for the uploads bucket with these rules (use one rule per concern, each with a clear `id`):
   - `abort-incomplete-multipart`: abort incomplete multipart uploads after **7** days.
   - `expire-noncurrent-versions`: delete **non-current** object versions after **90** days (**PROPOSAL**, variable `noncurrent_version_expiration_days`), but keep at least the **3** newest non-current versions (`newer_noncurrent_versions = 3`). This is the safety net for accidental overwrite.
   - `expire-delete-markers`: remove expired object delete markers.
   - `tier-to-intelligent`: transition the **current** version of every object under the prefixes `patients/`, `encounters/`, `operations/` and `imports/` to `INTELLIGENT_TIERING` after **30** days (**PROPOSAL**, variable `intelligent_tiering_after_days`). Do not use Glacier Flexible Retrieval or Deep Archive classes: they need an asynchronous restore, and clinicians must be able to open any document instantly. Intelligent-Tiering automatically moves untouched objects to its Infrequent and Archive Instant Access tiers, which are still millisecond-latency.
   - `imports-expiry`: objects under `imports/` (bulk import staging files) expire after **30** days.
   - Do not apply any expiry to the current version of `patients/`, `encounters/`, `operations/` or `clinicians/`. Medical documents are only ever removed by the application purge job in Phase 4.
2. Objects smaller than 128 KB are not worth tiering (Intelligent-Tiering does not monitor them); add an `object_size_greater_than = 131072` filter to the tiering rule.
3. Confirm the bucket already has: block-all-public-access, TLS-only bucket policy (`aws:SecureTransport`), default SSE (SSE-S3 today; add a variable to switch to a KMS key later), versioning on, access logging off (cost) but CloudTrail data events documented as optional. Add whatever is missing.
4. Add **CORS** to the bucket, driven by a variable `allowed_origins` (list), allowing `PUT`, `GET`, `HEAD` with headers `Content-Type`, `Content-MD5`, `x-amz-checksum-sha256`, `x-amz-meta-*`, exposing `ETag`, max age 3000. Phase 5 needs this; ship it now and keep origins empty by default.
5. Add CloudWatch metrics outputs and a small Tofu-managed dashboard or alarm: `BucketSizeBytes` and `NumberOfObjects` per storage class, plus an alarm when total bytes grow more than **30 percent in 7 days** (**PROPOSAL**). Wire the alarm to the existing observability module topic (`infra/tofu/modules/aws/observability`).
6. Add S3 Storage Lens or an inventory report as an optional variable `enable_inventory` (off by default) so we can later audit bytes per prefix.
7. Update `infra/tofu/README.md` with a "Storage lifecycle" section and a table of every rule and variable.

**Checks before Phase 2:** `tofu fmt -check`, `tofu validate` for the module and for both live stacks; show the rendered plan diff for staging if possible; list the rules in a table in the PR description. Do not apply.

### 4. Phase 2: storage metering and per-plan quotas

**Goal:** know exactly how many bytes each tenant stores, show it, and stop uploads at the plan limit without ever blocking reads, deletes or emergency clinical work.

#### 4.1 Data model (additive migration `storage_metering`)

1. Add a new enum value to nothing existing; instead add new tables:
   - `TenantStorageUsage`: `id`, `tenantId` (unique, FK to `Tenant` with `onDelete: Cascade`), `bytesTotal BigInt @default(0)`, `objectCount Int @default(0)`, `bytesByKind Json @default("{}")` (keys are `UploadKind`), `lastReconciledAt DateTime?`, `updatedAt`. Index on `tenantId`.
   - `StoragePack` (extra storage purchased): `id`, `tenantId`, `bytes BigInt`, `validFrom`, `validUntil DateTime?`, `source` (enum `PURCHASE | GRANT | PROMO`), `createdAt`. Follow the pattern used for message packs in `billing`/`credits`; reuse that purchase flow if one exists and only add the minimum new code.
2. Add `StorageLimitBytes` to the plan configuration. Do **not** put it in `UsageMetric` (that enum is for monthly counters; storage is a gauge). Extend `usage-limits.ts` with a separate `storageLimitBytesForPlan(planKey)` returning **PROPOSAL** defaults: LITE 2 GB, PRO 20 GB, CLINIC 100 GB, ENTERPRISE 1 TB, all overridable per tenant through a nullable `storageLimitOverrideBytes BigInt?` column on the tenant subscription (or the closest existing per-tenant override table; follow how other overrides are stored).
3. The effective limit is `planLimit + sum(active StoragePack.bytes)` or the override when set.

#### 4.2 Metering service

Create `apps/api/src/usage/storage-meter.service.ts` (inside the existing `UsageModule`):

- `recordUpload(tenantId, kind, bytes)` and `recordDelete(tenantId, kind, bytes)` update `TenantStorageUsage` with an atomic SQL increment (`UPDATE ... SET bytesTotal = bytesTotal + $1`) in the **same transaction** as the document row insert/delete. Never read-then-write.
- `assertCanStore(tenantId, incomingBytes)`: reads usage and the effective limit; behaviour:
  - below 80 percent: allow;
  - 80 to 100 percent: allow and emit a one-time-per-day warning notification to tenant owners (use the existing notification/push modules; see `usage-meter.service.ts` for how the 80 percent WhatsApp warning is raised and copy that pattern; add the new template keys in English and Arabic);
  - 100 to **110 percent (grace, PROPOSAL, config `STORAGE_GRACE_PERCENT`)**: allow only for kinds in the clinical set (`encounters`, `operations`, `patients` clinical documents and photos), block marketing and logo uploads; show the banner "storage full, upgrade";
  - above the grace: throw `USAGE_QUOTA_EXCEEDED` with `code: "STORAGE_QUOTA_EXCEEDED"`, `messageKey: "errors.storage.quotaExceeded"`, HTTP 402 or the status your existing quota errors use.
  - **Never** block: downloads, deletes, plan upgrades, data export, offboarding export.
- `getSummary(tenantId)` returns `{ bytesTotal, limitBytes, percentUsed, byKind, topPatientsByBytes (top 10, ids only, no names in logs), growthLast30DaysBytes }`.

#### 4.3 Wire it into every upload and delete path

Find every call site of `this.uploads.put(...)` and `this.uploads.deleteObject(...)` (use grep; the patients, encounters, operations, expenses, invoices, auth avatar, hr, clinician-verification, billing-platform proof, imports and marketplace profile services all upload). For each:

- Call `assertCanStore` **before** `put`.
- Call `recordUpload` after `put` and in the same transaction as the row insert; if the row insert fails after `put` succeeded, delete the blob in a `finally` compensation and do not record bytes.
- Call `recordDelete` with the row's `sizeBytes` when a document row is removed.
- For replace/crop flows (`cropDocument`, `cropEncounterDocument`), record the **delta** (new size minus old size).
- Factor the repeated "put + row + meter" into one helper (`StorageService.storeDocument`) so that the four document models share it. Do not copy-paste the logic four times.

#### 4.4 API and UI

- `GET /usage/storage` (tenant owner and admin roles only, same guards as `usage.controller.ts`): returns the summary above.
- Web: add a "Storage" card in the existing Usage/Billing settings page in `apps/web` with a progress bar (green below 80 percent, amber 80 to 100, red above), the breakdown by kind, "Buy more storage" button, and an empty/zero state. Both light and dark theme, English and Arabic (RTL).
- Show a non-blocking warning banner at 80 percent and a blocking-upload message at the hard limit inside every upload dialog.

**Tests for Phase 2:** unit tests for the threshold maths (79, 80, 99, 100, 109, 111 percent, with and without packs and overrides); integration test that two concurrent uploads cannot both slip through the limit (use a transaction or advisory lock on the tenant row); test that delete and replace keep the counter exact; test that tenant A's upload never changes tenant B's counter; test that exports and downloads still work at 120 percent.

### 5. Phase 3: server-side processing (compression, thumbnails, PDF optimisation)

**Goal:** make stored bytes smaller and previews fast, without ever destroying the original evidence unless the clinic chooses to.

#### 5.1 Schema (additive migration `document_processing`)

Add these **nullable** columns to `PatientDocument`, `EncounterDocument`, `OperationDocument` and `PatientClinicalPhoto` (extract a shared Prisma comment so they stay in sync):

- `sha256 String?` (hex digest of the stored original bytes)
- `originalSizeBytes Int?` (size before processing; `sizeBytes` stays "the size of the file we serve")
- `thumbSmallRelativePath String?` (256 px long edge), `thumbLargeRelativePath String?` (1024 px)
- `processingStatus String @default("NONE")` (`NONE | PENDING | PROCESSING | DONE | SKIPPED | FAILED`)
- `processingError String?`, `processedAt DateTime?`
- `width Int?`, `height Int?`, `pageCount Int?`
- Indexes: `@@index([tenantId, processingStatus])` and `@@index([tenantId, sha256])`.

Add a small `StorageJob` table for the work queue: `id`, `tenantId`, `kind` (`PROCESS_DOCUMENT | PURGE | RECONCILE | BACKFILL`), `refModel`, `refId`, `status`, `attempts`, `runAfter`, `lockedUntil`, `lastError`, `createdAt`. Index `(status, runAfter)`. Use `SELECT ... FOR UPDATE SKIP LOCKED` so several API instances can run workers safely. Do not introduce Redis or SQS now.

#### 5.2 Processing pipeline

Create `apps/api/src/storage/processing/` with:

- `image-processor.ts` using `sharp` (add the dependency, pin the version, make sure the Docker image builds it for linux x64 and arm64). Behaviour:
  - Auto-rotate by EXIF orientation, then **strip all EXIF/GPS/maker metadata** (location in a patient photo is PHI).
  - Resize so the long edge is at most **2400 px** for `camera`/clinical photos and **2000 px** for scanned documents (**PROPOSAL**, config), never upscale.
  - Re-encode: JPEG quality 82 with `mozjpeg`, or WebP quality 80 when the uploader's `Accept`/client flag allows it; keep PNG only if it is a screenshot-like image with transparency or fewer than 256 colours. Keep the smaller of "re-encoded" and "original"; if re-encoding does not save at least **10 percent**, keep the original and set `processingStatus = SKIPPED`.
  - Create `thumbSmall` (256 px) and `thumbLarge` (1024 px) as WebP, stored under the same prefix with suffixes `-t256.webp` and `-t1024.webp`.
  - Never process HEIC/HEIF unless `sharp` in our build supports it; otherwise convert on the client (see 5.4) or mark `SKIPPED`.
- `pdf-processor.ts`: for PDFs larger than **3 MB** (config), run **`qpdf --linearize --object-streams=generate --recompress-flate --compression-level=9`** (lossless) via a sandboxed child process with a timeout of 60 s and a memory ulimit. Optional second step (feature flag `storage.pdf.lossy`, default off): Ghostscript `-dPDFSETTINGS=/ebook` for scanned PDFs where more than 80 percent of the size is images. Read the page count with `pdf-lib` or `qpdf --show-npages`. Never run a PDF through anything that executes embedded scripts; reject PDFs with JavaScript or embedded files in the validation step.
- `validate-upload.ts`: **sniff the real file type from magic bytes** (not just the client mime) for JPEG, PNG, WebP, GIF, HEIC, PDF, DOCX, XLSX, plain text; reject mismatches; block executables and archives; enforce per-kind max size from a config map `UPLOAD_MAX_BYTES_BY_KIND` (default 15 MB images, **PROPOSAL** 25 MB PDF) instead of the single `MAX_UPLOAD_BYTES`. Keep `MAX_UPLOAD_BYTES` exported for old callers.
- `processing.worker.ts`: a `@nestjs/schedule` worker (interval 10 s, batch of 5, per-job timeout, exponential back-off, max 5 attempts, then `FAILED` with the original left intact). It reads the original through `getReadStream`, writes the processed file and thumbnails with `put`, then in **one transaction** updates the row (`sizeBytes`, `originalSizeBytes`, paths, `sha256`, dimensions, status) and adjusts the storage meter by the size delta. It must be **idempotent**: re-running a job for a `DONE` row is a no-op.
- Keep the **original** only when the clinic setting `keepOriginalUploads` (new boolean on the clinic or tenant settings, default `false`) is true; in that case store it under `<prefix>/orig/...`. When false, replace the original with the processed file. Document this default in the PRD section.

#### 5.3 Wiring

- On upload, store the original immediately (so the user sees success fast), set `processingStatus = PENDING`, enqueue a `PROCESS_DOCUMENT` job, return the existing DTO plus the new optional fields (`thumbSmallUrl`, `thumbLargeUrl`, `processingStatus`). Existing clients ignore the new fields.
- New endpoint `GET /patients/:id/documents/:docId/thumb?size=small|large` that streams the thumbnail (auth identical to the download endpoint) and falls back to a generic file-type icon response (`204` plus header) when no thumbnail exists yet.
- Patient 360 and the documents list (`patient-360.service.ts`, the documents tab) must use the thumbnails in lists and open the full file only on click. Add lazy loading and fixed aspect-ratio placeholders in the web app to avoid layout shift.

#### 5.4 Client changes (`apps/web`)

- Keep `enhance-image.ts`, but add **HEIC to JPEG conversion** on the client when `createImageBitmap` supports the file (iPhone photos), and show a per-file progress bar and the "saved X percent" result.
- Add upload concurrency limits (max 3 parallel) and retry with back-off for flaky mobile connections.
- Show "Processing..." chip while `processingStatus` is `PENDING` or `PROCESSING`, then the thumbnail.

**Tests for Phase 3:** golden-file tests with a small set of fixtures (a 6 MB phone photo, a 4 MB scanned PDF, a text PDF, a corrupted JPEG, a PDF with JavaScript, a disguised `.exe` renamed `.jpg`); assert size reduction, EXIF removed, thumbnails exist, original preserved when the setting is on, `FAILED` leaves the original usable, job idempotency, concurrency (two workers never process the same row), and meter exactness after processing.

### 6. Phase 4: retention, legal hold, soft delete and purge

**Goal:** documents are never lost early and never kept forever by accident.

**Legal note for you:** the exact minimum retention period for medical records differs by country and document type. Do **not** hard-code a legal claim. Implement retention as configuration per market and per document class, ship a **PROPOSAL** default of **10 years from the last clinical activity** for clinical documents and **7 years** for financial proofs, and mark the values `NEEDS_HUMAN: DPO/legal to confirm` in code comments, the migration notes and the docs.

#### 6.1 Schema (additive migration `retention`)

- New table `RetentionPolicy`: `id`, `marketCode` (matches the existing `markets` module, for example `EG`), `documentClass` (`CLINICAL | FINANCIAL | IDENTITY | MARKETING | OTHER`), `minRetentionDays Int`, `purgeGraceDays Int @default(30)`, `updatedAt`, unique on `(marketCode, documentClass)`. Seed the proposed defaults in a migration seed or the existing seed script.
- Add to the four document models: `retainUntil DateTime?`, `deletedAt DateTime?`, `deletedById String?`, `deleteReason String?`, `legalHold Boolean @default(false)`, `legalHoldReason String?`, `legalHoldSetById String?`, `legalHoldSetAt DateTime?`, `purgeAfter DateTime?`.
- Compute `retainUntil` on create from the policy (creation date or encounter date, whichever is later, plus `minRetentionDays`); recompute when the patient has later activity (config `RETENTION_EXTEND_ON_ACTIVITY`, default on).

#### 6.2 Behaviour changes

- **Deleting a document from the UI becomes a soft delete**: set `deletedAt`, `deletedById`, `deleteReason` (required text), `purgeAfter = max(now + purgeGraceDays, retainUntil)`. The row disappears from normal lists and counts, the blob is **kept**. The old hard-delete code path (`patients.service.ts` about line 827 and 850) must be replaced, not duplicated.
- Soft-deleted documents can be restored by an owner or admin until purge (`POST .../restore`), with an audit entry.
- **Legal hold**: owner/admin (and platform admin) can set or clear a hold with a mandatory reason; a document with `legalHold = true` is never purged and cannot be soft-deleted without clearing the hold first.
- **Purge job** (`StorageJob` kind `PURGE`, nightly): for rows where `deletedAt IS NOT NULL AND purgeAfter <= now AND legalHold = false`, delete the blobs (original, processed, thumbnails, orig), delete the row, `recordDelete` on the meter, write an audit entry that keeps **only**: tenantId, model, row id, kind, size, sha256, deletedBy, reason, purge date (no file name, no patient name). Batch 200 rows per run, stop on first S3 error rate above 5 percent, never delete if the S3 object version listing shows an unexpected count.
- **Tenant offboarding and patient erasure requests (PDPL/GDPR style):** add `POST /patients/:id/erasure-request` that does **not** delete immediately; it marks documents with `purgeAfter = max(retainUntil, now)` and creates a compliance task for the DPO (reuse the `compliance` module). Document that retention overrides erasure where the law requires keeping the record.
- Audit every soft delete, restore, hold set/clear and purge through the existing audit module with new action names; show them in the patient's audit tab.

#### 6.3 UI

- Replace the "Delete" confirm dialog with a dialog that asks for a reason and explains "kept for N years as required, hidden from lists".
- Add a "Recently deleted" view (admins) with restore and, when allowed, "purge now" (disabled before `purgeAfter`).
- Add a "Legal hold" toggle with reason in the document details panel for owners/admins.

**Tests for Phase 4:** retention maths per class and market; soft delete hides the row everywhere (lists, counts, search, patient 360, exports); hold blocks purge; purge removes blobs and adjusts the meter; restore re-adds counts; erasure request creates the task and purges nothing early; audit rows contain no file or patient names; permission matrix (clinician cannot purge or hold).

### 7. Phase 5: direct-to-S3 presigned uploads and downloads

**Goal:** large files never pass through the API process; the API only authorises and records.

1. Extend the `UploadBlobStorage` port with optional methods (so the local driver can implement them too): `createUploadUrl(kind, key, { contentType, maxBytes, sha256?, expiresSec })`, `createDownloadUrl(kind, key, { expiresSec, fileName, contentType })`, `headObject(kind, key)` returning `{ size, contentType, etag, checksumSha256? }`, and `copyObject` (needed later for dedup). Implement for S3 with `@aws-sdk/s3-request-presigner` and a **presigned POST** with a `content-length-range` condition (so a client cannot upload more than the declared size), `Content-Type` condition, and `x-amz-checksum-sha256`. For the local driver, implement the same contract with a signed short-lived token endpoint `PUT /uploads/local/:token` so dev and tests behave the same.
2. New flow for documents (keep the old multipart endpoint working as a fallback for small files and for old app versions):
   - `POST /patients/:id/documents/uploads` body `{ description, fileName, mimeType, sizeBytes, sha256? }`. Server checks permissions, validates mime and size by kind, runs `assertCanStore`, creates a **pending upload record** (`PendingUpload` table: id, tenantId, userId, targetModel, targetId, key, declaredSize, declaredMime, expiresAt, status) and returns `{ uploadId, url, fields, expiresAt }`. Expiry 10 minutes.
   - The client uploads straight to S3.
   - `POST /patients/:id/documents/uploads/:uploadId/complete`: server calls `headObject`, verifies size equals or is below the declared size and type matches, magic-byte sniffs the first 4 KB with a ranged GET, creates the `PatientDocument` row in one transaction with the meter update, enqueues processing, marks the pending upload `COMPLETED`. If anything fails, delete the object and return a typed error.
   - A cleanup job removes `PendingUpload` rows and orphan objects older than 24 hours (S3 keys under a `pending/` prefix that also has a 1-day lifecycle expiry from Phase 1).
3. Downloads: keep the streaming endpoint, and add `GET .../documents/:docId/url` that returns a presigned GET valid for **60 seconds** with `ResponseContentDisposition` and `Cache-Control: private, no-store`. Authorise **before** signing, audit every issue of a URL (document view audit already exists for patients; extend it), and never put the URL in logs. The mobile apps can adopt it later; do not change their current behaviour in this phase.
4. Update `apps/web` upload dialogs to use the new flow behind the feature flag, with fallback to the multipart endpoint when the flag is off or the browser lacks the required APIs. Update the web and Kiorly Team clients' TypeScript API clients only additively.
5. Malware scanning hook: add an interface `UploadScanner` with a no-op implementation and a documented extension point for **Amazon GuardDuty Malware Protection for S3** (tag-based quarantine). Do not implement a vendor integration now; add the `scanStatus` nullable column (`PENDING | CLEAN | INFECTED | SKIPPED`) and make downloads refuse `INFECTED`.

**Tests for Phase 5:** unit tests for policy conditions; integration test with the local driver for the whole init, upload, complete flow; tamper tests (oversized body, wrong mime, expired token, reused upload id, another tenant's key, key traversal such as `../`); orphan cleanup; presigned GET expiry and audit. Update the cross-product e2e suite (workspace `e2e/`) with one scenario: upload a 3 MB photo via the new flow, see the thumbnail, see the storage meter increase, soft delete, restore.

### 8. Phase 6: tenant-scoped deduplication (optional, only after phases 2 and 3 are stable)

1. New table `BlobObject`: `id`, `tenantId`, `sha256`, `sizeBytes`, `storageKey`, `refCount Int`, `createdAt`, unique `(tenantId, sha256)`. Documents point to a blob through a nullable `blobId` column; legacy rows keep working with their own `relativePath`.
2. On `complete` (Phase 5) or after processing (Phase 3), if a blob with the same `(tenantId, sha256)` exists, drop the new object, point the document to the existing blob, increment `refCount`, and meter only once per blob. Never dedupe across tenants. Never dedupe different patients' documents if the clinic setting `dedupeAcrossPatients` is false (default **false**, because identical files across patients may be a data-handling red flag); dedupe within the same patient by default.
3. Deleting a document decrements `refCount`; the blob is deleted only when `refCount = 0` and the purge rules allow it. Add a nightly consistency check that recomputes ref counts and reports drift.
4. Behind flag `storage.dedupe`, default off. Include a dry-run report command that prints how many bytes dedup would save per tenant before anyone enables it.

### 9. Phase 7: backfill, reconcile, rollout, observability and documentation

1. **Backfill job** (`StorageJob` kind `BACKFILL`, plus a CLI script `npm run storage:backfill -- --tenant <id> --dry-run --limit 500`): for existing rows, compute `sha256`, read real size from S3 `HeadObject` (the DB `sizeBytes` may be wrong), enqueue processing for images over 500 KB and PDFs over 3 MB, set `retainUntil` from the policy, and fill `TenantStorageUsage`. Idempotent, resumable (cursor stored in the job row), rate-limited to protect S3 and the DB, `--dry-run` prints projected savings without writing.
2. **Nightly reconcile job:** sums `sizeBytes` from all document tables per tenant and compares with `TenantStorageUsage`; logs and corrects drift above 0.5 percent; reports orphan S3 objects (in S3, not in DB) and dangling rows (in DB, not in S3) to the ops dashboard without deleting anything automatically.
3. **Observability:** structured logs and metrics (reuse `apps/api/src/observability`): upload count and bytes by kind, processing duration and savings percent, queue depth and oldest job age, quota rejections, purge counts, presign issues, S3 error rate. Add an ops view in the platform admin app showing the top 20 tenants by bytes and their growth.
4. **Rollout plan to write into the PR:** Phase 1 deploy, then Phase 2 flag on for internal tenants, then Phase 3 shadow mode (process but keep originals) for two weeks, then switch to replace-original, then Phase 4 with retention policy confirmed by the DPO, then Phase 5 per tenant, Phase 6 only after a dry-run review. Each step has a rollback: turn the flag off; data stays valid because every change was additive.
5. **Documentation to update in the same PRs:**
   - `docs` or `README` of the API: new env vars (`UPLOAD_MAX_BYTES_BY_KIND`, `STORAGE_GRACE_PERCENT`, `STORAGE_PROCESSING_ENABLED`, `STORAGE_PDF_LOSSY`, `RETENTION_EXTEND_ON_ACTIVITY`), endpoints, job kinds, flags.
   - `infra/tofu/README.md` lifecycle table.
   - The workspace documents (`_docs/rev23`): KX-05 (Clinic PRD, a new "Document storage and retention" section), KX-10 (platform engineering: processing pipeline and queue), KX-12 (monetisation: storage limits per plan and storage packs), KX-15 (compliance: retention, legal hold, erasure), KX-21 (AWS reference: lifecycle table and cost model), and the new KX-25 document. Do not edit those yourself in this repo; list the exact facts that changed in your final report so the documents can be updated.
6. **Cost model to include in the final report:** for 1,000 clinics with an average of 5 GB each, show monthly S3 cost before and after Phases 1 and 3 (Standard versus Intelligent-Tiering, compression savings of 40 to 70 percent on scanned images), with every assumption stated.

### 10. Definition of done and the final report

A phase is done only when all of these hold:

- Migrations are additive, apply on an empty database and on a copy of existing data, and `prisma migrate diff` shows no drift.
- `npm run build`, lint and type-check pass for `apps/api` and `apps/web`.
- All existing tests still pass and every new behaviour has tests as listed in its phase. Paste the test summary in the PR.
- Feature flags default off in production and the old behaviour is bit-for-bit unchanged when flags are off.
- No secret, presigned URL, file name or patient identifier appears in logs.
- Both languages (English and Arabic) and both themes render the new UI correctly at 360 px width.
- No deploys were made.

**Your final report must contain:** what you built per phase, the list of new env vars and flags, the migrations created, the open questions that need a human (retention numbers, plan storage limits, whether to keep originals by default, whether to enable lossy PDF compression, GuardDuty), the measured compression savings on the fixtures, and the exact documentation facts to add to the Kiorex documents.

Start with section 1 (reading), then Phase 1. Stop and ask only for the items marked NEEDS_HUMAN; make a sensible, configurable choice for everything else.
