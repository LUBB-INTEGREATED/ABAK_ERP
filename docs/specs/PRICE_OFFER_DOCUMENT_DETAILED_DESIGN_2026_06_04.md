# ABAK Price-Offer Document — Detailed Design (generated)

> Companion to `PRICE_OFFER_DOCUMENT_2026_06_04.md`. Produced by a 5-agent workflow (doc-model, template-builder UX, per-quote doc UX, process-fit) + adversarial critic, 2026-06-04. Pre-build blockers distilled into the main spec.

---

# PART A — Document composition model / render / PDF

I have everything required. There's a `FilesService` registering assets by URL (no upload pipeline, no mail, no PDF lib). The `send()` flow stamps SENT only. `QuoteItem.departmentId → ServiceCategory` already groups; `RfqAssignment.isLeadPricer` defines lead-pricer dept ordering. Org content currently lives in `SystemSetting` (string/JSON). Now I'll write the full specification.

# ABAK Quotation — Document Composition Data Model, Multi-Department Rendering, Pagination & PDF Strategy

Anchored to: `prisma/schema.prisma`, `packages/web/src/app/[locale]/quotes/[id]/print/page.tsx`, `packages/api/src/modules/quotes/{quotes.service.ts,quotes.controller.ts,dto/index.ts}`, `packages/api/src/modules/files/files.service.ts`, `packages/api/src/modules/settings/*`, `docs/specs/RFQ_SALES_TECH_SPLIT_2026_06_03.md`.

## 0. Current-state facts that shape the design

- **No PDF library** anywhere (`packages/api` + `packages/web` deps grep clean). Print today = `window.print()` in `print/page.tsx:67`.
- **No mailer, no S3/storage SDK**. Assets are registered **by URL** via `FilesService.register()` (`files.service.ts:17`) writing `FileAsset{url, ownerResource, ownerResourceId}` (schema `1888`). The send flow (`quotes.service.ts:642`) just flips `status→SENT` + stamps `sentAt`; it stores **no document**.
- **Two "department" identities coexist** — a deliberate trap to respect:
  - `QuoteItem.departmentId → ServiceCategory` (schema `922`, comment `918`) — the **pricing/grouping anchor** the print page already uses (`print/page.tsx:384 groupByDepartment`).
  - `Department` (schema `2187`) — the first-class RBAC org unit, with `managerId` + `nameAr`.
  - **Decision: the document model keys departments off `ServiceCategory.id`** (same FK as `QuoteItem.departmentId` and `RfqAssignment.departmentId`, schema `1190`), never off `Department.id`. This keeps fan-out joinable with zero extra mapping.
- **Lead-pricer ordering already exists**: `RfqAssignment.isLeadPricer` (schema `1195`), exactly one true per RFQ. That is the canonical "lead dept first" signal.
- **Org content home today** = `SystemSetting` (key/value/JSON, schema `178`), read via `SettingsService` (`settings.service.ts`). Pricing/VAT/currency already moved to a **singleton table** `PricingPolicy` (schema `1983`) — precedent for "one-row org config table."
- Per-line `MethodologyCard` (schema `950`) and `GanttBlock` (schema `970`) already render (`print/page.tsx:465,518`).

---

## 1. COMPOSITION MODEL

### 1.1 Ownership & versioning decision

- **Template owned at ORG level (default), with optional PER-DEPARTMENT variants.** Rationale: page 1 (Cover), 2 (About), 4 banking, 7 terms, 8 Thank-You are org-identical; only `SCOPE_PRICING / METHODOLOGY / TIMELINE` legitimately differ per department, and even then the _layout_ is shared — what differs is _which department's data fans into it_. So a single org template is the 99% case; per-dept variants are an escape hatch (e.g. Supervision wants a per-visit pricing table layout).
- **Versioning: snapshot-on-issue, not live-ref.** Old quotes MUST render as-issued (terms/bank/about change over years). Two-layer approach:
  1. `QuoteTemplate` is **immutable once `publishedAt` is set**; edits clone to a new `version` row (same pattern as `Quote.parentQuoteId` revisions, schema `851`).
  2. On **send** (the moment of record), serialize the fully-resolved composition (template sections + resolved org content + resolved assets) into `Quote.renderManifest Json` (new column, §4). The print route renders from the manifest when present, else live. This guarantees a 2026 quote reopened in 2028 looks identical even if the template, bank IBAN, and about text all changed — and it's cheaper than a full HTML/PDF snapshot.

### 1.2 Prisma models

```prisma
// ── Document composition ──────────────────────────────────────────

model QuoteTemplate {
  id        String  @id @default(cuid())
  name      String                              // "ABAK Standard EN/AR"
  isDefault Boolean @default(false)             // exactly one default org template
  isActive  Boolean @default(true)

  /// null = ORG-level (default). Set = per-department variant keyed on the
  /// SAME ServiceCategory id that QuoteItem.departmentId / RfqAssignment use.
  departmentId String?
  department   ServiceCategory? @relation(fields: [departmentId], references: [id])

  /// Immutable once published. New edits clone to version+1.
  version     Int       @default(1)
  publishedAt DateTime?
  parentId    String?
  parent      QuoteTemplate?  @relation("TemplateVersions", fields: [parentId], references: [id])
  versions    QuoteTemplate[] @relation("TemplateVersions")

  sections QuoteTemplateSection[]
  quotes   Quote[]                              // quotes issued against this template version

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([departmentId, isDefault])           // one default per scope (null dept = org)
  @@index([isActive])
  @@map("quote_templates")
}

model QuoteTemplateSection {
  id         String        @id @default(cuid())
  templateId String
  template   QuoteTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  sectionType QuoteSectionType
  bindingType QuoteSectionBinding @default(DATA_BOUND)
  position    Int                                // render order (0-based)
  enabled     Boolean @default(true)

  /// When bindingType = UPLOADED_IMAGE | STATIC_CONTENT this asset is the
  /// full-page image / background. Per-template default; a quote may override
  /// (see QuoteAsset.sectionType override, §2).
  assetId String?
  asset   QuoteAsset? @relation(fields: [assetId], references: [id])

  /// Per-section knobs. Shape depends on sectionType — see §1.3.
  /// e.g. SCOPE_PRICING: { fanOutPerDepartment: true, perVisitColumns: true }
  ///      PAYMENT:       { showScheduleCards: true }
  ///      IMAGE_PAGE:    { fit: "cover" }
  ///      CUSTOM_RICHTEXT: { html_ar, html_en }
  config Json @default("{}")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([templateId, position])
  @@index([templateId])
  @@map("quote_template_sections")
}

enum QuoteSectionType {
  COVER               // page 1
  ABOUT               // page 2  (org-level, often UPLOADED_IMAGE)
  SCOPE_PRICING       // page 3  (FANS OUT per department)
  PAYMENT             // page 4  (banner + schedule + banking)
  METHODOLOGY         // page 5  (FANS OUT per department)
  TIMELINE            // page 6  (FANS OUT per department; Gantt)
  REQUIREMENTS_NOTES  // page 7  (documents-required + terms)
  THANKYOU            // page 8  (org-level, often UPLOADED_IMAGE)
  IMAGE_PAGE          // arbitrary uploaded full-page insert
  CUSTOM_RICHTEXT     // arbitrary AR/EN rich-text page
}

enum QuoteSectionBinding {
  DATA_BOUND      // rendered from Quote / QuoteItem / org content
  UPLOADED_IMAGE  // a QuoteAsset full-page image (about/thankyou/cover-bg)
  STATIC_CONTENT  // org content text (about paragraphs, terms) w/o data binding
}
```

### 1.3 `config` JSON contract per section type (validated by a Zod/class-validator schema in the template-builder DTO, mirroring `MethodologyCardInputDto` style in `dto/index.ts`)

| sectionType          | config keys                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `COVER`              | `backgroundAssetId?`, `showProjectName`, `showAttention`, `refStripPosition`                                               |
| `ABOUT`              | (when STATIC) `useOrgProfile:true`; (when IMAGE) just `assetId` on section                                                 |
| `SCOPE_PRICING`      | `fanOutPerDepartment:boolean`, `showPerVisitColumn:boolean`, `showCombinedGrandTotal:boolean`, `showAmountInWords:boolean` |
| `PAYMENT`            | `showTotalBanner`, `showScheduleCards`, `showProjectTimelineGrid`, `showBankingBar`                                        |
| `METHODOLOGY`        | `fanOutPerDepartment:boolean`, `columns:1\|2`                                                                              |
| `TIMELINE`           | `fanOutPerDepartment:boolean`, `axisUnit:"day"\|"week"`                                                                    |
| `REQUIREMENTS_NOTES` | `showDocumentsRequired`, `showTerms`                                                                                       |
| `IMAGE_PAGE`         | `fit:"cover"\|"contain"`                                                                                                   |
| `CUSTOM_RICHTEXT`    | `html_ar`, `html_en`                                                                                                       |

---

## 2. ASSET MODEL

Recommendation: **dedicated `QuoteAsset` table**, _not_ reuse of `FileAsset`. `FileAsset` (schema `1888`) is a generic URL registry with no semantic role/locale; quote design assets need a typed role (cover-bg vs about-page vs thankyou-page), an org-vs-quote scope, and locale variants (AR vs EN about page image). Keep `FileAsset` as the raw upload registry **underneath** — `QuoteAsset.fileAssetId` can point at a `FileAsset` row so the existing `FilesService.register()` (`files.service.ts:17`) by-URL flow is reused unchanged.

```prisma
model QuoteAsset {
  id   String         @id @default(cuid())
  role QuoteAssetRole
  url  String                         // resolved URL (mirrors FileAsset.url convention)

  /// Optional link to the generic upload registry row.
  fileAssetId String?

  locale String @default("ALL")       // "ar" | "en" | "ALL"

  /// Scope: org-default asset (templateId set, quoteId null) OR a per-quote
  /// override (quoteId set). Exactly one of templateId/quoteId is non-null.
  templateId String?
  template   QuoteTemplate? @relation(fields: [templateId], references: [id])
  quoteId    String?
  quote      Quote?         @relation(fields: [quoteId], references: [id])

  sections QuoteTemplateSection[]     // sections referencing this as their image

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([templateId, role])
  @@index([quoteId, role])
  @@map("quote_assets")
}

enum QuoteAssetRole {
  COVER_BACKGROUND
  ABOUT_PAGE
  THANKYOU_PAGE
  LOGO          // overrides /images/logo.jpg used at print/page.tsx:81
  WATERMARK
}
```

**Resolution order at render** (per role): per-quote override (`quoteId` match) → per-template default (`templateId` match) → hardcoded fallback (`/images/logo.jpg`). `locale` filter applied first (exact locale → `ALL`).

---

## 3. ORG-LEVEL CONTENT (bank / about / services / accreditations / contact)

**Recommendation: dedicated singleton `CompanyProfile` table, NOT `SystemSetting` keys.** Three reasons:

1. **Precedent already set** — `PricingPolicy` (schema `1983`) is exactly this pattern (one-row org config, CEO/admin-owned, typed columns instead of stringly-typed settings). Bank/about belongs in the same neighborhood.
2. **Bilingual + structured** — about paragraphs, service cards, accreditations are AR/EN arrays of objects; cramming them into `SystemSetting.value String` (schema `181`) means JSON-in-string with manual `JSON.parse` (already a known sharp edge — `settings.service.ts:111`). Typed columns + `Json` arrays are cleaner and validate at the DTO layer.
3. **Audit** — `SettingHistory` is per-key; a profile edit touching 6 keys fragments the trail. One table = one coherent `updatedById`.

```prisma
model CompanyProfile {
  id String @id @default(cuid())     // singleton (one row)

  // Banking (page 4 banking bar) — ORG-LEVEL
  bankName       String?
  bankNameAr     String?
  accountHolder  String?
  iban           String?
  swift          String?

  // About (page 2) — bilingual paragraph arrays: [{ ar, en }]
  aboutParagraphs Json @default("[]")
  // Service cards (page 2 2x2): [{ titleAr, titleEn, descAr, descEn, icon }]
  serviceCards    Json @default("[]")
  // Accreditations (page 2 list): [{ ar, en }]
  accreditations  Json @default("[]")

  // Contact bar (page 2 footer + page 8)
  website     String?
  email       String?
  phone       String?
  addressAr   String?
  addressEn   String?

  // Default boilerplate (overridable per quote, see §4)
  defaultTermsAr Json @default("[]")   // numbered terms []
  defaultTermsEn Json @default("[]")
  defaultDocumentsRequiredAr Json @default("[]")
  defaultDocumentsRequiredEn Json @default("[]")

  updatedById String?
  updatedAt   DateTime @updatedAt
  createdAt   DateTime @default(now())

  @@map("company_profile")
}
```

Surface it through the existing settings module (`settings.controller.ts`) as `GET/PATCH /settings/company-profile`, gated by the same admin permission pattern PricingPolicy uses.

---

## 4. PER-QUOTE FIELDS MISSING TODAY

The canonical doc needs fields the `Quote` model (schema `806`) and `CreateQuoteDto` (`dto/index.ts:168`) don't have. **Decision: add the genuinely per-quote, single-value fields as `Quote` columns; put the repeating/structured per-department text in a small `QuoteDocumentMeta` companion + reuse `QuoteItem.departmentId` grouping for per-dept scope text.**

Add to `Quote`:

