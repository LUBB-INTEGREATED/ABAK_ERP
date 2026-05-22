# Overnight session — 2026-05-21 process correction

**Status:** Site live at **http://72.61.229.5:3487/** (NOT port 80 — nginx vhost listens on 3487).

This doc is the morning-after summary so you can pick up cleanly.

## What you'll see live

Open http://72.61.229.5:3487/ and sign in as `admin@abak.com` / `Password123!`.

### 1. Communications log on every lead

Open any lead at `/leads/[id]`. There's a new **"Communications log"** card at the top of the detail view:

- "Last contact: 3 days ago" subtitle (relative time of the most recent entry).
- Reverse-chronological timeline of every call / WhatsApp / email / meeting / site visit logged.
- **"Log communication"** button (top-right of the card) opens a sheet with:
  - Channel chips (segmented control — 1 tap, no dropdown).
  - Required subject + optional notes.
  - Inline **"Schedule follow-up"** toggle (default 3 working days ahead) — one screen, two outcomes.
- The Sales Person is the single thread-of-record; the `ccAuthorIds` field on the model lets engineers log site-visit coordination with the sales person auto-CC'd.

### 2. Pricing Policy admin screen

New nav item under Admin: **"Pricing policy"** at `/admin/pricing-policy`.

- **Sales ceiling** input (default 5%).
- **Mode** toggle: Tiered or Sequential.
- **Tiered editor:** add/remove `{ upToPct, approver }` rows.
- **Sequential editor:** drag-up/drag-down ordered list of approvers.
- **Live policy preview** panel (right side) reads the policy back in plain language as you edit — "Sales rep grants ≤5% → no approval. 5–10% → Sales Manager. >10% → Sales Manager then CEO." This is the conceptual-model surface; you can predict what will happen without running a test.
- Default policy is seeded in the migration. Service-layer helper `PricingPolicyService.resolveApprovalChain(discountPct)` is wired and returns the right chain — see Remaining for how it ties to quote approval routing.

### 3. Project Licences tab

Open any project at `/projects/[id]`. There's a new **"Licences"** tab alongside Overview / Phases / Gantt / Closure:

- Empty state CTA: "Add licence" opens a sheet for: licence name, portal name (Balady / Salama / MODON / HCIS / Etimad / Fursa — datalist suggestions), portal URL, request ID, applied date, optional notes, **multi-select of phases to block until issued**.
- Each licence row shows: name + portal + request ID + colored status pill + applied/issued dates + "Last checked X ago" + which phases it blocks.
- Per-row actions: **Open on portal** (click-through to the gov URL), inline **status select** (Applied / Under review / Issued / Rejected — Rejected prompts for a reason), **Edit dependencies** (rewire which phases this licence blocks).
- When ≥1 licence is non-Issued AND wired to active phases, a banner appears: "Project paused — waiting on N licence(s). Phases dependent on non-issued licences are hard-blocked from starting. Pause time is excluded from slip math."
- The licence service recomputes `Project.timelineState` (ACTIVE / PAUSED) on every create / update / status change and accumulates `pausedSecondsTotal` so reporting can back out paused time from slip later.

### 4. RFQ pricer assignments (per-department + Lead Pricer)

Open any RFQ at `/rfqs/[id]`, click the **Team** tab. The new top card **"Pricer assignments per department"** replaces the old three-user model (Coordinator / Technical / Financial Reviewer — kept visible as a legacy section underneath for backward compat):

