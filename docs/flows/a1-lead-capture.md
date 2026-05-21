# A1 — Lead Capture

**Status:** Draft 2026-05-20. First flow mapped under [`README.md`](README.md).
**FigJam:** _pending — to be added once this markdown is signed off._

## Activity goal

Capture an incoming opportunity into the system as a `LEAD-YYYY-XXXX` record, without losing it (the channel-handoff problem) or duplicating it (the same prospect entering through two channels at once). Success = every prospect ABAK _touched_ yesterday is queryable today, with a single owner and a running SLA clock.

## Personas (swimlanes)

| Persona               | Role on this activity                                                                                                                                                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sales Person**      | Primary intake actor for manual channels (walk-in, referral, phone, repeat business, occasionally social/website re-entry when the auto-intake fails). Also the **single thread-of-record** for the client's communications log from the moment the lead is created. |
| **Sales Manager**     | Owns assignment policy + manual re-assignment. Triages the queue when auto-assignment is off.                                                                                                                                                                        |
| **System (no human)** | Intake actor for website form and future Google Maps webhook. Creates the lead, runs duplicate detection, fires auto-assignment, starts SLA clock.                                                                                                                   |

The CEO, Department Manager, Department Engineer, Project Manager, and Finance Officer are **not on this activity** — they don't appear on the swimlane.

## Channels (post-correction list)

The activity is the same; the channel changes who initiates it and which fields are required up front. Per the 2026-05-21 correction, `GOVERNMENT_TENDER` is no longer a top-level channel — government work shows up as licences inside normal projects (see [B3 — Licence lifecycle](b3-licence-lifecycle.md)). Channels map to the in-code `LeadChannel` enum:

| Code                     | Channel                             | Initiator                                    | Distinguishing required fields                  |
| ------------------------ | ----------------------------------- | -------------------------------------------- | ----------------------------------------------- |
| `REFERRAL`               | Word of mouth                       | Sales Person (manual)                        | referrer name, referrer phone, referrer company |
| `WALK_IN`                | Visit to office                     | Sales Person (manual)                        | none beyond defaults                            |
| `PHONE`                  | Inbound phone                       | Sales Person (manual)                        | caller phone, source mention if given           |
| `SOCIAL_MEDIA`           | Instagram / WhatsApp / etc.         | System (preferred) → Sales Person (fallback) | platform, profile handle                        |
| `WEBSITE`                | abak.com.sa form                    | System                                       | none beyond defaults                            |
| `GOOGLE_MAPS`            | Maps profile inquiry                | System                                       | maps link, maps review boolean                  |
| `EXISTING_CLIENT_REPEAT` | Repeat business from a known client | Sales Person (manual)                        | links to existing CLIENT-YYYY-XXXX              |
| `OTHER`                  | Anything else                       | Sales Person (manual)                        | free-text source note                           |

For all channels: name, phone, service interest are required defaults.

## The communications log primitive (new in the correction)

A `Lead` (and its successor `Client`) carries a **communications log** — the cross-cutting timeline that any contact with the prospect (call, WhatsApp, email, meeting, site visit, other) is appended to. The Sales Person is the **single thread-of-record**: every contact is logged here, regardless of who at ABAK made it. When a Department Engineer later contacts the client directly for site-visit logistics (see [A3](a3-rfq-assignment.md)), they log against the same timeline with themselves as actor and the Sales Person auto-CC'd.

**Affordance on the lead detail page:**

- Primary CTA top-right: **Log communication** opens a sheet with channel chips (Call / WhatsApp / Email / Meeting / Site visit / Other), date defaulted to _now_, actor defaulted to the current user, required note (brief), optional follow-up date inline.
- Secondary CTA next to it: **Add attachment**.
- Reverse-chronological timeline below the lead's vitals: channel icon + actor avatar + time + first 80 chars + expand-to-read-full.
- **"Last contact: 3 days ago"** pill at the top of the lead card — closes the evaluation gap on a per-lead basis without requiring a click into the timeline.
- Lead list view sortable/filterable by `daysSinceLastContact` — closes the evaluation gap across leads.

**Slip mitigation on the comms log:**

