# Kiorex document PDF builder (`_docs/pdf`)

Turns the KX-xx Markdown sources in `_docs/rev23/*.md` (falling back to `_docs/*.md`) into presentable A4 PDFs: gradient cover in the product colour, document-control page, clickable contents with dotted leaders and page numbers, chapter dividers with large numerals, running header and footer ("Page X of Y"), styled tables, callouts, KPI cards, status pills, timelines, flow chips, syntax-highlighted code, Mermaid diagrams as vector SVG, Arabic with correct RTL shaping, landscape pages for very wide tables, PDF bookmarks, tagged PDF and metadata.

The Markdown is never modified. Everything is derived from plain Markdown conventions (below).

## Build

```bash
cd _docs/pdf
npm install                       # once: markdown-it, highlight.js, mermaid, pagedjs, pdf-lib, playwright-core
node build.mjs --all              # every document in docs.manifest.json -> _docs/pdf/out/
node build.mjs --doc KX-05        # one document (also: --doc KX-05,KX-09  or repeat --doc)
node build.mjs --all --out ~/Desktop/kx-pdfs
node build.mjs --file fixtures/showcase.md   # any Markdown file (showcase of every component)
```

Output names follow the Drive naming, e.g. `KX-05_Kiorly_Clinic_PRD.pdf`. `build-report.json` in the output folder lists pages, size and warnings per document. Options: `--keep-html` (keep the intermediate HTML in `out/.tmp/` for debugging), `--no-dividers`.

A document whose source is missing is skipped with a clear message (`SKIP KX-24 no Markdown source found ...`); exit code is 1 only when a build fails.

**Browser.** No download needed: it drives the Chromium that `kiorly-work/e2e-web` already uses (`~/Library/Caches/ms-playwright/chromium-*`, newest wins). Override with `KX_CHROMIUM=/path/to/chrome`.

**Fonts** are local (`fonts/`, SIL OFL): Inter (body), Jost (brand headings), JetBrains Mono (code), IBM Plex Sans Arabic (Arabic, the brand Arabic face), Noto Sans Math (arrows and comparison symbols). Chromium embeds only the glyphs used, so files stay around 0.7 to 1.2 MB.

## How it works

1. `lib/md.mjs` splits the header block (revision, owner, audience, tags, "What changed", extraction note) from the body and renders the body with markdown-it (HTML is escaped; `<Gate>` stays text).
2. `lib/template.mjs` builds the cover, control page and contents shell with the family colours from `docs.manifest.json` and the logo lockup from `_brand/dist/svg` (never redrawn).
3. `assets/enhance.js` runs in headless Chromium and turns plain Markdown patterns into components, renders Mermaid, detects wide tables, builds the contents.
4. Paged.js paginates (running strings, page counters, named pages); `lib/pdf.mjs` patches it so continued tables repeat their header, prints with Chromium (outline + tagged) and sets metadata with pdf-lib.

## Markdown conventions that trigger components

