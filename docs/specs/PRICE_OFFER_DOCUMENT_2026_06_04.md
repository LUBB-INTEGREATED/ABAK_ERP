# Price-Offer Document & Template Builder — Spec

**Date:** 2026-06-04
**Status:** Design approved direction, pending build. Depends on the RFQ split
(`RFQ_SALES_TECH_SPLIT_2026_06_03.md`) — the document is the output of the Quotations module.
**Full design:** `PRICE_OFFER_DOCUMENT_DETAILED_DESIGN_2026_06_04.md` (4-part, generated).
**Reference samples:** `Process/نماذج عروض اسعار/` (department-organized PDFs +
`Quotation_Q26422-1300-4_EN.html`, the canonical 8-page template).

---

## 1. Problem

The client-facing price offer must be a **multi-page, multi-department, template-built**
document. Today `packages/web/src/app/[locale]/quotes/[id]/print/page.tsx` is a **single
continuous A4 flow** printed via `window.print()` — no cover, company-profile, bank details,
amount-in-words, thank-you, no per-department scope sections, no template/section model, and
no builder. There is **no PDF library, no upload pipeline, no mailer** in the codebase.

## 2. The canonical document = 8 page-blocks (from the real sample)

1. **COVER** — geometric bg, large logo, PROJECT NAME, ATTENTION + client, ref + date strip.
2. **COMPANY PROFILE / ABOUT** — who-we-are, 4 service cards, accreditations, contact. ORG-level.
3. **QUOTATION** — ref box, meta (subject/to/date/validity/currency), greeting + Islamic
   salutation + intro (site location + area), SCOPE TABLE, subtotal/VAT/total, amount-in-words.
4. **PAYMENT** — total banner, installment % cards, project-timeline grid, BANKING bar (IBAN). ORG bank.
5. **WORK METHODOLOGY** — per-item cards (title, desc, steps, deliverable). Partly in code.
6. **PROJECT TIMELINE** — Gantt (axis, bars, legend). Partly in code.
7. **REQUIREMENTS & NOTES** — documents-required-from-client list + general T&C list.
8. **THANK YOU** — closing + script. ORG-level.

Pages **grow**: scope tables overflow; requirements overflow; methodology/timeline grow with
items. **Multi-department:** SCOPE_PRICING / METHODOLOGY / TIMELINE **fan out per department**;
single combined grand-total. Some pages are **uploaded full-page images** (cover bg, about,
thank-you). **Per-department pricing-model varies** (Supervision = per-visit, others lump-sum).

## 3. Composition model (key off `ServiceCategory.id`, snapshot-on-issue)

```prisma
QuoteTemplate { id, name, isDefault, isActive, departmentId?(→ServiceCategory),
                version, publishedAt(immutable once set), parentId, sections[] }
QuoteTemplateSection { templateId, sectionType, bindingType, position, enabled,
                       assetId?(→QuoteAsset), config Json }
enum QuoteSectionType { COVER ABOUT SCOPE_PRICING PAYMENT METHODOLOGY TIMELINE
                        REQUIREMENTS_NOTES THANKYOU IMAGE_PAGE CUSTOM_RICHTEXT }
enum QuoteSectionBinding { DATA_BOUND UPLOADED_IMAGE STATIC_CONTENT }
QuoteAsset { url, kind, ... }                      // full-page images / cover bg / logo
CompanyProfile (singleton) + CompanyProfileHistory // about, services, accreditations, contact, BANK
```

- **Template = ORG-level default**, optional per-department variants (escape hatch; consider
  dropping variants for v1 per P3 — real per-dept variation is per-visit captions + per-dept blocks).
- **Versioning = snapshot-on-issue.** Templates immutable once published (clone to new version).
  On **send**, serialize the resolved composition into `Quote.renderManifest Json` (NEW). The print
  route renders from the manifest when present, else live → a 2028-reopened 2026 quote looks
  as-issued even after bank/template/about changed. Cheaper than storing full HTML/PDF.
- **Department grain (RESOLVED 2026-06-04 → per real `Department`).** Owner: a multi-dept offer is
  "separate offers, mixed" — one scope page per department, one engineer each, one **Lead Reviewer**
  who dedups shared requirements/notes and submits. So a document section = a real `Department`, via
  the new **`QuoteDepartmentSection`** entity (see `RFQ_SALES_TECH_SPLIT_2026_06_03.md` §14), not a
  raw `ServiceCategory`. SCOPE_PRICING / METHODOLOGY / TIMELINE fan out **per section (Department)**;
  cover/about/payment/requirements/thankyou + the combined total are **shared/lead-owned**.
- **Per-quote new fields:** subject, greeting/intro, site location, site area, validity-days,
  per-department scope text, documents-required list, amount-in-words (computed). On a `QuoteDocument`
  side table or Quote columns (see full design §4).

## 4. Surfaces

- **Template builder (admin)** — `<SectionRail>` (reorder/toggle/type badges) + `<TemplatePreview>`
  (live A4) + `<SectionConfigPanel>` (per-section). Image upload via `<PageImagePicker>`. Org content
  (bank/about/contact) edited in a **separate Company Profile settings page** (split out), banking
  behind its own permission + audit.
- **Per-quote document (pricer)** — a **4th wizard step + a persistent Document tab** on the quote;
  authors the new per-quote fields, picks/inherits template, toggles pages on/off for this quote,
  adds image pages; **live A4 multi-page preview** (one renderer, two consumers: preview + print);
  **Send** generates the final PDF (`IssuedPdf`), attaches to client, stores immutably with the version.
