# Activity flows — ABAK ERP

Pinned 2026-05-20. Companion to [`../personas/README.md`](../personas/README.md) and [`../../MVP_SCOPE.md`](../../MVP_SCOPE.md).

## The frame

Per Norman's activity-centered design: we map **activities** end-to-end, with **personas as swimlane owners** on the steps. We do **not** map "the Sales Rep's day" or "the Sales Manager's flows" — those are persona-walkthroughs, not activities, and they invite bespoke persona surfaces.

Each activity gets walked through Norman's seven stages:

```
goal → plan → specify → perform → perceive → interpret → compare
```

Stages 2–4 cross the **Gulf of Execution** ("can I do what I want?"). Stages 5–7 cross the **Gulf of Evaluation** ("did it work?"). The flow board for each activity makes both gulfs visible and names where they're widest.

## Activity taxonomy

### Tier A — the lead-to-cash spine (must map for MVP)

The canonical chain that every won deal follows. Each link is one activity; the handoff between links is what most often breaks.

| #   | Activity                                                                           | Personas (swimlanes)                                                        | Key handoff to next                                                        |
| --- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| A1  | **Lead capture + communications log** — manual + per-channel                       | Sales Person (most), Sales Manager (assignment)                             | Lead → CRM conversion (auto); Sales Person becomes single thread-of-record |
| A2  | **Pipeline progression** — stages New → Contacted → Negotiation → Ready for RFQ    | Sales Person, Sales Manager                                                 | "Ready for RFQ" gate (criteria)                                            |
| A3  | **RFQ assignment + preparation** — Lead Pricer model                               | Department Manager(s) → Department Engineer(s) (one designated Lead Pricer) | "Submitted for approval"                                                   |
| A4  | **Quote approval** — configurable Pricing Policy chain                             | Lead Pricer, Department Manager / Sales Manager / CEO (per policy)          | "Approved, ready to dispatch"                                              |
| A5  | **Quote dispatch + outcome + 1-click project conversion** — won / lost / postponed | Sales Person (dispatch + outcome), Department Manager (conversion)          | Project created via 1-click                                                |
| A6  | **Project execution** — phases + tasks + gantt + licence pause                     | Project Manager, phase owners (Department Engineers)                        | "All phases complete"                                                      |
| A7  | **Project closure** — 5 sequential gates                                           | Project Manager (gates 1–3), Finance Officer (gates 4–5)                    | Project CLOSED                                                             |

### Tier B — major side-flows (must map for MVP)

Parallel or alternative paths to the spine. Each one is its own activity, but the personas and signifiers should _match_ the spine where possible.

| #   | Activity                                                                                     | Personas                                                                                             | Why it's its own flow                                                                   |
| --- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| B1  | **Follow-up loop**                                                                           | Sales Person, Sales Manager (escalation)                                                             | Cross-cuts CRM and pipeline; cadence ≠ pipeline stages                                  |
| B3  | **Licence lifecycle** (project-attached, replaces old gov-tender + gov-transaction concepts) | Department Engineer (primary), Department Manager / PM (dependency wiring), CEO (exemption override) | Runs in parallel to A6; phase hard-block + project pause when blocking licence ≠ Issued |
| B4  | **Finance validation** — commercial confirmation, payment, invoice                           | Finance Officer, Sales Manager (oversight)                                                           | The other end of A5 and the spine for gates 4–5 in A7                                   |

**Removed in the 2026-05-21 correction:**

- ~~B2 — Government tender side-flow~~. Government work no longer has a separate channel or special quote template. It shows up as licences inside normal projects.

### Tier C — supporting flows (nice to map, lower priority)

| #   | Activity                              | Personas                          | Notes                                                                               |
| --- | ------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------- |
| C1  | **Target setting + adjustment**       | Sales Manager                     | Quarterly/monthly cadence; reactive                                                 |
| C2  | **Stuck-deal / at-risk intervention** | Sales Manager, Project Manager    | Reactive activity triggered by system alerts; not a "flow" so much as a triage loop |
| C3  | **Admin configuration**               | Sales Manager (wearing Admin hat) | Settings, service catalog, holidays — episodic                                      |

### Out of MVP scope (do not map)

These either fall outside the 4 contract modules or are deferred to the addendum:

- Marketing campaigns / content production
- Resource workload matrix / capacity planning
- Executive dashboard beyond what Tier B/C reports cover
- Role builder UI, ABAC permission model, Client Portal, External Consultant magic-link

## File convention (once we start drafting)

Each activity becomes one file under `docs/flows/`:

```
docs/flows/
  README.md                  ← this file
  a1-lead-capture.md
  a2-pipeline-progression.md
  a3-rfq-assignment.md
  a4-quote-approval.md
  …
```

Each flow file contains:

1. **Activity goal** — one sentence on what success looks like
2. **Personas + swimlanes** — who owns which step
3. **Seven-stage walkthrough** — narrative against Norman's stages, naming the Gulf-of-Execution and Gulf-of-Evaluation pinch points
4. **Slip catalogue** — the specific slips this activity invites (with Norman taxonomy: capture / description-similarity / mode / memory-lapse), each paired with the mitigation
5. **Screen inventory** — which existing surfaces it touches (path in `packages/web/src/app/...`) and which gaps need new surfaces
6. **FigJam board link** — once we draft the visual swimlane in FigJam, link it here

## Sequencing decisions (pinned 2026-05-20)

- **First flow to map:** **A1 — Lead capture.** Top of the spine, simplest entry, validates the format on the canonical first-step before we hit the harder mid-spine activities.
- **FigJam structure:** **single file**, one section per activity. File name: `ABAK ERP — Activity Flows`. Each flow gets its own clearly-titled section that can be screenshot-shared independently.
- **Authoring order:** markdown first (in this folder), FigJam after the markdown is signed off. The markdown drives the visual swimlane, not the other way around — text edits are cheap, FigJam edits are expensive.

After A1 ships and the format is validated end-to-end (markdown + FigJam section), we batch the rest of Tier A and then Tier B.