- **Memory-lapse on follow-up:** the comm log sheet has an inline "Schedule follow-up" toggle (default 3 working days). One screen, two outcomes; the follow-up is a side-effect of the log entry, not a separate task to remember.
- **Capture error on which lead:** the log sheet is opened from the lead detail page; the lead identity is locked at the top of the sheet; there's no lead-picker inside the sheet.

## Seven-stage walkthrough (Norman)

Walking the canonical _manual_ path (Sales Rep at a walk-in client). Auto-channel notes inline where the system replaces the human at a stage.

### Stage 1 — Goal

_"This person in front of me / on this tender notice could become a client. I need them in the system before I lose the thread."_

### Stage 2 — Plan

The Rep decides:

- Which channel category fits?
- Is this person already a client / already a lead? (memory check)
- Do I have everything I need (phone, name, what they want) to capture now, or do I need to draft and finish later?

**For auto channels:** there is no human plan — the system has already fired its intake webhook by the time anyone notices.

### Stage 3 — Specify

The Rep opens the intake form: `/leads/new`. Picks channel. The form reshapes to that channel's required-field set.

**Gulf-of-Execution pinch point:** A first-time user staring at the seven channel options has to translate a real-world situation ("a guy walked into the showroom") into a channel code. Mitigation: channel picker leads with a one-line _description_ of the situation, not the enum name. E.g.: `Walk-in — visited the office or showroom in person.`

**Slip risk here:** **mode error** — picking REFERRAL when the lead actually came in via the website form and was just _introduced_ by a referrer. The picker copy must clarify "the channel = how did this prospect originally reach us, not who told us about them"; a separate `referredBy` field captures the human if relevant.

### Stage 4 — Perform

The Rep fills required fields + optional context, submits.

**Live signals during this stage:**

- Phone/email **duplicate detection** runs as the Rep types. If a match is found (existing client or existing lead), the form surfaces a non-blocking warning above the submit: _"This phone matches CLIENT-2024-0381 (Al-Faisal Holding). Continue as a new lead, link to that client, or open the existing record?"_
- Required-field validation is **inline on blur**, never on every keystroke (per MASTER §9).
- "Save draft" is a peer to "Save & assign" — the Rep can step away mid-form (a client calls them mid-intake) without losing data.

**Auto-channel parallel:** The system runs the same duplicate detection. If a match, it appends to the existing lead (or creates a linked one) rather than creating a silent duplicate.

### Stage 5 — Perceive

The Rep sees:

- A toast: _"Lead LEAD-2026-0042 created. Assigned to you (or to: $name)."_
- Redirect to the lead detail page showing the populated record, the SLA chip (e.g., "Respond within 4 hours — clock started"), and the assigned owner.

**Gulf-of-Evaluation pinch point:** if assignment happens silently and the Rep doesn't notice the owner field, they may not know whether the lead is theirs to chase or someone else's. Mitigation: the toast names the assignee; the detail page header puts assignee left of the title, not in a sidebar.

### Stage 6 — Interpret

The Rep understands:

- Whether they own follow-up or it's been routed away
- The SLA window (the system makes this a chip with absolute time AND relative countdown — "by 14:30 today (in 3h 12m)")
- Whether the lead is connected to an existing client (returning) or net-new

### Stage 7 — Compare

Was the original goal met? Did the prospect actually land as a queryable, owned, time-bound lead?

**The compare step is where the activity quietly succeeds or fails.** If the Rep moves on without checking — and the lead silently failed validation, or got merged into an old archived record — the lead is _gone_. Mitigation: the lead detail page is the redirect target by default (not the list view); the SLA chip is the most prominent element so the time-bound nature is impossible to miss; if the rep dismisses the detail page within 5 seconds, a soft "Lead saved — open detail" persistent banner stays on the list view for the next minute.

## Slip catalogue (Norman taxonomy)

