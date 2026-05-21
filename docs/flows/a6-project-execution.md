# A6 — Project Execution

**Status:** Draft 2026-05-20. Companion to [A1 — Lead capture](a1-lead-capture.md).

## Activity goal

Execute a project from its 1-click conversion (from a Won quote in A5) through to "all phases complete," ready for closure. Success = on-time delivery per Gantt; no phases stuck >14 days un-flagged; evidence attached on every phase completion; phases dependent on government licences honor the hard-block + project-pause model (see [B3 — Licence lifecycle](b3-licence-lifecycle.md)).

## Personas (swimlanes)

| Persona             | Role on this activity                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Project Manager** | Orchestrator. Creates/manages phases + tasks, marks completion, adjusts progress with reason, escalates stuck items. |
| **Phase Owner**     | Could be the PM or a different engineer per phase. Owns task-level execution within their phase.                     |
| **System**          | Auto-flags at-risk projects (progress vs date), stuck tasks (>14 days).                                              |

## Seven-stage walkthrough

| #   | Stage     | Project Manager                                                                                          | Phase Owner                                                    | System                                                                |
| --- | --------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | Goal      | "Deliver this project on time and on scope."                                                             | "Get my phase across the line."                                | —                                                                     |
| 2   | Plan      | "Which phase is active? Critical path? Who's blocked?"                                                   | "Which tasks are mine this week?"                              | —                                                                     |
| 3   | Specify   | "Open Gantt or Phases tab. Identify next actions."                                                       | "Open project, filter to my phase."                            | "Cron runs daily: compares planned vs actual progress."               |
| 4   | Perform   | "Create/assign tasks. Set planned dates. Resolve dependency loops at input (rejected with explanation)." | "Move tasks IN_PROGRESS → REVIEW → DONE. Attach deliverables." | "Flag projects where actual << planned as AT_RISK."                   |
| 5   | Perceive  | "Phase progress updates. Gantt slip visible (rose bars beyond planned end)."                             | "Task status changes reflect on PM dashboard."                 | "AT_RISK projects surface on PM dashboard + Sales Manager dashboard." |
| 6   | Interpret | "Any phases slipping? Tasks stuck >14 days? Reason recorded?"                                            | "Anything blocked on a dependency I should escalate?"          | —                                                                     |
| 7   | Compare   | "All phases complete with evidence attached. Ready for closure."                                         | —                                                              | "All phases COMPLETED unlocks the Closure tab gate 1."                |

**Gulf-of-Execution pinch point** — Creating task dependencies; user could accidentally make a cycle. Mitigation: dependency picker rejects cycles at input with a named explanation ("this would create A → B → C → A"); not a generic error.

**Gulf-of-Evaluation pinch point** — PM marks a phase complete but the gate criteria aren't visible. Mitigation: phase-complete dialog shows a checklist of phase's tasks; if any are NOT_STARTED or IN_PROGRESS, a banner asks "X tasks still open — confirm phase is genuinely complete?" Evidence note (≥50 chars) OR client acknowledgement date is mandatory.

## Slip catalogue

| Slip                             | Where it lives                                                                        | Mitigation                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Memory-lapse**                 | Marking phase complete without attaching evidence.                                    | Already mitigated: submit disabled until evidence note ≥ 50 chars OR client acknowledgement date entered.               |
| **Knowledge-based mistake**      | Creating a dependency loop unknowingly.                                               | Dependency picker rejects cycles at input with named loop members.                                                      |
| **Mode error**                   | Toggling between two projects in different tabs; adjusting progress on the wrong one. | Project header sticky + visually distinct per project; destructive actions name the project in the confirmation dialog. |
| **Description-similarity**       | "Site Visit — Building A" vs "Site Visit — Building B" in adjacent phases.            | Task picker shows phase + position + title.                                                                             |
| **Mistake from over-confidence** | Approving a phase complete on a familiar service type without checking deliverables.  | Completion dialog's task-list checklist forces visible accounting.                                                      |

## Screen inventory

- ✅ Project detail with Overview / Phases / Gantt / Closure tabs — `app/[locale]/(dashboard)/projects/[id]/page.tsx`
- ✅ Gantt — `components/projects/gantt.tsx` (shipped 2026-05-18)
- ✅ Phase + task management (M5-001..M5-011)
- ✅ At-risk auto-flag + stuck-task cron
- ✅ Phase completion with evidence requirement

## Open questions

1. **Phase-owner reassignment notifications** — currently silent? Should the reassigned owner get an in-app notification + email?
2. **Tablet UX for PM** — the PM persona one-pager assumes tablet usage for "review on the go." Does the Gantt tab work well on iPad-sized viewport? Worth a spot-check.
