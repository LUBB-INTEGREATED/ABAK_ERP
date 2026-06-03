# RFQ Sales/Technical Split — Restructure Spec

**Date:** 2026-06-03
**Status:** Approved direction (Option A), pending build
**Supersedes (in part):** the single-screen `/rfqs/[id]` model. Dovetails with
`docs/specs/RFQ_ROUTING_AND_RBAC_REMAINING_IMPLEMENTATION_2026_06_02.md`.
**Source of intent:** `docs/CORRECTED_CLIENT_JOURNEY.md`, `docs/flows/a3-rfq-assignment.md`,
owner statement 2026-06-02 (multi-select services → dept routing → Lead Pricer).

---

## 1. Problem (validated against code)

One `Rfq` object wears **three hats**, mixed at three layers:

1. **Screen** — `rfqs/[id]/page.tsx` is a 772-line, 5-tab mega-screen
   (Overview/Team/Requests/Quote/Outcome) shown **identically to every role**.
   No role/permission/scope check exists inside the detail view; visibility is
   gated only by `rfq.status`. A sales rep sees _Assign coordinator / Assign
   pricers / Lead Pricer ⭐ / Start preparation / raise doc request / record
   outcome_ — none of which is sales' job. Action buttons are **duplicated**
   (header lines 124-165 AND Overview tab 317-386). The one button that should
   exist — **"prepare price offer"** — exists **nowhere**; the Quote tab is
   read-only and `quotes/new` accepts no `rfqId`.

2. **State machine** — `RfqStatus` (10 states, `schema.prisma:1275-1286`)
   duplicates `QuoteStatus` (14 states, `schema.prisma:875-890`). Two machines,
   one reality, never synced. `rfqs.service.ts:378` (RFQ→WON) and
   `quotes.service.ts:676` (Quote→WON) don't touch each other.

3. **Data model** — `Rfq.quoteId` is written **only** by `linkQuote()`
   (`rfqs.service.ts:434`), which has **no route and no caller** (dead). Yet
   `submitForApproval` (`rfqs.service.ts:323`) _requires_ `rfq.quoteId`, so the
   RFQ lifecycle is **structurally un-finishable from the UI**.

Spec already prescribes a **two-sided model** (Sales = originator; Department =
triage+price) with the boundary: _"RFQ ends at pricer-assigned; Quotation begins
at the quote builder; one Quote per RFQ."_ Code drifted from its own spec.

---

## 2. Target architecture — two role surfaces over a thin RFQ + the existing Quote

```
SALES · "My Requests"          DEPARTMENT · "Pricing Workbench"
(RFQ as tracking ticket)       (RFQ as work to triage + Quote to build)
  ┌──────────────────────┐       ┌─────────────────────────────┐
  │ ● Submitted          │       │ Inbox (routed by service →   │
  │ ● Assigned           │       │        my department)        │
  │ ◐ Pricing…           │       │  [Accept] [Assign ⭐ pricer] │
  │ ○ Quote ready        │       │ My pricing queue             │
  │ — Eng needs: soil rpt│       │  [Open price offer → Draft]  │
  │   [Upload]           │       │  [Req docs] [Req site visit] │
  │ — Site visit? [Pick] │       │  [Submit for approval]       │
  │ [Send] [Won/Lost]    │       └─────────────────────────────┘
  └──────────────────────┘
```

The **draft price offer is NOT a new module** — it is the existing Quotations
module (`/quotes`) in `DRAFT`. The job is to **wire** the handoff and **collapse**
the duplicate RFQ lifecycle.

---

## 3. RFQ state collapse (single source of truth = the Quote)

RFQ owns states only up to the handoff; after a quote exists, the RFQ display
status **derives from the quote**.

