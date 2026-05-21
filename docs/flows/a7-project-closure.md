# A7 — Project Closure

**Status:** Draft 2026-05-20. Companion to [A1 — Lead capture](a1-lead-capture.md).

## Activity goal

Close a project formally across 5 sequential gates so nothing is left hanging (deliverables, client sign-off, money). Success = clean handoff; project status is CLOSED with all gates green and an audit trail.

## Personas (swimlanes)

| Persona             | Role on this activity                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Project Manager** | Initiates closure. Owns gates 1–3 (ALL_PHASES_COMPLETED, DELIVERABLES_SUBMITTED, CLIENT_APPROVAL_RECEIVED). |
| **Finance Officer** | Owns gates 4–5 (FINAL_PAYMENT_RECEIVED, FINANCE_CLEARANCE_ISSUED).                                          |

## Five sequential gates (the activity's core constraint)

```
PM owns ↓                            Finance owns ↓
[1] ALL_PHASES_COMPLETED → [2] DELIVERABLES_SUBMITTED → [3] CLIENT_APPROVAL_RECEIVED → [4] FINAL_PAYMENT_RECEIVED → [5] FINANCE_CLEARANCE_ISSUED → CLOSED
```

Each gate has a timestamp + actor on close. Gates are independent but the activity is "complete" only when all 5 are green.

## Seven-stage walkthrough

| #   | Stage     | Project Manager                                                                                          | Finance Officer                                                                                      |
| --- | --------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | Goal      | "Close this project clean. No loose ends."                                                               | "No premature clearance. No invalid payment cleared."                                                |
| 2   | Plan      | "Are PM-owned gates ready (1–3)? What's blocking?"                                                       | "Has PM handed off? Are gates 4–5 ready to validate?"                                                |
| 3   | Specify   | "Open Closure tab. Walk the gates."                                                                      | "Open Finance > Invoices, locate this project's PO."                                                 |
| 4   | Perform   | "Tick each PM gate as evidence is in. Gate 2 needs deliverable links; gate 3 needs client sign-off doc." | "Validate final payment against PO + invoice. Then tick gate 5 only when accounts fully reconciled." |
| 5   | Perceive  | "Gate state changes. Audit log entry per tick."                                                          | "Gate 4 unlocks gate 5. Project status reflects gates green."                                        |
| 6   | Interpret | "Anything blocking? E.g., client never signed off → soft-escalate."                                      | "Is finance reconciled? Any holds from accounting?"                                                  |
| 7   | Compare   | "Gates 1–3 done. Handed off to Finance."                                                                 | "All 5 gates green. Project status flips to CLOSED."                                                 |

**Gulf-of-Execution pinch point** — User attempts to tick gate 5 without gate 4 done. Mitigation: gate 5 is disabled with inline reason "Final payment must be validated first" (already shipped).

**Gulf-of-Evaluation pinch point** — Gates ticked but project status doesn't appear to change. Mitigation: after the 5th gate ticks, the project header status pill animates to CLOSED + closedAt timestamp; toast confirms.

## Slip catalogue

| Slip                        | Where it lives                                                                                                                     | Mitigation                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Mode error**              | Trying to issue clearance (gate 5) while gate 4 not validated.                                                                     | Already mitigated: gate 5 disabled with named reason.                                     |
| **Knowledge-based mistake** | Finance Officer not realizing a side-agreement was made externally (e.g., late deliverable accepted by client outside the system). | Closure tab includes a free-text "context for closure" field PM fills before handoff.     |
| **Capture error**           | Ticking the wrong gate fast.                                                                                                       | Each tick requires a brief "evidence note" (link or short text) — light forcing function. |
| **Memory-lapse**            | Forgetting to add closedAt note.                                                                                                   | Already required at the schema level.                                                     |

## Screen inventory

- ✅ Closure tab on project detail — `app/[locale]/(dashboard)/projects/[id]/page.tsx` (ClosurePanel)
- ✅ Gate 5 dependency on gate 4 — shipped
- ✅ Per-gate ownership badge (PM / Finance) — shipped
- ⚠️ Cross-team handoff notification — when PM completes gates 1–3, does Finance get notified? Worth verifying.

## Open questions

1. **Handoff notification** — when PM finishes gates 1–3, should Finance Officer get an explicit "ready for your gates" notification, or do they discover it via their dashboard? Notification reduces handoff lag.
2. **Closure documentation export** — should closing a project auto-generate a PDF summary (gates, dates, evidence) for archival? Useful for compliance-oriented Finance Officer.
