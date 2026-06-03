# RFQ Split + Price-Offer — Build Roadmap & Checklist

**Date:** 2026-06-04 · **Owner:** Abdullah
**Specs:** `RFQ_SALES_TECH_SPLIT_2026_06_03.md` (+detailed), `PRICE_OFFER_DOCUMENT_2026_06_04.md` (+detailed).
Every item below is dependency-ordered. `[ ]` todo · `[x]` done · **(P1)** blocks build.
Acceptance = the one check that proves it's done.

---

## EPIC 0 — Foundations & decisions (unblock everything)

- [x] **BUG-1** Fix live `OPEN→PENDING` enum mismatch in `rfq-requests-panel.tsx` (+ web type
      `use-rfq-assignments.ts:123`). _Done 2026-06-04 — doc/site-visit requests now render & resolve._
- [x] **GRAIN-1** Resolve category-vs-department grain → **per real `Department`** (owner D5).
      _Done — see split spec §14._
- [ ] **UP-1 (P1)** Upload pipeline: multipart endpoint + storage target (disk volume or S3 SDK).
      Today `FilesService.register()` only writes a `FileAsset` row from a URL. _Accept:_ an image
      uploaded from the browser is stored and served back by URL.
- [ ] **PDF-1 (P1)** PDF-gen infra spike: `playwright-core` + `@sparticuz/chromium`, server render
      token, server-trusted data fetch (or SSR the print route), `print-color-adjust:exact`, self-hosted
      fonts. _Accept:_ an API call returns a multi-page A4 PDF of a real quote with backgrounds intact.
- [x] **AIW-1 (P1)** Amount-in-words util in `packages/shared`, AR + EN, halalas, tested.
      _Accept:_ 851,000.00 SAR → vetted Arabic + English strings in unit tests.
      _Done 2026-06-04 — `amountInWords()` in `shared-utils`; 10 `node:test` cases green via `nx test shared-utils`._
- [x] **MON-1 (P1)** One localized money formatter; DECIDE Latin vs Arabic-Indic digits and apply
      everywhere (replaces hardcoded `toLocaleString('en-US')` in `print/page.tsx:648`).
      _Done 2026-06-04 — DECISION: **Latin (Western) digits** on client quotes (Saudi
      commercial/bank/invoice convention; PDF-font-safe; no English-export drift). `print/page.tsx`
      now routes money + qty/%/day-offsets through `shared-utils` `formatNumber`; hardcoded
      `toLocaleString` removed._

---

## EPIC 1 — Data model: thin RFQ, Quote owns the lifecycle

- [ ] **DM-1 (P1)** Collapse `RfqStatus` → `SUBMITTED·ASSIGNED·PRICING·CANCELLED·DECLINED` (+ migration
      mapping old→new). _Accept:_ migration runs; no code writes the removed states.
- [ ] **DM-2 (P1)** `deriveRfqDisplayStatus(rfq.quote.status)` mapper → QUOTE_READY/SENT/CLOSED in
      list + detail serializers (no second write).
- [ ] **DM-3 (P1)** New `QuoteDepartmentSection` (departmentId→Department, pricerId, scopeText,
      status DRAFT/SUBMITTED*TO_LEAD, isLead) + `QuoteItem.sectionId` + `QuoteRequirement`
      (type, text, isShared, dedupedFromIds). \_Accept:* a multi-dept quote has one section per Department.
- [ ] **DM-4 (P1)** `startPricing(rfqId)` — single atomic tx: fold categories→Departments, create
      assignment rows + Draft Quote + one section per Department, set `rfq.quoteId`+status=PRICING,
      return quoteId. Idempotent; `leadId` null-safe (client-only opportunity). _Accept:_ double-click
      creates exactly one quote; client-only opp doesn't throw.
- [ ] **DM-5 (P1)** `declineRfq(rfqId,{type,reason,suggestedCategoryIds})` → status=DECLINED, notify sales.
- [ ] **DM-6 (P1)** `POST /rfqs/:id/reroute` (perm `rfq:request`, requires DECLINED+WRONG_DEPT): new
      `requestedCategoryIds`, clear decline fields, status→SUBMITTED, re-fire inbox routing.
- [ ] **DM-7 (P1)** Move submit/approve/send/outcome OFF RFQ → Quote; delete dead `linkQuote` +
      orphan `markApproved`.
- [ ] **DM-8 (P1)** Fix `revise()` (`quotes.service.ts:857`): repoint `rfq.quoteId` to the new version
      (FK `@unique`), carry `departmentId`/`sectionId`/`methodologyCard`/`ganttBlock`. _Accept:_ regression
      test asserts `rfq.quoteId === latest revision` and sections survive a revision.
- [ ] **DM-9 (P1)** `submit()` validation: reject if any section subtotal ≤ 0, if
      `paymentMilestones.length === 0`, or `totalAmount ≤ 0`; surface missing-section list.
- [ ] **DM-10 (P1)** Re-home broker `Commission` onto `accept()`; resolve RFQ via repointed quoteId;
      once-per-RFQ guard (no double-accrual on reopen).
- [ ] **DM-11 (P1)** Extend `QUOTE_INCLUDE` (`quotes.service.ts:46`): `department.order` +
      `rfq.assignments{departmentId,isLeadPricer}` for lead-dept ordering; null-safe for manual quotes.
- [ ] **DM-12 (P1)** Permissions: split `rfq:request_site_visit` from `rfq:request_docs`; gate
      respond/resolve by `rfq:request` (sales); add `company_profile.manage` (SUPER_ADMIN); seed-rbac.
- [ ] **DM-13 (P2)** Add `accessContactName`/`accessContactPhone` to `RfqSiteVisitRequest`.
- [ ] **DM-14 (P2)** Un-accept / return-to-triage (DRAFT quote + no priced items → delete draft, null
      quoteId, status→SUBMITTED).