| Slip type                   | What it looks like here                                                                                                                                                 | Mitigation                                                                                                                                                                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description-similarity**  | Two clients with near-identical names cause the new lead to be (a) wrongly linked to the wrong existing record, or (b) wrongly created as net-new when a match existed. | Duplicate-detection match list shows CR# / city / phone-tail / last-interaction-date — not just name. The "link to existing" button shows the existing record's contact name in confirmation, not just the ID.                                        |
| **Capture error**           | Rep is in muscle-memory "fill form fast" mode; picks the previously-used channel from a sticky dropdown instead of the correct one for this lead.                       | Channel picker has no sticky default — must be picked per lead. Channel choice is irrevocable post-creation only via a "change channel with reason" admin action (slight friction = intentional).                                                     |
| **Memory-lapse**            | Mid-form, Rep gets a phone call, comes back, forgets which fields were filled.                                                                                          | Auto-save every 5s; a visible "Draft saved at 14:23" stamp; the form preserves through navigation away. "Save draft" available even with partial required fields.                                                                                     |
| **Mode error**              | A walk-in lead gets entered under REFERRAL because the visitor was introduced by an existing client. The actual _origin_ (walk-in) is lost.                             | Channel picker description copy distinguishes "how did it reach us" vs "who told us about it." A `referredBy` field is present on every lead to capture the human, so the rep doesn't feel they're losing information by picking the correct channel. |
| **Knowledge-based mistake** | Confusion about the "Ready for RFQ" criteria → rep tries to mark a fresh lead as qualified-ready prematurely.                                                           | Out of scope for _this_ activity — that mistake belongs to A2 Pipeline progression. The intake form does not surface stage-progression actions; it only creates the lead in INCOMING status.                                                          |

## Screen inventory

**Existing surfaces this activity touches** (no new surfaces needed for MVP):

| Screen                                             | Path                                                            | Status                                       |
| -------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------- |
| Lead list with intake CTA                          | `packages/web/src/app/[locale]/(dashboard)/leads/page.tsx`      | ✅ built; DataState migrated 2026-05-19      |
| Manual intake form                                 | `packages/web/src/app/[locale]/(dashboard)/leads/new/page.tsx`  | ✅ built; duplicate-detection M1-016 shipped |
| Lead detail (post-creation redirect target)        | `packages/web/src/app/[locale]/(dashboard)/leads/[id]/page.tsx` | ✅ built; status badges migrated 2026-05-19  |
| Duplicate warning component (inline in /leads/new) | inside `leads/new/page.tsx`                                     | ✅ built (M1-016)                            |
| AI chatbot intake endpoint                         | API only — no UI                                                | ✅ built (M1-017)                            |
| Auto-assignment cron                               | API only                                                        | ✅ built (M1-015)                            |

**Gaps surfaced by walking the activity** (worth addressing before submission):

1. **Channel picker copy + value list refresh** — current form uses enum-style labels and still includes `GOVERNMENT_TENDER` (now removed). Drop the obsolete value; add `PHONE` and `EXISTING_CLIENT_REPEAT`; rewrite labels in situation-description form ("the prospect walked into our office", "a referrer phoned us about them"). One-day fix in `leads/new`.
2. **Post-creation banner on list view** — if the rep dismisses the detail page fast, there's no recovery surface that says "lead saved." Add a 60-second toast on the next list view visit. Half-day fix.
3. **SLA chip prominence** — the SLA chip on the lead detail page exists but is currently sidebar-positioned. Per the Gulf-of-Evaluation analysis, it should be in the header. Half-day fix.
4. **Channel-change-with-reason admin action** — does not exist; today the rep is stuck with the channel they picked. Low priority for MVP if rare; needed for the slip-mitigation in the table above.

## Open questions for the user

1. **Auto-assignment policy default for MVP** — the system supports round-robin / load-based / off (per `lead_auto_assign_strategy` setting). The activity flow is cleaner if MVP defaults to **round-robin** (every lead has an owner immediately, no manager-triage delay). Confirm?
2. **Duplicate-detection threshold** — current implementation matches on exact phone OR exact email. Worth fuzzy-matching on name + city? (Description-similarity slip prevention.) Defer to v2 unless flagged.
3. **Channel-change-with-reason** — does ABAK actually need to change a lead's channel after creation? Or is the current "you're stuck with it" the desired immutability? Norman lean: allow with audit trail; cheap insurance against rep mistakes.
