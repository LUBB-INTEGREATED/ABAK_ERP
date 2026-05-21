# A5 — Quote Dispatch + Outcome (and 1-click Project conversion)

**Status:** Rewritten 2026-05-21 per the corrected client journey. Companion to [A4 — Quote approval](a4-quote-approval.md) and [the journey master doc](../CORRECTED_CLIENT_JOURNEY.md).

## Activity goal

Send the approved quote to the client through the agreed channel, record the outcome (Won, Lost, Postponed), and — when Won — turn the quote into a live Project with a single click. Success = no quote sits in Sent longer than the configured follow-up cadence without an outcome; every Won quote becomes a Project the same day.

## What changed in the correction

- **No auto-mint PO step.** On Won, the **Department Manager** sees a "Convert to Project" CTA on the quote (with inline preview of what will be created) and converts in one click. Phases derive from line items; departments + payment schedule + docs + gantt blocks carry over. The PO concept is folded into the Project's commercial confirmation (validated by Finance Officer downstream).
- **Sales Person handles negotiation end-to-end.** They mark Won, Lost, or Postponed. The Won surface includes signature attachment + award date.
- **Department Manager is the actor on conversion**, not the Sales Person. The sales side's responsibility ends at "Won"; the delivery side picks up at "Convert."

## Personas (swimlanes)

| Persona                | Role on this activity                                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Sales Person**       | Dispatches the quote (channel + cover message). Owns follow-up. Records outcome. On Won, attaches the client's signed copy + award date. |
| **Department Manager** | On Won: reviews the inline preview, clicks "Convert to Project." Wires phase ↔ licence dependencies as the last step of conversion.      |
| **Sales Manager**      | Oversight; intervenes on stuck Sent quotes.                                                                                              |
| **System**             | Auto-expires past-validity quotes; on Convert, creates the Project record with inherited fields.                                         |

## Seven-stage walkthrough — Dispatch & Outcome

| #   | Stage     | Sales Person                                                                                                                       | Sales Manager                                              | System                                                                        |
| --- | --------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Goal      | "Get this to the client and follow up."                                                                                            | "Watch for Sent quotes going dark."                        | —                                                                             |
| 2   | Plan      | "WhatsApp or email? Client preference?"                                                                                            | —                                                          | —                                                                             |
| 3   | Specify   | "Open quote. Preview PDF (sanity check). Pick dispatch channel."                                                                   | —                                                          | —                                                                             |
| 4   | Perform   | "Send — or download PDF + send externally (MVP). Status → Sent, sentAt stamped. Log the dispatch in the comms timeline."           | —                                                          | "Cron checks validUntil; auto-expires past-date quotes."                      |
| 5   | Perceive  | "Status pill: Sent. Toast confirms."                                                                                               | "Sent count visible on dashboard."                         | "Auto-expiry runs daily; quote moves to Expired if no outcome by validUntil." |
| 6   | Interpret | "Client responding? Negotiating? Going dark? Log each interaction on the client's comms timeline."                                 | "Any Sent quotes >14 days without comms entry? Intervene." | —                                                                             |
| 7   | Compare   | "Record outcome: Won (attach signed copy + award date) → triggers conversion notification. Lost (reason). Postponed (until-date)." | "Win-rate trend healthy for this rep / service?"           | —                                                                             |

**Gulf-of-Execution pinch point** — "Send" today is download-PDF-and-send-externally; the system doesn't actually email/WhatsApp the client. The Sales Person must remember to mark "Sent" after sending. Mitigation: "Preview & print" button (shipped 2026-05-18) shows what the client sees; "Mark as sent" button is highlighted in the action row after preview is opened.

**Gulf-of-Evaluation pinch point** — Quote sits in Sent; the Sales Person doesn't know if the client opened it (no read receipt in MVP). Mitigation: nudge the rep to log an interaction within 3 days of Sent ("How did your last touch on this quote go?"). The comms log on the client/lead picks this up.

## Seven-stage walkthrough — 1-click Project conversion

| #   | Stage     | Sales Person                                                                                       | Department Manager                                                                                          |
| --- | --------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | Goal      | "We Won. Mark it."                                                                                 | "Get the project rolling."                                                                                  |
| 2   | Plan      | "Open the Won sheet. Upload signed copy. Pick award date."                                         | "Open the quote. Inline preview shows what the project will look like."                                     |
| 3   | Specify   | "Submit the Won sheet."                                                                            | "Click Convert to Project."                                                                                 |
| 4   | Perform   | "Status → Won. Department manager(s) of involved depts get notified."                              | "Wizard creates the project. Final step: wire phase ↔ licence dependencies (with 'do later' escape hatch)." |
| 5   | Perceive  | "Toast: 'Won. Department manager notified.' Source quote pill now says Won · awaiting conversion." | "Toast: 'Project P-2026-0091 created from QUO-2026-0142.' Navigates to the new project's Gantt tab."        |
| 6   | Interpret | —                                                                                                  | "Review the Gantt; phases derive from line items 1:1 by default. Refine if needed."                         |
| 7   | Compare   | "Source quote pill: Won · P-2026-0091."                                                            | "Project is Active."                                                                                        |