| Old `RfqStatus`             | New RFQ state | Owner / source                   |
| --------------------------- | ------------- | -------------------------------- |
| RECEIVED                    | `SUBMITTED`   | RFQ (sales raised)               |
| ASSIGNED                    | `ASSIGNED`    | RFQ (manager assigned pricer)    |
| IN_PREPARATION              | `PRICING`     | RFQ (pricer opened the offer)    |
| PENDING_APPROVAL            | `PRICING`     | derive: quote `PENDING_APPROVAL` |
| APPROVED_READY_FOR_DISPATCH | `QUOTE_READY` | derive: quote `APPROVED`         |
| SENT                        | `SENT`        | derive: quote `SENT`             |
| WON / LOST / POSTPONED      | `CLOSED`      | derive: quote outcome            |
| CANCELLED                   | `CANCELLED`   | RFQ                              |

RFQ keeps a real column only for `SUBMITTED · ASSIGNED · PRICING · CANCELLED`.
`QUOTE_READY / SENT / CLOSED` are computed from `rfq.quote.status` (no second
write). Removes the two-truths bug entirely.

---

## 4. The handoff wiring (the core fix)

**New backend action `startPricing(rfqId)`** (replaces dead `linkQuote` +
`startPreparation`):

- If `rfq.quoteId` is null → create a `DRAFT` Quote (`quotes.service.create`
  pattern, `quotes.service.ts:95`) carrying `clientId`/`leadId` from the RFQ and
  **one department section per involved service category** (`requestedCategoryIds`
  → `QuoteItem.departmentId`, the multi-dept structure from the routing spec).
- Set `rfq.quoteId`, `rfq.status = PRICING`.
- Return `quoteId` → frontend navigates the pricer to the **quote builder**.

**Remove from the RFQ module** (move to the Quote, which already implements them):

- `submitForApproval` / `markApproved` → use `quotes.service.submit` (`:372`) +
  `decideApproval` (`:514`).
- `dispatch` → `quotes.service.send` (`:642`).
- `recordOutcome` (+ its broker `Commission` side-effect) → `quotes.service`
  `accept`/`reject`/`postpone` (`:676/:758/:787`). Re-home the commission accrual
  onto the quote `accept` path.
- Delete `linkQuote` (`:434`, dead) and the orphan `markApproved` (`:354`, no route).

**Doc requests / site-visit requests** (`RfqDocRequest schema.prisma:1223`,
`RfqSiteVisitRequest :1247`) stay on the RFQ but **split by direction**:

- **Raise** (engineer asks) → Department workbench.
- **Respond** (sales answers) → Sales "My Requests" (add the missing responder UI;
  `req.response` is display-only today). Give site visits a dedicated
  `rfq:request_site_visit` permission instead of reusing `rfq:request_docs`.

---

## 5. Role / permission matrix (gates the surface, not just the nav)

| Capability                       | Permission                         | Surface              | Role(s)                |
| -------------------------------- | ---------------------------------- | -------------------- | ---------------------- |
| Create RFQ from lead             | `rfq:request`                      | Sales                | Sales Person           |
| Respond to doc / site-visit ask  | `rfq:request` (responder)          | Sales                | Sales Person           |
| Send quote to client             | `quote:send`                       | Sales                | Sales Person / Manager |
| Record outcome (Won/Lost/Postp.) | `quote:set_outcome`                | Sales                | Sales Person / Manager |
| Triage inbox / accept            | `rfq:assign_pricers` (mgr action)  | Dept Workbench       | Department Manager     |
| Assign pricer / Lead Pricer ⭐   | `rfq:assign_pricers`               | Dept Workbench       | Department Manager     |
| Open price offer → Draft Quote   | `quote:build`                      | Dept Workbench→Quote | Engineer / Pricer      |
| Build draft, request docs/visit  | `quote:build` / `rfq:request_docs` | Quote builder        | Engineer / Pricer      |
| Submit for approval              | `quote:submit_approval`            | Quote builder        | Lead Pricer            |
| Approve                          | `quote:approve`                    | Approvals            | Mgr → Director → CEO   |

**Hard rule:** the detail views render by role, not one mega-screen. Sales never
sees assign/pricing controls; engineers never see send/outcome.

---

## 6. Screens

### 6.1 Sales — "My Requests" (`/rfqs`, `/rfqs/[id]`)

- **List:** my requests; columns = RFQ#, client, services, status pill, last
  update. Empty state: "No requests yet — open a lead and click _Request RFQ_."
