# A4 — Quote Approval

**Status:** Rewritten 2026-05-21 per the corrected client journey. Companion to [A3 — RFQ assignment](a3-rfq-assignment.md) and [the journey master doc](../CORRECTED_CLIENT_JOURNEY.md).

## Activity goal

Get a submitted quote approved (or rejected with reason) so it can be sent to the client. Approval is **configurable** — the CEO/admin picks the Pricing Policy (tiered or sequential) and the chain runs against the quote's value and any discount requested. Success = approval turnaround under SLA; no approved quote later reveals a margin or terms issue.

## What changed in the correction

- **No hardcoded "L1 = Sales Manager, L2 = CEO" model.** Approval chain is admin-configurable via the **Pricing Policy** singleton in Admin Settings.
- **No Financial Reviewer role.** The Lead Pricer (a Department Engineer or Manager) submits the quote; the same person reworks if the chain returns it.
- **Discount approval is a sub-flow of this activity.** When the Sales Person grants a discount above their ceiling during negotiation, the discount-approval request runs through the same configurable chain, on the same quote.

## Pricing Policy — the conceptual model spine

The admin (CEO or portal admin) configures, at `Admin Settings → Pricing Policy`:

- **Sales ceiling** (% the sales person may grant without approval — e.g. 5%)
- **Mode**: `tiered` or `sequential`
- **Tiered config** (visible when mode = tiered): an ordered list of `{ upToPct, approver }` rows, e.g. `[{ ≤10%, Main Manager }, { ≤20%, CEO }]`.
- **Sequential config** (visible when mode = sequential): a drag-to-reorder list of approvers.

A **live preview** panel reads the policy back in plain language: _"Sales rep grants ≤5% → no approval. 5–10% → Main Manager. >10% → Main Manager then CEO."_ The preview is the entire signifier of the policy — the admin sees the consequence of their edits in real time.

## Personas (swimlanes)

| Persona                                                                         | Role on this activity                                               |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Lead Pricer** (Department Engineer or Manager)                                | Submits the quote. Reworks on rejection / revision request.         |
| **Sales Person**                                                                | Submits discount requests above the sales ceiling.                  |
| **Approver(s)** (Department Manager, Sales Manager, CEO — per configured chain) | Approves, rejects with reason, or requests changes.                 |
| **Admin / CEO**                                                                 | Owns the Pricing Policy. Adjusts thresholds, mode, approver chains. |

## Seven-stage walkthrough — quote-level approval

| #   | Stage     | Lead Pricer                                                                                 | Approver(s)                                                                                                                                               |
| --- | --------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Goal      | "Get this quote moving."                                                                    | "Keep my approval queue clear."                                                                                                                           |
| 2   | Plan      | —                                                                                           | "Margin healthy? Standard terms? Above my threshold?"                                                                                                     |
| 3   | Specify   | "Click Submit for Approval on the quote detail."                                            | "Open approvals queue. Pick this quote."                                                                                                                  |
| 4   | Perform   | —                                                                                           | "Approve, Reject (with reason), or Request changes. Margin diff + commercial summary visible above the button. On mobile (CEO): tap-and-hold on Approve." |
| 5   | Perceive  | "Status changes: Pending Approval → Approved / In Revision."                                | "Status changes. Activity timeline updates."                                                                                                              |
| 6   | Interpret | "If rejected/revised: read reason, rework, resubmit. If approved: ready to send to client." | "Look at next item in queue."                                                                                                                             |
| 7   | Compare   | "Quote is Approved."                                                                        | "My tier in the chain is clear."                                                                                                                          |

**Gulf-of-Execution pinch point** — the policy can change between the time the pricer submits and the time the approver opens the request (admin edits the policy mid-flight). Mitigation: the approval request snapshots the policy in effect at submission time; the approver sees "Policy in effect: Tiered (sales ceiling 5%, mid 10%, CEO >10%)" at the top of the request so the rules are explicit.

**Gulf-of-Evaluation pinch point** — Lead Pricer doesn't know which stage of the chain their quote is at. Mitigation: status pill spells out the stage by name ("Pending: Main Manager" or "Pending: CEO"); when one approver approves on a multi-stage chain, status changes to the next named stage, not a generic "Pending."

## Seven-stage walkthrough — discount approval sub-flow

