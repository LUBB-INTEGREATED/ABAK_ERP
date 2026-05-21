# Finance Officer

## Role

Finance / Accounts team member. Compliance-oriented; the system's most-conservative user. Operates downstream of the Department Engineer (who prices the quote) and the Sales Manager / CEO (who approve it) — Finance validates the _commercial confirmation_ that mints a PO from a Won quote.

## Responsibilities in the system

- Validates **commercial confirmations** — the gate that mints a PO from a won quote. Validation triggers the PO and unlocks project creation.
- Validates received **payments** against PO + invoice
- Issues **invoices** for milestone payments
- Satisfies **closure gates 4 and 5**: FINAL_PAYMENT_RECEIVED, FINANCE_CLEARANCE_ISSUED
- Reconciles payment records with the external accounting system

## Device + context

**Desktop primary.** Double-checks paperwork — has the accounting software open in another window for cross-reference. Sessions are 5–20 minutes per validation, batched across the day (morning, lunch, afternoon). Often works in parallel with the team accountant who is not necessarily in the system.

## Success measure

- Zero invalid payments validated (a validated payment that turns out to be wrong is a compliance incident)
- Zero unapproved commercial confirmations passed
- Gate 5 (FINANCE_CLEARANCE) issued only when accounts are fully reconciled
- Average validation turnaround — quick enough that finance isn't the project-closure bottleneck

## Friction risks

- **Capture error on batch validation** — validating several similar payments in succession and applying muscle memory to one that needed scrutiny. Mitigation: each validation requires acknowledging the amount + reference number out loud (typed confirmation of the last 4 digits of the reference, not just a click); the queue surfaces "anomalies" (amount mismatch with invoice, unusual payment method) above routine items.
- **Description-similarity slip on PO numbers** — `PO-2026-0123` vs `PO-2026-0132`. Mitigation: PO picker shows PO + project name + client + total; recently-used POs are pinned at the top.
- **Knowledge-based mistake on commercial confirmation** — approving a confirmation when the underlying quote has an issue the Finance Officer wouldn't catch (e.g., commercial terms that the Sales Manager already flagged but were overridden). Mitigation: the commercial-confirmation surface shows a summary line for any non-default terms (extended payment, custom milestones, unusual exclusions) above the validate button; "Validate" expands these summaries by default the first time the user sees that confirmation.
- **Pressure-to-validate-fast vs need-to-verify creates slip risk** — the queue can grow when project closures pile up at quarter-end. Mitigation: queue defaults to oldest-first and never to a "validate all" bulk action. Bulk reject (with reason) is fine; bulk approve is intentionally absent.
- **Mode error on closure gates** — gates 4 and 5 are sequential; satisfying gate 5 (Finance Clearance) without gate 4 (Final Payment) genuinely received would be a process failure. Mitigation: gate 5 is disabled and shows "Final payment must be validated first" until gate 4 is green.
