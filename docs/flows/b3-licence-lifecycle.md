# B3 — Licence Lifecycle (project-attached)

**Status:** Rewritten 2026-05-21 per the corrected client journey. Supersedes the deleted _B3 — Government Transaction Lifecycle_. Companion to [A6 — Project execution](a6-project-execution.md) and [the journey master doc](../CORRECTED_CLIENT_JOURNEY.md).

## Activity goal

Track every government licence (building permit, demolition permit, civil-defense approval, MODON licence, commercial registration, etc.) that an active project depends on. Move each licence from `Applied` → `UnderReview` → `Issued` (or `Rejected`), with the dependent project phases hard-blocked until the licence is `Issued`. Success = no project phase ever starts against a non-issued licence; the engineer always knows what's pending and where to check it; the project's paused-time is visible and excluded from slip math.

## What changed in the correction

- **No separate "Government Transaction" entity, no separate `/gov-transactions` route.** Licences are **resources on the project**, not a parallel system.
- **No PRO (Government delegate) role.** The **Department Engineer** assigned to the relevant project phase owns the licence application — they go to the government portal, file the request, and bring back the ID + portal URL + applied date.
- **Phase ↔ Licence dependency is explicit.** The Department Manager (or PM) wires which phases depend on which licences. A phase whose dependent licence is not yet `Issued` is **hard-blocked from starting** — the start button is disabled, the gantt bar renders paused (desaturated + dashed), and a banner names the missing licence.
- **Project enters Paused state** while any due-to-start phase is blocked by a licence. Paused intervals **do not count as slip**.
- The "weekly status BR" cadence is replaced by a per-licence reminder cadence (admin-configurable, default every 5 working days while status ∈ `{Applied, UnderReview}`).

## Personas (swimlanes)

| Persona                                         | Role on this activity                                                                                                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Department Engineer**                         | Primary actor. Applies for the licence on the gov portal, creates the licence record on the project (ID, URL, applied date, attachments), updates status as it progresses, flips to Issued on receipt. |
| **Department Manager** (or **Project Manager**) | Wires phase ↔ licence dependencies. Reviews paused projects and unblocks where possible.                                                                                                               |
| **CEO**                                         | Only role with the **licence-exemption override** — can mark a phase "Start without licence (formal exemption)" with mandatory justification (audit-logged; expected to be rare).                      |
| **System**                                      | Cron checks Applied/UnderReview licences for the reminder cadence; on `Issued` flip, cascades phase unblocking + project unpause.                                                                      |

## Seven-stage walkthrough

| #   | Stage     | Department Engineer                                                                                                                                                  | Department Manager / PM                                                                                                    | System                                                                                                                |
| --- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | Goal      | "This phase needs a Building Permit before I can start it."                                                                                                          | "Make sure the right phases are wired to the right licences."                                                              | —                                                                                                                     |
| 2   | Plan      | "Identify the portal (Balady / Salama / Etimad / MODON). Gather required docs. File."                                                                                | —                                                                                                                          | —                                                                                                                     |
| 3   | Specify   | "Open the project's Licences tab. Click 'Add Licence'. Side sheet: licence name, portal name + URL, status = Applied, applied date, attach the application receipt." | "On the project's Gantt or Phases tab, click a phase → 'Depends on licences' picker → tick the licences this phase needs." | "Daily cron at 07:00: scan Applied/UnderReview licences; flag those past reminder cadence as 'Status check overdue'." |
| 4   | Perform   | "Periodically update status as the authority moves it. Add the request ID once issued by the portal. Attach issuance copy. Flip to Issued."                          | "Wire the dependencies."                                                                                                   | "Send reminder notification to licence owner; update banner on project header."                                       |
| 5   | Perceive  | "Status pill on the licence row updates. Gantt phase chips reflect dependency status."                                                                               | "Project header shows 'Paused (waiting on Building Permit · applied 2026-04-10)' when any blocking licence is non-Issued." | "On Issued: cascade phase unblocking. Banner appears on project: '3 phases unblocked. Updated timeline saved.'"       |
| 6   | Interpret | "If Rejected: read the authority's reason; remediate; create a new linked licence (re-application)."                                                                 | "Plan around paused phases — reassign engineers to other projects in the meantime if useful."                              | "Paused interval recorded for reporting."                                                                             |
| 7   | Compare   | "Licence Issued; dependent phases startable; banner clears."                                                                                                         | "Project no longer paused."                                                                                                | "Project's paused-days total updated."                                                                                |

**Gulf-of-Execution pinch point** — the engineer is mid-portal, switching between the gov portal in one tab and the licence row in another. The portal's request ID needs to be copied accurately. Mitigation: licence row has a "Copy request ID" affordance (clipboard icon) once entered; the portal URL is a single-click open-in-new-tab; the licence row's last-checked timestamp is updated automatically whenever any user opens the portal URL (so the team can see who recently looked).

**Gulf-of-Evaluation pinch point** — the engineer wants to know what changed since they last looked at the licence. Authorities may have posted comments; the portal might show a new state. The system doesn't integrate with the portals (no API), so it relies on the engineer's manual check. Mitigation: per-licence reminder cadence (admin-configurable, default every 5 working days while Applied/UnderReview); the licence row shows "Last checked: 4 days ago" so the engineer knows when they last looked; the next reminder fires on the 5th day.

## Slip catalogue (Norman taxonomy)