- **Detail = a tracker, not a workboard:**
  - Status timeline (Submitted → Assigned → Pricing → Quote ready → Sent → Closed).
  - **Open asks** card: "Engineering needs a soil report" → `[Upload]`; "Site
    visit requested" → `[Pick date / give access contact]`. (The new responder UI.)
  - **Quote** card: once `QUOTE_READY`, review + `[Send to client]`; after sent,
    `[Mark Won]/[Mark Lost]/[Postpone]`.
  - No Team tab, no pricing, no assign controls.

### 6.2 Department — Quotations pipeline (lives INSIDE `/quotes`, owner decision 2026-06-03)

Insight: _"an RFQ once accepted IS a quotation"_ — the accept+assign moment is the
RFQ→Quote seam, so the department's home is **Quotations**, and the RFQ inbox is its
front door. One left→right pipeline, same card moving right (no separate "workbench"):

```
Incoming → Pricing → In approval → Sent → Closed
(RFQ, no   (Draft     (approver     (quote  (Won/Lost/
 quote yet) quote)     chain)        sent)   Postponed)
```

- **Incoming** = RFQs routed to my dept by service category
  (`requestedCategoryIds` ∩ dept services), not yet accepted. SLA timer ⏱ (red > 4
  business hrs, A3). Manager actions: `[Accept & assign ⭐]` → fires `startPricing`
  (creates the linked Draft Quote, card slides to Pricing) · `[Not us / decline]`
  → routes back to sales with a reason (see §8 dec.1).
- **Pricing** = my Draft Quotes. `[Open builder]` (my dept section) ·
  `[Request docs]` · `[Request site visit]` · `[Submit for approval]` (Lead Pricer).
- **In approval / Sent / Closed** = existing `QuoteStatus` lifecycle.
- **One record, two IDs:** pre-accept shows `RFQ-0042`; post-accept the header reads
  `QUO-118 · from RFQ-0042`. The RFQ stays the link target for request context
  (scope, attachments, the doc/site-visit asks); the Quote owns pricing.
- Board (kanban) is the default for managers; pricers can filter to "my queue."

### 6.3 Quotation (`/quotes`) — unchanged module, now reachable

The existing 3-step builder (`quotes/new`) becomes the price-offer surface,
opened **from the workbench with the RFQ pre-linked** (not from a blank client
picker). Multi-dept = one Quote, N `QuoteItem.departmentId` sections; Lead Pricer
compiles.

---

## 7. Migration (in-flight RFQs)

- Map old `RfqStatus` → new per §3 table.
- RFQs in `IN_PREPARATION` with null `quoteId`: create the linked `DRAFT` Quote on
  migration (or lazily on first "Open price offer").
- Preserve legacy assignment fields (coordinator / technical / financial) as
  read-only history; new work uses `RfqAssignment` (`isLeadPricer`).
- Backfill `requestedCategoryIds` for RFQs created via the old
  `RfqsService.create` path (which left it empty → invisible to dept-manager
  category scope).

---

## 8. Open design decisions

0. **RESOLVED 2026-06-03:** the department surface lives **inside Quotations**
   (Incoming → Pricing → Approval → Sent → Closed pipeline), not a separate group.
   Sales "My Requests" stays under the Sales group. The accept+assign action is the
   RFQ→Draft-Quote seam.
1. **RESOLVED 2026-06-03:** Intake has `[Accept & assign ⭐]` AND `[Not us / decline]`
   with a required reason (wrong-dept / no-bid). Declined → routes back to sales "My
   Requests" as needs-re-route, or closed-no-bid. New RFQ sub-state `DECLINED`.
2. **RESOLVED 2026-06-03:** Module label stays **"Quotations"** with an "Incoming"
   tab (no rename). Keep i18n churn minimal.
3. **Send + outcome ownership** — Sales-owned (recommended, matches spec) vs
   coordinator-owned. Affects who closes the loop.
