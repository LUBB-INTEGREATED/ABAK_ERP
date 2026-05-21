# B1 — Follow-up Loop

**Status:** Draft 2026-05-20. Companion to [A1 — Lead capture](a1-lead-capture.md).

## Activity goal

Make sure every commitment to a client (call back Tuesday, send revised quote by Friday, visit site next week) is honoured on time. Success = no overdue follow-ups silently accumulating; the rep can scan their day and know exactly what's owed and to whom.

## Personas (swimlanes)

| Persona           | Role on this activity                                                    |
| ----------------- | ------------------------------------------------------------------------ |
| **Sales Rep**     | Owns follow-ups they create. Closes them out same-day they're completed. |
| **Sales Manager** | Escalation watcher; intervenes on chronically overdue follow-ups.        |
| **System**        | Daily cron marks DUE_TODAY / OVERDUE; sends notifications.               |

## Seven-stage walkthrough

| #   | Stage     | Sales Rep                                                                                                                        | Sales Manager                                                               | System                                                                                                          |
| --- | --------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | Goal      | "Don't drop the ball on what I promised."                                                                                        | "My team's commitments are being kept."                                     | —                                                                                                               |
| 2   | Plan      | "What's due today? Overdue?"                                                                                                     | —                                                                           | —                                                                                                               |
| 3   | Specify   | "Open my Follow-ups. Filter to Due today + Overdue."                                                                             | "Open team follow-ups. Filter to OVERDUE."                                  | "Cron at 07:00: flips PENDING → DUE_TODAY for items due today; flips PENDING/DUE_TODAY → OVERDUE for past-due." |
| 4   | Perform   | "Make the call / send the email / log the meeting. Click Close Follow-up. Add outcome note. Optionally schedule next follow-up." | "Pick top-overdue. Reassign or call rep."                                   | "Notifications fire (in-app bell + email if configured)."                                                       |
| 5   | Perceive  | "Status → COMPLETED. If next-follow-up created, see it in tomorrow's list."                                                      | "Reassignment logged. Audit trail kept."                                    | "OVERDUE count drops on closure."                                                                               |
| 6   | Interpret | "All due-today closed? Anything sliding?"                                                                                        | "Pattern of overdue? Specific rep, specific client, specific service type?" | —                                                                                                               |
| 7   | Compare   | "Inbox-zero on today's follow-ups."                                                                                              | "Team OVERDUE count trending down or stable."                               | —                                                                                                               |

**Gulf-of-Execution pinch point** — Rep wants to log "I called but no answer; will try again tomorrow" — should that close the current follow-up + create a new one? Or extend the current? Mitigation: Close dialog has an explicit "Schedule next follow-up" sub-form that pre-fills client + service from the closed one; one action, two outcomes.

**Gulf-of-Evaluation pinch point** — After closing many follow-ups in a session, the rep isn't sure which are done. Mitigation: closed follow-ups slide off the "Due today" filter immediately and a session counter at top shows "8 closed today."

## Slip catalogue

| Slip                       | Where it lives                                                              | Mitigation                                                                                      |
| -------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Memory-lapse**           | Forgetting a follow-up exists.                                              | Daily cron + morning email digest; in-app red badge on the bell.                                |
| **Capture error**          | Marking the wrong follow-up complete.                                       | Close dialog shows full title + client + due date in the dialog header.                         |
| **Mode error**             | Closing without recording next-action when one is needed.                   | "Schedule next follow-up" is a peer option in the close dialog.                                 |
| **Description-similarity** | Two near-identical follow-ups for the same client (rep created duplicates). | List shows last-edited timestamp; on close, system suggests merging if a near-duplicate exists. |

## Screen inventory

- ✅ Client follow-ups tab — `app/[locale]/(dashboard)/clients/[id]/page.tsx`
- ✅ Follow-up dialog + close dialog — `clients/[id]/follow-up-dialog.tsx`, `close-follow-up-dialog.tsx`
- ✅ Daily cron for DUE_TODAY / OVERDUE transitions — shipped (M8-002)
- ⚠️ "My follow-ups" dedicated cross-client view — not built. Today the rep walks client-by-client. P1 for mobile-first ergonomics.

## Open questions

1. **Cross-client "My follow-ups" view** — worth building for MVP? Mobile-first sales rep will want one screen showing today's commitments across all clients.
2. **Escalation cadence** — Sales Manager intervention threshold (how many days OVERDUE before escalation?) configurable in admin? Currently hard-coded.