```prisma
  // ── Canonical-doc per-quote fields (2026-06 doc composition) ──
  subject         String?     // page 3 "Subject:" line (distinct from title)
  greetingIntroAr String?     // page 3 greeting/intro paragraph
  greetingIntroEn String?
  siteLocation    String?     // page 3 intro "site located at …"
  siteAreaSqm     Float?      // page 3 "… area of N m²"
  validityDays    Int?        // structured; today only validUntil DateTime (schema 824)

  // Snapshot-on-issue (see §1.1 versioning). Resolved composition frozen at send.
  templateId     String?
  template       QuoteTemplate? @relation(fields: [templateId], references: [id])
  renderManifest Json?         // serialized sections + org content + asset URLs

  // Per-quote overrides of org defaults (else fall back to CompanyProfile)
  documentsRequiredAr Json?    // [] of strings; null => use profile default
  documentsRequiredEn Json?
  termsOverrideAr     Json?
  termsOverrideEn     Json?

  assets QuoteAsset[]          // per-quote image overrides
```

**amount-in-words: computed, never stored as a column** (it's a pure function of `totalAmount` + currency + locale — storing it invites drift when totals recompute, and totals already recompute on every `update`, `quotes.service.ts`). Compute at render time (§8); freeze into `renderManifest` at send.

**Per-department scope text** (page 3 "each dept gets its own scope text"): do **not** add columns. Add an optional `scopeText` per department section by introducing a lightweight join, OR — simpler and consistent with the existing per-line model — store it on the **lead `QuoteItem` of each department group** via a new `QuoteItem.sectionIntro String?`. Recommendation: a dedicated tiny row keyed by `(quoteId, departmentId)` so it survives item edits:

```prisma
model QuoteDepartmentSection {
  id           String @id @default(cuid())
  quoteId      String
  quote        Quote  @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  departmentId String
  department   ServiceCategory @relation(fields: [departmentId], references: [id])

  scopeTextAr  String?   // page-3 per-dept scope narrative
  scopeTextEn  String?
  pricingModel DeptPricingModel @default(LUMP_SUM)  // drives per-visit presentation

  @@unique([quoteId, departmentId])
  @@index([quoteId])
  @@map("quote_department_sections")
}

enum DeptPricingModel {
  LUMP_SUM
  PER_VISIT      // qty = N visits, unitPrice = price/visit (Supervision)
  PER_UNIT
}
```

---

## 5. MULTI-DEPARTMENT RENDER RULES

Inputs available at render: `quote.items[]` each with `departmentId` + `department{name,nameAr}` (already loaded, `quotes.service.ts:64`), `quote.departmentSections[]`, and — for ordering — the RFQ's `assignments[]` with `isLeadPricer` (schema `1195`).

```
RENDER(quote, template):
  groups = groupBy(quote.items, it => it.departmentId ?? "__ungrouped")
  isMultiDept = groups.size > 1 OR (groups.size == 1 AND firstKey != "__ungrouped")

  # ── department ordering: lead pricer dept first ──
  leadDeptId = quote.rfq?.assignments.find(a => a.isLeadPricer)?.departmentId
  orderedKeys = sort(groups.keys, by:
       key == leadDeptId          ? 0          # lead dept first
     : department.order ?? 9999)               # then ServiceCategory.order (schema 134)
  # "__ungrouped" always sorts last

  for section in template.sections.filter(enabled).sortBy(position):
    if section.bindingType == UPLOADED_IMAGE:        renderImagePage(resolveAsset(section)); continue
    if section.bindingType == STATIC_CONTENT:        renderStatic(section, companyProfile); continue

    switch section.sectionType:

      COVER:      renderCover(quote, resolveAsset(COVER_BACKGROUND))
      ABOUT:      renderAbout(companyProfile)                # never fans out
      PAYMENT:    renderPayment(quote, companyProfile.banking) # combined, never per-dept
      REQUIREMENTS_NOTES, THANKYOU: renderOrgLevel(...)

      SCOPE_PRICING:
        if NOT isMultiDept OR NOT config.fanOutPerDepartment:
           renderScopeTable(allItems, showGrandTotalOnly)       # single ungrouped table
        else:
           for key in orderedKeys:
              ds = quote.departmentSections[key]
              renderDeptScopeText(ds.scopeTextAr/En)            # per-dept narrative
              renderScopeTable(groups[key], perVisit = ds.pricingModel==PER_VISIT)
              renderDeptSubtotal(groups[key])                   # subtotal/VAT/total PER DEPT
           renderCombinedGrandTotal(quote.subtotal, quote.taxAmount, quote.totalAmount)
           renderAmountInWords(quote.totalAmount)               # once, on the GRAND total

      METHODOLOGY:   fanOrFlat(groups, orderedKeys, renderMethodologyCards)  # reuse print/page.tsx:465
      TIMELINE:      fanOrFlat(groups, orderedKeys, renderGantt)             # reuse print/page.tsx:518
```

**Key rules:**

- **Combined grand total lives at the END of the last `SCOPE_PRICING` fan-out block**, never inside a department block. Per-dept blocks show their own SUBTOTAL/VAT/TOTAL; the grand total reconciles them. `Quote.subtotal/taxAmount/totalAmount` (schema `831`) remain the source of truth for the grand total (already summed across all items).
- **Single-dept simplification**: when one group (or none with a deptId), `SCOPE_PRICING` renders exactly as today's ungrouped `ItemsTable` (`print/page.tsx:369` else-branch) — no dept header row, no per-dept subtotal, one totals block. This preserves the existing behavior the owner already approved.
- **Per-visit presentation** (`PER_VISIT`): the scope row label becomes `description` + a "× N visits" qualifier; the table header for that dept block reads `Visits | Price/Visit | Total` instead of `Qty | Unit Price | Total`. Data is unchanged (`quantity`=visits, `unitPrice`=price/visit, `subtotal`=product) — only the column captions + a footnote differ, driven by `QuoteDepartmentSection.pricingModel`.
- **METHODOLOGY/TIMELINE fan-out** reuses the existing components (`MethodologySection`, `GanttSection` in `print/page.tsx`); fan-out simply calls them once per ordered group with a dept sub-heading, falling back to a single flat call when `!isMultiDept`.

---

## 6. PAGINATION / OVERFLOW

**Recommendation: CSS Paged Media (print CSS) as the single source of truth, rendered by a real engine (Puppeteer/Chromium, §7) — NOT a JS paginator, NOT a server layout engine like WeasyPrint.**

Rationale: the print route already leans on `@page` + `break-inside` rules (`print/page.tsx:268-289`). Chromium honors `@page`, running headers/footers via fixed elements, repeating `<thead>` (already set: `thead { display: table-header-group }`, `print/page.tsx:285`), and `break-*` controls. A bespoke JS paginator (measuring DOM heights, slicing tables) is brittle with RTL + Arabic line-wrapping and duplicates what the browser does for free.

Concrete rules to add to the print stylesheet:

```css
@page {
  size: A4;
  margin: 18mm 14mm 20mm;
}
/* page counter for "Page X of Y" footer */
@page {
  @bottom-center {
    content: 'QUOTATION ' counter(page) ' / ' counter(pages);
  }
}

.scope-table {
  break-inside: auto;
}
.scope-table thead {
  display: table-header-group;
} /* repeats per page */
.scope-table tfoot {
  display: table-footer-group;
} /* subtotal repeats/anchors */
.scope-table tr {
  break-inside: avoid;
}

.page-block {
  break-before: page;
} /* each canonical page-block starts fresh */
.dept-block {
  break-inside: avoid-region;
} /* keep a dept's header+first rows together */
.cover,
.about,
.thankyou {
  break-before: page;
  break-after: page;
}

/* org running header/footer on data pages only (cover/about/thankyou suppress it) */
.running-header {
  position: running(hdr);
}
@page data {
  @top-center {
    content: element(hdr);
  }
}
```

- **Scope tables spanning pages**: native — `thead` repeats, rows avoid mid-row breaks, the per-dept `tfoot` subtotal travels with the last chunk. The combined grand total is its own `.keep-together` block placed after all dept tables, with `break-inside: avoid`.
- **Requirements/Notes overflow**: plain numbered `<ol>` flows naturally across pages; no special handling.
- **Page numbering**: CSS `counter(page) / counter(pages)` in `@bottom-center` (engine-computed, correct even as content grows). The current `window.print()` path can't reliably do running counters across browsers — this is a concrete reason to move to Chromium-headless for the canonical output.
- Keep the **on-screen `print/page.tsx` route** as the live preview (dev + "Print/Save" button), but the **stored/sent PDF** comes from the headless engine rendering the _same_ route with `?print=1` (so there's one renderer, no divergence).

---

## 7. PDF GENERATION

**Recommendation: server-side headless Chromium (Playwright `chromium`) in the API, rendering the existing Next.js `print/page.tsx` route, triggered on `send` and stored.** Reasons tied to this repo:

- **Send-to-client needs a durable artifact.** `send()` (`quotes.service.ts:642`) currently stores nothing. A client-side `window.print()` produces a file on the user's disk, not on the server — it cannot be emailed/attached/re-sent. The process spec (`RFQ_SALES_TECH_SPLIT`) ends at "SEND to client (needs a real PDF) → outcome."
- **One renderer, no drift.** Chromium rendering the same `/[locale]/quotes/[id]/print?print=1` route reuses all existing components (`ItemsTable`, `MethodologySection`, `GanttSection`) and the new section components — the screen preview and the PDF are byte-identical by construction.
- **RTL/Arabic/print-color:** Chromium handles `dir="rtl"`, Arabic shaping, and `print-color-adjust: exact` (must be set so the navy `#1a3a5c` / gold backgrounds and the cover image survive — add `* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }` to the print stylesheet). Fonts must be **self-hosted/embedded** (bundle the Arabic webfont; do not rely on Google Fonts at render time — headless has no network guarantee). `waitUntil: 'networkidle'` + an explicit `await page.evaluate(() => document.fonts.ready)` before `page.pdf()` prevents un-shaped Arabic.

**Where it runs:** a new API module `quote-render`:

```
POST /quotes/:id/render-pdf   (RequirePermission('quote:send'))
  -> Playwright launches chromium (or hits a managed render service)
  -> page.goto(`${WEB_URL}/${locale}/quotes/${id}/print?print=1&token=<server-mint>`)
  -> document.fonts.ready; pdf({ format:'A4', printBackground:true, preferCSSPageSize:true })
  -> FilesService.register({ url, mimeType:'application/pdf',
                             ownerResource:'quote', ownerResourceId:id })  // files.service.ts:17
  -> Quote.renderManifest snapshot (§1.1)
```

Wire it into `send()`: render → store `FileAsset` → set `sentAt`. Auth: mint a short-lived server token so the headless browser can fetch the protected print route (the route is currently client-fetch via `useQuote`; add a server-trusted fetch path or pass a render token).

**Deployment note:** Playwright's Chromium needs system libs; if API runs serverless, use `@sparticuz/chromium` + `playwright-core`, or an external render endpoint. Add `playwright` (or `puppeteer-core`+`@sparticuz/chromium`) to `packages/api` — none present today.

**Interim:** keep `window.print()` working for ad-hoc "save a copy"; it is NOT the send artifact.

---

## 8. AMOUNT IN WORDS (SAR, AR + EN)

- **Library, not custom.** Custom Arabic number-to-words (gender agreement, dual, hundreds, تنوين) is a classic bug farm. Use a maintained lib: **`@israeli-bank/...`** — no; concretely **`riyal`-style**: use **`number-to-words`** (EN) + **`@bk/arabic-number-to-words` / `arabic-numbers-to-words`** (AR), or the well-tested **`to-words`** package which supports a SAR/Arabic locale config (currency name "ريال" + subunit "هللة"). Wrap both behind one helper.
- **Where computed:** in a shared util in `packages/shared` (where `nextEntityNumber` already lives — imported as `shared-utils` in `quotes.service.ts:20`), as `amountInWords(total: number, locale: 'ar'|'en', currency='SAR'): string`. Called by the **renderer** (so it tracks the live total), and **frozen into `Quote.renderManifest`** at send for as-issued fidelity. Never a DB column (§4).
- Format: `"خمسة وعشرون ألف ريال سعودي و 00/100 هللة"` (AR) / `"Twenty-Five Thousand Saudi Riyals and 00/100 Halalas"` (EN). VAT-inclusive `totalAmount` is the number spelled out (matches the page-4 banner + page-3 tfoot "Amount in Words").

---

## 9. Migration / sequencing (low-risk order)

1. Add `CompanyProfile` + seed one row from current hardcoded strings; expose via settings module. (No render change yet.)
2. Add `QuoteTemplate` / `QuoteTemplateSection` / `QuoteAsset` / `QuoteDepartmentSection` + the new `Quote` columns. Seed **one default org template** whose 8 sections reproduce today's flow 1:1 (so existing quotes render unchanged).
3. Refactor `print/page.tsx` to **iterate `template.sections`** instead of the hardcoded JSX order — extracting the current blocks into `<CoverSection/> <AboutSection/> <ScopePricingSection/> …`, reusing `ItemsTable/MethodologySection/GanttSection` verbatim. Behind a feature check: `quote.templateId ?? defaultTemplate`.
4. Build the **template builder** admin screen (reorder/toggle sections, upload `QuoteAsset` images via existing `FilesService`, edit `CompanyProfile`). "Configurable Everything" rule satisfied.
5. Add `quote-render` module (Playwright) + wire into `send()`; store `FileAsset`, snapshot `renderManifest`.
6. Add `amountInWords` to `shared-utils`; surface in scope tfoot + payment banner.

**Net new Prisma:** 5 models (`QuoteTemplate`, `QuoteTemplateSection`, `QuoteAsset`, `CompanyProfile`, `QuoteDepartmentSection`), 4 enums (`QuoteSectionType`, `QuoteSectionBinding`, `QuoteAssetRole`, `DeptPricingModel`), ~10 `Quote` columns. Reuses existing `FileAsset` (`files.service.ts`), `QuoteItem.departmentId→ServiceCategory` grouping (`print/page.tsx:384`), `RfqAssignment.isLeadPricer` (schema `1195`) for dept ordering, and the `PricingPolicy` singleton precedent (schema `1983`) for `CompanyProfile`.

---

# PART B — Template builder (admin UX)

I have enough grounding. The org-content (bank/about/contact/accreditations) has no existing home, and there are no existing quote-template messages — both are greenfield. I have all the conventions I need. Here is the design.

---

# ABAK Quote Template Builder — Admin UX Design

**Module:** Quotations · **Surface:** `admin/quote-templates` · **Author intent:** senior product designer
**Stack alignment:** Next.js App Router, shadcn/ui, `abak-blue` token, next-intl ar/en, RTL-primary, TanStack Query mutations, `sonner` toasts. Matches the conventions in `admin/services/page.tsx` (Dialog + Table list) and `admin/pricing-policy/page.tsx` (left editor / right live "reads-it-back" preview, dirty-tracked single Save).

The governing idea, borrowed straight from `pricing-policy`: **the right panel always renders the truth back to the admin** so they can predict the output without sending a test quote. Here that truth is literal — it's the actual A4 pages a client will receive, rendered with sample data.

---

## 1. WHERE IT LIVES, ACCESS, AND THE TEMPLATE LIST

### Route & nav

- **List:** `app/[locale]/(dashboard)/admin/quote-templates/page.tsx`
- **Builder:** `app/[locale]/(dashboard)/admin/quote-templates/[id]/page.tsx` (full-width builder, not a dialog — a dialog can't hold an A4 live preview)
- **Org content:** `app/[locale]/(dashboard)/admin/company-profile/page.tsx` (see §5 — recommended split out)
- Sidebar: under **Admin** group, label **"Quote templates / قوالب عروض الأسعار"**, after "Pricing policy".

### Permissions

Follow the exact guard already used in `admin/services/page.tsx`:

```ts
if (user && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
  return <NoAccessCard message={t('quoteTemplates.noAccess')} />;
}
```

Per the RBAC model in memory (permission-based, not role-hardcoded), gate behind a permission **`quote_templates.manage`** mapped to ADMIN + SUPER_ADMIN by default, and allow it to be delegated to a **Sales & Marketing Manager** (the owner explicitly wants delegation). The Company-Profile org content is a **separate, more sensitive** permission `company_profile.manage` (bank IBAN lives here) — default SUPER_ADMIN only.

### The list screen

A Table (same shape as services list) of templates. Each row = one template. Templates have a **scope**: `ORG_DEFAULT` (exactly one, pinned) or `DEPARTMENT` variant.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Quote templates                                          [+ New template ▾]  │
│  The page-block recipe used to build every client quotation.                  │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ Template            Scope            Pages  Status     Updated      Actions│ │
│  ├─────────────────────────────────────────────────────────────────────────┤ │
│  │ ★ Standard (org)    Org default       8     ● Active   3d ago    Edit  ⋯  │ │
│  │   Supervision       Supervision dept  7     ● Active   1w ago    Edit  ⋯  │ │
│  │   Engineering       Engineering dept  8     ○ Draft    1w ago    Edit  ⋯  │ │
│  │   Gov tender (BOQ)  Used for CH-GOV    9     ● Active   2w ago    Edit  ⋯  │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **★** marks the org default (cannot be deleted or deactivated — only replaced by promoting another).
- **Scope** column: "Org default" badge (gold/`abak-blue`) vs a department name badge. Gov tender is just a department-less variant flagged `appliesTo: GOV`.
- **Pages** = count of enabled sections (live, computed) — a quick sanity number.
- **⋯ menu:** Duplicate · Set as default · Rename · Activate/Deactivate · (Delete only if Draft & never used — "No-deletion policy" means used templates archive, not delete).
- **[+ New template ▾]** split-button: "Blank", "Duplicate org default", "From department…".
- **Empty state:** never truly empty — on first load the system seeds the **canonical 8-block org default** (the structure from the real sample). Empty copy reserved for "no department variants yet" inside the New dialog.

`useQuoteTemplates()`, `useQuoteTemplate(id)`, `useCreateQuoteTemplate`, `useUpdateQuoteTemplate`, `useDuplicateQuoteTemplate`, `useSetDefaultTemplate` — mirroring `use-services` / `use-pricing-policy` hook naming.

---

## 2. THE BUILDER SCREEN

Three regions: **left section list** (the recipe), **center live A4 preview**, **right config panel** (opens when a section is selected). On narrow screens the config panel becomes a Sheet overlay.

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│  ‹ Templates   Standard (org default)  [Draft●]        [Preview data ▾] [Discard] [Save]│
├──────────────────┬──────────────────────────────────────────┬─────────────────────────┤
│ SECTIONS         │  LIVE PREVIEW · A4 · RTL                  │  COVER — config         │
│ ─────────────    │  ┌────────────────────────────────────┐  │  ─────────────────────  │
│ [+ Add section]  │  │                                    │  │  Section title          │
│                  │  │     ┌──────────────────────────┐   │  │  [ صفحة الغلاف        ]  │
│ ⠿ ▸ Cover        │  │     │  ▓▓ geometric bg ▓▓      │   │  │  Show in document  [✔]  │
│   1  IMAGE  ●    │  │     │        [ LOGO ]          │   │  │  ─────────────────────  │
│ ─────────────    │  │     │     PROJECT NAME         │   │  │  Background image       │
│ ⠿ ▸ About us     │  │     │   ATTENTION: {client}    │   │  │  ┌───────────────────┐  │
│   2  STATIC ●    │  │     │  ─ REF Q26422 | DATE ─   │   │  │  │  [thumb 210×297]  │  │
│ ─────────────    │  │     └──────────────────────────┘   │  │  │  cover-bg.jpg     │  │
│ ⠿ ▾ Scope &      │  │           Page 1 / 8               │  │  │  Replace · Remove │  │
│      pricing     │  │                                    │  │  └───────────────────┘  │
│   3  DATA   ●    │  └────────────────────────────────────┘  │  Title source           │
│      ├ Eng dept  │  ┌────────────────────────────────────┐  │  ( ) Quote title        │
│      └ Sup dept  │  │  ABAK | WHO WE ARE                  │  │  (•) Project name field │
│ ─────────────    │  │  ──────────────────────────────    │  │  ( ) Custom text…       │
│ ⠿ ▸ Payment      │  │  about paragraph lorem…            │  │  ─────────────────────  │
│   4  DATA   ●    │  │  OUR SERVICES  [□][□]              │  │  Subtitle               │
│ ─────────────    │  │                [□][□]              │  │  [ عرض سعر فني        ]  │
│ ⠿ ▸ Methodology  │  │  ACCREDITED WITH · contact bar     │  │                         │
│   5  DATA   ○    │  │           Page 2 / 8               │  │  ▸ Edit on Company      │
│ ─────────────    │  └────────────────────────────────────┘  │    Profile (bg only here)│
│ ⠿ ▸ Timeline     │                                          │                         │
│   6  DATA   ●    │     [ scroll for pages 3–8 ▼ ]           │  [Reset section]        │
│ ─────────────    │                                          │                         │
│ ⠿ ▸ Requirements │                                          │                         │
│   7  STATIC ●    │                                          │                         │
│ ─────────────    │                                          │                         │
│ ⠿ ▸ Thank you    │                                          │                         │
│   8  IMAGE  ●    │                                          │                         │
└──────────────────┴──────────────────────────────────────────┴─────────────────────────┘
```

### Left "Sections" rail — named `<SectionRail>`

- Each item is a `<SectionCard>`: drag handle (`⠿` `GripVertical`), expand caret, **section name**, an **ordinal index** (1..n, the page-order number), a **type badge**, and an **enable toggle** (`●` on / `○` off — a shadcn `Switch`, not a checkbox, because it reads as "in/out of the document").
- **Type badges** (small, color-keyed, like the Active/Archived badges in services):
  - `DATA` — emerald — bound to live quote data (scope, payment, methodology, timeline).
  - `IMAGE` — violet — a full-page uploaded image (cover bg, about, thank-you).
  - `STATIC` — slate — org boilerplate text (requirements/T&C, about-as-structured).
  - `CUSTOM` — amber — free rich-text page.
- **Reorder by drag** (dnd-kit `SortableContext`), with a **keyboard alternative** (see §9): focus a card, `Space` to lift, `↑/↓` to move, `Space` to drop. Pricing-policy already ships ↑/↓ reorder buttons in `SequentialEditor` — reuse that exact affordance as the non-drag path: each card has a `⋯` → "Move up / Move down" and the buttons appear on focus.
- **Locked ordering rules** (the conceptual model the document enforces): Cover is always first, Thank-you always last — they show a small lock glyph and refuse to drop elsewhere. Everything between is free. Disabling Cover/Thank-you is allowed (toggle off) but warns.
- Expanding **Scope & pricing** reveals **per-department sub-rows** (read-only here — they come from the quote's actual departments; this tells the admin "this one section fans out into N tables at render time").
- Disabled sections render dimmed with a strikethrough index and **drop out of the page count and the preview** (so "Pages 7/8" updates live — the pricing-policy live-feedback principle).

### Center "Live preview" — named `<TemplatePreview>`

- Stacked **A4 page frames** (`aspect-[210/297]`, fixed mm-proportioned, drop shadow on a `bg-muted` canvas). This is the _same_ render path as `quotes/[id]/print` — the builder mounts the real print components against **sample data** so WYSIWYG is guaranteed and there's one renderer to maintain.
- **The preview is RTL Arabic** (the client-facing default). A small toggle `AR | EN` in the toolbar flips preview locale only (not the admin chrome).
- Selecting a section in the rail **scrolls the preview to that page and outlines it** (`ring-2 ring-abak-blue`). Clicking a page in the preview selects its section in the rail. Bi-directional — bridges the gulf of evaluation.
- **Page X / N** caption under each frame; growth sections (scope overflowing to 2–3 pages) show as multiple consecutive frames with "Page 3 / 9 · Scope (cont.)".

### Right "Config panel" — named `<SectionConfigPanel>`

- Opens when a section is selected; header = section name + type badge; body = the per-section form (§3); footer "Reset section".
- **One global Save** (dirty-tracked exactly like `PolicyEditor`'s `dirty` memo + disabled Save button + `sonner` toast). No per-field save. `Discard` reverts to last-saved.

---

## 3. PER-SECTION CONFIG PANELS

Each is a focused form (shadcn `Label` + `Input`/`Textarea`/`Switch`/`Select`/`RadioGroup`), never a wall of fields. Shared header pattern: **Section title** (overridable, defaults to canonical name) + **Show in document** switch.

### 3.1 COVER `<CoverConfig>` — type IMAGE

```
Background image      [ upload / thumb / Replace / Remove ]   (A4 full-bleed)
Title source         (•) Project name field  ( ) Quote title  ( ) Custom…
Subtitle             [ text, bilingual ]
Show REF + date strip [✔]   ·   Show "ATTENTION: {client}" block [✔]
```

Geometric shapes are part of the uploaded bg (owner uses an uploaded background) — we do **not** generate decorative blobs. If no bg uploaded → fallback navy→blue gradient (`#1a3a5c`→`#2d5a8a`) panel with logo, so the cover is never broken.

### 3.2 ABOUT `<AboutConfig>` — type IMAGE **or** STATIC (mode switch)

A `ModeToggle` identical in shape to pricing-policy's two-card toggle:

```
┌─ Uploaded design ─┐  ┌─ Structured (built) ─┐
│ One full-page     │  │ About text, service  │
│ image you upload  │  │ cards, accreditations│
└───────────────────┘  └──────────────────────┘
```

- **Uploaded design:** single image picker (§4). Done.
- **Structured:** edits the org content (about paragraphs `Textarea`, 4 service cards = name+icon+blurb, accreditations = string list with add/remove like `TieredEditor`, contact bar = web/email/address). **These fields read/write the Company-Profile org store** (§5) — the panel shows a banner: _"Shared content — edits here change every quote. ▸ Manage on Company Profile."_ The structured editor is mirrored here for convenience but is the same source of truth.

### 3.3 SCOPE_PRICING `<ScopePricingConfig>` — type DATA

```
Columns         [✔] # · [✔] Scope of work · [✔] Qty · [✔] Unit
                [✔] Unit price (SAR) · [✔] Total (SAR)
Per-department  (•) One table per department + combined grand total
layout          ( ) Single merged table (single-dept only)
Pricing display  Supervision-style "per visit" shows  Qty × Unit price [✔]
                 Lump-sum depts hide Qty/Unit columns         [auto]
Greeting block  [✔] Show Islamic salutation + intro (site location + area)
Totals          Subtotal · VAT {vatPct from pricing policy} · Total inc. VAT
Amount in words [✔]  (auto, Arabic + English)
```

- Qty/Unit hiding is **per-department**, driven by the line-item model: a dept whose items are lump-sum auto-collapses Qty/Unit; Supervision (qty=N visits) keeps them. The toggle here sets the _default_; render respects each dept's data. This is the one place the "per-visit vs lump-sum" variability surfaces in config.
- VAT % and currency are **read from the existing Pricing Policy** (don't duplicate) — shown read-only with a "set on Pricing policy" link.

### 3.4 PAYMENT `<PaymentConfig>` — type DATA

```
Total banner          [✔] big amount + amount-in-words
Disbursement schedule (•) From quote's PaymentMilestones (the pricer set them)
                      ( ) Template default:  [50] [20] [20] [10] % + trigger text
                          (validates Σ = 100% — clamp like clampPct)
Project timeline grid  duration · commencement · validity · currency  [✔]
Banking details        Source: Company Profile  →  Bank · Holder · IBAN
                       [ shows current values read-only + ▸ Manage link ]
```

- The "must = 100%" rule (Module 4 business rule) is enforced inline with the same clamp/validation pattern as `clampPct`; a red helper text shows the running sum if ≠ 100.

### 3.5 METHODOLOGY `<MethodologyConfig>` / 3.6 TIMELINE `<TimelineConfig>` — type DATA

Minimal — these are auto-generated from `QuoteItem.methodologyCard` / `ganttBlock`:

```
Show in document        [✔]
Intro paragraph         [ bilingual text, optional ]
Empty behaviour         (•) Hide page if no items carry methodology/gantt
                        ( ) Show page with "to be detailed" note
Gantt color legend      [✔] show legend (Timeline only)
```

This matches the existing print behaviour where `MethodologySection`/`GanttSection` return `null` when no item carries the data — the config just exposes that as a choice.

### 3.7 REQUIREMENTS_NOTES `<RequirementsConfig>` — type STATIC

```
Documents required from client   [ numbered list editor — add/remove/reorder ]
General terms & conditions       [ numbered list editor ]
   ├ "Boilerplate (org default)" preset loaded  [Restore defaults]
   └ Pricer may extend per-quote  [✔]  (these become editable defaults the
                                        pricer can append to, not replace)
```

List editor = the add/remove/↑↓ row pattern from `SequentialEditor`. The **org default T&C** lives in Company Profile; the pricer-extend flag controls whether the quote builder lets the pricer add lines.

### 3.8 THANKYOU `<ThankYouConfig>` — type IMAGE or STATIC

Same `ModeToggle` as About. Structured = closing paragraphs + script "Thank you" + contact line (pulled from Company Profile contact). Uploaded = full-page image.

### 3.9 IMAGE_PAGE `<ImagePageConfig>` — type IMAGE (insertable anywhere)

A blank full-page image slot the admin can **insert at any position** (e.g. a certificate scan, a portfolio page). Added via **[+ Add section] → Image page**. Just §4's picker + an optional title. This satisfies "pages can be uploaded images, inserted anywhere".

### 3.10 CUSTOM_RICHTEXT `<RichTextConfig>` — type CUSTOM

Bilingual rich-text (headings, bold, lists) for an arbitrary extra page — e.g. a case-study or a special-conditions page. Tiptap-style minimal toolbar; RTL-aware editing.

---

## 4. IMAGE UPLOAD UX — `<PageImagePicker>`

A reusable component used by Cover bg, About-image, Thank-you-image, Image-page.

```
┌──────────────────────────────────────────┐
│  ┌────────────┐   cover-bg.jpg            │
│  │            │   1654 × 2339 px · 1.2 MB │
│  │  [thumb,   │   ✓ Matches A4 ratio       │
│  │   A4 crop] │                            │
│  │            │   [ Replace ]  [ Remove ]  │
│  └────────────┘                            │
│  ⓘ Full-page A4 design, 210 × 297 mm.      │
│    Best at 300 DPI = 2480 × 3508 px.       │
│    PNG or JPG, ≤ 5 MB. Portrait.           │
└──────────────────────────────────────────┘
```

- **Drop zone** when empty (dashed border, "Drag a full-page design or click to upload").
- **Validation, surfaced as inline helper not a blocking error:**
  - Wrong aspect ratio → amber warning _"This image isn't A4 (210×297). It may be letterboxed or cropped in the document."_ + a **fit toggle**: `Contain` (letterbox, safe) vs `Cover` (fill, may crop).
  - Too small (< ~1240×1754, 150 DPI) → amber _"Low resolution — may look soft when printed."_
  - Wrong format/oversize → red toast (the services-page `toast.error` pattern), upload rejected.
- **Preview** is the live A4 frame in the center — the picker just feeds it; what you see is the printed page.
- **Replace** keeps position/section; **Remove** falls back to the section's generated/structured rendering (never a broken page).
- **Fallback when missing:** every IMAGE section has a graceful structured/gradient fallback so a half-built template still previews and prints. The preview shows a subtle "Using fallback — no image uploaded" ribbon on that page.
- Storage: upload via an API endpoint returning a URL stored on the template section config (`imageUrl`); same axios/TanStack mutation pattern as the rest of admin.

---

## 5. ORG CONTENT EDITOR — RECOMMENDATION: SPLIT IT OUT

**Recommendation: a dedicated `admin/company-profile` page, NOT inside the template builder.**

Rationale (the Norman "one conceptual model, one source of truth" argument):

- Bank IBAN, the legal "WHO WE ARE", accreditations, and contact are **org-level facts, identical on every quote and every template variant.** Editing them inside a _template_ implies they're per-template — a false model that invites drift (a wrong IBAN copy-pasted into 3 variants is a real money bug).
- The CLAUDE.md `SystemSetting` key/value store is the natural home — store under keys like `company.bank`, `company.about`, `company.services`, `company.accreditations`, `company.contact`. One write site, every template reads it.
- It's a **different, higher permission** (`company_profile.manage`, IBAN-sensitive) than template editing.

So:

- **Company Profile page** = the editor of record for about/services/accreditations/contact/bank.
- **Template builder** = chooses _whether and where_ that content appears, can switch a page to an uploaded image instead, and shows a **mirrored, clearly-labelled** structured editor for convenience with the banner _"Shared content · changes every quote · ▸ Company Profile"_. Edits there write straight through to the same store.

```
admin/company-profile
┌─────────────────────────────────────────────┐
│ Company profile · used across all quotes      │
│ [ Identity ] [ Services ] [ Accreditations ]  │
│ [ Contact ] [ Banking 🔒 ]                    │
│  Banking (🔒 super-admin)                     │
│   Bank name      [ Al Rajhi Bank          ]   │
│   Account holder [ ABAK Engineering …     ]   │
│   IBAN           [ SA00 0000 …  ] dir=ltr     │
│   ⚠ Appears on every payment page.            │
└─────────────────────────────────────────────┘
```

---

## 6. PER-DEPARTMENT VARIANTS & TEMPLATE SELECTION

### Creating a variant

`[+ New template] → "From department…"` opens a small dialog (services-dialog shape):

```
Name      [ Supervision (per-visit)        ]
Scope     ( ) Org default   (•) Department  → [ Supervision ▾ ]
Start from (•) Duplicate org default  ( ) Blank
```

The admin then, inside the builder, tunes that variant — e.g. for **Supervision (per-visit)**: in `<ScopePricingConfig>` keep Qty/Unit columns and label the unit "visit"; for **Engineering (lump-sum)**: hide Qty/Unit, single total per scope line. Same builder, different config — no separate code path.

### How the system picks a template for a quote (the resolution rule — show it to the admin)

A small **"Template resolution"** info card on the list page states the model in plain language (the pricing-policy "PolicyPreview reads it back" move):

> 1. **Government tender** (RFQ channel CH-GOV) → the **Gov tender** template.
> 2. **Single-department** quote → that **department's variant** if one is Active; else the **Org default**.
> 3. **Multi-department** quote → the **Org default** template for cover/about/payment/thank-you, and **each department's Scope & Pricing block renders with its own variant's column rules** (per-visit vs lump-sum) inside the combined document, ending in a **combined grand total**.

That last rule is the important one: variants don't fork the whole document for multi-dept quotes — they only govern _their own scope/pricing/methodology block_, which is exactly how the print page already fans out by `departmentId`. The cover/about/payment/thank-you come from the org default to keep one coherent document. The admin sees this stated, so there's no surprise.

A per-quote **override** ("Use template: ▾") is exposed in the quote builder (not here) for the rare manual case — configurable-everything rule.

---

## 7. SAVE / VERSION / SET-DEFAULT / DUPLICATE / SAMPLE PREVIEW

- **Save:** one dirty-tracked button (the `PolicyEditor` `dirty` memo pattern), `sonner` success/error. Disabled when clean or saving (`save.isPending → "Saving…"`).
- **Version:** templates are **versioned, not overwritten in place** for sent quotes — a quote **snapshots the template version it was sent with**, so re-saving a template never retroactively changes already-sent PDFs (Module 4 "no-deletion / full-traceability" rule). The builder header shows `v3 · last saved 3d ago`; a "Version history" drawer lists versions with Restore.
- **Set as default:** ⋯ menu → confirm dialog _"Make 'X' the org default? New quotes without a department variant will use it."_ Demotes the previous default. Norman: this is a **confirmation** (not undo) because it changes behaviour for all future quotes — a consequential, hard-to-notice change.
- **Duplicate:** ⋯ → copies all sections + config to a new Draft named "X (copy)". Cheapest path to a variant.
- **Preview with sample data — `[Preview data ▾]` toolbar menu:**
  - **Built-in samples:** "Single dept · lump-sum", "Multi-dept (Eng + Supervision)", "Gov tender / BOQ", "Long scope (overflow → 3 pages)". Picking one re-renders the live preview so the admin sees page growth, per-visit pricing, and multi-dept grand total **before** any real quote exists.
  - **From a real quote:** search-pick an existing quote to preview the template against true data.
  - **[Open print preview]** opens the actual `quotes/[id]/print`-equivalent in a new tab against the chosen sample for a true print check.

---

## 8. INTERACTION STATES & COPY (en + ar intent)

| State                        | Treatment                                                                           | EN copy                                                                             | AR intent                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Loading (list)**           | Table skeleton rows (services pattern `Loading…`)                                   | "Loading templates…"                                                                | جارٍ تحميل القوالب…                                           |
| **Loading (builder)**        | Left rail skeleton + 1 ghost A4 frame pulsing                                       | —                                                                                   | —                                                             |
| **Empty (no dept variants)** | Only org default exists; New-dialog shows hint                                      | "No department variants yet. The org default covers every quote until you add one." | لا توجد قوالب للأقسام بعد. القالب الافتراضي يغطي كل العروض.   |
| **Error (load)**             | Destructive card (pricing-policy `Failed to load…`) + Retry                         | "Couldn't load this template. Retry."                                               | تعذّر تحميل القالب. أعد المحاولة.                             |
| **Saving**                   | Save → spinner "Saving…", rail/panel disabled                                       | "Saving…"                                                                           | جارٍ الحفظ…                                                   |
| **Save success**             | `toast.success`                                                                     | "Template saved."                                                                   | تم حفظ القالب.                                                |
| **Save error**               | `toast.error` w/ server message (services error-extract pattern)                    | "Couldn't save. {reason}"                                                           | تعذّر الحفظ. {السبب}                                          |
| **Dirty leave**              | beforeunload / route guard                                                          | "Discard unsaved changes to this template?"                                         | تجاهل التغييرات غير المحفوظة؟                                 |
| **Upload rejected**          | inline + toast                                                                      | "Use a PNG or JPG under 5 MB."                                                      | استخدم PNG أو JPG أقل من ٥ ميجابايت.                          |
| **Image missing**            | preview ribbon, never blocks                                                        | "Using fallback — no image uploaded."                                               | يُستخدم البديل — لم تُرفع صورة.                               |
| **Preview render fail**      | the failing A4 frame shows an error card, **rest of pages still render** + "Report" | "This page couldn't render with the sample data. Other pages are fine."             | تعذّر عرض هذه الصفحة بالبيانات التجريبية. باقي الصفحات سليمة. |
| **All sections off**         | preview shows one empty frame + warning                                             | "Every section is disabled — this quote would be blank."                            | كل الأقسام معطّلة — سيكون العرض فارغًا.                       |

Preview-render-fail is isolated **per page-frame** (error boundary around each `<A4Page>`), so a bad sample never blanks the whole builder — the admin can still work on other sections.

---

## 9. ACCESSIBILITY, RTL, KEYBOARD REORDER

- **RTL-primary:** admin chrome follows the app's `dir`. The **preview is independently RTL Arabic** (client default) with an `AR | EN` flip. All builder styling uses logical properties already standard in this codebase — `me-2`, `ps-5`, `text-end`, `insetInlineStart` (seen in the Gantt block), `rtl:rotate-180` on back arrows — so mirroring is automatic. Drag direction respects `dir` (dnd-kit reads logical axis).
- **Keyboard reorder (drag alternative — required):** every `<SectionCard>` is a focusable row.
  - `Space`/`Enter` = lift (announces _"Cover, lifted, position 1 of 8"_ via `aria-live="assertive"`), `↑/↓` move, `Space` drop, `Esc` cancel.
  - Plus the always-visible **↑ / ↓ buttons** on each focused card (the exact `SequentialEditor` affordance from pricing-policy) — so reorder never requires a pointer. Lock rules disable the buttons at the boundaries (Cover can't move up, Thank-you can't move down) just like `disabled={i === 0}` there.
- **Toggle = `Switch`** with a real `<Label htmlFor>` and `aria-describedby` pointing at the type-badge meaning.
- **Selection sync** announced: selecting a section moves focus into the config panel heading and scrolls/outlines the matching A4 page (`aria-controls` linking rail item → page frame).
- **Color is never the only signal:** type badges carry a text label (`DATA`/`IMAGE`/`STATIC`/`CUSTOM`) and enabled/disabled carries the strikethrough + dimming, not just the dot.
- **Image alt + DPI text** are screen-reader exposed; the A4 ratio guidance is plain text, not a tooltip-only hint.
- **Focus order:** toolbar → section rail → config panel → preview (preview is `role="region"` aria-label "Live document preview", focusable for scroll but not a tab trap).

---

## Named components (shadcn-style), at a glance

`QuoteTemplatesPage`, `TemplateListTable`, `NewTemplateDialog`, `TemplateResolutionCard` · `TemplateBuilder`, `BuilderToolbar`, `SectionRail`, `SectionCard`, `SectionTypeBadge`, `SectionConfigPanel`, `TemplatePreview`, `A4Page` · per-section: `CoverConfig`, `AboutConfig`, `ScopePricingConfig`, `PaymentConfig`, `MethodologyConfig`, `TimelineConfig`, `RequirementsConfig`, `ThankYouConfig`, `ImagePageConfig`, `RichTextConfig` · shared: `PageImagePicker`, `ModeToggle` (reused from pricing-policy shape), `NumberedListEditor` (reused from `SequentialEditor` shape), `SampleDataMenu`, `VersionHistoryDrawer` · separate page: `CompanyProfilePage` (Identity/Services/Accreditations/Contact/Banking tabs).

**Reuse, not reinvention:** the live-preview-reads-it-back model, the two-card `ModeToggle`, the add/remove/↑↓ list editor, the dirty-Save+toast loop, the role guard, and the department-grouped renderer all already exist in this codebase — the builder is a composition of those proven patterns plus the A4 preview and the image picker.

---

Relevant files I read / referenced (all absolute):

- `/Users/amgedalmogahed/Documents/LUBB/Clients/Abak/ABAK_ERP/packages/web/src/app/[locale]/(dashboard)/admin/services/page.tsx` — list+Dialog, role guard, toast error-extract.
- `/Users/amgedalmogahed/Documents/LUBB/Clients/Abak/ABAK_ERP/packages/web/src/app/[locale]/(dashboard)/admin/pricing-policy/page.tsx` — left-editor/right-live-preview, `ModeToggle`, dirty `Save`, `SequentialEditor` reorder, `clampPct`.
- `/Users/amgedalmogahed/Documents/LUBB/Clients/Abak/ABAK_ERP/packages/web/src/app/[locale]/quotes/[id]/print/page.tsx` — the 8-block renderer, department grouping (`groupByDepartment`), `MethodologySection`, `GanttSection`, `@page` A4 print CSS — the same render path the preview reuses.

Two design decisions the implementer must ratify: (1) org content (bank/about/contact/accreditations) lives in a **separate `admin/company-profile` page** backed by `SystemSetting`, mirrored read/write inside the builder — not owned by templates; (2) templates are **version-snapshotted onto sent quotes** so re-editing a template never mutates already-sent PDFs.

---

# PART C — Per-quote document experience

I have everything I need. The `send()` method at line 642 currently just flips status (no PDF generation), there's a `use-settings.ts` hook, and the i18n is namespaced under `quotePdf`. Now I'll write the design.

# ABAK Price-Offer Document Experience — Design Spec

**Author:** design pass over `quotes/new`, `quotes/[id]`, `quotes/[id]/print`, the RFQ split spec, and the Prisma quote model.
**Scope:** how a department pricer turns a built Quote into the 8-block multi-page offer, previews it, and sends it. Arabic-PRIMARY, RTL, SAR/15% VAT.
**Grounding facts that shape every decision below:**

- No PDF library exists in either `package.json`. The current document is `quotes/[id]/print/page.tsx` rendered to A4 via `window.print()`. **The PDF engine is a build decision, not a design decision — but the design must not assume one exists today.** I specify the rendering contract so the document component is the single source of truth for both on-screen preview and the eventual server PDF.
- The print page already groups `QuoteItem` by `departmentId`, already renders methodology (pg 5) and gantt (pg 6) from `item.methodologyCard` / `item.ganttBlock`. The 3-step builder already captures dept + service + qty/unit/unitPrice + per-item methodology/gantt + milestones. **So ~40% of the data model the document needs already flows.** The gap is: the 8 page-blocks, org-level content, per-quote document fields, template composition, live preview, and immutable issued PDF.
- Per the RFQ split spec, the builder is now opened **from the RFQ workbench with `rfqId` pre-linked**, one `QuoteItem.departmentId` section per involved department, Lead Pricer compiles. The document is the OUTPUT of `DRAFT → submit → APPROVED → SEND`.

---

## 0. The spine: a Document is a composed, versioned artifact — not a print route

Today `print/page.tsx` is a hardcoded continuous flow. I replace that mental model with three layers:

```
TEMPLATE (org/dept defaults)   →   DOCUMENT (per-quote overrides + authored fields)   →   RENDER (8 page-blocks → A4 pages → PDF)
   admin-configured                  pricer-authored in the "Document" tab               <QuoteDocument/> = single source for preview AND PDF
```

**Named primitives (these are the vocabulary for the whole spec):**

- **`PageBlock`** — one of 9 block _kinds_. Each is either `DATA_BOUND` (renders from quote/org data) or `IMAGE_PAGE` (renders an uploaded full-page image). The 8 canonical blocks plus a generic `IMAGE_PAGE` insert:
  `COVER · COMPANY_PROFILE · QUOTATION · PAYMENT · METHODOLOGY · TIMELINE · REQUIREMENTS · THANK_YOU · IMAGE_PAGE`.
- **`DocumentTemplate`** — admin-level: ordered `PageBlock[]` with per-block `{ enabled, mode: 'data'|'image', imageAssetId?, locked }`, plus org content (about, services, accreditations, contact, bank). Scoped `org` or `department`. Stored as a `SystemSetting` row (`document.template.org`, `document.template.dept.<id>`) — the model already uses `SystemSetting` as a key/value store for thresholds.
- **`QuoteDocument`** — per-quote: a _diff_ against the resolved template (`blockOverrides`), plus the **authored fields** the pricer fills (subject, greeting, site location/area, validity, per-dept scope text, documents-required, extra notes), plus per-quote `IMAGE_PAGE` inserts. New Prisma model `QuoteDocument` (1:1 with Quote, versioned alongside `quote.version`).
- **`IssuedPdf`** — immutable snapshot: the rendered PDF bytes + a frozen JSON of the fully-resolved document, stamped with `quote.version`. New model `QuoteIssuedDocument`.

**Why a diff, not a copy:** the owner wants "Configurable Everything" _and_ low-friction per-quote tweaks. The pricer inherits the org/dept template; per-quote changes are stored as sparse overrides so a later template edit (new accreditation, new bank IBAN) still flows into _unsent_ drafts, while _issued_ PDFs are frozen.

---

## 1. HOW the quote-build flow feeds the document

### 1.1 Where the authoring lives: a 4th wizard step **and** a persistent tab

The current wizard is `1 المعلومات الأساسية → 2 البنود → 3 دفعات السداد`. I add **Step 4 «المستند» (Document)** — but the document is _also_ a standalone **tab on `quotes/[id]`** (`المستند`), because:

- On _create_ (`quotes/new`) the pricer is in flow → Step 4 is the natural place to author cover/greeting before first save.
- On _edit/revise_ (`quotes/[id]`) the quote already exists, has a version, may have been bounced back from approval → a tab is the right re-entry. Re-authoring the whole wizard is wrong.

So Step 4 and the tab render **the same `<DocumentEditor/>` component**. Step 4 is `<DocumentEditor mode="wizard"/>` (compact, "you can finish this later" affordance); the tab is `<DocumentEditor mode="tab"/>` (full, with the live preview docked right).

### 1.2 New per-quote authored fields (where each lives in the editor)

These are **document-only** fields — they belong on `QuoteDocument`, NOT on `Quote` (keeps the quote model about pricing; keeps the document about presentation). The existing `Quote.scopeOfWork/deliverables/...` stay as the _technical record_; the document's per-dept scope text is authored separately because multi-dept needs N scope texts, not one.

| Field                           | Block it feeds                         | Editor section                  | Default / inherit                                                         |
| ------------------------------- | -------------------------------------- | ------------------------------- | ------------------------------------------------------------------------- |
| `subject` (موضوع العرض)         | QUOTATION meta                         | «الترويسة»                      | falls back to `quote.title`                                               |
| `greetingName` / `salutation`   | QUOTATION greeting                     | «التحية»                        | org default salutation (Islamic), client `contactName`                    |
| `introSentence`                 | QUOTATION greeting block               | «التحية»                        | templated: "يسرّنا تقديم عرضنا لمشروع {project} في {site} بمساحة {area}…" |
| `siteLocation` / `siteArea`     | QUOTATION intro + COVER subtitle       | «الموقع»                        | from RFQ/lead if present                                                  |
| `projectName`                   | COVER big title                        | «الغلاف»                        | `quote.title`                                                             |
| `validityDays`                  | PAYMENT timeline grid + QUOTATION meta | «الصلاحية»                      | org default (e.g. 30); writes `quote.validUntil = issuedAt + N`           |
| `scopeTextByDept[deptId]`       | QUOTATION per-dept scope paragraph     | «النطاق لكل قسم» (one per dept) | empty; pre-seeded from dept template snippet                              |
| `documentsRequired[]`           | REQUIREMENTS list                      | «المتطلبات»                     | org boilerplate list, editable                                            |
| `extraNotes[]` / `termsExtra[]` | REQUIREMENTS T&C                       | «الملاحظات»                     | org T&C boilerplate, append-only by pricer                                |
| `blockOverrides`                | template composition                   | «الصفحات» (page toggles)        | resolved template                                                         |
| `imageInserts[]`                | IMAGE_PAGE blocks                      | «الصفحات»                       | none                                                                      |

**Rule:** every authored field shows its inherited/default value as ghost placeholder; the pricer overrides only what's needed. A field left at default is _not_ persisted as an override (keeps the diff sparse). This directly satisfies the brief's "per-quote overrides vs template defaults."

### 1.3 The methodology/gantt already in Step 2 stay there

`MethodologyGanttEditor` (per line item) already feeds METHODOLOGY (pg5) and TIMELINE (pg6). **Do not move it** — methodology is intrinsically per-line, and the pricer fills it while pricing the line. Step 4 only _toggles whether those pages appear_ and shows a read-only "12 items have methodology, 8 have gantt" rollup with a "← edit in البنود" jump. This avoids two editors for one dataset.

---

## 2. TEMPLATE SELECTION & per-quote composition

### 2.1 Resolution order (deterministic, shown to the user)

```
effectiveBlocks = applyOverrides(
  resolveTemplate(quote.primaryDepartmentId),   // dept template if set, else org template
  quoteDocument.blockOverrides                   // per-quote on/off/reorder/image-swap
)
```

The «الصفحات» (Pages) panel in `<DocumentEditor/>` shows the resolved block list as a **vertical reorderable strip** (one row per block) with, per row:

- a **toggle** (enabled/disabled) — disabled blocks dim, render nothing in preview;
- a **mode chip** where allowed: `بيانات` (data-bound) ↔ `صورة` (image). COVER background, COMPANY_PROFILE, THANK_YOU support image mode (brief calls these out explicitly); QUOTATION/PAYMENT/METHODOLOGY/TIMELINE are data-only (you can't sell a priced scope as a flat image) — their mode chip is absent;
- a **lock badge** if the template marked the block `locked` (e.g. org policy: COMPANY_PROFILE and PAYMENT's bank bar can't be hidden — bank details and accreditations are compliance content). Locked blocks can't be toggled off or reordered past their fence; the toggle renders as a disabled lock with tooltip «مثبّت بواسطة القالب».

### 2.2 What the pricer may do per quote

| Action                                                     | Allowed?         | Constraint                                                                                   |
| ---------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------- |
| Toggle a non-locked block off                              | ✅               | e.g. hide METHODOLOGY + TIMELINE for a tiny one-line quote                                   |
| Swap COVER/ABOUT/THANK_YOU to an uploaded image            | ✅               | image must exist (org asset or per-quote upload)                                             |
| Add an `IMAGE_PAGE` insert (e.g. an extra credential page) | ✅               | drops between blocks; max N (template cap, default 4)                                        |
| Reorder                                                    | ✅ within fences | locked blocks are fence posts; COVER is always first, THANK_YOU always last                  |
| Change org content (about text, IBAN)                      | ❌ from here     | that's admin; a link «تُحرَّر في إعدادات القالب» for users with `settings:document_template` |

**Reorder is intentionally constrained.** The 8 blocks have a canonical narrative order (you can't put PAYMENT before QUOTATION). Free drag invites broken documents. So reorder is "move within the same fence segment" only; cross-fence drops snap back with a toast «لا يمكن نقل هذه الصفحة قبل/بعد صفحة مثبّتة».

---

## 3. MULTI-DEPARTMENT in the builder

### 3.1 The structural truth the UI must make obvious

One Quote, N `QuoteItem.departmentId` sections, one combined grand total (RFQ split spec §6.3). The document renders **one QUOTATION scope/pricing block per department + a combined-totals band**, exactly extending the grouping `ItemsTable` already does in `print/page.tsx:groupByDepartment`.

### 3.2 Step 2 (البنود) gains a department spine

Today items are a flat list each carrying a `departmentId` dropdown. For multi-dept this is too loose — the pricer can't see "Architecture has 3 items priced, MEP has 0." I restructure Step 2 into **department accordions** (only when the linked RFQ has ≥2 departments; single-dept stays the current flat list — no new noise):

```
▼ القسم: العمارة (Architecture)            3 بنود · 45,000 ر.س   ⬤ تم التسعير
   [the existing per-item cards, scoped to this dept]
   [+ إضافة بند للعمارة]
   ── نطاق العمارة (scope text for the QUOTATION block of this dept) ──
   [ textarea: scopeTextByDept['architecture'] ]
▸ القسم: الكهروميكانيك (MEP)               0 بنود · —           ⬤ بانتظار التسعير
▸ القسم: الإشراف (Supervision)             1 بند · 18,000 ر.س   ⬤ تم التسعير (بالزيارة)
```

Each dept accordion header shows: name, item count, dept subtotal, and a **pricing-status dot** (priced / awaiting). The dept's **scope text lives at the bottom of its own accordion** — co-located with its items, so the pricer authors scope and price for one dept together. This is the single biggest "make multi-dept obvious" move: the per-dept boundary is a physical container, not a column value.

### 3.3 Per-department pricing-model presentation (the Supervision case)

The brief flags Supervision = priced **per visit** (qty=N × price/visit) while others are lump-sum. The line model (`quantity`/`unit`/`unitPrice`) already supports this. The _document_ must present it right, and the _editor_ must signal it:

- The dept accordion carries a **`pricingMode` chip** stored on the dept template: `LUMP_SUM` | `PER_UNIT`. For Supervision it's `PER_UNIT` with `unitLabel = "زيارة"`.
- In `PER_UNIT` mode the item card's quantity field gets a unit-aware label («عدد الزيارات») and the document's QUOTATION row for that dept renders `الكمية` as `8 زيارات` and a sub-line `4,500 ر.س / زيارة`, so the client sees the basis. The combined totals band still sums all dept totals identically.
- This is a _presentation_ flag, not a new pricing engine — keeps the model honest.

### 3.4 Lead Pricer compile state

Each co-pricer fills their dept accordion. The Lead Pricer sees a **compile banner** at the top of Step 2 / the tab:
`«3 من 3 أقسام جاهزة — يمكنك تقديم العرض للاعتماد»` (green) or `«قسم الكهروميكانيك لم يُسعَّر بعد»` (amber, blocks submit). This reuses the existing `canProceed2` gate, extended to "every dept with items has all items valid AND every involved dept has ≥1 item."

---

## 4. PREVIEW — live A4 multi-page, the real document

### 4.1 One renderer, two consumers

The critical architectural commitment: **extract the document into `<QuoteDocument document={resolved} mode="screen"|"print"|"pdf"/>`** — a pure, data-in component that emits the 8 page-blocks as a sequence of `.a4-page` elements. `quotes/[id]/print/page.tsx` becomes a thin wrapper that renders `<QuoteDocument mode="print"/>`. The live preview renders the _same_ component at `mode="screen"` inside a scaled scroll container. The eventual server PDF renders `mode="pdf"`. **No second template, ever** — this kills the class of "preview looked different from what the client got" bugs.

### 4.2 The preview surface (docked, tab mode)

```
┌─ المستند — QUO-118 · من RFQ-0042 ───────────────────────────── [حفظ] [معاينة كاملة ⤢] ─┐
│ ┌── editor (45%) ───────────┐  ┌── live preview (55%) ───────────────────────────────┐ │
│ │ ▸ الغلاف                  │  │  ┌─thumbs─┐  ┌──────── A4 page (scaled) ─────────┐   │ │
│ │ ▸ الترويسة                │  │  │ ▭ 1    │  │                                   │   │ │
│ │ ▸ التحية                  │  │  │ ▭ 2 ●  │  │      [ live COVER renders here ]  │   │ │
│ │ ▾ النطاق لكل قسم          │  │  │ ▭ 3    │  │                                   │   │ │
│ │   • العمارة   [textarea]  │  │  │ ▭ 4    │  │                                   │   │ │
│ │   • MEP       [textarea]  │  │  │ ▭ 5    │  └───────────────────────────────────┘   │ │
│ │ ▸ المتطلبات               │  │  │ +N…    │   صفحة 2 من 11      ◀ ▶  [100%▾]         │ │
│ │ ▸ الصفحات (تشغيل/ترتيب)   │  │  └────────┘                                          │ │
│ └───────────────────────────┘  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Page thumbnails rail** (left of the canvas in LTR, right in RTL): one thumb per _rendered_ page (so an overflowing scope table that spans 3 pages shows 3 thumbs). Click = jump. Active page dot. Thumbs are the same `<QuoteDocument/>` at tiny scale (CSS `transform: scale`), not screenshots — always live.
- **Edit-then-see:** the editor and preview share React state; debounced (250ms) so typing scope text reflows the QUOTATION page live. The thumb count animates when a block toggles on/off.
- **Pagination is real, not faked.** A4 page breaks are computed by a `<Paginator/>` that measures block heights and splits overflowing `DATA_BOUND` content (scope table rows, requirements list items) across `.a4-page` containers using CSS `break-inside: avoid` on rows (already in the print stylesheet) plus a measuring pass for screen mode. The page counter «صفحة 2 من 11» is the brief's "page count GROWS" made visible.
- **«معاينة كاملة ⤢»** opens the existing `/quotes/[id]/print` route full-screen (now `<QuoteDocument mode="print"/>`) for a true print check.

### 4.3 Mobile/tablet preview

On a tablet the dock collapses to **tabbed** (editor | preview) with a bottom segmented control; the thumbnail rail becomes a horizontal filmstrip above the canvas. Pinch-zoom on the A4. Pricers on tablet author in portrait, flip to preview — never side-by-side under ~1024px.

---

## 5. SEND — generate the final PDF, attach, store immutably

### 5.1 The send is gated and produces an `IssuedPdf`

Today `quotes.service.send()` (`:642`) just flips `APPROVED → SENT`. I extend the **send flow** (not the document design, but it's load-bearing for "what the client receives"):

1. Pre-send check (client-side, in the Send dialog): `assertRenderable(document)` — every enabled block resolves, every `IMAGE_PAGE` asset exists, bank/accreditation org content present, milestones sum 100%, every involved dept priced. Failures listed inline (see §7).
2. On confirm → `POST /quotes/:id/issue` renders `<QuoteDocument mode="pdf"/>` server-side to PDF bytes (engine TBD — server-side headless Chromium against the same React component is the recommended path so on-screen == issued), writes `QuoteIssuedDocument { quoteVersion, pdfUrl, resolvedJson, issuedAt, issuedBy, sha256 }`, then runs the existing `send()` status transition.
3. The issued PDF is **immutable** — keyed by `(quoteId, quoteVersion)`. A revision (`quotes.service.revise :857`, new version) produces a _new_ `IssuedPdf`; the old one stays for audit (the "no deletion" project rule). The detail rail gains a **«النسخ المُصدَرة»** list: `v1 — أُرسل 2026-06-01 ⬇`, `v2 — أُرسل 2026-06-04 ⬇`.

### 5.2 Dispatch — what the client receives

Per the RFQ split spec, **send + outcome is sales-owned**. So after the pricer issues, the act of dispatching can be sales (or the same person if they hold both perms). The Send dialog offers channel(s):

- **Email** — subject «عرض سعر {quoteNumber} — {projectName}», body from `document.introSentence`, the issued PDF attached. Arabic body, RTL.
- **WhatsApp** (per the dispatch flow, future WhatsApp Business API) — short message + a tokenized link to a client-viewable PDF.
- The client receives the **exact `<QuoteDocument/>` PDF** — cover with their company in ATTENTION, per-dept scope, combined totals, amount-in-words, bank bar, thank-you. Nothing the pricer didn't see in preview.

### 5.3 Amount-in-words

A `toArabicWords(amount)` / `toEnglishWords` util feeds the QUOTATION and PAYMENT blocks ("Amount in Words"). It's a render-time derivation of `quote.totalAmount` — never stored, never editable (prevents the words/figures mismatch class of bug). VAT-inclusive total, SAR, e.g. «فقط مئة وخمسة آلاف ريال سعودي لا غير».

---

## 6. REQUIREMENTS / NOTES authoring & overflow

- **`documentsRequired[]`** and **`termsExtra[]`** are list editors in «المتطلبات» / «الملاحظات». Each is seeded from org boilerplate (`SystemSetting document.boilerplate.documentsRequired` / `.terms`). The pricer **appends** project-specific items (e.g. "صك الأرض", "تقرير فحص التربة"); each row is reorderable, deletable _for this quote_ (boilerplate items deleted here are per-quote overrides, not org edits).
- **Overflow** is handled by the same `<Paginator/>`: a 30-item documents list flows onto a second REQUIREMENTS page; the block header repeats with «(تابع)». No manual page management.
- Bilingual intent: list items store a single string the pricer types; the block header is bilingual («المستندات المطلوبة من العميل · Documents Required»), matching the existing pattern in `MethodologySection`.

---

## 7. INTERACTION STATES

| State                       | Trigger                         | What the USER sees                                                                                                                                                                      |
| --------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Loading (editor)**        | quote/document fetch            | Editor skeleton left + an A4 page skeleton right (mirrors `DetailSkeleton`); thumb rail shows 3 shimmer rects.                                                                          |
| **Empty (no document yet)** | first open of a fresh draft     | Editor pre-filled from template; preview shows the document with ghost placeholders («اسم المشروع» faded). Banner: «هذا المستند مبني من قالب {org/dept}. عدّل ما يلزم.»                 |
| **Empty (dept unpriced)**   | a dept accordion has 0 items    | That dept's QUOTATION block in preview shows an inline amber strip «لم تُسعّر بنود هذا القسم بعد»; submit/issue blocked.                                                                |
| **Saving (autosave)**       | debounced field change          | Top-bar pill «يُحفظ…» → «تم الحفظ ٠٩:٤١». Optimistic; preview never blocks on save.                                                                                                     |
| **Save error**              | network/validation              | Pill turns rose «تعذّر الحفظ — إعادة المحاولة»; the offending field border rose with message; preview keeps last-good state.                                                            |
| **Preview render fail**     | a block throws                  | That page slot shows a bordered fallback «تعذّر عرض هذه الصفحة (الغلاف)» with «إعادة المحاولة»; other pages render — one bad block never blanks the document. Error-boundary per block. |
| **Missing template image**  | `IMAGE_PAGE`/cover bg asset 404 | The page renders a dashed placeholder «صورة الصفحة مفقودة — ارفع صورة أو حوّلها إلى بيانات»; counts as a pre-send blocker.                                                              |
| **Missing org content**     | bank/accreditation unset        | PAYMENT bank bar shows «بيانات البنك غير مُعدّة — تُضاف في إعدادات القالب» (link for privileged users); pre-send blocker.                                                               |
| **Send pre-check fail**     | `assertRenderable` fails        | Send dialog lists each blocker with a jump link («النطاق لقسم MEP فارغ → افتح»); primary button disabled until clear.                                                                   |
| **Issuing (PDF gen)**       | confirm send                    | Dialog → progress «يُولَّد ملف PDF… قد يستغرق لحظات»; button spinner; non-cancelable once bytes start.                                                                                  |
| **Send/issue fail**         | server/render error             | Dialog stays open, rose alert «تعذّر إصدار المستند. لم يُرسل العرض للعميل.» + «إعادة المحاولة»; quote stays `APPROVED` (no half-sent state).                                            |
| **Sent (success)**          | issue+send ok                   | Dialog closes, toast «أُرسل العرض إلى {client}», status → SENT, issued-PDFs rail gains the new row, primary action flips to outcome.                                                    |
| **Locked block tampering**  | toggle/reorder a locked block   | Disabled control + tooltip «مثبّت بواسطة القالب»; no state change.                                                                                                                      |

---

## 8. Copy (en + ar intent), wireframes

### 8.1 Step indicator (extended)

`١ المعلومات الأساسية · ٢ البنود · ٣ دفعات السداد · ٤ المستند`
Step 4 sublabel: «اختياري الآن — يمكنك إكماله من تبويب المستند» / "Optional now — finish later in the Document tab".

### 8.2 Document tab — section copy

| ar                                  | en intent                 |
| ----------------------------------- | ------------------------- |
| المستند                             | Document                  |
| الغلاف                              | Cover                     |
| الترويسة                            | Header / Ref              |
| التحية                              | Greeting                  |
| النطاق لكل قسم                      | Scope per department      |
| المتطلبات                           | Requirements              |
| الصفحات                             | Pages                     |
| الصفحات المُصدَرة / النسخ المُصدَرة | Issued copies             |
| معاينة كاملة                        | Full preview              |
| إرسال للعميل                        | Send to client            |
| يُحفظ… / تم الحفظ                   | Saving… / Saved           |
| مثبّت بواسطة القالب                 | Locked by template        |
| المبلغ كتابةً                       | Amount in words           |
| تُحرَّر في إعدادات القالب           | Edit in template settings |

### 8.3 Document step (wizard mode) — compact

```
┌─ ٤ المستند ─────────────────────────────────────────────┐
│ هذا المستند مبني من قالب «العمارة». عدّل ما يلزم.        │
│                                                          │
│ موضوع العرض  [ تصميم معماري — برج سكني …            ]    │
│ اسم المشروع  [ برج الواحة                           ]    │
│ الموقع       [ الرياض — حي الياسمين ]  المساحة [ ١٢٥٠ م² ]│
│ الصلاحية     [ ٣٠ ] يومًا                                │
│                                                          │
│ ▾ النطاق لكل قسم                                         │
│   العمارة   [ يشمل النطاق التصميم المعماري الكامل…    ]  │
│   MEP       [ … ]                                        │
│                                                          │
│ الصفحات: ☑غلاف ☑تعريف ☑عرض ☑دفعات ☑منهجية ☑جدول ☑متطلبات ☑شكر │
│                                                          │
│ [ ◀ السابق ]              [ معاينة ]   [ حفظ كمسودة ]    │
└──────────────────────────────────────────────────────────┘
```

### 8.4 Pages panel (reorder/toggle/mode)

```
┌─ الصفحات ───────────────────────────────────────┐
│ ⠿ 🔒 الغلاف            [بيانات|صورة]  ●مفعّل      │
│ ⠿ 🔒 التعريف بالشركة    [بيانات|صورة]  ●مفعّل      │
│ ⠿    عرض السعر          ·بيانات·       ●مفعّل      │
│ ⠿ 🔒 الدفعات + البنك    ·بيانات·       ●مفعّل      │
│ ⠿    المنهجية           ·بيانات·       ○معطّل      │  ← hidden for tiny quote
│ ⠿    الجدول الزمني      ·بيانات·       ○معطّل      │
│ ⠿    المتطلبات والشروط  ·بيانات·       ●مفعّل      │
│ ⠿    + صفحة صورة…                                 │  ← add IMAGE_PAGE
│ ⠿ 🔒 شكرًا              [بيانات|صورة]  ●مفعّل      │
└──────────────────────────────────────────────────┘
   ⠿ = drag handle (within fences)   🔒 = locked
```

### 8.5 Send dialog

```
┌─ إرسال العرض إلى العميل ───────────────────────────┐
│ العميل: مؤسسة البناء الحديث · CLIENT-2026-0042      │
│ الإجمالي شامل الضريبة: ١٢٠٬٧٥٠٫٠٠ ر.س               │
│ المبلغ كتابةً: مئة وعشرون ألفًا وسبعمئة وخمسون ر.س   │
│ ─────────────────────────────────────────────────  │
│ ✓ ١١ صفحة جاهزة   ✓ ٣ أقسام مُسعّرة   ✓ بيانات البنك│
│ ⚠ صورة صفحة الشكر مفقودة → [ارفع] [حوّل لبيانات]    │
│ ─────────────────────────────────────────────────  │
│ القناة:  ☑ بريد إلكتروني   ☐ واتساب                 │
│ سيُولَّد ملف PDF نهائي ويُرفق بنسخة العرض v2.        │
│                          [ إلغاء ]  [ إصدار وإرسال ]│
└──────────────────────────────────────────────────────┘
```

---

## 9. Mobile/tablet, a11y, RTL

- **Tablet (primary for pricers):** editor and preview are _tabs_, not split; thumbnail filmstrip horizontal; A4 pinch-zoom; the dept accordions in Step 2 are full-width stacks (they already are at `sm:`). The Pages reorder uses long-press drag with up/down buttons as a non-drag fallback (drag is unreliable on touch + a11y).
- **a11y:** every toggle is a real `<button aria-pressed>`; reorder rows expose «نقل لأعلى/لأسفل» buttons (keyboard + SR path, not drag-only); the preview canvas is `role="document" aria-label="معاينة عرض السعر، صفحة 2 من 11"`; locked controls are `aria-disabled` with the tooltip text also in `aria-describedby`; the issued-PDF links are real `<a download>`. Page-render error fallbacks are `role="alert"`.
- **RTL:** the whole document is RTL Arabic-primary; the only LTR islands are numerals/money/IBAN/quote-number/dates — already handled in `print/page.tsx` via `dir="ltr"` on those spans and `formatMoney` in en-US grouping. The preview dock mirrors (thumbnail rail on the right in RTL); `insetInlineStart` (already used for the gantt bars) keeps the gantt/payment-card flow correct in both directions. The COVER's bottom ref strip and ATTENTION block must use `dir="ltr"` for the `Qxxxx | DATE` token, `rtl` for the Arabic labels.

---

## 10. Build order (so this lands incrementally without breaking print)

1. **Extract `<QuoteDocument/>`** from `print/page.tsx` (mechanical; print route wraps it). No behavior change — derisks everything after.
2. **Org content in `SystemSetting`** + admin «إعدادات القالب» screen (about/services/accreditations/contact/bank/boilerplate). COMPANY_PROFILE, PAYMENT bank bar, REQUIREMENTS boilerplate start reading from it.
3. **`QuoteDocument` model + `<DocumentEditor/>`** (Step 4 + tab) with authored fields + live preview reusing `<QuoteDocument mode="screen"/>`.
4. **8 page-blocks + `<Paginator/>`** (COVER, COMPANY_PROFILE, PAYMENT, REQUIREMENTS, THANK_YOU new; QUOTATION/METHODOLOGY/TIMELINE refit from existing code).
5. **Template composition** (blockOverrides, IMAGE_PAGE, dept templates) + Pages panel.
6. **Issue/send** (`POST /quotes/:id/issue`, `QuoteIssuedDocument`, PDF engine, dispatch channels).

**Relevant files (absolute):**

- `/Users/amgedalmogahed/Documents/LUBB/Clients/Abak/ABAK_ERP/packages/web/src/app/[locale]/quotes/[id]/print/page.tsx` — current document; extract `<QuoteDocument/>` here; already has dept grouping (`groupByDepartment`), `MethodologySection`, `GanttSection`, A4 `@page` stylesheet.
- `/Users/amgedalmogahed/Documents/LUBB/Clients/Abak/ABAK_ERP/packages/web/src/app/[locale]/(dashboard)/quotes/new/page.tsx` — 3-step builder; add Step 4; restructure Step 2 into dept accordions for multi-dept.
- `/Users/amgedalmogahed/Documents/LUBB/Clients/Abak/ABAK_ERP/packages/web/src/app/[locale]/(dashboard)/quotes/[id]/page.tsx` — add «المستند» tab + «النسخ المُصدَرة» rail; `send` primary already here.
- `/Users/amgedalmogahed/Documents/LUBB/Clients/Abak/ABAK_ERP/packages/api/src/modules/quotes/quotes.service.ts` — `send()` at line 642 (extend to issue PDF), `create:95`, `revise:857`.
- `/Users/amgedalmogahed/Documents/LUBB/Clients/Abak/ABAK_ERP/packages/web/messages/{ar,en}.json` — `quotePdf` namespace at en.json:957; add `document.*` keys.
- `/Users/amgedalmogahed/Documents/LUBB/Clients/Abak/ABAK_ERP/docs/specs/RFQ_SALES_TECH_SPLIT_2026_06_03.md` — the process this document is the output of (multi-dept Quote, sales-owned send/outcome).

**Two flagged build decisions (design-affecting, not design-resolvable):** (a) the **PDF engine** — recommend server-side headless Chromium rendering the _same_ `<QuoteDocument mode="pdf"/>` so issued == previewed; do NOT add a parallel react-pdf template (guaranteed drift). (b) **`<Paginator/>` for screen mode** needs a height-measuring pass; print mode can lean on CSS `break-inside` (already present) but screen thumbnails/jump-to-page require measured pagination — this is the one genuinely hard component.

---

# PART D — Process integration

I have complete grounding. Now I'll write the specification. This is the deliverable — I'll return it as my final message (markdown), not write a file.

Let me produce the comprehensive spec.

---

# Price-Offer Document & Template Builder — Process Integration Spec

**Date:** 2026-06-04 · **Status:** Proposed direction, pending build
**Anchors to:** `docs/specs/RFQ_SALES_TECH_SPLIT_2026_06_03.md` (the RFQ→Quote seam, phases P1–P4), `MVP_SCOPE.md` (4-module contract, addendum protocol), the existing Quotations module (`packages/api/src/modules/quotes/*`, `packages/web/src/app/[locale]/quotes/[id]/print/page.tsx`), and the settings layer (`packages/api/src/modules/settings/*`, `prisma/schema.prisma`).

> **Scope flag (read first):** A full visual template builder with image-upload page-blocks and per-department variants is **addendum territory** under `MVP_SCOPE.md` §"Hidden but built" / §"Explicitly out of scope" — it introduces a new admin sub-surface and a new permission, which the "pragmatic exception" clause explicitly does _not_ absorb. The MVP-safe slice (org content settings + default template seed + the as-issued snapshot) **does** qualify because it only hardens the already-contracted Quotations PDF. This spec therefore splits every section into **MVP-safe** vs **Addendum** so the owner can sign off the boundary. This honours the "Configurable Everything" rule _within_ the contract envelope rather than against it.

---

## 0. Grounding — what exists today (verified in code)

| Fact                                                                                                                                                                                      | Location                                                             | Consequence for this spec                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| The "PDF" is a single continuous client-rendered HTML flow printed via `window.print()`; **no PDF lib in deps**, no artifact captured                                                     | `quotes/[id]/print/page.tsx` (one file, 654 L)                       | "PDF-issued" = render this React tree server-or-client side → real PDF; nothing is persisted at send today                          |
| Line items already group by department when any `QuoteItem.departmentId` is set; single-dept renders ungrouped                                                                            | `print/page.tsx:323-407` (`groupByDepartment`)                       | Multi-department scope tables are **already half-built**; the model gap is page composition, not grouping                           |
| `methodologyCard` + `ganttBlock` per line item already render pages 5 & 6                                                                                                                 | `print/page.tsx:465-579`, schema `:950-984`                          | Page-blocks 5 & 6 are data-bound and present; blocks 1,2,4,7,8 are the gap                                                          |
| `Quote.send()` just flips status → `SENT`, sets `sentAt`; **no document snapshot**                                                                                                        | `quotes.service.ts:642-671`                                          | The "lock + issue" step has no home yet — this is the natural insertion point                                                       |
| Settings are a key/value store (`SystemSetting`, seeded via `systemSetting.createMany`), plus one **structured singleton table** precedent (`PricingPolicy`, id `default-policy`)         | `settings.service.ts`, `pricing-policy.service.ts:19`, `seed.ts:251` | Org content → key/value JSON settings; the template definition → a structured table mirroring the `PricingPolicy` singleton pattern |
| Permissions are DB rows (`Permission` model) seeded by `mk(key, scopeable, desc)`; `settings:manage_pricing_policy` already exists as the "global, non-scopeable, admin config" archetype | `seed-rbac.ts:35,91`, `schema.prisma:2127`                           | A new `settings:manage_quote_template` perm follows an established pattern exactly                                                  |
| Uploads have a home: `FileAsset{url, ownerResource, ownerResourceId}`                                                                                                                     | `schema.prisma:1888`                                                 | Image page-blocks (cover bg, About image, Thank-You image) attach here — no new storage concept needed                              |
| The RFQ→Quote seam is `startPricing(rfqId)` → creates DRAFT Quote with one `QuoteItem.departmentId` section per `requestedCategoryIds`; quote owns send/approve/outcome                   | split spec §4, §9-P1                                                 | The document is assembled **on top of** that already-multi-dept quote; no new data plumbing for multi-dept                          |

---

## 1. Ownership & placement (capability → screen → permission)

Two homes, mirroring the PricingPolicy precedent (org config in Admin, per-instance work in the module):

| Capability                                                                                                                                                             | Screen                                                          | Permission                                                                                                       | Storage                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **Org content**: bank details, About/"Who we are", services blurbs, accreditations, contact bar, default T&C boilerplate, default validity days, installment templates | `/admin/quote-template` (new tab under Admin → System settings) | **MVP:** `settings:manage` (reuse)                                                                               | `SystemSetting` JSON keys (§5)   |
| **Template definition**: ordered page-block list, on/off per block, image-vs-data-bound per block, uploaded static images, per-dept variants                           | `/admin/quote-template` (same screen, "Layout" panel)           | **Addendum:** new `settings:manage_quote_template` (non-scopeable, archetype = `settings:manage_pricing_policy`) | new `QuoteTemplate` table (§5)   |
| **Author per-quote doc fields** (title/scope/greeting/site location/area, per-dept scope text, methodology, gantt, milestones, exclusions, notes)                      | `/quotes/new` builder + `/quotes/[id]` edit                     | `quote:build` (reuse) — scopeable                                                                                | `Quote` + `QuoteItem` (existing) |
| **Preview the assembled document**                                                                                                                                     | `/quotes/[id]/print` (existing)                                 | `quote:view` (reuse)                                                                                             | render-time assembly             |
| **Lock + issue PDF**                                                                                                                                                   | action on `/quotes/[id]` at Send                                | `quote:send` (reuse)                                                                                             | snapshot artifact (§2)           |
| **See the doc in approval review**                                                                                                                                     | `/quotes/[id]` approvals panel                                  | `quote:approve` (reuse)                                                                                          | render-time preview              |

**"Configurable Everything" check:** satisfied. Org content + layout become admin-configurable like every SLA/threshold. The MVP-safe slice already delivers configurability of _content_ (bank, about, T&C, validity) via existing `settings:manage`; the _layout/image_ configurability is the addendum increment. No capability is hardcoded that the rule requires configurable — the boundary is purely about how much builder UI ships in v1.

---

## 2. Lifecycle tie-in (assemble → preview → lock → issue) + versioning

Mapped onto the split spec's RFQ→Quote→approve→send→outcome chain:

```
RFQ accepted ──startPricing──▶ DRAFT Quote (N dept sections)        [split spec §4]
                                   │  pricer authors doc fields      quote:build
   ASSEMBLE  ◀── render-time: template(default or dept-variant) + org content + quote data
                                   │  [Preview] any time             quote:view  → /quotes/[id]/print
   submit_approval ─▶ PENDING_APPROVAL  approver sees same preview   quote:approve
   decideApproval  ─▶ APPROVED
   ─────────────────────────── ⬇ THE LOCK POINT ───────────────────────────
   send ─▶ SENT:  (a) freeze template snapshot onto the quote        quote:send
                  (b) render → PDF → persist as FileAsset
                  (c) set sentAt  (existing)
   accept/reject/postpone ─▶ outcome (PDF already frozen)
```

- **Assemble** is **render-time**, not a stored build step — the print route composes `template ⊕ orgContent ⊕ quote` on every view. This keeps DRAFT quotes live-editable with zero extra write path and means blocks 1/2/4/7/8 light up the instant org content + template exist.
- **Lock** happens **at `quote:send`**, not at approval. Rationale: approval can bounce to `IN_REVISION` and re-price; locking earlier would freeze a doc that still changes. The thing the client receives is the thing that gets frozen — send is that moment. `quotes.service.send()` (`:642`) is the exact insertion point (today it only flips status).

### Versioning recommendation (the in-flight template-change question)

**As-issued snapshot wins.** When admin edits the template or bank/about content, **already-SENT quotes must not visually mutate** — the client holds a PDF that must reconcile. Two-layer guarantee:

1. **Definition versioning** — `QuoteTemplate` carries an integer `version`; every admin save increments it and writes a `QuoteTemplateHistory` row (mirror `SettingHistory`, `schema.prisma:213`). Org-content settings already get free history via the existing `SettingHistory` write in `settings.service.update` (`:52`).
2. **Per-quote snapshot** — at `send`, copy the **resolved** `{templateVersion, blockConfig, orgContentSnapshot}` into a JSON column `Quote.issuedTemplateSnapshot` (+ the rendered PDF `FileAsset`). The print route reads: _if `issuedTemplateSnapshot` is set → render from snapshot; else → render from live template._

Result: DRAFT/PENDING quotes always reflect the **current** template (so a mid-flight admin fix benefits them); SENT/WON/LOST quotes are **immutable as-issued**. This matches the project's "Full Traceability" rule and the existing PricingPolicy/`SettingHistory` audit posture.

---

## 3. Who does what (RACI on the document)

| Step                                                         | Actor (role)                             | Permission                                    | Surface                                                          |
| ------------------------------------------------------------ | ---------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------- |
| Configure layout/images/per-dept variants                    | Admin / Super Admin                      | `settings:manage_quote_template` _(addendum)_ | `/admin/quote-template`                                          |
| Configure org content (bank/about/T&C/validity/installments) | Admin                                    | `settings:manage` _(MVP)_                     | `/admin/quote-template`                                          |
| Author per-quote fields + per-dept scope/pricing             | Engineer / Pricer (Lead Pricer compiles) | `quote:build`                                 | `/quotes/new`, `/quotes/[id]`                                    |
| Preview during build                                         | Pricer                                   | `quote:view`                                  | `/quotes/[id]/print`                                             |
| Review the assembled doc in approval                         | Mgr → Director → CEO                     | `quote:approve`                               | `/quotes/[id]` approvals                                         |
| Lock + issue PDF + send                                      | Sales Person / Manager                   | `quote:send`                                  | `/quotes/[id]` (Sales "My Requests" Quote card, split spec §6.1) |
| Record outcome                                               | Sales                                    | `quote:set_outcome`                           | Sales tracker                                                    |

**Reuse, don't invent:** every per-quote and lifecycle action reuses an existing scopeable permission (`quote:build/view/send/approve/set_outcome`, all in `seed-rbac.ts:59-64`). **Exactly one** new permission is introduced — `settings:manage_quote_template` — and only for the addendum layout-builder. MVP org content rides on existing `settings:manage`. This keeps the new-permission count at the floor the `MVP_SCOPE.md` pragmatic-exception clause tolerates (0 for MVP, 1 for the signed addendum).

---

## 4. Data flow (RFQ categories → dept sections → document)

```
Rfq.requestedCategoryIds[]  (ServiceCategory ids = departments)   schema.prisma:1114
        │  startPricing()  (split spec §4)
        ▼
Quote.items[].departmentId  — one section per involved category   schema.prisma:922
        │  pricer builds per section (qty/unit/unitPrice + optional methodology/gantt)
        ▼
RENDER assembles, per page-block:
  Block 3 SCOPE   → groupByDepartment(items)  → one table + subtotal per dept,
                     then COMBINED grand total (subtotal/VAT15/total)   [grouping exists :384]
  Block 5 METHOD  → items[].methodologyCard, grouped by dept            [:465]
  Block 6 GANTT   → items[].ganttBlock, dept tone = categoryTone        [:518]
  Block 4 PAYMENT → paymentMilestones[] + org bank settings             [:581]
  Blocks 1/2/7/8  → org content settings (+ quote.title, client, ref)   [NEW]
```

- **Per-department pricing variance** (e.g. Supervision priced **per visit**: `qty = N visits × unitPrice/visit`; others lump-sum) needs **no model change** — the `QuoteItem{quantity, unit, unitPrice}` triple already expresses it; the document presents it correctly because the dept group renders qty/unit/unitPrice columns (`:440-454`). The only addition: let a **per-dept template variant** choose a pricing-presentation mode (`per_unit` shows the qty×unit column prominently; `lump_sum` collapses it). Addendum-tier polish, not blocking.
- **"Documents required from the client" (Block 7)** is **distinct from** `RfqDocRequest` (`schema.prisma:1223`). Disambiguation to bake into the spec:
  - `RfqDocRequest` / `RfqSiteVisitRequest` = the **engineer→sales internal ask** _during pricing_ ("I need the soil report to price this"), answered in Sales "My Requests" (split spec §4, §6.1). Operational, transient, resolves to `RESOLVED`.
  - Block 7's "Documents required from client" = a **client-facing deliverable checklist** of what the client must furnish _to start the won project_ (IDs, title deeds, prior drawings). It is **boilerplate-with-overrides**: default list from org settings (`quote.template.docs_required_default`), optionally edited per quote into `Quote.clientNotes`-adjacent field. They may overlap in content but have different lifecycles and audiences — do **not** auto-populate Block 7 from open `RfqDocRequest`s (that would leak internal workflow into a client document).

---

## 5. Settings introduced (admin-configurable)

**MVP-safe (key/value `SystemSetting`, JSON type, `editableByRoles:['SUPER_ADMIN','ADMIN']`, seeded in `seed.ts:251` `createMany`, category `quote_template`):**

| Key                                    | Type   | Drives                                                                |
| -------------------------------------- | ------ | --------------------------------------------------------------------- |
| `quote.org.bank_details`               | JSON   | Block 4 banking bar `{bankName, accountHolder, iban}`                 |
| `quote.org.about`                      | JSON   | Block 2 "Who we are" `{ar, en}` paragraphs                            |
| `quote.org.services`                   | JSON   | Block 2 2×2 service cards                                             |
| `quote.org.accreditations`             | JSON   | Block 2 "Accredited & registered with" list                           |
| `quote.org.contact`                    | JSON   | Block 2/8 contact bar `{web, email, address, phone}`                  |
| `quote.template.tnc_default`           | JSON   | Block 7 General Terms boilerplate `{ar, en}`                          |
| `quote.template.docs_required_default` | JSON   | Block 7 client-docs checklist default                                 |
| `quote.template.installment_presets`   | JSON   | Block 4 disbursement presets (e.g. `[50,20,20,10]` with trigger text) |
| `quote.template.validity_days_default` | NUMBER | default `validUntil` offset                                           |

These ride entirely on the existing `SettingsController` (`PATCH /admin/settings/:key`, `settings:manage`) + `SettingsService.update` history — **zero new backend code**, just seed rows + an admin form panel.

**Addendum (structured singleton table, `PricingPolicy` pattern, `settings:manage_quote_template`):**

```
QuoteTemplate (id 'default-template' singleton; optional per-dept rows keyed by departmentId)
  version Int
  blocks  Json   // ordered [{type:'COVER', enabled, mode:'data'|'image', imageFileAssetId?}, ...]
  departmentId String?  // null = org default; set = per-dept variant
QuoteTemplateHistory (mirror SettingHistory)
```

- image page-blocks resolved via `FileAsset{ownerResource:'quote_template', ownerResourceId}` (`schema.prisma:1888`).
- `Quote.issuedTemplateSnapshot Json?` and a `Quote ⇄ FileAsset` (issued PDF) for the §2 lock.

---

## 6. Migration & backward-compat

1. **Default-template seed** (idempotent migration) creates `QuoteTemplate{id:'default-template', version:1, blocks:[all 8 in canonical order, blocks 2/7/8 enabled+mode:'data' with empty org content allowed]}` — exactly like `PricingPolicy.getOrCreate()` (`:46`) self-heals if absent. **Nothing breaks if the table is empty** because the render path defaults to "all blocks, data-bound."
2. **Graceful-degradation render rule:** each block renders **only if its data exists** — the print page already does this (`MethodologySection` returns `null` when no card, `:471`; `GanttSection` `:523`; scope grouping only when a `departmentId` is present, `:327`). Extend the same guard to new blocks: no bank setting → skip the banking bar; no About content → skip Block 2. So a **legacy quote with no template, no org content, no dept ids renders today's continuous flow unchanged** — Blocks 1/2/4/7/8 simply don't appear until configured. This is the backward-compat guarantee.
3. **Existing SENT/WON quotes:** never re-rendered through the new model — `issuedTemplateSnapshot` is null for them, and the print page treats null-snapshot historical quotes as "live render with whatever exists," which for them is the legacy flow. No backfill required; no client-visible change.
4. **i18n:** new block labels are ar/en JSON in `packages/web/messages/*` under a `quoteDoc.*` namespace (Arabic-primary, matching `quotePdf.*` already in those files).

---

## 7. Build phasing (dovetailed with the RFQ-split P1–P4)

The split spec's phases own the RFQ→Quote wiring; this document's work slots **after the seam exists** and is mostly additive:

| Phase                                | Depends on                    | Work                                                                                                                                                                                                                                                                                            |
| ------------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1 (split)**                       | —                             | `startPricing` → multi-dept DRAFT Quote (split spec §9-P1). **Prereq** — sections must exist before the doc can present per-dept scope.                                                                                                                                                         |
| **D0 — MVP org content**             | split P1 done                 | Seed the 9 `quote_template` `SystemSetting` keys; build the `/admin/quote-template` content form (reuses `settings:manage`); wire Blocks 1/2/4/7/8 into the print page reading those settings with graceful-skip. **Ships inside MVP** (no new perm, no new route concept beyond an Admin tab). |
| **D1 — Real PDF + lock**             | split P2 (Sales send surface) | Add server render → PDF (pick a lib; none in deps today) + persist `FileAsset`; snapshot `issuedTemplateSnapshot` in `quotes.service.send()` (`:642`). Closes the split spec's stated need: _"SEND to client (needs a real PDF)."_                                                              |
| **D2 — Template builder (ADDENDUM)** | D0, D1, signed addendum       | `QuoteTemplate`/`History` tables, `settings:manage_quote_template` perm, block on/off + reorder UI, image page-blocks (cover bg, About image, Thank-You image via `FileAsset`), per-dept variants, pricing-presentation mode.                                                                   |

**Recommended order:** finish split **P1** (sections) → **D0** (org content, the highest value-per-effort and MVP-legal) → split **P2/P3** (send/workbench surfaces) → **D1** (real PDF + lock, pairs with the send surface) → **D2** only on a signed addendum.

**The one decision to put in front of the owner now:** D2 (the visual builder with image-blocks and per-dept variants) is an **addendum item** per `MVP_SCOPE.md` Article 10 — it adds a route concept, a new permission, and an upload-management surface. D0+D1 deliver a fully data-driven 8-page bilingual quote with bank details, about page, amount-in-words, real PDF, and as-issued locking **within the contracted Quotations module**. Recommend shipping D0+D1 in MVP and scoping D2 as the first paid addendum.

---

## Key file anchors for the implementer

- Print/assembly: `/Users/amgedalmogahed/Documents/LUBB/Clients/Abak/ABAK_ERP/packages/web/src/app/[locale]/quotes/[id]/print/page.tsx` (dept grouping `:384`, methodology `:465`, gantt `:518`, milestones `:581`)
- Lock point: `/Users/amgedalmogahed/Documents/LUBB/Clients/Abak/ABAK_ERP/packages/api/src/modules/quotes/quotes.service.ts:642` (`send`)
- Settings pattern: `/Users/amgedalmogahed/Documents/LUBB/Clients/Abak/ABAK_ERP/packages/api/src/modules/settings/settings.service.ts` · seed `/Users/amgedalmogahed/Documents/LUBB/Clients/Abak/ABAK_ERP/prisma/seed.ts:251`
- Structured-config precedent: `/Users/amgedalmogahed/Documents/LUBB/Clients/Abak/ABAK_ERP/packages/api/src/modules/settings/pricing-policy.service.ts:19,46`
- Permission seed: `/Users/amgedalmogahed/Documents/LUBB/Clients/Abak/ABAK_ERP/prisma/seed-rbac.ts:35,91` (add `mk('settings:manage_quote_template', false, ...)`)
- Schema: `/Users/amgedalmogahed/Documents/LUBB/Clients/Abak/ABAK_ERP/prisma/schema.prisma` — `Quote:806`, `QuoteItem.departmentId:922`, `SystemSetting:178`, `SettingHistory:213`, `FileAsset:1888`, `PricingPolicy:1983`, `Rfq.requestedCategoryIds:1114`
- Constraint docs: `MVP_SCOPE.md` (addendum protocol), `docs/specs/RFQ_SALES_TECH_SPLIT_2026_06_03.md` §4/§9 (the seam + phases)
