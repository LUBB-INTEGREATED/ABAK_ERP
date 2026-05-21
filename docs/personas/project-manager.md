# Project Manager

## Role

Engineering project manager. Owns post-PO execution for one or several concurrent projects.

## Responsibilities in the system

- Accepts the project auto-seeded by the Department Manager's 1-click conversion from a Won quote (phases derived from quote line items; departments + payment schedule + docs carried over)
- Refines the phase plan if needed — splits/merges phases, adds intermediate tasks, customizes from the canonical template (Initiation → Kickoff → Execution → Review → Submission → Revisions → Closure)
- Assigns phase owners (typically Department Engineers); reassigns when capacity changes
- Manages tasks within each phase — creates, assigns, sequences, tracks dependencies
- **Coordinates with Department Engineers on licence applications** — engineers add licence records under the project's Licences tab; the PM wires phase ↔ licence dependencies that hard-block phase start until the licence is `Issued`
- Marks phases complete with evidence (required note ≥ 50 chars OR client acknowledgement date)
- Adjusts planned progress with mandatory reason when execution diverges from plan (note: time the project sits Paused due to a licence wait does **not** count as slip)
- Identifies and escalates stuck items (auto-flagged after 14 days; PM intervenes)
- Initiates project closure and satisfies gates 1–3: ALL_PHASES_COMPLETED, DELIVERABLES_SUBMITTED, CLIENT_APPROVAL_RECEIVED
- Reviews the Gantt to spot slip and rebalance; paused phases (licence-blocked) render in a distinct tone so they're not confused with slip

## Device + context

**Desktop primary** at the office — Gantt audits, dependency planning, phase reviews, and resource reassignment all want screen real estate. **Tablet secondary** for reviewing site updates and approving evidence. Sessions are long (20–90 min); the PM may spend a half-day on a project review during a milestone.

## Success measure

- On-time phase completion vs planned dates
- Actual vs planned progress alignment (low slip across the portfolio)
- Zero projects at-risk-flagged without an intervention recorded
- Closure gates 1–3 satisfied on time for projects entering closure

## Friction risks

- **Memory-lapse on evidence attachment** — marking a phase complete without attaching the evidence note. Mitigation: already required in the dialog — the submit button is disabled until evidence ≥ 50 chars OR a client acknowledgement date is entered.
- **Knowledge-based mistake on dependencies** — accidentally creating a dependency loop (Task A blocks B blocks C blocks A). Mitigation: the dependency picker rejects cycles at the input layer with a clear "this would create a loop with Task B → Task C → Task A" message, not a generic error.
- **Mode error across active projects** — toggling between two open projects in different browser tabs and adjusting progress on the wrong one. Mitigation: the project header (name, number, status) is sticky and visually distinct per project; destructive actions (Adjust Progress, Mark Complete) show the project name in the confirmation dialog.
- **Description-similarity slip on tasks** — two tasks named "Site Visit — Building A" and "Site Visit — Building B" in adjacent phases. Mitigation: task picker shows phase + position + title.
- **Mistake from over-confidence** — approving a phase complete on a familiar service type without checking the deliverables. Mitigation: completion dialog shows a checklist of the phase's tasks with their status; if any task isn't DONE, a banner asks "X tasks are still open — confirm phase is genuinely complete?"
- **Knowledge-based mistake on licence dependency wiring** — a project is converted from a Won quote but the PM doesn't realize a downstream phase needs a yet-unfiled licence. Phase starts; work happens; the discovery comes when authorities reject the submission. Mitigation: the project conversion wizard ends at a "Wire licence dependencies" step that the Department Manager owns; the PM sees a project-level warning chip until the wiring is confirmed; the Licences tab shows "Suggested by service type" prompts based on the line-items that became phases.
