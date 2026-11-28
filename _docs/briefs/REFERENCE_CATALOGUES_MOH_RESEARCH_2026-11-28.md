# National reference catalogues for Kiorly Pharmacy and Kiorly Lab: research and recommendation

Date: 28 Nov 2026. Status: research brief, no code changed. Audience: founder, then the build agents.
Source access date for every URL below: 28 Nov 2026 unless stated. No medicine, price or test data was copied or invented for this brief; the sample CSV uses placeholder tokens only.

## 1. Executive summary

1. **Pharmacy.** The Egyptian Drug Authority (EDA) runs a public registered-products search (EDDB). It is a web form behind a verification code (CAPTCHA). EDA publishes no bulk file, no API and no open-data licence that we could find, and we found no website terms of use or copyright grant covering reuse (the site footer only says "Copy Rights @ EDA 2021"). The documented detail fields include a "Price status" but no ATC code and no GTIN. So the data is publicly viewable but NOT licensed for bulk copy or redistribution. Scraping would mean defeating a CAPTCHA, which we must not do.
2. **Labs.** LOINC is the right global backbone: free for commercial use and redistribution in perpetuity, with a required notice and a few conditions, and it ships an Arabic (Jordan) translation. The WHO Model List of Essential In Vitro Diagnostics is a list of test categories (about 200), published under a non-commercial licence, so we can link to it and use it as a tagging overlay only after asking WHO. SNOMED CT is NOT free for Egypt (not a member country); skip it. We found no public Egyptian MoH, EDA or procurement lab-test catalogue with codes.
3. **Recommended option (both products):** one global, read-only, versioned **reference catalogue** that the Kiorex super admin (ops console, maker-checker) loads from **officially obtained files uploaded by a super admin** (EDA written permission or a licence request letter for pharmacy; LOINC download for labs), never from scraping. Each pharmacy or lab sees it read-only and **adopts** items into its own catalogue, where its own price and stock live. Existing Drug and lab test rows are matched, not replaced.
4. **Biggest decision for the founder:** how to get an EDA data file legitimately (letter to EDA, see section 11) and whether to launch pharmacy with an EMPTY reference table plus the existing synthetic demo master until EDA answers. The lab side can ship sooner because LOINC is lawful today.

## 2. What exists today in the code (read-only review)

| Item | Pharmacy (`kiorly-pharmacy/apps/api/prisma/schema.prisma`) | Lab (`kiorly-lab/apps/api/prisma/schema.prisma`) |
|---|---|---|
| Catalogue row | `Drug`: `orgId` nullable (null = global seed row, set = tenant-local), `brandName`, `brandNameAr`, `activeIngredient`, `strength`, `dosageForm`, `packSize`, `gtin`, `manufacturer`, `rxOnly`, `controlledSchedule`, `coldChain`, `otc`, `marketCodes` JSON (comment: `{"EG":{"edaCode":"..."}}`), `substitutionGroupId`, `vatRate`, `category`, `baseUnit`, `sourceKey` unique (idempotent import key), `active` | `TestDefinition` (`orgId` required, unique `[orgId, code]`): `nameEn`, `nameAr`, `specimenType`, `container`, `fastingRequired`, `tatMinutes`, `price`, `sendOut`, `section`; `Analyte` (`orgId`, `code`, `nameEn`, `nameAr`, `unit`, `precision`, `analyzerCodes`, `valueType`, `allowedValues`, `formula`); `TestAnalyte`; `TestPackage` and `TestPackageItem`; `ReferenceInterval` (`orgId`, sex, age days, low/high, `version`, `effectiveFrom/To`, `condition`, `source`) |
| Global vs tenant | Already half-built: reads use `OR: [{orgId: null}, {orgId}]` in catalogue and price services. Seed creates global rows with `sourceKey` `synthetic-eg:N` (synthetic demo data, not EDA data). | No global rows. Every table is per tenant (`orgId` required). No LOINC or other standard code field anywhere. |
| Price and stock | `PriceBookEntry`, `StockLot` already reference `Drug` and are per org | `price` sits on the test row itself (per tenant); `PriceList` and `PriceListItem` exist |
| Super admin | There is no super admin UI inside the product repos. Platform-to-product machine calls use signed HMAC routes (e.g. `marketplace/v1/plans`, `PlatformAdminHmacGuard`). The "Kiorly admin edition" and maker-checker config live in `kiorex-platform` (ops console). | Same |

Consequences: (a) Pharmacy already has the right read pattern (global rows visible to all tenants); what is missing is read-only enforcement, versioning, provenance and an import pipeline. (b) The Lab needs a new global layer and a LOINC field. (c) The "super admin table" belongs in the Kiorex ops console (the existing Kiorly admin edition), not in the product web apps, following the plan-price precedent.

## 3. Pharmacy sources: Egyptian Drug Authority