4. **Lead Pricer authority** (a3 OQ#2) — can the Lead Pricer edit/lock a
   co-pricer's submitted section, or only request revision?
5. **Lead Pricer arbitration** (a3 OQ#1) — multi-dept tie: "first manager to
   triage proposes" vs a Sales-Manager arbitration step.

---

## 9. Build phases

- **P1 — Data + wiring (backend):** collapse `RfqStatus`; add `startPricing` →
  Draft Quote with dept sections; move submit/approve/send/outcome to the Quote;
  delete `linkQuote`/`markApproved`; migration. Re-home commission accrual.
- **P2 — Sales surface:** rebuild `/rfqs/[id]` as the tracker; add doc/site-visit
  responder UI; surface quote review/send/outcome.
- **P3 — Department surface:** new Pricing Workbench (inbox + queue); triage,
  assign, Lead Pricer; "Open price offer"; raise doc/site-visit; submit.
- **P4 — Cleanup:** remove duplicated buttons; role-gate nav; delete dead paths;
  dedicated `rfq:request_site_visit` permission.

---

## 10. Code anchors (for the implementer)

- RFQ states: `prisma/schema.prisma:1275-1286` · Quote states: `:875-890`
- RFQ↔Quote FK: `Rfq.quoteId :1135` / `Quote.rfq :859`
- `rfqs.service.ts`: create:56, assignCoordinator:260, startPreparation:310,
  submitForApproval:323, markApproved:354(orphan), dispatch:363, recordOutcome:378,
  linkQuote:434(dead), requireStatus:489, scope 197-243
- `rfq-assignments.service.ts`: createAssignment:95 (auto Lead Pricer),
  updateAssignment:131 (single-lead invariant)
- `quotes.service.ts`: create:95, submit:372, decideApproval:514, send:642,
  accept:676, reject:758, postpone:787, revise:857
- Frontend: `rfqs/[id]/page.tsx` (772L, 5 tabs), `leads/[id]/request-rfq-dialog.tsx`
  (sales create), `quotes/new/page.tsx` (builder, no rfqId today),
  `components/rfqs/pricer-assignments.tsx`, `rfq-requests-panel.tsx`,
  `components/sidebar-nav.tsx` (nav.groupSales)

---

## 11. Detailed surface design

Full screen-by-screen design (sales tracker, quotations pipeline, data/API/migration)
produced by a 4-agent workflow + adversarial critic lives in the companion doc:
**`docs/specs/RFQ_SPLIT_DETAILED_DESIGN_2026_06_03.md`**. Highlights:

- **Sales tracker:** collapse the 10-value `RfqStatus` into ONE rep-facing phase label
  (`<RequestPhaseBadge>`); list is **urgency-sorted by who-owes-the-next-move** ("Needs
  you · N" chip), not date-sorted; detail is a single-scroll tracker (timeline → open-asks
  → request summary → quote card), not a 5-tab board; new `<OpenAsksCard>` is the sales
  responder (attach doc / confirm site visit). Mobile-first.
- **Quotations pipeline:** `<QuotationsShell>` one route, board/list/my-queue modes;
  `<IncomingRfqCard>` + `<AcceptAssignSheet>` (the seam) + `<DeclineRfqDialog>` +
  `<DraftQuoteCard>`; drag scoped Incoming→Pricing only.
- **Data/API:** collapse enum, `deriveRfqDisplayStatus` mapper, `startPricing` +
  `declineRfq` endpoints, removed/moved RFQ-lifecycle methods, migration
  `2026xxxx_rfq_restructure_thin_rfq`, notification matrix.

## 12. Adversarial critique verdict

> Not build-ready as first drafted. The state-machine UX is strong, but **8 P1
> data-integrity/flow blockers** must be fixed before/with implementation. Reconcile the
> Prisma/service deltas and the section-grain vocabulary before any UI work.

## 13. PRE-BUILD BLOCKERS (P1 — fix before/with build)

1. **`revise()` doesn't repoint `rfq.quoteId`** (`quotes.service.ts:857`). A revision is a
   new Quote (version+1); `Rfq.quoteId` keeps pointing at the parent (now `REVISED`), so
   the derived sales tracker shows the STALE parent forever. **Fix:** in the revise() tx,
   `tx.rfq.update({ quoteId: next.id })` (FK is `@unique` → move, don't duplicate) + regression test.
2. **`revise()` drops `departmentId` + methodology/gantt** (copies items at lines ~908-919).
   A revised multi-dept quote loses every department section → the whole per-dept/per-pricer
   structure collapses. **Fix:** carry `departmentId` and re-create `methodologyCard`/`ganttBlock`
   per `create()` (lines 155-177).
3. **`submit()` doesn't validate dept sections are priced** (`:372`). `startPricing` seeds
   zero-price placeholder items, so an all-zero / half-priced multi-dept quote submits into
   approval cleanly; only milestone-sum is checked, and only `if length>0`. **Fix:** reject if
   any `departmentId` section subtotal ≤ 0, reject if `paymentMilestones.length === 0`, reject if
   `totalAmount ≤ 0`; surface the missing-section list to the UI.
4. **Category-vs-Department granularity conflation** (cross-cutting). `requestedCategoryIds`,
   `RfqAssignment.departmentId`, `QuoteItem.departmentId` all reference **ServiceCategory**, not
   `Department`. "One section per department" is really per-category — 3 categories of one team
   render 3 manager rows. **Fix (DECIDE):** (a) fold categories → managing `Department` (via
   `DepartmentService`) and make one section per real Department, OR (b) keep category-grain but
   relabel UI "service line/section", not "department". Do not ship "department" copy over category data.
5. **Broker `Commission` re-home target is wrong** (`accept()` `:697-713`). No broker data in
   scope (`brokerName` lives on `Rfq`); after blocker #1, a won-after-revision quote's `rfq`
   back-relation is null → commission silently skipped. **Fix:** resolve RFQ via the repointed
   `quoteId` (after #1); guard once-per-RFQ by `rfqId` to avoid double-accrual on reopen.
6. **Decline → re-route loop has no backend.** `declineRfq` lacks a `suggestedCategoryIds`; no
   endpoint lets sales fix services + flip `DECLINED → SUBMITTED`. The whole re-route loop is
   undeliverable. **Fix:** add `suggestedCategoryIds String[]`; add `POST /rfqs/:id/reroute`
   (perm `rfq:request`, requires `DECLINED`+`WRONG_DEPT`) that resets routing + re-fires inbox.
7. **PRE-EXISTING LIVE BUG — open-asks feature is dead today.** `rfq-requests-panel.tsx` filters
   `status === 'OPEN'` (lines 91, 92, 184, 344) but the enum is `PENDING/RESOLVED/CANCELLED`
   (`schema.prisma:1269`). Result: open-count badges always 0; `{isOpen && …}` resolve/respond
   controls **never render**. **Fix (surgical, ~4 lines):** replace every `'OPEN'` → `'PENDING'`.
   Highest-leverage correctness fix; prerequisite for the new sales responder.
8. **`startPricing` leadId resolution can crash / mis-link** on a client-only opportunity (no
   lead). **Fix:** optional-chain `opp?.leadId ?? undefined`, never throw; `Quote.leadId` is
   optional; add a client-only-opportunity test through the seam.

### P2 (fix same branch)

- **Accept race** (two managers): on confirm, if `rfq.quoteId` was set between open and confirm,
  don't silently proceed — tell manager B who won the lead, add their pricer to their section.
- **Client-goes-silent** (IN_DISCUSSION/IN_NEGOTIATION) collapses into "Sent" — rep can't tell
  "no reply" from "negotiating". Expose a "Log client reply" action or scope it out explicitly.
- **No staleness on Pricing column** — accepted-but-never-opened drafts sit forever. Add a
  PRICING-age signal (admin-configurable) alongside the Incoming SLA.
- **No un-accept** — a manager who accepted the wrong RFQ (DRAFT created) can't decline. Add
  "return to triage" (DRAFT + no priced items → delete draft, null `quoteId`, status→SUBMITTED).
- **No "sent back for revision" timeline branch** for the rep when approval rejects to PRICING.
- **Responder permission split** — respond/resolve must be gated by `rfq:request` (sales), not the
  raiser perm; verify OWN-scope covers RFQs the rep raised.
- **Site-visit access contact** — `accessContactName/Phone` are net-new; add the two nullable
  columns to `RfqSiteVisitRequest` (don't pack structured data into free-text `notes`).
- **Accept atomicity** — make accept a single server-side tx (assignment rows + quote) with
  upsert-by-`[rfqId, departmentId]`, not N client POSTs then a seam POST.

### P3 (follow-up)

- Dual-ID: print/PDF must show which number to quote the client.
- Pipeline board: keep it scoped (drag Incoming→Pricing only), not a generic 5-col kanban.
- New sales components belong in `components/rfqs/`, not under the route folder.
- Migration: legacy RFQs from old `create()` path have empty `requestedCategoryIds` — backfill.

---

## 14. Multi-department & Lead Reviewer model (resolves D5, owner 2026-06-04)

Owner's model: a multi-dept offer is _"kind of separate offers, mixed"_ — mostly the **scope**
differs per department, each scope on its own page(s); multiple engineers price their own
department; **one is the main lead/reviewer** who reviews the others' details, **dedups shared
requirements & notes**, and **submits** the offer.

This **resolves the grain (blocker #4) → per real `Department`**, not `ServiceCategory`. One
section = one department = one engineer = one scope page. (A department may still contain several
service-category line items inside its one section.)

### 14.1 New structural unit — `QuoteDepartmentSection`

Introduce a first-class section entity (replaces the implicit `QuoteItem.departmentId`=category
grouping):

```prisma
QuoteDepartmentSection {
  id, quoteId, departmentId(→Department), pricerId(→User),
  scopeText, position,
  status: SectionStatus  // DRAFT → SUBMITTED_TO_LEAD
  isLead Boolean         // the section whose pricer is the Lead Reviewer (exactly one true)
}
QuoteItem.sectionId → QuoteDepartmentSection   // items belong to a section
QuoteRequirement { id, quoteId, sectionId?, type(DOC_REQUIRED|NOTE|TERM), text, isShared, dedupedFromIds[] }
```

- Category→Department fold happens once at accept/`startPricing` time (via `DepartmentService`):
  the RFQ's `requestedCategoryIds` resolve to distinct **Departments**; one section per Department.
- `RfqAssignment.isLeadPricer` (already exists) designates the Lead; mirror it onto
  `QuoteDepartmentSection.isLead`.

### 14.2 The Lead Reviewer compile gate (the new process step)

1. **Each engineer** edits ONLY their own section (scope text, line items, methodology, their
   dept's requirements/notes). They cannot price another dept's section. When done they
   **"Submit section to lead"** (`SectionStatus.SUBMITTED_TO_LEAD`) — NOT to approval.
2. **The Lead Reviewer** gets a **compile view**: all sections side by side. They:
   - review co-pricer sections (read; request-revision sends a section back to DRAFT);
   - **dedup requirements & notes** — each dept may list "client must provide CR / title deed /
     soil report"; the lead merges duplicates into the shared Requirements page (doc page 7),
     marking `isShared`/`dedupedFromIds`;
   - reconcile offer-level fields (payment schedule = 100%, validity, combined total).
3. **Submit for approval** is enabled **only when every section is `SUBMITTED_TO_LEAD`** and only
   the Lead can fire it (`quote:submit_approval`). This replaces "any pricer submits".

### 14.3 Effect on the document (one offer per RFQ)

- **Per-department** (fan out): SCOPE_PRICING (own page[s]), METHODOLOGY, optionally TIMELINE.
- **Shared / offer-level** (lead-owned): cover, about, payment + bank, requirements & notes
  (deduped), thank-you, and the **single combined grand total** (pre-VAT per-dept subtotals →
  one discount + one VAT + one total, per price-offer blocker #2).

### 14.4 Effect on the surfaces

- **Pricing pipeline:** the "Pricing" column shows section progress (e.g. "2/3 sections submitted");
  the Lead's card carries the **"Compile & submit"** action, gated on all sections in.
- **Co-pricer view:** scoped to their section only; "Submit to lead" + a "sent back for revision"
  state.
- **Open questions now answered:** a3 OQ#2 (can lead edit co-pricer sections?) → lead **reviews +
  request-revision + dedups shared requirements**, does NOT silently overwrite a co-pricer's pricing.
