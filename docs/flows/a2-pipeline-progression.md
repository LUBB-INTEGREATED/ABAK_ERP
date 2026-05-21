# A2 — Pipeline Progression

**Status:** Draft 2026-05-20. Companion to [A1 — Lead capture](a1-lead-capture.md).

## Activity goal

Move a lead through pipeline stages (New → Contacted → Negotiation → Ready for RFQ → RFQ Submitted → Won/Lost/Postponed) so an RFQ can be raised against it and ultimately won. Success = every active lead has a recorded next-action and a sensible stage; nothing rots silently in "Contacted" for 30 days. Note: per the 2026-05-21 correction, **`Qualified` is no longer a manual stage** — submitting an RFQ in A3 _implicitly_ qualifies the lead.

## Personas (swimlanes)

| Persona           | Role on this activity                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| **Sales Rep**     | Owns the lead. Decides next stage based on real client signals. Records interactions that justify each move. |
| **Sales Manager** | Watches for stuck deals (auto-flagged after 14 days). Intervenes on stuck or high-value items.               |

## Seven-stage walkthrough

| #   | Stage     | Sales Rep                                                                                                                                                                                                                                           | Sales Manager                                                                 |
| --- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Goal      | "This lead has potential. Move it forward."                                                                                                                                                                                                         | "My team's pipeline is healthy. Spot risks early."                            |
| 2   | Plan      | "Where is it now? What's the next concrete action?"                                                                                                                                                                                                 | —                                                                             |
| 3   | Specify   | "Open pipeline kanban OR lead detail page. Pick next stage."                                                                                                                                                                                        | "Open kanban. Filter to my team. Look for cards 14+ days unchanged."          |
| 4   | Perform   | "Drag card to next column, or use stage-change dropdown. READY_FOR_RFQ stage requires the 5 gate fields: nextStep, decisionMakerName, expectedDecisionDate, estimatedValue, expectedCloseAt — these surface as required fields in the move dialog." | "Open stuck lead. Either reassign, demote stage, or call the rep to discuss." |
| 5   | Perceive  | "Card moves. Stage transition logged with timestamp + actor. SLA chip may update."                                                                                                                                                                  | "Stuck flag clears. Or escalation notification fires to rep + their manager." |
| 6   | Interpret | "Am I on track for monthly target? Which deals need follow-up today?"                                                                                                                                                                               | "How many deals stuck this week? Bottlenecks at any stage?"                   |
| 7   | Compare   | "Pipeline value matches my mental model. Targets visible vs actual."                                                                                                                                                                                | "Conversion-per-stage healthy? Where is the leak?"                            |

**Gulf-of-Execution pinch point** — Stage 4 READY_FOR_RFQ has 5 mandatory fields. If they're not all filled, the stage transition is silently rejected. Mitigation: the dialog shows all 5 fields inline with required markers, and the submit button names what's missing ("Add decision-maker name to continue").

**Gulf-of-Evaluation pinch point** — After dragging a card on kanban, the user may not know which stage they landed on if the column visual is dense. Mitigation: card briefly pulses on landing in the new column, and a toast confirms ("Moved to Negotiation").

## Slip catalogue

| Slip                       | Where it lives                                                                                           | Mitigation                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Capture error**          | Dragging the wrong kanban card during fast triage.                                                       | Card hover shows full client name + value; drop confirmation when card moves >2 columns.      |
| **Memory-lapse**           | Stage 4: trying to move to READY_FOR_RFQ without having recorded the decision-maker.                     | The 5 required fields surface in the move dialog with inline validation, not a separate page. |
| **Mode error**             | Pipeline view's period filter ("Q1") quietly retained — manager looks at old data thinking it's current. | Active filter is a persistent visible chip in the page header, not a hidden default.          |
| **Description-similarity** | Two deals from the same client (different services) confused at stage move.                              | Card title shows client + service name, not just client.                                      |

## Screen inventory

- ✅ Kanban board — `app/[locale]/(dashboard)/pipeline/page.tsx`
- ✅ Lead detail with stage-change dialog — `app/[locale]/(dashboard)/leads/[id]/status-dialog.tsx`
- ✅ Stuck-lead flag + cron — shipped 2026-04-24 (M3 pipeline gaps)
- ✅ Sales target tracking — `app/[locale]/(dashboard)/targets/page.tsx` (currently hidden from sidebar per MVP scope, reachable by URL)

## Open questions

1. **READY_FOR_RFQ gate copy** — should the 5 required-field validation give the rep a "Why these?" link to a brief explanation of why each matters? Reduces knowledge-based mistakes for new reps.
2. **Stuck-lead escalation timing** — 14 days is the current default. Per CLAUDE.md it's configurable via admin settings. Confirm 14 is right for ABAK's sales cycle vs shorter (10) or longer (21).
