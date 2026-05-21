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
- The Sales Person is the single thread-of-record; the `ccAuthorIds` field on the model lets engineers log site-visit coordination with the sales person auto-CC'd (used later by the multi-dept flow).

### 2. Pricing Policy admin screen

New nav item under Admin: **"Pricing policy"** at `/admin/pricing-policy`.

- **Sales ceiling** input (default 5%).
- **Mode** toggle: Tiered or Sequential.
- **Tiered editor:** add/remove `{ upToPct, approver }` rows.
- **Sequential editor:** drag-up/drag-down ordered list of approvers.
- **Live policy preview** panel (right side) reads the policy back in plain language as you edit — "Sales rep grants ≤5% → no approval. 5–10% → Sales Manager. >10% → Sales Manager then CEO." This is the conceptual-model surface; you can predict what will happen without running a test.
- Save behavior: writes the singleton. Default policy is seeded in the migration.

### 3. Project Licences tab

Open any project at `/projects/[id]`. There's a new **"Licences"** tab alongside Overview / Phases / Gantt / Closure:

- Empty state CTA: "Add licence" opens a sheet for: licence name, portal name (Balady / Salama / MODON / HCIS / Etimad / Fursa — datalist suggestions), portal URL, request ID, applied date, optional notes, **multi-select of phases to block until issued**.
- Each licence row shows: name + portal + request ID + colored status pill + applied/issued dates + "Last checked X ago" + which phases it blocks.
- Per-row actions: **Open on portal** (click-through to the gov URL), inline **status select** (Applied / Under review / Issued / Rejected — Rejected prompts for a reason), **Edit dependencies** (rewire which phases this licence blocks).
- When ≥1 licence is non-Issued AND wired to active phases, a banner appears: "Project paused — waiting on N licence(s). Phases dependent on non-issued licences are hard-blocked from starting. Pause time is excluded from slip math."
- The licence service recomputes `Project.timelineState` (ACTIVE / PAUSED) on every create / update / status change and accumulates `pausedSecondsTotal` so the reporting can back out paused time from slip later.

### 4. Lead channel cleanup

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

## Database migration applied

**`prisma/migrations/20260521182437_process_correction_2026_05_21/`** ran cleanly on both local and VPS. It:

- Remapped GOVERNMENT_TENDER leads → OTHER, then dropped the enum value and added PHONE / EXISTING_CLIENT_REPEAT / OTHER.
- Broadened the `interactions` table: `clientId` is now nullable; added `leadId`, `rfqId`, `projectId`, `ccAuthorIds[]`, `followUpDate`.
- Added `projects.timelineState` (ACTIVE / PAUSED) + `pausedSecondsTotal`.
- Added `phases.licenceOverrideJustification / By / At` (for the CEO licence-exemption override path, UI TODO).
- Created `pricing_policy` table (singleton, seeded with a sensible default chain).
- Created `licences` table + `_PhaseLicenceDependencies` many-to-many join.

## What's NOT done (scope-honest)

The Tier 2 quote-builder rework is the biggest remaining piece — risky to ship overnight without your input on the UX. Specifically:

1. **Multi-dept quote with Lead Pricer** — schema doesn't yet have `DepartmentSection` grouping or `Rfq.assignments[]` with `isLeadPricer`. The current quote builder still assumes one flat line-item list per quote. Designed but not built.
2. **Per-line methodology card + gantt block** — same situation; designed in `CORRECTED_CLIENT_JOURNEY.md §4` but no schema fields or editor UI yet.
3. **1-click Won-quote → Project conversion** — the current code still auto-mints a PO on accept; the new "Department Manager clicks Convert to Project" UX with inline preview + 24h undo is designed but not coded.
4. **Discount approval sub-flow wiring** — the PricingPolicy admin screen works and `PricingPolicyService.resolveApprovalChain(pct)` returns the right approver chain, but the quote module still routes against the old hardcoded `approval_threshold_tier1/2` settings. Replacing that wiring is a focused refactor — half a day.
5. **Per-licence reminder cron** — the licence schema has `reminderCadenceDays`, but no cron has been wired yet to send the reminder when the cadence elapses.
6. **CEO licence-exemption override UI** — the schema fields are in place; no UI surface yet.
7. **FigJam board** — markdown is now ahead of the board; B2 section needs deletion and B3 needs a rewrite; A3/A4/A5 swimlanes need new role rows.
8. **gov-transactions data migration** — the old `/gov-transactions` route still works for legacy data; whether to migrate that data into project-attached `Licence` records is a decision that needs your input (you may have demo records on the VPS).

## Commits shipped tonight

```
02dbbf1 fix(correction): satisfy TS strict mode on channelRequirements field indexing
45d24a0 feat(correction): add Licence model + Project Licences tab
4f9a0c6 feat(correction): add PricingPolicy admin screen + service
3ee1491 feat(correction): add Communications log on lead detail
2ae7112 feat(correction): drop GOVERNMENT_TENDER channel, broaden Interaction scope
a142098 chore(baseline): pre-correction snapshot — MVP polish + corrected journey docs
```

All pushed to `origin/main` and live on the VPS (pm2 + nginx restarted; smoke tests passed).