| # | Source | URL | What it is | Format | Update | Licence or terms found | Verdict |
|---|---|---|---|---|---|---|---|
| P1 | EDA Egyptian Drug Database (EDDB) search of registered products | https://eservices.edaegypt.gov.eg/EDASearch/SearchRegDrugs.aspx | Public search of all valid registered products. Product types: human, biological, herbal, veterinary, biocides, cosmetics, complementary. Search by trade name, reg no, applicant, generic name; minimum three characters; **verification code (CAPTCHA) required**. | Interactive web form only. No export, API or bulk download documented. | Not stated. EDA announced it as a public service on 6 Nov 2026 (https://www.egypttoday.com/Article/1/150447/Egyptian-Drug-Authority-launches-database-for-registered-medicines; https://www.youm7.com/story/2026/11/6/%D9%84%D9%88-%D8%B4%D8%A7%D9%83%D9%83-%D9%81%D9%89-%D8%A7%D9%84%D8%B9%D9%84%D8%A7%D8%AC-%D9%87%D9%8A%D8%A6%D8%A9-%D8%A7%D9%84%D8%AF%D9%88%D8%A7%D8%A1-%D8%AA%D8%AA%D9%8A%D8%AD-%D9%82%D8%A7%D8%B9%D8%AF%D8%A9-%D8%A8%D9%8A%D8%A7%D9%86%D8%A7%D8%AA-%D9%84%D9%84%D8%A7%D8%B3%D8%AA%D8%B9%D9%84%D8%A7%D9%85/7608006). | No terms of use or reuse licence found. Copyright footer "Copy Rights @ EDA 2021". EDA says (as reported 31 Jul 2026) its website, verified social pages and press releases are the only approved sources for its decisions (Medigize summary, https://www.medigize.com/en/blog/medicine-official-price-egypt). | **Viewable, not licensed for bulk reuse. Scraping not allowed in practice (CAPTCHA).** Needs written permission. |
| P2 | EDDB procedure notice EDREX:NP.PPMA.18 v1, 6 Jun 2024 | https://edaegypt.gov.eg/media/0d3auqxq/np-ppms-18_en.pdf | Defines the result fields: name, product type, dosage form, shelf life, route, strength, pack unit and details, applicant, company name, registration number, market type, registration type, registration date, expiry date, license status, **price status**, physical character, storage condition, combo pack, generics, packages, attachments. | PDF (read by text extraction on 28 Nov 2026) | Version 1/2024 | A notice to applicants; no reuse grant | Field list only. **No ATC code and no GTIN in the documented fields; "Price status" is not a price figure.** |
| P3 | EDA website publication guideline EDREX.GL.CEO.002, 2 Aug 2026 | https://www.edaegypt.gov.eg/media/ldmfmgky/guide-line-eda-website-publishing_2026.pdf | Lists the public tools: Pricing Inquiries, API Searching Tool, EDA Similars, DDB Egyptian Drug Database, Batch Production and others. "API Searching Tool" is a search tool for active ingredients, not a developer API. | PDF | v1.0 2026 | None for reuse | Confirms the tools exist; no data licence. |
| P4 | EDA periodic lists page | https://edaegypt.gov.eg/en/publications-reports-and-eda-in-numbers/eda-publications/periodic-lists/ | 13 lists incl. OTC list, National Egyptian Essential Medicines List (2025), crash cart, do-not-crush (2026), high-alert medications (2025), API list, localized-similars list (PDF, Jan 2026). Most have no direct link on the page. | Mostly PDF; the page states formats for only one | Annual or ad hoc | None found | Useful as **flag overlays** (OTC, essential, high-alert) after permission. Not a full product list. |
| P5 | Committee-approved product lists (decision 450 of 2023), e.g. April-June 2026 and July-Sept 2026 sessions | e.g. https://www.edaegypt.gov.eg/media/ugij0pou/%D9%82%D8%A7%D8%A6%D9%85%D8%A9-%D8%AF%D8%B9%D9%85-%D8%A7%D9%84%D9%85%D8%AB%D8%A7%D8%A6%D9%84-%D8%A7%D9%84%D8%B9%D9%84%D8%A7%D8%AC%D9%8A%D8%A9-%D8%A7%D9%84%D9%85%D8%B3%D8%AA%D9%88%D8%B1%D8%AF-_9.pdf | Arabic PDFs about similars and committee decisions per period. Not verified to be price lists. | PDF | Quarterly | None found | Do not treat as a price source. |
| P6 | EDA pricing e-service ("Online Pricing Submission Gate") | http://eservices.edaegypt.gov.eg/Pricing/ | Company-facing pricing submission system (login). | Web app | n/a | Private | Not a public data source. |
| P7 | Public price | n/a | We could NOT find a public EDA price list file. A Nov 2026 explainer found no figure in EDDB and reports that packs carry the price (and a QR/track-and-trace record). Pricing rules were re-written (effective 24 Sep 2026, per https://enterpriseam.com/egypt/2026/09/27/the-eda-rewrites-its-drug-pricing-rulebook-around-costs-competition-and-localization/); a price review from Jan 2027 was reported as possible. | n/a | n/a | n/a | **Public price is a risk: the authoritative price is on the pack and in EDA systems we cannot reuse.** Keep price OUT of the reference row or store it only as an optional "EDA public price (as of date)" field when EDA permits. |
| P8 | National track and trace (EPTTS) | https://www.edaegypt.gov.eg/media/qymmg5az/gl-cip-ppmma-001_en-2026.pdf ; https://www.edaegypt.gov.eg/media/4glpemgb/track-n-trace-qna-final.pdf ; https://gs1eg.org/en/track-and-trace-system/ | Every pack carries a GS1 DataMatrix with GTIN, serial, batch, expiry. Imported products from 1 Feb 2026, local from 1 Aug 2026. Company assigns its own GTIN; one GTIN per pack size. | n/a | n/a | n/a | **GTIN will be the best matching key in the future, but EDA does not publish a GTIN list.** The pharmacy captures it by scanning. Reference rows get GTIN only when a lawful source provides it. |
| P9 | WHO ATC/DDD index | https://atcddd.fhi.no/atc_ddd_index_and_guidelines/atc_ddd_index/ | ATC codes. Free searchable web version; Excel/XML download from a registered account (the community scraper repo cites about EUR 200 for the file). Copyright statement: use requires reference to WHOCC; "copying and distribution for commercial purposes is not allowed; changing or manipulating the material is not allowed" (https://atcddd.fhi.no/filearchive/publications/1_2026_guidelines_for_atc_classification_and_ddd_assignment.pdf). | Excel, XML | Annual (valid 1 January) | Restrictive | **Do not bulk redistribute ATC.** Use ATC only as an optional code on a row after a written WHOCC licence query, or let each pharmacy type it. |

### 3.1 Legal reading (not legal advice; counsel to confirm)

- Public availability on a regulator's website is not a reuse licence. We found no EDA terms of use, no open-data licence and no statement allowing copy or redistribution. Egyptian copyright and database-protection rules (Law 82 of 2002) should be checked by counsel before any bulk copy. We did not verify the statute text; **NEEDS_HUMAN (counsel)**.
- The EDDB requires a CAPTCHA. Automating around it is excluded by our own rule (no bypass of bot detection) and would likely breach site conditions. **We will not scrape EDDB.**
- Prices: a product's maximum public price is a regulated fact, and pharmacies are legally bound by it (EDA speaks of the compulsory price). Showing a stale or wrong price in a product is a patient-facing and regulatory risk. Never show an EDA price as current unless it carries an "as of" date and source and the pharmacy confirms it.
- Our own repo is public. Committing an EDA extract into any repo is a redistribution; **never commit it.** Imports must be uploaded at runtime to the database.

### 3.2 Compliant ways to obtain the data (ranked)

1. **Written request to EDA** (Central Administration of Pharmaceutical Policies and Market Access, "Administration of Pharmaceutical Systems and Information", the owner of EDDB per the notice) for a licensed periodic extract of the registered human pharmaceutical products, with a data-sharing agreement. Draft in section 11. Contacts on the EDA site: hotline 15301, info@edaegypt.gov.eg (https://eservices.edaegypt.gov.eg/EDASearch/SearchRegDrugs.aspx).
2. **Official files the EDA itself publishes** (periodic lists in section 3 P4) imported as flag overlays, once permission for reuse inside a commercial product is confirmed in writing (the page carries no terms, so ask).
3. **Each pharmacy's own data**: its supplier price list or distributor catalogue (the pharmacy owns what it receives under its supply terms), imported into its own catalogue only. This does not need EDA permission but is not a national list.
4. **Look-up on demand, not copy**: a deep link to EDDB for the pharmacist to verify a product. Cheap, lawful, no data stored.
5. Not acceptable: scraping EDDB; using third-party scraped datasets (GitHub, apps) of unknown provenance; copying another app's price list.

**Licence verdict, pharmacy:** RED for any automated or bulk reuse today. AMBER after written EDA permission. GREEN only for deep links and user-uploaded own data.

## 4. Lab sources

| # | Source | URL | What | Licence | Verdict |
|---|---|---|---|---|---|
| L1 | **LOINC** (Regenstrief Institute) | https://loinc.org/license/ (text), https://loinc.org/kb/license (same text), downloads at https://loinc.org (free account and acceptance of terms; account requirement per the Getting LOINC page) | International code system for lab and clinical observations: LOINC code, long name, component, property, time aspect, system (specimen), scale, method, example units, status, plus Part, Group and Panels files and **linguistic variants**. Releases twice a year; latest we saw is 2.83 (release notes https://loinc.org/kb/loinc-release-notes). **Arabic (Jordan)** translation is in the distribution (`arJO32LinguisticVariant.csv`; https://loinc.org/translations/ar-jo); no Egyptian Arabic variant exists. About 100k+ terms in total (unverified; count at import), of which a lab subset is relevant. | "Permission is hereby granted in perpetuity, without payment of license fees or royalties, to use, copy, or distribute the Licensed Materials for any commercial or non-commercial purpose", subject to conditions: (1) do not use it to build a competing standard; (9) each copy carries the copyright notice and licence and the version/release date, and via the internet the licence must be accessible on the download page; (10) portions may be embedded in products and services including mobile apps, provided the **required notice** is included (below), third-party content is complied with or removed, and extracted information always carries the LOINC code and display name. Third-party content (some survey instruments, SNOMED CT in the Part file, RadLex) has its own terms, flagged per code in `EXTERNAL_COPYRIGHT_NOTICE`; that notice must be shown with those codes. | **GREEN with conditions.** Safe for a commercial lab product. |
| L2 | **WHO Model List of Essential In Vitro Diagnostics (EDL)** | https://www.who.int/teams/health-product-policy-and-standards/assistive-and-medical-technology/medical-devices/selection-access-and-use-in-vitro ; first list https://www.who.int/publications/i/item/9789241210263 | Policy list of about 200 test CATEGORIES by purpose, specimen, health-care level (not products, not analytes with units or intervals). EDL 4 is published (TRS report, Oct 2023); EDL 5 was planned for 2025 and we could not confirm its publication. eEDL is an open access electronic database with GMDN (and later EMDN) codes. | WHO publications are CC BY-NC-SA 3.0 IGO; commercial use needs WHO permission (https://www.who.int/about/policies/publishing/copyright). Tables and figures may need separate permission. We did not find a separate eEDL data licence. | **AMBER.** Use as a read-only "WHO essential" tag/list by reference (link plus our own mapping of category to LOINC), or request WHO permission. Do not copy tables wholesale. |
| L3 | Egypt MoH / UHIA / EDA / procurement lab-test catalogue | n/a | We searched and found **no public machine-readable Egyptian lab-test catalogue with codes**. Universal Health Insurance Authority (UHIA) publishes a medical-services price regulation (6th edition effective 1 Jan 2026, https://gate.ahram.org.eg/News/5341706.aspx) and a service package page (https://uhia.gov.eg/%D8%AD%D8%B2%D9%85%D8%A9-%D8%A7%D9%84%D8%AE%D8%AF%D9%85%D8%A7%D8%AA-%D8%A7%D9%84%D8%B7%D8%A8%D9%8A%D8%A9/) with a "medical analyses" group; no downloadable coded list found. MoHP designated WHO ICHI for the service package coding (https://www.who.int/about/accountability/results/who-results-report-2020-mtr/country-story/2020/egypt). No Egypt SNOMED membership or national LOINC mandate was found. | Unknown | **Not available as a lawful bulk source. Ask UHIA / MoHP for their coded lab service list** (letter in section 11). WHO ICHI is CC BY-ND (use unadapted, cited) per the WHO copyright page; ICHI is about interventions, not a lab analyte list. |
| L4 | SNOMED CT | https://www.snomed.org/members ; https://www.snomed.org/licensing | Clinical terminology. Egypt is NOT in the member list we saw (54 members; Jordan, Qatar, Saudi Arabia and UAE are). Non-member use needs an annual affiliate licence per data processing system (USD 652 to 1,954 per year bands in the page we read; web and mobile apps need special permission and fees). | Paid or fee-exempt only | **RED/AMBER for now. Do not include.** LOINC already embeds SNOMED parts; we must keep the third-party notice. |
| L5 | UCUM (units of measure) | https://ucum.org | Case-sensitive unit codes, free for use under its own terms (not fetched; verify). | Free (unverified) | Use UCUM codes in a `unitUcum` field; confirm terms. |
| L6 | IFCC / IUPAC NPU, CLSI conventions | IFCC C-NPU (https://ifcc.org), CLSI (https://clsi.org) | NPU is a code system; CLSI documents (e.g. reference interval standard EP28) are paid copyrighted standards. | Not fetched. Typically restrictive | **Do not copy.** Use only as a naming and method convention. Each lab's own reference intervals stay its own (as the schema already requires `source` per interval). |
| L7 | Reference intervals | n/a | LOINC has no reference ranges. Intervals are method, population and lab specific; the existing `ReferenceInterval` model already versions them per tenant with `source`. | n/a | **Never ship a global interval set as truth.** A global interval, if ever offered, must be a clearly labelled published source with licence (literature) and require lab pathologist adoption (NH-LB-005 style). Out of scope for v1. |
| L8 | LOINC panels and the "Universal Lab Order Codes Value Set" | in the LOINC distribution (Group 3) | Panels (e.g. profiles), order code set | Same LOINC licence | Candidate source for `TestPackage` templates. |

**Required LOINC notice** (must appear in the product's terms/licence page and on any page that downloads the data, and next to LOINC-derived data in exports; wording from the licence):
"This material contains content from LOINC (http://loinc.org). LOINC is copyright (c) Regenstrief Institute, Inc. and the Logical Observation Identifiers Names and Codes (LOINC) Committee and is available at no cost under the license at http://loinc.org/license. LOINC(R) is a registered United States trademark of Regenstrief Institute, Inc."
Also: store the LOINC release version per row; show the code with its display name; show `EXTERNAL_COPYRIGHT_NOTICE` where present; do not use LOINC to create a competing standard (do not invent a "Kiorly code" that replaces LOINC; keep ours as a local key beside it).

**Licence verdict, lab:** GREEN with conditions for LOINC; AMBER for WHO EDL; RED for SNOMED and CLSI copy; unknown for Egyptian lists.

## 5. How comparable products and regulators handle this

| Case | What we saw | Lesson |
|---|---|---|
| Saudi SFDA | Publishes a registered human drug list on its site with a downloadable Excel option, an Open Data section (https://www.sfda.gov.sa/en/open-data), a developer portal "Registered Drug Service" API with bearer token and Open Data category (https://developer.sfda.gov.sa/products/registered-drug-product/registered-drug-service). List columns on the page: scientific name, trade name, strength, form, price, details; the API adds ATC codes, register number, barcode search, legal status. | A regulator-sanctioned file or API is how regional products integrate. Egypt does not offer one yet, so we ask. Do not copy keys that appear in public pages. |
| Community scrapers | Public GitHub scrapers exist for SFDA and ATC pages. | Their licence is unclear or non-commercial (the ATC scraper itself is CC BY-NC-SA). Do not rely on them. |
| Egyptian consumer apps | Not verifiable. We found no authoritative statement of how any Egyptian app sources its drug list. | Treat unknown provenance as unsafe. |
| National LOINC users (Jordan, Qatar, Indonesia, 30+ countries name LOINC a standard) | Adopt LOINC as the lab code system, often with national translations (https://loinc.org/international). | A national lab list normally maps to LOINC; propose that to MoHP or UHIA. |

We could not verify how named competitor products in Egypt import lists.

## 6. Recommended architecture (both products)

### 6.1 Principles

1. The **reference catalogue is global, read-only for tenants, append-only, versioned, effective-dated and provenance-stamped**. No code path for a tenant to update or delete a reference row.
2. A tenant **adopts** a reference item: creates a tenant-owned `Drug` or `TestDefinition` that points to the reference row (`referenceItemId` plus the reference `version` at adoption). Price, stock, VAT override, reorder, display name override live on the tenant row. The reference row never changes because of a tenant.
3. Tenants may also create **own items** with no reference link (the "extra items" the founder asked for).
4. Imports are **files uploaded by a super admin**. A scheduled fetch exists only where a licence expressly allows it (today: LOINC could be a scheduled manual-assist job, see 6.6; EDA: none).
5. An import is approved by a **second super admin** (maker-checker, same pattern as `CommissionRatePolicy` and growth config), and the approve step is refused by the database for the same user.
6. Data is never fabricated. If there is no lawful source file, the reference table stays empty and the UI says so.

### 6.2 Where it lives

The master tables and the maker-checker import workflow live in **`kiorex-platform`** (ops console, the "Kiorly admin edition", `super_admin` role), because that is where the shared super admin, audit and maker-checker already are. Products (Pharmacy, Lab, and later Clinic lab orders) need a local copy because they run STANDALONE. So the platform publishes **signed versioned snapshots** that each product pulls (or receives on a signed route, like `marketplace/v1/plans`) into its own read-only `Reference*` tables. A STANDALONE product (no Kiorex link) receives the same snapshot from a super admin bundle upload (signed file) so it still works offline. Open question for founder: keep the master in the platform (recommended) or inside each product (simpler for Kiorly Admin but duplicates workflow); see section 12.

### 6.3 Data model (proposal, names are suggestions)

Platform (master):

- `ReferenceCatalogue` (`id`, `kind` DRUG_EG | LAB_LOINC | LAB_WHO_EDL, `name`, `licenceCode`, `licenceText` pointer, `attributionText`, `ownerOrg`, `marketCode`)
- `ReferenceImport` (`id`, `catalogueId`, `status` DRAFT | VALIDATED | PENDING_APPROVAL | APPROVED | REJECTED | APPLIED | SUPERSEDED, `sourceName`, `sourceUrlOrLetterRef`, `sourceAsOfDate`, `fileSha256`, `fileSizeBytes`, `rowCount`, `licenceEvidenceRef` (letter, email, or licence URL, required to submit), `sourceVersion` (e.g. LOINC 2.83), `createdBy`, `approvedBy` (must differ), `diffSummary` JSON, `createdAt`, `approvedAt`)
- `ReferenceItem` (append-only; one row per item per version): `id`, `catalogueId`, `itemKey` (stable natural key, see 6.4), `version` int, `effectiveFrom`, `effectiveTo`, `status` ACTIVE | WITHDRAWN | SUPERSEDED, `importId`, `sourceRowHash`, `payload` typed columns per kind (below), `nameEn`, `nameAr`, `searchText` (normalised), `source`, `licenceCode`, `asOfDate`. A change creates a new row and closes the old row's `effectiveTo`. Withdrawn items stay for history; the DB blocks UPDATE and DELETE except setting `effectiveTo` (trigger, as already done for other append-only tables).
- `ReferenceImportRowIssue` (`importId`, `rowNo`, `severity`, `code`, `message`) for data-quality reports.

Typed columns for the drug kind (`ReferenceDrug`, one table, tens of thousands of rows): `edaRegNo`, `tradeNameEn`, `tradeNameAr`, `genericName`, `strength`, `strengthUnit`, `dosageForm`, `route`, `packDetails`, `packSize`, `applicant`, `manufacturer`, `productType`, `registrationStatus` (licence status), `regDate`, `regExpiry`, `legalStatus` (Rx/OTC if the source states it), `storageCondition`, `atcCode` (nullable, only if licensed), `gtin` (nullable), `publicPrice` and `publicPriceAsOf` (nullable, only with licence), `sourcePriceStatus`.
Typed columns for the lab kind (`ReferenceLabTest`): `loincNum`, `longCommonName`, `shortName`, `component`, `property`, `timeAspect`, `system`, `scale`, `method`, `class`, `exampleUcumUnits`, `status` (ACTIVE/DEPRECATED/DISCOURAGED), `versionFirstReleased`, `externalCopyrightNotice`, `whoEdlCategory` (nullable overlay), `loincVersion`; plus `ReferenceLabTestName` (`loincNum`, `lang`, `name`, `source`) for Arabic and other translations.

Product side (Pharmacy, Lab): a read-only mirror table of the active snapshot plus **`referenceItemId`** (nullable, indexed) and `referenceVersionAtAdoption` on `Drug` and `TestDefinition`/`Analyte`. `Drug.marketCodes` already anticipates `{"EG":{"edaCode"}}`: promote `edaRegNo` to a real nullable column with a partial unique index per org (`orgId`, `edaRegNo`) so one pharmacy cannot adopt the same registration twice. Add `Drug.origin` enum (REFERENCE | OWN | LEGACY_SEED).

### 6.4 Matching keys

- Drug: primary `edaRegNo` (the registration number is shown on every EDDB record); secondary `gtin` (EDA track and trace makes GTIN per pack size universal over time, GS1 prefix owned by the brand owner); tertiary normalised `(brand, strength, dosageForm, packSize)` fuzzy match for review only. Never auto-link on name alone.
- Lab: `loincNum`. Tenant tests map one-to-one or one-to-many (a panel maps to a LOINC panel plus component LOINCs). Our local analyzer codes stay in `Analyte.analyzerCodes`.

### 6.5 Import pipeline

1. Super admin chooses the catalogue and uploads CSV or XLSX (max size configured, e.g. 100 MB), enters source name, as-of date, licence evidence reference. Upload is stored encrypted, SHA-256 recorded.
2. Parser maps columns through a saved **column mapping** (section 10), streams rows, never loads the whole file in memory.
3. **Validation** (errors block approval, warnings need an acknowledgement): required fields present; `edaRegNo` unique inside file; GTIN is 8, 12, 13 or 14 digits and passes the GS1 check digit; dates parse; dosage form and unit are in the controlled vocabularies (unknown values reported, not silently mapped); Arabic text is NFC normalised, no mixed replacement characters, Arabic-Indic digits converted for keys; strength parse (value plus unit) ; duplicate trade name inside the same applicant and strength flagged; LOINC check digit (mod 10) valid; LOINC status DEPRECATED rows imported but hidden from adopt by default; row count change vs previous import beyond a threshold (e.g. more than 10 percent removed) is a blocking warning.
4. **Diff** against the active snapshot: counts of ADDED, CHANGED (with field-level changes), WITHDRAWN, UNCHANGED, plus list samples. Stored as `diffSummary`; full detail downloadable as CSV.
5. **Maker-checker**: maker submits; a different `super_admin` reviews the diff and the licence evidence and approves, or rejects with a reason. Self-approval refused by a DB constraint. Audit entry per transition (checksums only, no row data).
6. **Apply** in one transaction: append new versions, close superseded rows' `effectiveTo`, set status WITHDRAWN for rows absent from the new file when the file is declared a full snapshot (partial files declared as delta only add or change). Publish a new snapshot id.
7. **Distribute**: products pull `GET /reference/v1/<kind>/snapshots?since=<id>` (signed, paged) and upsert their mirror; they never accept edits. A tenant's adopted item shows a "reference changed" badge when its reference version differs, with a review screen (accept new name/strength, never touching price or stock).
8. **Rollback** = approve a new import that restores the previous snapshot (never delete).
9. LOINC assisted refresh: a super admin downloads the new LOINC release by hand (account and acceptance of terms required) and uploads `Loinc.csv`, `LinguisticVariants/*.csv`, `Part.csv` as a single import; no unattended fetch, because the download requires a free account and acceptance of terms.

### 6.6 Scheduled fetch policy

No scheduled fetch for EDA (no licensed endpoint, CAPTCHA). If EDA later grants an API or file feed under agreement, implement it as a fetch that produces a DRAFT import and still needs maker-checker. LOINC FHIR terminology service (https://fhir.loinc.org) exists but terms for automated bulk calls were not verified; do not automate.

### 6.7 Super admin table (Kiorex ops console, Kiorly admin edition)

- Tabs per catalogue: Items, Imports, Mapping, Quality.
- Items table: server-side pagination (cursor), debounced search across EN and AR names, registration number, GTIN, LOINC, active ingredient; filters: product type, dosage form, status (active/withdrawn), Rx/OTC, controlled, manufacturer/applicant, source, as-of date range, "has Arabic name", "has GTIN", "adopted by N tenants". Columns: code (reg no or LOINC), EN name, AR name, strength or component, form or specimen, status, **source badge** (EDA, LOINC, WHO EDL, Kiorly-curated), licence chip, version, as-of date, last updated, adoption count.
- Row detail: full record, version history, which tenants adopted it (count, not names unless needed), import that created it.
- Export: CSV of the current filter, with the licence/attribution header block repeated and the LOINC notice included. Export is rate limited and audited, and disabled for a catalogue whose licence says no redistribution (e.g. pre-permission EDA data).
- Imports tab: upload, mapping, validation report, diff, submit; second admin sees "awaiting your approval".
- RTL and Arabic labels throughout; AR/EN strings added to the shared wording manifest used by the apps.

### 6.8 Tenant view (pharmacy and lab)

- A "National list" / "Reference list" tab inside Catalogue (pharmacy) and Test catalogue (lab), read-only, with a lock badge and the source badge, as-of date, and attribution line.
- Actions: **Adopt** (pharmacy: pick pack, set price, VAT, category, reorder defaults; lab: set price, section, TAT, specimen overrides) creating the tenant row linked to the reference; **Adopt many** from a filter; "Not in the list? Add your own item" opens the existing create form with origin OWN.
- Own amounts: price book entries, stock lots, costs and margins stay in tenant tables. Reference public price (if licensed) shows as a grey "Official reference price as of <date>" hint next to the pharmacy's own price and warns if the own price exceeds it, but never overwrites it.
- Tenant users get `catalogue.read` for the reference list and `catalogue.write` only for adopting. Tenants cannot hide the lock; there is no edit endpoint.
- Offline POS: only adopted rows sync to the till; the full reference list is not pushed to devices.

### 6.9 Migration impact on existing rows

- Pharmacy: existing global rows (`orgId` null, `sourceKey` `synthetic-eg:N`) are synthetic demo data. Mark them `origin LEGACY_SEED` and hide them from the reference list in production; keep them in test and demo environments. Existing tenant `Drug` rows keep working; a matching job proposes `referenceItemId` by `edaRegNo` then `gtin`, queued for the pharmacist to confirm (no silent relinking, no change of price or stock). Real tenants that already have drugs keep their ids; `PriceBookEntry` and `StockLot` foreign keys are untouched. Additive migration: new nullable columns and tables, backfill separately.
- Lab: add `loincNum` (nullable) and `referenceItemId` on `TestDefinition` and `Analyte`; a mapping assistant suggests a LOINC by name, specimen and unit; a human confirms. `ReferenceInterval` stays per tenant and unchanged.
- Backward compatible with the generated OpenAPI; mobile staff app reads the same `Drug` shape, with two optional new fields.

### 6.10 Size and performance

- Pharmacy: EDDB lists all valid registered products across seven product types. We could not count it; human registered products are commonly reported in the tens of thousands (estimate only, measure on first import). At 20k to 100k rows with ~1 KB each, the table is well under 200 MB.
- Lab: the LOINC table is on the order of 100k terms (verify at import); we load only lab-relevant classes (e.g. CHEM, HEM/BC, COAG, MICRO, SERO, DRUG/TOX, UA, and so on) by a class filter, about tens of thousands of rows. Arabic names exist only for part of the table.
- Indexes (PostgreSQL): btree on `(catalogueId, itemKey, version)` unique; partial index on `effectiveTo IS NULL` (current rows); `gtin`, `edaRegNo`, `loincNum`; **trigram GIN (`pg_trgm`) on normalised EN and AR search text**; optional `unaccent` and an Arabic normaliser (strip tashkeel and tatweel, unify alef forms, ya/alef maqsura, ta marbuta) applied on write into `searchText` and on query. Full-text (`tsvector`) for ingredient search. Keyset pagination, no offset on deep pages. A materialised "current snapshot" view or a `isCurrent` boolean updated in the apply transaction keeps list queries on a small index.
- Distribution: snapshot delta sync is paged (e.g. 5k rows), compressed, with an etag; a product's first sync of 50k rows should take seconds to a minute and runs off the request path.
- Memory and time: import streaming with batched `INSERT ... ON CONFLICT` in chunks of 1k to 5k; run in a worker, not the web request.

## 7. Compliance and risk register

| # | Risk | Rating | Mitigation |
|---|---|---|---|
| R1 | Copying EDA data without a licence (copyright, database right, contract, regulator relationship) | HIGH | No scraping; EDA letter; import only files with `licenceEvidenceRef`; counsel review; reference table empty until then |
| R2 | CAPTCHA bypass | HIGH | Prohibited; not built |
| R3 | Wrong or stale price shown as official | HIGH | Price not in v1 reference rows; if added later, always `asOf` plus source plus "confirm on pack" wording; never auto-fill tenant price |
| R4 | A tenant edits or deletes a national item | MED | No write endpoints; DB triggers; tests that attempt an update with a tenant token |
| R5 | LOINC notice or version missing | MED | Notice stored in `ReferenceCatalogue.attributionText`, shown on the list page, terms page and exports; automated test that every LOINC export carries it; third-party copyright notice shown per code |
| R6 | LOINC third-party content (e.g. survey instruments) redistributed | MED | Filter out rows with external copyright notice in v1, or show notice |
| R7 | Misuse of LOINC to define a Kiorly standard | LOW | Keep local code as a key only; do not market it as a standard |
| R8 | Wrong auto-matching changes a pharmacy's stock or price links | HIGH | Matching proposes only; human confirms; matching never edits price or stock; reversible |
| R9 | Data quality (Arabic encoding, duplicate reg numbers, withdrawn products still sold) | MED | Validation list in 6.5; withdrawn items show a red "withdrawn by source" flag and a stock alert in the pharmacy; controlled-substance schedule NOT assumed from source unless source says it |
| R10 | Public repos | HIGH | Never commit extracts; import via UI at runtime; sample CSV uses placeholders only |
| R11 | Clinical safety: global reference intervals | HIGH | Out of scope; intervals remain lab-owned |
| R12 | Import abuse or a single admin loading bad data | MED | Maker-checker with DB-enforced two-person rule; full audit; rollback by new import |
| R13 | Licence change by a source (e.g. LOINC third-party items; WHO terms) | LOW | `licenceCode` and evidence per catalogue; an "licence review due" date |
| R14 | Personal data | LOW | Reference data has none; EDA applicant companies are legal entities |
| R15 | Regulatory claim: showing a list as "approved medicines" | MED | Label "EDA registered products as of <date>, source EDA"; disclaimer that registration does not prove a given pack is genuine; do not call it a clearance to dispense |

## 8. Options considered

| Option | Pharmacy | Lab | Risk | Verdict |
|---|---|---|---|---|
| A. Scrape EDDB nightly | yes | n/a | Legal, CAPTCHA, brittle | Rejected |
| B. Upload of an official EDA file by super admin after written permission | yes | n/a | Depends on EDA reply | **Recommended** |
| C. Per-pharmacy import of own supplier list only | yes | n/a | Fully lawful but no national list | Fallback / complement |
| D. Deep link to EDDB only | yes | n/a | None | Ship now as a stopgap |
| E. LOINC upload by super admin | n/a | yes | Low with notice | **Recommended** |
| F. LOINC plus WHO EDL tag after WHO permission | n/a | yes | Low after permission | Phase 2 |
| G. SNOMED CT | n/a | optional | Cost and licence | Not now |

## 9. Phased implementation plan

Phase 0 (founder, no code): send the letters (section 11); decide master location and the open decisions in section 12. Counsel review of the EDA and WHO terms and of the Egyptian database-protection position.

Phase 1 (foundation, no external data needed). Repos and tasks:

- `kiorex-contracts`: add OpenAPI and types for `reference/v1` (snapshots list, item shape per kind, attribution block, import status); bump version, tag, regenerate vendored tarballs for consumers.
- `kiorex-platform`: migrations `ReferenceCatalogue`, `ReferenceImport`, `ReferenceItem` (+ typed tables), append-only triggers, two-person constraint; module `reference-catalogue` with upload, mapping, validation, diff, submit/approve/reject/apply, snapshot feed (HMAC); ops console pages (Items table, Import wizard, Mapping, Quality report); audit events; tests (upload, validation fail, self-approve refused, apply, diff counts, rollback, export carries notice); RBAC (`super_admin` maker and checker, `ops_admin` read).
- `kiorly-pharmacy`: migration (additive) `ReferenceDrug` mirror, `Drug.referenceItemId`, `referenceVersionAtAdoption`, `edaRegNo`, `origin`; snapshot sync worker (signed pull); read-only list endpoint with search; adopt endpoint (creates tenant `Drug` and optional first price); web "National list" tab with lock/source badges and adopt dialog; tests that a tenant cannot mutate reference rows and that adoption never touches stock; AR/EN strings; mark `synthetic-eg` rows LEGACY_SEED and hide in production.
- `kiorly-lab`: migration `ReferenceLabTest` mirror, `loincNum` and `referenceItemId` on `TestDefinition` and `Analyte`, snapshot sync, list, adopt, mapping assistant UI; same tests.
- `e2e`: end-to-end spec: super admin A uploads placeholder CSV, super admin B approves, a pharmacy and a lab see it read-only and adopt; second import produces a diff; self-approval fails.
- Docs: `Docs/` per repo plus an ADR; update `LLM_HANDOFF.md` and `LAUNCH_PREPARATION_GUIDE.md` rows (new LG rows: EDA data permission, WHO permission, counsel on database rights, LOINC notice in terms).

Phase 2 (Lab content): obtain LOINC release (free account), import the lab-class subset with `ar-JO` as a draft Arabic layer, flagged "translation by third party, Jordan dialect"; panels as package templates; WHO EDL tag after permission; optional UCUM unit field.

Phase 3 (Pharmacy content): after EDA written permission, first import with maker-checker; matching job for existing pharmacies with confirmation UI; GTIN capture from scans enriches the tenant rows (not the reference unless EDA allows); ATC only after WHOCC licence; optional public price field only with explicit EDA permission.

Phase 4 (hardening): performance test with 100k rows, search tuning, snapshot sync soak test, accessibility pass for the tables, i18n review by a human, counsel sign-off record for the catalogue licence stored as a human record (never marked approved by an agent).

Estimates are for the founder to plan, not commitments: Phase 1 is the largest piece of work across three repos; Phases 2 and 3 are mostly operations once Phase 1 exists.

## 10. Sample CSV column mappings (placeholders only, no real product)

### 10.1 Pharmacy: EDA-derived registered product file (the file we ask EDA for; the columns follow the EDDB notice fields)

| CSV column (source header, as EDA would supply) | ReferenceDrug field | Rule |
|---|---|---|
| Reg No | `edaRegNo` (itemKey) | required, unique per file, trimmed, digits and letters as given |
| Trade Name | `tradeNameEn` | required |
| Trade Name (Arabic) | `tradeNameAr` | optional, NFC normalised |
| Generic Name | `genericName` | required for human products; mapped to Drug.activeIngredient on adoption |
| Strength / Strength Unit | `strength`, `strengthUnit` | parse; keep raw text too |
| Dosage Form | `dosageForm` | controlled list, unknown values reported |
| Route | `route` | optional |
| Pack unit and details | `packDetails`, `packSize` | parse pack size if numeric |
| Applicant | `applicant` | company legal name |
| Company name | `manufacturer` | |
| Product type | `productType` | HUMAN, BIOLOGICAL, HERBAL, VET, ... ; v1 loads HUMAN and BIOLOGICAL |
| License status | `registrationStatus` | withdrawn or expired becomes WITHDRAWN/EXPIRED |
| Registration date / Reg Expiry date | `regDate`, `regExpiry` | ISO dates |
| Storage condition | `storageCondition` | cold chain flag only if text matches a reviewed rule list |
| Price status | `sourcePriceStatus` | stored as text; NOT a price |
| Barcode / GTIN | `gtin` | only if EDA supplies it; check digit validated |
| ATC | `atcCode` | only if licensed |

Example row (placeholder tokens, not real data):
```
Reg No,Trade Name,Trade Name (Arabic),Generic Name,Strength,Dosage Form,Pack unit and details,Applicant,License status,Reg Expiry date
<REG-0001>,<BRAND-A>,<ARABIC-NAME-A>,<GENERIC-X>,<STRENGTH-1>,<FORM-1>,<PACK-1>,<APPLICANT-1>,<VALID>,<YYYY-MM-DD>
```

Adoption mapping to the existing `Drug` row: `brandName` from `tradeNameEn`, `brandNameAr` from `tradeNameAr`, `activeIngredient` from `genericName`, `strength`, `dosageForm`, `packSize`, `manufacturer`, `gtin`, plus `marketCodes.EG.edaCode` (replaced by the `edaRegNo` column); `rxOnly`, `otc`, `controlledSchedule`, `coldChain` are NOT taken from the source unless the source states them; the pharmacist confirms them on adoption.

### 10.2 Lab: LOINC table (`Loinc.csv`) and linguistic variant

| LOINC column | Field |
|---|---|
| LOINC_NUM | `loincNum` (itemKey, check digit validated) |
| COMPONENT, PROPERTY, TIME_ASPCT, SYSTEM, SCALE_TYP, METHOD_TYP | same names, lower camel case |
| CLASS | `class` (filter for lab classes) |
| LONG_COMMON_NAME, SHORTNAME | `longCommonName`, `shortName` (displayed with the code, as the licence requires) |
| EXAMPLE_UCUM_UNITS | `exampleUcumUnits` |
| STATUS | `status` |
| VersionFirstReleased, VersionLastChanged | version fields |
| EXTERNAL_COPYRIGHT_NOTICE | `externalCopyrightNotice` (shown with the code) |
| `arJO32LinguisticVariant.csv` columns (LOINC_NUM plus translated component, system, long common name, etc.; see `LinguisticVariantsReadMe.txt`) | `ReferenceLabTestName` rows, `lang` = ar-JO |

Adoption mapping to the Lab: `TestDefinition.nameEn` from `longCommonName` (editable by the lab), `nameAr` from the Arabic layer or the lab's own wording, `specimenType` from `system`, `section` from `class` mapping, `Analyte.unit` from `exampleUcumUnits` (lab confirms), `loincNum` stored. Reference intervals are never copied.

## 11. Draft requests (for the founder to send; not sent)

To EDA (Central Administration of Pharmaceutical Policies and Market Access, Pharmaceutical Systems and Information): "We build pharmacy management software used by licensed pharmacies in Egypt. We request a written licence to receive a periodic extract (monthly or quarterly) of the registered human pharmaceutical products from the Egyptian Drug Database (fields: registration number, trade name, generic name, strength, dosage form, pack details, applicant, status, registration and expiry dates, and where available GTIN, ATC and public price), to show it read-only to pharmacies inside our product with source and as-of date, and to confirm what attribution, update frequency and redistribution limits apply. We will not scrape the portal." Also ask whether an API exists, whether prices may be shown, and who the data owner is. Counsel to review before sending.

To WHO (permissions form): permission to reproduce the list of test categories of the Model List of Essential In Vitro Diagnostics as an informational tag in commercial lab software, with attribution.

To UHIA and MoHP: ask whether a coded list of laboratory services (and a national LOINC or ICHI mapping) exists and may be reused.

To WHOCC (ATC/DDD): ask for a written licence to embed ATC codes in a commercial application.

To Regenstrief: not required for the free licence; note the notice and keep the licence page accessible.

## 12. Open founder decisions

1. Send the EDA letter (and WHO, UHIA, WHOCC letters)? Who signs and from which entity?
2. Master location: Kiorex platform ops console (recommended) or inside each product?
3. Until EDA answers, launch Pharmacy with: (a) empty national list plus deep link to EDDB, (b) own-supplier-file import only, or (c) hold the feature? (Recommended: a plus b.)
4. Show an official price hint? Recommended: not in v1; only with explicit EDA permission and an as-of date.
5. Lab scope for v1: LOINC lab classes only, or also microbiology and molecular? Which Arabic: use the Jordan variant as a draft layer or only the lab's own Arabic?
6. Adoption model: copy-on-adopt (recommended) versus live link where the tenant row follows reference changes automatically (rejected: surprises a pharmacy).
7. Who may adopt within a tenant (owner and pharmacist only)?
8. Should Kiorex (patient side) also use the reference list for search (e.g. generic name search)? Separate licence question.
9. Counsel: confirm database-right position in Egypt, the wording of the source disclaimer, and whether showing registration status can be read as a clearance to dispense.
10. Retention: keep withdrawn items forever (recommended for audit) or archive after N years.

## 13. What could not be verified

- No EDA terms of use, copyright or open-data statement was found; there may be one not reachable by our tools. Ask EDA.
- Whether EDDB results show a public price figure, GTIN or ATC. The 2024 procedure notice lists "Price status" and no GTIN or ATC; we did not run a search (CAPTCHA) and did not view the live result page.
- Total number of EDA registered products (no count found); the "tens of thousands" figure is the founder's estimate, not a sourced number.
- The EDA databases page (the "14 tools" mentioned by a third-party explainer) and the periodic-list download links; most list entries had no link on the fetched page.
- WHO EDL 5 publication status and any eEDL data licence; WHO ICHI details.
- LOINC: the licence text was read in full for the parts quoted; numbered conditions 2 to 8 were not displayed in our fetch; the Getting LOINC and loinc.org/license pages returned 403 to the first fetch tool (the text was read through another fetch). Exact term counts and the current release number should be confirmed at download.
- UCUM, IFCC NPU and CLSI terms: not fetched.
- Egyptian copyright and database-protection law text; Egyptian lab-test lists at UHIA or MoHP; how Egyptian competitors source their lists.
- Whether EDA, MoHP or UHIA have a national LOINC mandate (none found).

## 14. Source table (access date 28 Nov 2026)

| Topic | URL | Used for |
|---|---|---|
| EDDB search | https://eservices.edaegypt.gov.eg/EDASearch/SearchRegDrugs.aspx | existence, search fields, captcha |
| EDDB notice | https://edaegypt.gov.eg/media/0d3auqxq/np-ppms-18_en.pdf | result fields, price status |
| EDA announcement of the public database | https://www.egypttoday.com/Article/1/150447/Egyptian-Drug-Authority-launches-database-for-registered-medicines | launch date |
| EDA publication guideline | https://www.edaegypt.gov.eg/media/ldmfmgky/guide-line-eda-website-publishing_2026.pdf | tools list |
| EDA periodic lists | https://edaegypt.gov.eg/en/publications-reports-and-eda-in-numbers/eda-publications/periodic-lists/ | lists and no terms |
| EDA GMP portal | https://eservicesdata.edaegypt.gov.eg/WebData | other data portals, no export |
| Track and trace | https://www.edaegypt.gov.eg/media/qymmg5az/gl-cip-ppmma-001_en-2026.pdf ; https://www.edaegypt.gov.eg/media/4glpemgb/track-n-trace-qna-final.pdf ; https://gs1eg.org/en/track-and-trace-system/ | GTIN |
| Price explainer (third party) | https://www.medigize.com/en/blog/medicine-official-price-egypt | price status vs figure |
| Pricing rule change | https://enterpriseam.com/egypt/2026/09/27/the-eda-rewrites-its-drug-pricing-rulebook-around-costs-competition-and-localization/ | price regime risk |
| LOINC licence | https://loinc.org/license/ ; https://loinc.org/kb/license | licence |
| LOINC release notes | https://loinc.org/kb/loinc-release-notes | version, linguistic variants |
| LOINC Arabic (Jordan) | https://loinc.org/translations/ar-jo | Arabic |
| LOINC international | https://loinc.org/international | adoption |
| WHO EDL page | https://www.who.int/teams/health-product-policy-and-standards/assistive-and-medical-technology/medical-devices/selection-access-and-use-in-vitro | EDL, eEDL |
| WHO copyright | https://www.who.int/about/policies/publishing/copyright | CC BY-NC-SA, ICHI CC BY-ND |
| SNOMED members and licensing | https://www.snomed.org/members ; https://www.snomed.org/licensing ; https://www.snomed.org/fee-exemptions | cost, Egypt not a member |
| ATC/DDD | https://atcddd.fhi.no/atc_ddd_index_and_guidelines/atc_ddd_index/ ; https://atcddd.fhi.no/filearchive/publications/1_2026_guidelines_for_atc_classification_and_ddd_assignment.pdf | ATC licence |
| UHIA | https://gate.ahram.org.eg/News/5341706.aspx ; https://uhia.gov.eg/%D8%AD%D8%B2%D9%85%D8%A9-%D8%A7%D9%84%D8%AE%D8%AF%D9%85%D8%A7%D8%AA-%D8%A7%D9%84%D8%B7%D8%A8%D9%8A%D8%A9/ | no coded lab list found |
| MoHP and WHO ICHI | https://www.who.int/about/accountability/results/who-results-report-2020-mtr/country-story/2020/egypt | national coding |
| Saudi SFDA | https://www.sfda.gov.sa/en/open-data ; https://developer.sfda.gov.sa/products/registered-drug-product/registered-drug-service | regional precedent |