| #   | Stage     | Sales Person                                                                                                                          | Approver(s)                                                                                              |
| --- | --------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | Goal      | "Client wants 12% off. My ceiling is 5%."                                                                                             | —                                                                                                        |
| 2   | Plan      | "Open the Grant Discount sheet."                                                                                                      | —                                                                                                        |
| 3   | Specify   | "Slider clamps at 5%. Above 5%, the sheet rolls into a justification step: 'Above 5% requires Main Manager. >10% also requires CEO.'" | —                                                                                                        |
| 4   | Perform   | "Enter requested 12% + justification. Submit."                                                                                        | "Receive request. See justification + quote totals + new total at 12% off + current vs proposed margin." |
| 5   | Perceive  | "Status pill on quote: 'Discount request: 12% pending Main Manager.'"                                                                 | "Approval queue carries the discount request, distinct from quote-approval items."                       |
| 6   | Interpret | "Wait. (May log a comms entry on the client to keep them informed.)"                                                                  | "Approve, reject, or modify — modify lets the approver counter-propose a lower %."                       |
| 7   | Compare   | "Discount granted at 12% (or modified to 9%, etc.). Updated total visible on quote. Client receives revised PDF."                     | "Request resolved; queue clean."                                                                         |

**Norman flag on the modify path:** allowing the approver to _counter-propose_ a different % is a soft middle path (rather than forcing reject-and-restart). Norman: _Reject is a peer button, not a tertiary; reason templates speed it up; "Request changes" exists as a soft middle path._ Same principle applies here.

## Slip catalogue (Norman taxonomy)

| Slip                                      | Where it lives                                                                                    | Mitigation                                                                                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Capture error in succession**           | CEO approves three quotes in a row on phone; the third needed scrutiny but got muscle-memory tap. | Tap-and-hold confirmation on Approve, OR a tap-then-confirm dialog showing the quote total + requested discount.                                                           |
| **Knowledge-based mistake**               | Approving without checking margin vs target.                                                      | Margin shown as a colored pill above the Approve button — green/amber/red against rate-card baseline; for discount requests, shows current vs proposed margin both.        |
| **Mode error on policy change**           | Admin changes Tiered → Sequential mid-deal; in-flight requests run under stale rules.             | Policy edit screen surfaces a banner if any pending requests exist: "Apply new policy to existing pending requests, or keep them on the old policy?"                       |
| **Asymmetric action design**              | "Approve" easy, "Reject" requires reasons → implicit pressure to approve.                         | Reject is a peer button; reason templates speed it up; "Modify" exists as a soft middle path for discount requests.                                                        |
| **Capture error on slider/numeric input** | Sales rep types `25` intending `2.5`.                                                             | Discount input is a slider (clamped to the policy ceiling) + a stepped numeric field with whole-percent or half-percent granularity. Free numeric typing is a slip magnet. |

## Screen inventory

**Existing surfaces this activity touches:**

| Screen                       | Path                                                                          | Status                                      |
| ---------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------- |
| Quote detail with action row | `app/[locale]/(dashboard)/quotes/[id]/page.tsx`                               | ✅ built; needs configurable-chain refactor |
| Approvals queue              | `app/[locale]/(dashboard)/approvals/page.tsx` (if it exists; otherwise inbox) | ⚠️ varies — confirm                         |

**Gaps surfaced by the corrected model:**

1. **Pricing Policy admin screen** — `app/[locale]/admin/pricing-policy/page.tsx`. Mode picker (radio), tier editor, sequential editor, live preview, save with "apply to pending?" prompt.
2. **Approval chain visualization on quote detail** — replaces the current hardcoded L1/L2 panel. Shows the current stage in the chain with names, with the policy snapshot link.
3. **Discount Grant + Discount Request sheets** — `components/quotes/discount-grant-sheet.tsx`, `components/quotes/discount-request-sheet.tsx`. Slider clamped to ceiling; auto-rolls into request form above the ceiling.
4. **Discount audit strip** — under the line items on the quote detail; reverse-chronological log of grants + requests + approvals.

## Open questions

1. **Default Pricing Policy on day-1** — should the system ship a sensible default (e.g. 5% ceiling, tiered: ≤10% Main Manager, >10% CEO) so the screen isn't blank? Yes, by default — confirm specifics.
2. **Modify vs Counter-Propose** — should the approver-modify path be the canonical alternative to Reject, or is Counter-Propose a separate action with notification semantics? Currently treated as a Modify action.
3. **Discount on top of an already-approved quote** — a sales person grants 3% (within ceiling) on a quote already at Approved status. Does this trigger a new approval chain or auto-apply because it's within the sales ceiling? Currently assumed: auto-apply within ceiling; only above-ceiling triggers a chain.
