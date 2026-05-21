# B4 — Finance Validation

**Status:** Draft 2026-05-20. Companion to [A1 — Lead capture](a1-lead-capture.md).

## Activity goal

Validate received payments and the project's commercial confirmation (the financial counterpart to the 1-click conversion done by the Department Manager in A5), issue invoices, and ultimately satisfy project closure gates 4 (FINAL_PAYMENT_RECEIVED) and 5 (FINANCE_CLEARANCE_ISSUED). Success = zero invalid payments cleared; zero unapproved commercial confirmations passed.

## Personas (swimlanes)

| Persona             | Role on this activity                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Finance Officer** | Primary validator. Approves/rejects commercial confirmations, validates payments, issues invoices, handles closure gates 4–5. |
| **Sales Manager**   | Oversight on commercial confirmations (a confirmation rejection means a sales conversation).                                  |
| **System**          | Auto-mints PO when commercial confirmation validated; auto-applies payment to PO; computes invoice totals.                    |

## Seven-stage walkthrough

| #   | Stage     | Finance Officer                                                                                                                                                                     | Sales Manager                                                    | System                                                                                                    |
| --- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | Goal      | "Don't let any invalid payment through. Compliance first."                                                                                                                          | "Sales-side commercial confirmations clear cleanly."             | —                                                                                                         |
| 2   | Plan      | "What's in my queue today? Anomalies first."                                                                                                                                        | —                                                                | —                                                                                                         |
| 3   | Specify   | "Open Finance > Commercial confirmations / Payments / Invoices. Sort by anomaly + age."                                                                                             | "Watch for rejected commercial confirmations on team dashboard." | "Anomaly detection: amount mismatch with invoice, unusual payment method, unusually large round numbers." |
| 4   | Perform   | "For each: cross-check against accounting software. Validate (PO/payment status flips) or Reject with reason. Type last 4 digits of reference to confirm — light forcing function." | "Investigate rejected commercial confirmations; coach the rep."  | "On validate: PO minted from quote; payment applied; closure gate 4 unlocks if final payment."            |
| 5   | Perceive  | "Status changes. Project closure gate 4 unlocked if applicable. Audit log entry."                                                                                                   | "Rejection visible on team commercial dashboard."                | "Project status pill updates if all 5 gates green."                                                       |
| 6   | Interpret | "Anything systematically odd this week? Patterns in rejections?"                                                                                                                    | "Same rep getting repeated rejections — training opportunity."   | —                                                                                                         |
| 7   | Compare   | "Queue cleared. Compliance maintained."                                                                                                                                             | "Commercial reject-rate stable."                                 | "Closure gate 5 issuable only when gate 4 green AND reconciliation complete."                             |

**Gulf-of-Execution pinch point** — Bulk validation creates capture-error risk. Mitigation: queue defaults to oldest-first, no "validate all" bulk action; bulk reject (with reason) is fine; bulk approve is intentionally absent.

**Gulf-of-Evaluation pinch point** — Finance Officer validates a payment but doesn't see whether it unlocked a downstream project closure gate. Mitigation: validation toast names the project + gate impact ("Payment validated. Gate 4 unlocked for Project PRO-2026-0142").

## Slip catalogue

| Slip                                      | Where it lives                                                                                                | Mitigation                                                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Capture error on batch**                | Validating several similar payments fast; one needed scrutiny.                                                | Each validation requires typing last 4 digits of reference; anomalies float to top above routine items.                                                 |
| **Description-similarity on POs**         | `PO-2026-0123` vs `PO-2026-0132`.                                                                             | PO picker shows PO + project name + client + total; recently-used pinned.                                                                               |
| **Knowledge-based mistake on commercial** | Approving with non-default terms unknown to Finance Officer (negotiated extended payment, custom milestones). | Commercial confirmation surface shows summary line for any non-default terms above Validate; first-time-seen confirmations expand summaries by default. |
| **Mode error on closure gates**           | Trying to issue clearance (gate 5) before final payment (gate 4) validated.                                   | Already shipped: gate 5 disabled with named reason "Final payment must be validated first."                                                             |
| **Pressure-to-validate-fast**             | Quarter-end pile-up creates batch-validation pressure.                                                        | Queue defaults oldest-first; no bulk approve; daily caps if anomaly count crosses threshold.                                                            |

## Screen inventory

- ✅ Finance dashboard with tabs (commercial / payments / invoices) — `app/[locale]/(dashboard)/finance/page.tsx`
- ✅ Commercial confirmation validation — shipped (Module 7)
- ✅ Payment validation — shipped
- ✅ Invoice issuance — shipped
- ✅ Closure gates 4–5 with sequence dependency — shipped
- ⚠️ Anomaly highlighting — not explicitly built. Current sort is by age. P1 if Finance volume is meaningful.

## Open questions

1. **Anomaly detection rules** — what counts as anomalous in ABAK's payment patterns? (Unusual amount round numbers, unusual payment methods, unusual reference formats.) Determines a small ruleset that surfaces in the UI.
2. **Bulk reject UX** — when can Finance reject multiple items at once? E.g., end-of-quarter cleanup of obviously-invalid items. What reason templates make sense?
3. **External accounting sync** — Finance persona uses an external accounting system in parallel. Is there a future sync, or is double-entry by hand the indefinite reality? Determines whether to build export tooling.
