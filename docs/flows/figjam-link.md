# FigJam — ABAK ERP Activity Flows

**File:** [ABAK ERP — Activity Flows](https://www.figma.com/board/9Vnln7h2RzdUteymXPpdOU)
**Team:** Rabwatech (student tier)
**Created:** 2026-05-20

Single FigJam file containing one section per activity. Companion to the markdown specs in this folder.

## Structure inside the file

All 11 flows drafted as of 2026-05-20. **The FigJam board has not yet been updated for the 2026-05-21 corrections** — the markdown flows are now the source of truth; the board needs a follow-up pass to mirror them (see "Pending FigJam updates" below).

Top-to-bottom (original layout):

- **Title block** — board entry point with link back to `docs/flows/README.md`
- **Activity Index** (gray section) — index of all 11 flows
- **A1 — Lead capture** (light blue)
- **A2 — Pipeline progression** (light violet)
- **A3 — RFQ assignment + preparation** (light blue)
- **A4 — Quote approval** (light violet)
- **A5 — Quote dispatch + outcome** (light blue)
- **A6 — Project execution** (light violet)
- **A7 — Project closure** (light blue, 2-lane compact)
- **B1 — Follow-up loop** (light teal)
- **B2 — Government tender** (light pink, 4-lane tallest) — **DEPRECATED, board section to delete**
- **B3 — Gov transaction lifecycle** (light teal) — **REWRITE as B3 — Licence lifecycle (project-attached)**
- **B4 — Finance validation** (light pink)

Wrapper size: 3520 × 19616. Tier A uses blue/violet alternation; Tier B uses teal/pink alternation.

## Pending FigJam updates (2026-05-21 corrections)

1. **Delete B2 section** entirely. Government tender is no longer a flow.
2. **Rename B3** to "Licence lifecycle (project-attached)" and rewrite its swimlanes — Department Engineer + Department Manager + CEO (exemption), drop PRO swimlane.
3. **A3** — replace swimlanes with: Sales Person (originator) · Department Manager(s) (assigners) · Department Engineer(s) with Lead Pricer designation. Drop RFQ Engineer / Financial Reviewer rows.
4. **A4** — replace L1/L2 hardcoded chain with configurable Pricing Policy chain visualization; add discount-approval sub-flow lane.
5. **A5** — replace "auto-mint PO" terminus with "1-click Project conversion" branch, owned by Department Manager.
6. **A1** — drop GOVERNMENT_TENDER channel from the channel band; add a comms-log primitive box on the Sales Person swimlane.

## A1 board anatomy (canonical pattern for future flows)

Each flow section follows this layout:

```
Title + Goal subtitle
  Stage axis:  1·Goal  2·Plan  3·Specify  4·Perform  5·Perceive  6·Interpret  7·Compare
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ Persona row 1: cards at each populated (persona × stage) cell            │
  │ Persona row 2: …                                                         │
  │ Persona row 3: …                                                         │
  └─────────────────────────────────────────────────────────────────────────┘
  Gulf bands (orange = execution stages 2–4, teal = evaluation 5–7)
  Slip callouts (red stickies) with dashed connectors to specific cells
```

Conventions:

- **Card fill** — white for human-actor cards, light gray for System (automated) cards
- **Stage-tag color on cards** — blue for execution-gulf stages (1–4), teal for evaluation-gulf stages (5–7)
- **Intra-lane connectors** — solid charcoal arrows for human lanes, gray for System lane
- **Cross-lane handoff connectors** — dashed blue with a one-word label
- **Slip stickies** — red sticky (`#FFB8A8`), wide form factor, dashed red connector pointing to the cell where the slip lives