- **Process fit:** admin owns templates + org content; pricer authors per-quote doc; approver sees
  it in review; sales sends. Configurable per the "Configurable Everything" rule.

## 5. PRE-BUILD BLOCKERS (P1 — these invalidate the naive build)

1. **No upload pipeline exists.** `FilesService.register()` only writes a `FileAsset` row from a
   pre-existing `url` string — no multipart/multer, no S3 SDK. All four designs assumed uploads.
   **Fix:** make "add upload pipeline" (multipart endpoint + storage target: disk volume or S3) an
   explicit prerequisite. Until it lands, scope image-page blocks + stored-PDF artifact OUT;
   FilesService stays a URL registry.
2. **Per-department totals don't add up.** `calculateTotals()` (`quotes.service.ts:1100`) is
   QUOTE-WIDE: one `discountAmount` off the summed subtotal, THEN 15% VAT on the post-discount total.
   Per-dept subtotal/VAT/total can't reconcile. **Fix:** per-dept blocks show ONLY a pre-discount,
   pre-VAT **line subtotal** ("department subtotal" = sum of its lines); discount + VAT + grand total
   appear **ONCE** on the combined band. Encode this rule; do not render per-dept VAT.
3. **`QUOTE_INCLUDE` doesn't fetch ordering data** (`quotes.service.ts:46`) — no `department.order`,
   no `rfq`/`rfq.assignments`. Lead-pricer-dept-first ordering breaks. **Fix:** add `order:true` to
   the department select + `rfq:{ include:{ assignments:{ select:{ departmentId, isLeadPricer }}}}`;
   fall back gracefully when `rfqId` is null (manual quote).
4. **"~40% already renders" is FALSE.** `print/page.tsx` is one continuous `<main>` flow. **5 of 8
   page-blocks are greenfield**; per-dept subtotals greenfield; page-block pagination (break-before,
   running header/footer, page counters) greenfield. Only the quotation-table grouping, methodology
   grid, and gantt exist. Re-baseline the estimate.
5. **`window.print()` cannot produce a server-side PDF to email.** The print route is a client
   component behind auth. **Fix:** treat PDF gen as a discrete **infra spike** — `playwright-core` +
   `@sparticuz/chromium`, a server render token, server-trusted data fetch (or SSR the print route),
   `print-color-adjust:exact`, self-hosted fonts. Not a design detail.
6. **RTL/Arabic is hand-waved.** `formatMoney()` hardcodes `toLocaleString('en-US')` (Latin digits);
   headings are hardcoded English-first bilingual strings. **Fix:** one localized money formatter
   (DECIDE Latin vs Arabic-Indic, document it, apply everywhere incl. gantt/qty/%); amount-in-words as
   a **tested util in `packages/shared`** with explicit Arabic worked examples (e.g. 851,000.00 SAR).
7. **No `CompanyProfile` history → weak IBAN audit.** A wrong/changed IBAN on a sent quote = money to
   the wrong account. **Fix:** add `CompanyProfileHistory` (old/new/changedBy/at); gate banking writes
   behind a dedicated `company_profile.manage` permission (SUPER_ADMIN default), separate from template
   editing; log every banking change.

### P2 (same phase)

- **Per-visit caption** drive from the LINE (`item.unit` e.g. "زيارة"/"visit"), not a dept-level flag;
  dept flag only sets default columns. A dept can host both lump-sum and per-visit lines.
- **Payment page = function of data, not a free toggle:** if `paymentMilestones.length>0` the schedule
  MUST render (lock the toggle); if 0, hide. `validateMilestones()` already enforces sum=100% when any exist.
- **Revision artifact** keyed by `Quote.id` (the version row), NOT `(quoteId,version)`; `revise()` must
  NOT copy the parent's issued PDF/manifest — child starts fresh (ties to RFQ-split revise() blockers #1/#2).
- **VAT/currency single source:** `PricingPolicy.vatPct/currency` is canonical; set `Quote.taxRate` from
  it at create/recompute (snapshot for as-issued), doc reads the quote snapshot. Kill the 3-source drift.
- **Overflow:** pin to what Chromium honors — `position:fixed` running header/footer, `counter(page)`/
  `counter(pages)` in `@page` margin boxes, repeating `thead`, "continued" labels, tfoot placement.
- **Block-7 "documents required from client" is client-facing boilerplate-with-overrides — NEVER
  auto-populated from `RfqDocRequest`** (the engineer→sales internal asks). Bind this rule for all.

### P3

- Drop per-department template VARIANT table for v1 (real variation is per-visit captions + per-dept blocks).
- Org-content home: a `CompanyProfile` singleton (better for bilingual structured arrays) IF paired with
  the history table above.
- Gantt RTL: bars grow from inline-start (right in RTL); day numbers `dir=ltr`; paginate beyond ~15 tasks.

## 6. Build phasing (dovetail with RFQ split P1–P4)

- **PO-P0 (prereq spikes):** upload pipeline + PDF-gen infra spike + amount-in-words util. Independent of UI.
- **PO-P1 (model):** QuoteTemplate/Section/Asset, CompanyProfile(+History), renderManifest, per-quote
  doc fields, VAT single-source. Migration + seed the default 8-block template so existing quotes render.
- **PO-P2 (renderer):** rebuild the print route as 8 paged blocks with per-dept fan-out + correct
  totals band + pagination; manifest-aware.
- **PO-P3 (builder + per-quote doc UX):** admin template builder + Company Profile page; the 4th wizard
  step / Document tab + live preview.
- **PO-P4 (send):** issue PDF, store immutably, attach to dispatch. Lands after RFQ-split send flow.