---

## EPIC 2 — Sales "My Requests" surface

- [ ] **SALES-1** List rebuild: urgency-sorted ("Needs you · N"), mobile stacked cards, `<DataState>`
      empty/error, `<RequestPhaseBadge>`. Remove coordinator/priority/source columns.
- [ ] **SALES-2** Tracker: strip the 5-tab board to a single-scroll tracker (timeline → asks →
      summary → quote). Delete Team tab + assign/prep/submit/dispatch controls.
- [ ] **SALES-3** `<OpenAsksCard>` responder (the net-new): doc upload (needs UP-1) + site-visit
      confirm with access contact. Replaces the `window.prompt` scheduler.
- [ ] **SALES-4** Quote card: review → `Send to client` → `Won/Lost/Postpone` (maps to quote actions).
- [ ] **SALES-5** Re-route UI after decline (shows decline reason, edit services, resubmit → DM-6).
- [ ] **SALES-6 (P2)** Client-silent sub-state (IN_DISCUSSION/IN_NEGOTIATION) or explicit "log reply".

---

## EPIC 3 — Quotations pipeline (department surface, inside `/quotes`)

- [ ] **QP-1** `<QuotationsShell>`: board / list / my-queue modes; fold existing `/quotes` list + KPIs in.
- [ ] **QP-2** Incoming column + `<IncomingRfqCard>` + SLA timer (red > 4 biz hrs).
- [ ] **QP-3** `<AcceptAssignSheet>` (the seam): per-Department rows, one ⭐ Lead, confirm → DM-4.
      Handle the accept-race (P2): if quoteId set between open & confirm, tell manager B.
- [ ] **QP-4** `<DeclineRfqDialog>` (wrong-dept → suggest re-route; no-bid → reason) → DM-5.
- [ ] **QP-5** Pricing column + `<DraftQuoteCard>` + section progress ("2/3 sections submitted").
- [ ] **QP-6** **Lead Reviewer compile view** (split spec §14): all sections side by side, dedup shared
      requirements/notes, request-revision a section, submit gate (all sections SUBMITTED_TO_LEAD).
- [ ] **QP-7** Re-site the raise doc/site-visit panel into Pricing (now `PENDING`-correct after BUG-1).
- [ ] **QP-8 (P2)** Pricing-column staleness signal (accepted-but-never-opened drafts).
- [ ] **QP-9 (P2)** Un-accept UI → DM-14.
- [ ] **QP-10** In-approval / Sent / Closed columns map to `QuoteStatus`.

---

## EPIC 4 — Price-offer document (the renderer)

- [ ] **DOC-1** Models: `QuoteTemplate`, `QuoteTemplateSection` (sectionType + bindingType),
      `QuoteAsset`, `CompanyProfile` + `CompanyProfileHistory`. Seed the default 8-block template so
      existing quotes still render.
- [ ] **DOC-2** `Quote.renderManifest` snapshot-on-issue (as-issued rendering). Key artifact by
      `Quote.id` (version row), not (quoteId,version); `revise()` starts fresh.
- [ ] **DOC-3 (P1)** Rebuild `print/page.tsx` as 8 paged blocks: per-section (Department) fan-out for
      scope/methodology/timeline; **pre-VAT per-dept subtotals → one combined discount+VAT+grand-total
      band** (per blocker #2); pagination (break-before, running header/footer, page counters), RTL.
- [ ] **DOC-4** Per-quote authored fields (subject, greeting/intro, site location + area, validity,
      per-section scope text, documents-required list) on the new `QuoteDocument`/Quote columns.
- [ ] **DOC-5 (P2)** Per-visit caption driven from the LINE (`item.unit` e.g. "زيارة"), not a dept flag.
- [ ] **DOC-6 (P2)** VAT/currency single source: `PricingPolicy` → snapshot `Quote.taxRate` at
      create/recompute; doc reads the snapshot. Kill the 3-source drift.
- [ ] **DOC-7 (P2)** Block-7 "documents required from client" = client boilerplate-with-overrides,
      NEVER auto-populated from `RfqDocRequest` (the internal engineer→sales asks).

---

## EPIC 5 — Template builder + per-quote document UX

- [ ] **TB-1** Admin template builder: `<SectionRail>` (reorder/toggle) + `<TemplatePreview>` (live A4)
  - `<SectionConfigPanel>`. Version / set-default / duplicate.
- [ ] **TB-2** Company Profile settings page (about/services/accreditations/contact + **bank behind
      `company_profile.manage` + audit**). Split from template editing.
- [ ] **TB-3** `<PageImagePicker>` for cover/about/thankyou/image-page (needs UP-1).
- [ ] **QD-1** Per-quote Document step (4th wizard step + persistent tab): authored fields, template
      selection, per-quote page on/off, insert image page.
- [ ] **QD-2** Live A4 multi-page preview (one renderer, two consumers: preview + print).
- [ ] **QD-3** Send → generate `IssuedPdf` (needs PDF-1 + UP-1), store immutable, attach to dispatch.

---

## Suggested execution order

1. **EPIC 0** spikes in parallel (UP-1, PDF-1, AIW-1, MON-1) — independent, unblock the rest.
2. **EPIC 1** data model (DM-1..14) — the backbone; DM-3/DM-4 + the revise/submit fixes first.
3. **EPIC 3** (department pipeline) and **EPIC 2** (sales) on top of EPIC 1.
4. **EPIC 4** renderer, then **EPIC 5** builder + per-quote doc UX.

Counts: **P1 = 19** · P2 = 14 · other = ~12. (BUG-1, GRAIN-1 done.)