- One row per department; each row shows ⭐ Lead Pricer toggle + assignee + department + status + Remove button.
- **⭐ Lead Pricer** is mutually-exclusive across the RFQ (toggling one clears the others; service-layer enforcement). The first pricer added auto-becomes Lead Pricer.
- Inline warning banners: "No Lead Pricer designated" (amber) or ">1 Lead Pricers designated" (rose) if the invariant is violated.
- "Add pricer" card below lets you pick department (filters out already-assigned depts) + engineer/manager via UserPicker.
- Cannot remove the current Lead Pricer — explained via toast (Norman: name the constraint, don't just block silently).
- Backend also exposes `POST /rfqs/:id/doc-requests` and `POST /rfqs/:id/site-visit-requests` so pricers can request extra docs or site visits during pricing (UI panels for these are not yet built — wire them up later).

### 5. 1-click Won → Project conversion

On any quote with status **WON**, the action row now shows a **"Convert to project"** primary button:

- Single click: auto-validates the commercial confirmation, mints the PO, creates the Project with the canonical 7-phase template, bumps client `lifetimeValue` — all in one transaction.
- Redirects to the new project's detail page after success.
- Once converted, the button is replaced by "Open project P-2026-XXXX" so the surface tells the next-step story.
- Department Manager is the intended actor (the user calling the endpoint becomes the project's PM).

### 6. Quote print preview — department sections + methodology + Gantt

Open any quote and click **"Preview & print"**. Three updates to match the canonical 8-page ABAK PDF:

- **Line items grouped by department**: when items carry a `departmentId`, the table renders section headers per department (Architecture, MEP, Safety, …). Single-department quotes stay ungrouped to avoid noise.
- **Methodology section** (mirrors page 5 of the canonical PDF): for every line item with a `methodologyCard`, prints a description + step bullets + deliverable badge.
- **Gantt timeline section** (mirrors page 6): for every line item with a `ganttBlock`, prints a horizontal bar chart sized to the longest end-day.
- Empty methodology / gantt simply skip — degraded gracefully when not used.

### 7. Lead channel cleanup

- `GOVERNMENT_TENDER` is gone from the LeadChannel enum.
- New channels: `PHONE`, `EXISTING_CLIENT_REPEAT`, `OTHER`.
- The existing GOVERNMENT_TENDER lead in the DB was migrated to `OTHER` automatically.
- Sidebar no longer shows the standalone "Gov Transactions" link (the route file still exists for legacy data access until you decide to delete the data).
- The "tender deadline" notification cron is removed; the per-licence reminder cadence in the licences service replaces it (cron implementation still TODO — see below).

## Paper trail

All the design + correction docs are in the repo at `ABAK_ERP/docs/`:

- **`CORRECTED_CLIENT_JOURNEY.md`** — the authoritative redesign of the client journey (10 sections, signed off in conversation on 2026-05-21).
- **`personas/`** — 7 personas; `pro-government-delegate`, `rfq-engineer`, `financial-reviewer` removed; `department-manager` + `department-engineer` added; sales-rep / sales-manager / ceo / project-manager / finance-officer / README all updated.
- **`flows/`** — 10 flow markdowns; `b2-government-tender.md` deleted; `b3-gov-transaction-lifecycle.md` → `b3-licence-lifecycle.md` (full rewrite); `a3` (RFQ assignment with Lead Pricer), `a4` (configurable Pricing Policy + discount sub-flow), `a5` (1-click conversion) fully rewritten; `a1` updated with the comms log primitive + corrected channel list; `a2`, `a6`, `b4` minor edits; both README files updated; `figjam-link.md` annotated with the pending board updates.

The `../GitHub Issues/` folder was also updated by an agent: Sprint 1/3/4/5/6/7 gap files + summaries now reflect the corrected model, with all new gap issue numbers (M1-019..M1-022, M2-021, M3-011/012, M4-018..M4-026, M5-012..M5-017) drafted but **not yet opened on GitHub** — they're written as templates ready to paste into `gh issue create` calls.

## Database migrations applied

Two migrations ran cleanly on both local and VPS:

**`prisma/migrations/20260521182437_process_correction_2026_05_21/`**:

- Remapped GOVERNMENT_TENDER leads → OTHER, then dropped the enum value and added PHONE / EXISTING_CLIENT_REPEAT / OTHER.
- Broadened the `interactions` table: `clientId` is now nullable; added `leadId`, `rfqId`, `projectId`, `ccAuthorIds[]`, `followUpDate`.
- Added `projects.timelineState` (ACTIVE / PAUSED) + `pausedSecondsTotal`.
- Added `phases.licenceOverrideJustification / By / At` (for the CEO licence-exemption override path, UI TODO).
- Created `pricing_policy` table (singleton, seeded with a sensible default chain).
- Created `licences` table + `_PhaseLicenceDependencies` many-to-many join.

**`prisma/migrations/20260522014057_correction_multi_dept_quotes_methodology_gantt_rfq_assignments/`**:

- `quote_items.departmentId` (FK to `service_categories`) for multi-dept grouping.
- `methodology_cards` table (one-to-one with QuoteItem; description + steps[] + deliverable).
- `gantt_blocks` table (one-to-one with QuoteItem; startDay + durationDays + categoryTone).
- `rfq_assignments` table (per-dept + isLeadPricer + status enum).
- `rfq_doc_requests` table (pricer → sales person doc request stream).
- `rfq_site_visit_requests` table (pricer → sales person + direct-coord flow).

## What's NOT done (scope-honest)

1. **Discount approval routing not yet wired to PricingPolicy** — the policy admin screen works and `PricingPolicyService.resolveApprovalChain(pct)` returns the right approver chain, but the quote module's approval workflow still routes against the old hardcoded `approval_threshold_tier*` settings. Replacing that wiring is a focused refactor — half a day. See task #19.
2. **Per-line methodology + gantt editor UI** — the schema + API + print preview rendering are all in place, but there's no in-app editor that lets a Lead Pricer add methodology card / gantt block per line item without going through the API directly. Adding it means extending the existing quote builder with a drawer per line item. ~1 day. See task #13.
3. **Doc-request + site-visit-request UI panels on the RFQ page** — backend `POST /rfqs/:id/doc-requests` + `POST /rfqs/:id/site-visit-requests` endpoints exist, but no side-panel UI yet for pricers to raise them. ~2h each. See journey doc §D.
4. **Per-licence reminder cron** — the licence schema has `reminderCadenceDays`, but no cron is wired yet to send the reminder when the cadence elapses. ~1h.
5. **CEO licence-exemption override UI** — schema fields in place; no UI surface yet. ~2h.
6. **FigJam board update** — markdown is now ahead of the board; B2 section needs deletion and B3 needs a rewrite; A3/A4/A5 swimlanes need new role rows.
7. **`gov_transactions` data migration** — the old `/gov-transactions` route still works for legacy data; whether to migrate that data into project-attached `Licence` records is a decision that needs your input (you may have demo records on the VPS).

## Commits shipped

```
b4ea826 feat(correction): quote print preview groups by dept + methodology + gantt
3d1c50c feat(correction): RFQ Pricer Assignments + Convert-to-Project button
2db50c5 feat(correction): multi-dept quote schema + RFQ assignments + 1-click convert
e2b27fc docs(correction): add OVERNIGHT_2026_05_21 summary for morning-after pickup
02dbbf1 fix(correction): satisfy TS strict mode on channelRequirements field indexing
45d24a0 feat(correction): add Licence model + Project Licences tab
4f9a0c6 feat(correction): add PricingPolicy admin screen + service
3ee1491 feat(correction): add Communications log on lead detail
2ae7112 feat(correction): drop GOVERNMENT_TENDER channel, broaden Interaction scope
a142098 chore(baseline): pre-correction snapshot — MVP polish + corrected journey docs
```

All pushed to `origin/main` and live on the VPS (pm2 + nginx restarted; smoke tests passed end-to-end via `POST /leads/:id/interactions` and `GET /rfqs/:id/assignments`).

## How to verify each new piece end-to-end

| Feature                    | URL / Path                      | Smoke test                                                                                                                                     |
| -------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Comms log                  | `/leads/[id]`                   | "Log communication" sheet → channel chip → submit → see timeline entry appear with "Last contact: just now"                                    |
| Pricing Policy             | `/admin/pricing-policy`         | Edit ceiling → save → reload → value persists; live preview reads back the policy in plain language                                            |
| Licences                   | `/projects/[id]` → Licences tab | "Add licence" sheet → Balady + applied date + multi-select phase to block → save → "Project paused" banner appears, phase row shows as blocked |
| RFQ Pricer Assignments     | `/rfqs/[id]` → Team tab         | "Add pricer" → pick dept + user → first one auto-becomes ⭐ Lead Pricer; add second → toggle ⭐ → first row's ⭐ clears                        |
| Convert to Project         | quote detail with status WON    | "Convert to project" → see redirect to /projects/[id] with 7 default phases + commercial confirmation auto-validated                           |
| Print preview (multi-dept) | `/quotes/[id]/print`            | If line items carry departmentId, table groups under section headers; methodology + gantt sections render when items have those                |