| Slip                                      | Where it lives                                                                                    | Mitigation                                                                                                                                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Capture error on request ID**           | Engineer types the wrong portal request ID into the licence record.                               | Free-text field with a "Verify" button alongside that opens the gov portal URL in a new tab, so the engineer can paste-compare without leaving the screen.                                                                              |
| **Description-similarity**                | Two licences with similar IDs (`BLDG-PRM-7821` vs `BLDG-PRM-7281`).                               | Licence list shows portal name + applied date + status + issued date (where relevant) — never just the ID.                                                                                                                              |
| **Memory-lapse on licence wiring**        | Department Manager creates the project but forgets to wire which phases depend on which licences. | Project conversion wizard ends at the "Wire licence dependencies" step (not auto-dismissed); the project header shows a warning chip until at least one phase has dependencies or the manager explicitly confirms "no licences needed." |
| **Memory-lapse on status check**          | Licence sits at Applied for weeks because nobody checks.                                          | Per-licence reminder cadence (default every 5 working days for Applied/UnderReview); in-app + email reminder to the licence's owner.                                                                                                    |
| **Mode error on rejection**               | Engineer treats a Rejected licence as a "still pending" record and keeps waiting.                 | Rejected status renders with a distinct (red-tone) badge + a "Remediate" CTA that creates a new linked licence record, with the rejection reason carried over to the new record's notes.                                                |
| **Knowledge-based mistake on dependency** | An engineer attempts to start a phase whose dependent licence isn't Issued.                       | Phase Start button is **hard-blocked** when any dependent licence ≠ Issued; tooltip points to the blocking licence(s); on the Gantt, the phase bar renders in a paused tone.                                                            |

## Screen inventory

**Existing surfaces this activity touches:**

| Screen          | Path                                              | Status                                                                   |
| --------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| Project detail  | `app/[locale]/(dashboard)/projects/[id]/page.tsx` | ✅ built; **needs Licences tab + paused-phase rendering on the Gantt**   |
| Gantt component | `packages/web/src/components/projects/gantt.tsx`  | ✅ built; **needs licence-dependent phase chip + paused-tone rendering** |

**Gaps surfaced by the corrected model:**

1. **Project Licences tab** — `app/[locale]/(dashboard)/projects/[id]/licences/page.tsx` (or as a tab inside `projects/[id]/page.tsx`). Lists all licences for the project with status, portal link, request ID, dates, attachments.
2. **Licence row component** — `components/projects/licence-row.tsx`. Single row with the data fields + copy-id + open-portal + verify + Remediate (for Rejected).
3. **Add Licence side sheet** — `components/projects/add-licence-sheet.tsx`. Form for licence name, portal name + URL, applied date, attachment.
4. **Phase ↔ Licence dependency picker** — `components/projects/phase-licence-picker.tsx`. Multi-select against the project's licence list, attached to each phase row.
5. **Gantt licence-dependent rendering** — extend the existing component: small licence chip on the phase bar; paused tone when blocking licence ≠ Issued; banner overlay "Waiting on [licence name]" on the bar.
6. **Project header paused-state pill** — when `timelineState = Paused`, header shows "Paused (waiting on N licence(s))" with click-to-Licences-tab.
7. **CEO-only licence-exemption override** — `app/[locale]/(dashboard)/projects/[id]/phases/[phaseId]/override-licence/` (or similar). Hidden from engineer + manager surfaces by default; surfaces on a CEO-targeted approvals queue when manually invoked. Justification field is required + audit-logged.
8. **Per-licence reminder cron** — extend the existing cron framework. Per-licence schedule based on admin-configurable cadence; sends in-app + email.

## What to do with the existing `/gov-transactions` surface

The current code has `app/[locale]/(dashboard)/gov-transactions/page.tsx` + `[id]/page.tsx` and an API surface for the obsolete `GovTransaction` model. Migration plan:

- **Data migration:** existing rows (if any) need to be mapped onto the new `Licences` model attached to the relevant project. Without project linkage, they become orphaned — handle by linking to a placeholder "Legacy" project or by explicit admin review.
- **Route:** redirect `/gov-transactions` to a project-licences index (cross-project view, optional) or 410 it.
- **Model:** `gov_transactions` table becomes obsolete; `licences` table replaces it. Schema changes are coordinated with the [`Module 6 — Projects`](../../Process/) spec rewrite.

## Open questions

1. **Cross-project licence index** — useful (e.g., "all my open Building Permits across projects") or noise (engineers think project-by-project anyway)? Currently assumed: project-by-project for MVP; cross-project view deferred.
2. **Licence types catalog** — should the system ship a configurable catalog of licence types per department (e.g., Safety dept's licences: Civil Defense Approval, Salama Submission, etc.) so the "Add Licence" sheet has a picker rather than free text? Reduces description-similarity slips on licence names; admin work to maintain. Currently assumed: free text in MVP, with a per-dept library deferred to v2.
3. **Reminder cadence default** — 5 working days assumed for Applied/UnderReview. Confirm for ABAK's portal experience; some portals (e.g., Balady) move fast, others (e.g., Civil Defense) sit for weeks — per-portal defaults could replace the global one.
4. **CEO-exemption discoverability** — where does the CEO see the option to override a phase block? Listed in their approvals queue when an engineer/manager explicitly requests it? Or always visible to the CEO on the project page? Currently assumed: surfaces only when requested (manager → CEO).