**Gulf-of-Execution pinch point** — conversion is currently a manual project-creation form in some legacy ERPs; here it's one click. The signifier is unambiguous because the manager sees the _inline preview_ (phases that will be created, payment schedule, docs) before clicking. Norman: _get the mapping right — the action sits where the activity continues._

**Gulf-of-Evaluation pinch point** — if the manager converts then realizes a scope change came up in final negotiation, they need a reverse. Mitigation: the conversion is **reversible within 24 hours** via "Undo conversion" on the new project page. After 24h, the project is locked in; further changes happen through the project edit surface.

## Slip catalogue (Norman taxonomy)

| Slip                                          | Where it lives                                                                                                         | Mitigation                                                                                                                                                                                                                                                  |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Memory-lapse on signature attachment**      | Sales Person marks Won without uploading the client's signed copy.                                                     | Won sheet's "Confirm Won" button is disabled until a signed file is attached AND an award date is selected. Contract Article 11 requires written acceptance — justified forcing function.                                                                   |
| **Description-similarity**                    | Wrong client picked when sending externally (rep grabs the wrong PDF).                                                 | PDF filename is `QUO-YYYY-XXXX-ClientName.pdf` so the rep sees what they're attaching.                                                                                                                                                                      |
| **Mode error**                                | Negotiating vs Negotiating-with-discount-request — both exist; sales person unsure which to pick on the status picker. | Status picker shows a one-line description of each, not just the enum name. Discount-request status is auto-set by the discount request, not picked manually.                                                                                               |
| **Memory-lapse on outcome**                   | Forgetting to record the outcome → quote sits in Sent indefinitely.                                                    | After 14 days Sent, an at-risk badge appears on the quote; weekly digest emails the sales person.                                                                                                                                                           |
| **Capture error on conversion**               | Manager clicks Convert then realizes scope changed in final negotiation.                                               | Conversion is reversible within 24h via "Undo conversion" on the project detail page.                                                                                                                                                                       |
| **Memory-lapse on licence dependency wiring** | Manager converts but forgets to wire phase ↔ licence dependencies in the final wizard step.                            | Wizard ends _at_ the licence-dependencies step, with a "Wire dependencies later" escape that adds a project-level warning chip until done. Norman: _every action surface tells the next-step story; don't drop the user back to "blank state" prematurely._ |

## Screen inventory

**Existing surfaces this activity touches:**

| Screen                                           | Path                                                                                       | Status                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Quote detail with action row + "Preview & print" | `app/[locale]/(dashboard)/quotes/[id]/page.tsx`, `app/[locale]/quotes/[id]/print/page.tsx` | ✅ shipped 2026-05-18                                                |
| Won / Lost / Postponed outcome sheet             | (inside quote detail)                                                                      | ✅ built; **needs Won-sheet signature-attachment + award-date gate** |
| Auto-expiry cron                                 | API only                                                                                   | ✅ shipped                                                           |

**Gaps surfaced by the corrected model:**

1. **Won sheet rework** — add required signature upload + award date input before Confirm Won is enabled. Replace the auto-PO mint with the manager-facing conversion notification.
2. **"Convert to Project" CTA on Won quotes** — visible to Department Manager(s) of the quote's involved departments. Inline preview panel showing the phases-to-be-created and the inherited payment schedule. Path: extend `quotes/[id]/page.tsx`.
3. **Project conversion wizard final step (licence dependencies)** — `components/projects/licence-dependencies-step.tsx`. Lists phases of the about-to-be-created project + lets the manager assign licence dependencies (or defer). Path: extend the conversion wizard.
4. **24h Undo Conversion** on the project page — `app/[locale]/(dashboard)/projects/[id]/page.tsx`. Surface only for 24h after creation; logs the action.

## Open questions

1. **Stuck-Sent threshold** — 14 days assumed in the slip table. Confirm right for ABAK sales cycle.
2. **Auto-mark-as-sent on PDF download** — when sales person downloads the PDF via Preview & Print, should the system auto-prompt "Mark this quote as Sent now?" Reduces the memory-lapse slip.
3. **Multi-department conversion** — when a multi-department quote is Won, which Department Manager sees the "Convert to Project" CTA? All of them, or only the Lead Pricer's manager? Currently assumed: the Lead Pricer's manager owns the conversion; the others are notified but cannot convert.
4. **Reverse conversion window** — 24h assumed. Confirm. Some shops want longer (a full week) for the same reason; the trade-off is locking in scope sooner gives delivery a stable target.