| Write this | Get this |
|---|---|
| `# KX-05 — Title`, then `Revision:`, `Subtitle:`, `Tags:`, `Owner role:`, `Audience:` lines, or a `Field / Value` table, or a `DOCUMENT: .. \| REVISION: ..` line | Cover and document-control page (revision label, date, status chip, owner, audience, tags). Title and subtitle on the cover come from the manifest. |
| `## What changed ...` (or a `WHAT CHANGED IN REV ...` paragraph) | "What changed" panel on the control page |
| `## Contents` / `Contents:` line | Dropped (the contents page is generated) |
| `## 01 Chapter name` | Numbered chapter. Long chapters (more than about one page, or 5+ `###` sections) get a full-page divider with a large numeral and the list of sub-sections; short ones get a compact numbered banner |
| `### Heading` | Section heading (listed in the contents, bookmarked) |
| `> **Note** ...`, `> **Warning**`, `> **Decision**`, `> **Risk**`, `> **Open question**`, `> **Rule**`, `> **Tip**` | Callout with icon and colour. Paragraphs starting `RULE:`, `WATCH:`, `NOTE:`, `DECISION:`, `RISK:` also work |
| any other `> quote` | Pull-quote |
| `<!-- kpis -->` followed by a list (`- **108** Build steps (note)` or `- Label: value`) | KPI cards. Also a list under a heading containing "Key numbers", and paragraphs `Tiles: LABEL 108 (note) · LABEL 4`, `Headline stats: ...; ...`, `Counters: ...` |
| Tables | Zebra rows, gradient header that repeats on page breaks, bold first column, right-aligned numeric columns, rows never split. Cells reading Done / Shipped / Planned / Blocked / Open / In progress / Proposed / Superseded / STOP (and High / Medium / Low / Critical in columns headed status, severity, likelihood, impact, priority ...) become coloured pills. `✓` and `✕` become icons, `#RRGGBB` gets a swatch |
| A table whose columns cannot fit a portrait page without breaking words | Moved to a landscape page automatically |
| An ordered list introduced by a paragraph containing Steps / Flow / Sequence / Procedure / Timeline / Process | Numbered step timeline |
| `Flow: A → B → C`, or any short line/list item with three or more `→` | Chevron flow chips |
| `Diagram: A —label→ B; C —label→ D` | Edge diagram |
| `Figure — caption` / `Chart: ...` | Captioned note |
| `Group — Shipped: item; item; item` or `Name (built): item; item` | Capability cards with a status pill |
| `**ADR001** Accepted · Area. Why: ... Consequence: ...` | ADR card (badge, status pill, area, labelled body) |
| `ADR-033`, `KX-09`, and inline `` `R8` `` / `` `NH019` `` style IDs | ID badges (ADR indigo, KX ocean, risks coral) |
| `Label: text` at the start of a list item or paragraph | Accent-coloured lead-in label |
| `- [ ] task` / `- [x] done` | Checklist with drawn boxes |
| ```` ```ts ```` fenced code | Dark code panel with syntax highlighting (highlight.js); unlabeled HTTP-like blocks are highlighted as `http` |
| ```` ```mermaid ```` | Diagram rendered to vector SVG in brand colours (flowchart, sequence, ...) |
| Arabic text | Wrapped in `dir="rtl"` runs (or the whole paragraph / cell when mostly Arabic), IBM Plex Sans Arabic, properly joined |

## Add a document

1. Put the Markdown at `_docs/rev23/KX-NN_Name.md` (or `_docs/`).
2. Add an entry to `docs.manifest.json`:
   - `code` (`KX-25`), `file` (Drive base name, `KX-25_Something`, becomes `<file>.pdf`), `title`, `subtitle` (cover line)
   - `family`: `platform` (Kiorex, indigo), `clinic` (ocean), `pharmacy` (green), `lab` (violet), `nurse` (rose), `business` (coral accents on indigo). Colours and logo lockup are defined once under `families`.
   - `group` (cover eyebrow) and `sources` (first existing path wins, relative to the repo root).
3. `node build.mjs --doc KX-25`, open the PDF, check `build-report.json` for warnings.

## Known limitations

- One chapter divider page is added per long chapter; this adds pages (turn off with `--no-dividers`).
- Cover title, subtitle and group come from the manifest, not from the Markdown, so keep them in sync when a document is retitled.
- Very wide Mermaid diagrams are scaled to the text width and can end up with small labels; split them or use TB direction.
- Arabic strings that were extracted from a PDF with reversed presentation-form glyphs (see the KX-19 extraction note) are reproduced as written; fix them in the Markdown.
- Paged.js is patched in memory to repeat table headers (`lib/pdf.mjs`); pin or re-check the patch when upgrading `pagedjs`.
- Header and footer of a landscape page use the same strings as portrait pages; page sizes are mixed (A4 portrait and A4 landscape) in one PDF, which every viewer handles but some print dialogs ask about.
