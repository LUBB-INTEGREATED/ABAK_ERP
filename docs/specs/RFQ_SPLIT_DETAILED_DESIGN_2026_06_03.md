# RFQ Sales/Tech Split — Detailed Surface Design (generated)

> Companion to `RFQ_SALES_TECH_SPLIT_2026_06_03.md`. Produced by a 4-agent design workflow (sales surface, quotations pipeline, data/API/migration) + adversarial critic on 2026-06-03. The **pre-build blockers** distilled from the critique live in the main spec §13.

---

# PART A — SALES "My Requests" surface

I now have everything I need: the existing list/tracker, the requests panel (currently engineering-side raise UI, no sales responder), the design rulebook (Norman-grounded, DataState, 5-token status, RTL rules), the state primitives, and the i18n surface. I'll write the complete spec.

I have enough to produce the spec. Returning it now.

---

# Sales "My Requests" — UX Design Spec

> Surface: `/rfqs` (list) + `/rfqs/[id]` (tracker). Audience: **sales reps & sales managers only**. This is a **tracker**, not a workboard. The rep raises a request, watches it move, answers when engineering asks for something, sends the quote, records the outcome. Every assign/pricing/approval control is gone — it lives in Quotations now.

Grounded in: `DESIGN_SYSTEM_MASTER.md` (§2 status tokens, §3 signifiers, §4 action hierarchy, §5 RTL, §6 feedback, §8 four-state, §12 approval ladder), the existing `<DataState>`, `<EmptyState>`, `<ErrorState>`, `<DetailHeader/DetailBody/DetailRail>`, `<RfqStatusBadge>`, `<Sheet>`, and the live `RfqRequestsPanel`.

---

## 0. Vocabulary the rep sees (and never sees)

The rep thinks in **two words, not eleven enum values**. We collapse the backend `RfqStatus` (SUBMITTED · ASSIGNED · PRICING · CANCELLED · DECLINED) + derived quote states (QUOTE_READY · SENT · CLOSED) into **one human phase label** with a sub-line. The rep's mental model is a relay baton: _"I handed it off → they're working → I have a quote back → I sent it → it's closed."_

| Backend truth                                 | Rep-facing phase label (EN)                            | Phase label (AR intent)        | Tone token |
| --------------------------------------------- | ------------------------------------------------------ | ------------------------------ | ---------- |
| `SUBMITTED`                                   | **Submitted** — waiting on a department to pick it up  | بانتظار قبول القسم             | `info`     |
| `ASSIGNED`                                    | **With pricing team** — accepted, Lead Pricer assigned | لدى فريق التسعير               | `info`     |
| `PRICING`                                     | **Pricing in progress**                                | جارٍ إعداد العرض               | `warning`  |
| derived `QUOTE_READY` (quote.status APPROVED) | **Quote ready** — review & send                        | العرض جاهز — راجِع وأرسِل      | `success`  |
| derived `SENT` (quote.status SENT)            | **Sent to client**                                     | أُرسِل للعميل                  | `info`     |
| derived `CLOSED` won                          | **Won**                                                | تم الفوز                       | `success`  |
| derived `CLOSED` lost                         | **Lost**                                               | خسارة                          | `error`    |
| derived `CLOSED` postponed                    | **Postponed**                                          | مؤجَّل                         | `muted`    |
| `DECLINED`                                    | **Passed back** — needs re-routing                     | أُعيد إليك — يحتاج إعادة توجيه | `error`    |
| `CANCELLED`                                   | **Cancelled**                                          | أُلغي                          | `muted`    |

These map through `lib/status-tones.ts` (`rfqStatusVariant` — extend it; do **not** hand-roll a map per §17). A new `<RequestPhaseBadge>` wrapper in `entity-status-badges.tsx` reads the derived phase, not the raw enum.

---

## 1. `/rfqs` LIST — "My Requests"

### 1.1 Purpose & first scan

The rep opens this between site visits, on a phone, to answer one question: **"Is anything waiting on ME?"** So the list is **action-sorted, not date-sorted**. The default sort floats rows where the baton is back in the rep's court to the top:

**Default sort order (descending urgency to the rep):**

1. **Passed back** (DECLINED) — engineering bounced it, rep must re-route. Red left-border.
2. **Quote ready** — rep must review & send. Gold left-border.
3. **Open ask** — a doc/site-visit request is OPEN and unanswered. Amber left-border + amber dot.
4. **Sent to client** — rep should chase / record outcome. Blue.
5. Everything in-flight (Submitted / With pricing / Pricing) — informational, no action.
6. Closed (Won/Lost/Postponed/Cancelled) — sinks to the bottom, muted.

This is the single most important opinion in the list: **sort by who-owes-the-next-move, then recency within each band.** A rep should never have to read every row.

### 1.2 Header

- Title: **My Requests** (`rfq.title` is repurposed; keep module label literal). Subtitle: _"Quotes you've raised — track them and act when something's waiting on you."_
- Primary action top-end (top-**left** in RTL per §4): there is **no "New RFQ" button here** — RFQs are born on the lead card via `RequestRfqDialog`. Instead a quiet secondary link: **"Raise from a lead →"** routing to `/leads` (the real entry point). This avoids a dead-end primary button that needs a lead first.
- A persistent **"Needs you (3)"** count chip beside the title — the sum of bands 1–3 above. It is the rep's whole reason to open the screen. Tappable → applies the "Needs me" filter.

### 1.3 Columns (desktop, ≤6 per §10)

| #   | Column         | Content                                                    | Notes                                                        |
| --- | -------------- | ---------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | **Ref**        | `RFQ-0042` and, once accepted, `QUO-118` underneath        | mono, LTR, `dir="ltr"` per §5. The two-ID rule made visible. |
| 2   | **Client**     | Company name (contact name as sub)                         | row click target                                             |
| 3   | **Scope**      | Service summary chips (first 2 + "+1")                     | derived from `serviceType` / categories                      |
| 4   | **Phase**      | `<RequestPhaseBadge>`                                      | the collapsed label, color-coded                             |
| 5   | **Waiting on** | "**You** — answer doc request" / "Pricing team" / "Client" | **this is the column reps read.** Bold when "You".           |
| 6   | **Updated**    | relative ("2h ago")                                        | sort tiebreaker; full date on hover                          |

Removed vs. today's list: **Coordinator** column, **Priority** column (priority is engineering's triage signal, not the rep's — it stays on the Quotations side), **Source** column (rep raised it; they know the source). The rep does not care who the coordinator is.

Whole row is the click affordance (§10), opens `/rfqs/[id]`. A 3px start-aligned colored left-border encodes the urgency band so the eye can triage the list in one vertical sweep without reading text.

### 1.4 Filters & sort

A single segmented control, not a dropdown the rep has to open:

`[ Needs me ] [ In progress ] [ Sent ] [ Closed ] [ All ]`

- **Needs me** is the default landing tab (bands 1–4). This is the opinionated default — open the screen, see your queue.
- Free-text search box (client / RFQ no / QUO no) — `type="search"`, max-w-xs, ms-auto.
- Sort dropdown is **secondary** and rarely touched: "Urgency (default) / Newest / Client A–Z". Filter chips persist across navigation in-session (§10).

### 1.5 ASCII wireframe — desktop list

```
┌───────────────────────────────────────────────────────────────────────────┐
│  My Requests                                       [ Raise from a lead → ]  │
│  Quotes you've raised — act when something's waiting on you.                │
│                                                                             │
│  ( Needs you · 3 )   [Needs me][In progress][Sent][Closed][All]   🔍 ____   │
├───┬──────────┬───────────────┬──────────────┬────────────────────┬─────────┤
│   │ REF      │ CLIENT        │ SCOPE        │ PHASE / WAITING ON │ UPDATED │
├───┼──────────┼───────────────┼──────────────┼────────────────────┼─────────┤
│ ▌ │ RFQ-0042 │ Al-Faisal Co. │ Struct +MEP  │ ● Passed back      │  10m    │ ← red
│ R │          │ Khaled A.     │              │  You · re-route    │         │
├───┼──────────┼───────────────┼──────────────┼────────────────────┼─────────┤
│ ▌ │ RFQ-0039 │ Reem Group    │ Architecture │ ● Quote ready      │   1h    │ ← gold
│ G │ QUO-118  │               │              │  You · send it     │         │
├───┼──────────┼───────────────┼──────────────┼────────────────────┼─────────┤
│ ▌ │ RFQ-0051 │ NEOM Sub.     │ Supervision  │ ● Pricing  ⬤ ask   │   3h    │ ← amber
│ A │ QUO-121  │               │ +1           │  You · 1 doc ask   │         │
├───┼──────────┼───────────────┼──────────────┼────────────────────┼─────────┤
│ ▏ │ RFQ-0048 │ Dar Eng.      │ MEP          │ ● With pricing team│   1d    │
│   │ QUO-119  │               │              │  Pricing team      │         │
├───┴──────────┴───────────────┴──────────────┴────────────────────┴─────────┘
```

### 1.6 Mobile layout (rep's primary device)

The table collapses to a **stacked card list** — not a horizontally-scrolling table (§10 forbids hidden columns on the rep's device). Each card is a 44px+ tap target.

```
┌─────────────────────────────────────┐
│ ▌ RFQ-0042 · QUO-118     ● Passed back│  ← colored left edge = band
│   Al-Faisal Co.                       │
│   Struct + MEP                        │
│   ┌───────────────────────────────┐   │
│   │ ⚠ You — re-route or close      │   │  ← the "waiting on you" strip,
│   └───────────────────────────────┘   │     amber/red filled when it's the rep
│                            updated 10m│
└─────────────────────────────────────┘
```

- The "Needs you" count chip is sticky at the top of the scroll under the header.
- The segmented filter becomes a horizontally-scrollable chip row; "Needs me" preselected.
- Closed items render at 60% opacity and are collapsed under a **"Closed (12) ▸"** disclosure so the active queue isn't buried.
- No row checkboxes, no bulk actions — the rep never batch-operates requests.

### 1.7 List states (via `<DataState>`)

- **Loading** → `<ListSkeleton rows={6}>` (mobile) / `<TableSkeleton rows={6} cols={6}>` (desktop). Skeleton matches the stacked-card height so layout doesn't jump (§8). **Never a center spinner.**
- **Empty (first-run)** → `<EmptyState>` with `icon=FileText`, warm copy + a real next step:
  - Title: **"No requests yet"**
  - Body: _"When you need a price for a client, raise it from their lead. It'll show up here and we'll keep you posted as the departments work it up."_
  - Action: **"Go to leads"** → `/leads`. (Per §8, first-run gets a CTA; this is the honest CTA since RFQs start on a lead.)
- **Empty (filtered)** → distinct copy, **no create CTA** (§8 hard rule): Title **"Nothing here"**, body _"No requests match this filter."_, action **"Show all"** (clears to All tab). Special case: filtered to **Needs me** and empty → celebratory-but-flat: _"You're all caught up. Nothing's waiting on you."_ (no button).
- **Error** → in-page `<ErrorState onRetry={refetch}>`: _"We couldn't load your requests. Check your connection and try again."_ + **Retry**. Never a stack trace.

---

## 2. `/rfqs/[id]` TRACKER

Reuses `<DetailHeader>` / `<DetailBody>` / `<DetailRail>` (the same shell as today) but the **body is no longer a 5-tab workboard**. It becomes a **single scrolling tracker column** with the rail showing facts. The rep reads top-to-bottom: _where is it → what did I ask for → what does it want from me → here's the quote → record the result._

### 2.1 Information hierarchy — what the rep sees 1st / 2nd / 3rd

1. **FIRST — the phase + the one thing to do now.** The header eyebrow shows the two IDs (`QUO-118 · from RFQ-0042`); the title is the client; the badge is `<RequestPhaseBadge>`. The **single primary CTA** in the header is the rep's _current_ next move, lifted out (mirrors today's "one primary in header" pattern, lines 124–165) — but now it's only ever a **sales** action: `Send to client` / `Record outcome` / `Re-route` / `Answer asks ↓`. If the baton is with engineering, there is **no primary button** — instead a calm status line: _"With the pricing team — nothing needed from you right now."_ (A disabled button with no reason is a false signifier, §3.)

2. **SECOND — Open Asks.** If anything is OPEN and owed by the rep, an **amber callout card sits directly under the header**, above even the timeline, because it's the only interactive thing on the page. If there are no open asks, this card is absent (not an empty shell).

3. **THIRD — the status timeline**, then the read-only request summary, then the quote card.

### 2.2 Section order (top → bottom)

```
[ Header: QUO-118 · from RFQ-0042 | Al-Faisal Co. | ●Quote ready | (primary CTA) | ⋯ ]

①  ⚠ OPEN ASKS  (only if any are OPEN & owed by sales) ───────────── amber card
②  STATUS TIMELINE  (the relay baton)
③  REQUEST SUMMARY  (scope / services / departments — read-only)
④  QUOTE  (review when ready → Send → then Won/Lost/Postpone)
⑤  ACTIVITY  (collapsed log: who did what, when — engineering-side included)
```

Right rail (`<DetailRail>`, becomes a **bottom block on mobile**):

- Quote total (`<RailStat tone="brand">`) once a quote exists.
- Client name + contact (tap-to-call on mobile).
- Lead link (`LEAD-2026-0007`) — back to where it started.
- "Raised by you on {date}", last update.

### 2.3 ASCII wireframe — tracker (desktop, quote-ready state)

```
┌─────────────────────────────────────────────────────────────┬───────────────┐
│ ‹ Back   QUO-118 · from RFQ-0042                             │  QUOTE TOTAL  │
│ Al-Faisal Holding Co.        ● Quote ready                   │  187,500 SAR  │
│ Khaled Al-Faisal                              [ Send to client ]   ⋯         │
│                                                              │  QUO-118      │
├─────────────────────────────────────────────────────────────┤───────────────┤
│ ② STATUS                                                     │  CLIENT       │
│  Submitted ─●─ With pricing ─●─ Pricing ─●─ Quote ready      │  Al-Faisal Co.│
│   ✓Mar 3     ✓Mar 4          ✓Mar 6      ◉ now               │  ☎ +9665…21   │
│   …………………………………………………………………… → Sent → Closed (pending)      │               │
│                                                              │  FROM LEAD    │
│ ③ REQUEST SUMMARY                              (read-only)   │  LEAD-26-0007 │
│  Services   Structural · MEP design                          │               │
│  Departments Structural Eng. · MEP                           │  Raised by you│
│  Scope      "Two-storey office retrofit, ~1,800 m²,          │  Mar 3, 2026  │
│              existing slab to be assessed…"                  │               │
│                                                              │               │
│ ④ QUOTE                                                      │               │
│  QUO-118   187,500 SAR   ●Approved   [ Review quote ↗ ]      │               │
│  Approved by Eng. Mgr · Mar 6.  Ready to send to the client. │               │
│  ┌──────────────────────────────────────────────────────┐   │               │
│  │   [ Send to client ]                                  │   │               │
│  └──────────────────────────────────────────────────────┘   │               │
│                                                              │               │
│ ⑤ ACTIVITY  ▸ (12)                                           │               │
└─────────────────────────────────────────────────────────────┴───────────────┘
```

### 2.4 Status timeline — visual (ASCII)

The timeline is the relay baton. In **RTL the timeline reverses direction** (past on the right, future on the left, §5) — mirror the layout, not just glyphs. Completed steps: solid gold/blue dot + date. Current step: pulsing ring (`◉`, respects `prefers-reduced-motion` — pulse becomes a static heavier ring). Future steps: greyed, dotted connector.

**Happy path:**

```
LTR →   Submitted ──● ── With pricing ──● ── Pricing ──◉ ── Quote ready ····  Sent ····  Closed
          ✓ Mar 3        ✓ Mar 4            now            (next)

RTL ←   مغلق ····  أُرسل ····  العرض جاهز ── ◉ التسعير ── ● لدى الفريق ── ● مُرسَل
```

**Declined branch (engineering passed it back):** the line forks _down-and-back_ toward sales, colored red, and the future steps grey out:

```
          Submitted ──●── With pricing ──◉
                                          ╲
                                           ╲  (Structural passed back)
                                            ▼
                                       ● Passed back to you  ← red node, action lives here
                                       └─ "Re-route" / "Close — no bid"
```

**Postponed branch (after Sent):** terminal but reopenable — rendered as a muted node with a "Postponed until {date}" chip and a quiet **"Reopen"** affordance:

```
          … Sent ──●── ◉ Postponed
                          └─ until Aug 2026   [ Reopen ]
```

**Cancelled:** the whole strip greys to muted with a single red ✕ node where it stopped; no further affordances.

### 2.5 Request summary (③) — strictly read-only

Scope, the selected services as chips, derived departments as chips (the same chips the rep picked in `RequestRfqDialog`), broker info if present, attachments the rep originally provided. **No edit controls** — once submitted, changes flow through asks, not silent edits. Uses `<DetailSection>` + `<FieldGrid>` + `<Field>` exactly as today's Overview tab (lines 290–315) — but with **assign/contributor controls deleted**.

### 2.6 Quote card (④) — the rep's payoff

- **Before ready** (Submitted/Assigned/Pricing): card shows _"No quote yet — the pricing team is preparing it."_ with the QUO number reserved once `rfq.quoteId` exists. No buttons.
- **Quote ready** (`quote.status = APPROVED`, derived QUOTE_READY): card shows total, approval line (who/when, §12 — _"Approved by {name} · {date}"_), **`Review quote ↗`** (opens the existing quote print/detail in the rep's read mode), and the **primary `Send to client`** button (also mirrored in header). Send is **irreversible → forcing-function modal** (§7): confirm channel (WhatsApp/Email), recipient, then toast + timeline advances to Sent.
- **Sent**: card flips to _"Sent {date} via WhatsApp"_ and surfaces the outcome controls: **`Won` · `Lost` · `Postpone`** as three distinct buttons (Won = solid gold/success, Lost = red text/destructive + mandatory reason, Postpone = outline + date). These move OFF the RFQ ONTO the quote (`quote.accept/reject/postpone`) but the rep doesn't know or care — to them it's "record the result."
- **Won** triggers the confirmation sub-form (PO/Payment/Contract + value + date) inline, matching today's outcome tab fields (lines 591–647) but as a focused step, not a buried tab.

---

## 3. OPEN ASKS responder (①) — the net-new surface

Today `RfqRequestsPanel` only lets **engineering raise** asks; `req.response` is display-only. This section adds the **sales responder UI**. It is the beating heart of "My Requests."

### 3.1 Placement & behavior

- Rendered as a distinct **`<OpenAsksCard>`** (amber-tinted, `border-warning/40 bg-warning/5` per §2 — warning = "needs human attention soon"), pinned under the header whenever ≥1 ask is `OPEN`.
- Card title: **"Open asks · {n}"** with a one-line subtitle: _"The pricing team needs this from you before they can finish."_ This narrows the gulf of execution — the rep knows exactly what's blocking the quote.
- Each ask is a row with a strong signifier of **who owes the answer** (a "You" badge), the requester (which department), the timestamp, and an inline **respond control**. Once answered, the row collapses to a muted "Provided" state and the engineering side gets a notification (§6 background-job pattern: in-app notification + the ask's status flips OPEN→RESOLVED).

### 3.2 Doc request responder

The engineer's `description` is shown verbatim (it was written to be forwarded — see `requestDocumentDescription` copy). The rep:

1. Reads what's needed (e.g. _"Updated CAD plan with the new mezzanine + soil-test report"_).
2. **Attaches a file** (`<input type=file>` styled as a dropzone button; multiple allowed) — sets `attachmentUrl`. On mobile this is the camera/photo picker (reps photograph paper docs on site).
3. Optionally types a note in `response` (e.g. _"Client only has the old CAD; soil test ordered, ETA Thursday."_).
4. Hits **`Mark provided`** → `useUpdateRfqDocRequest({status:'RESOLVED', response, attachmentUrl})`. Toast: _"Sent to the pricing team."_ Engineering is notified.

If the rep **can't** provide it, a quiet secondary **`Can't get this`** opens a 1-field reason → posts as the `response` and resolves with a flag, so engineering isn't left waiting on a doc that will never come.

### 3.3 Site-visit responder

The engineer gives `purpose` + a preferred window (`preferredDateFrom/To`). Today the only control is a raw `window.prompt` (`scheduleNow`, line 346) — **that is replaced**. The sales responder:

1. Reads purpose + preferred window (shown as a chip: _"Preferred: Mar 10 → Mar 14"_).
2. Provides an **access contact** (name + phone — net-new fields the rep fills; this is what engineering actually needs to get on site) and **confirms a date** via a proper `<Input type="date">` / time picker, not a prompt.
3. Optional notes (gate codes, parking, "ask for the facilities manager").
4. **`Confirm visit`** → `useUpdateRfqSiteVisitRequest({scheduledAt, notes, /* accessContact */})`. The ask stays OPEN-but-scheduled (shows the confirmed date chip) until engineering marks it complete. Toast: _"Visit confirmed — the engineer will be notified."_

> Note for backend: site-visit confirm needs to carry `accessContactName` / `accessContactPhone`. Today's `RfqSiteVisitRequest` only has `notes` — fold these in or pack into `notes` with labels for v1. Also: per the locked decisions, **raising** site visits needs the new `rfq:request_site_visit` permission on the engineering side; the **responding** here is gated by `rfq:request` (sales create+respond).

### 3.4 ASCII wireframe — Open Asks (mobile)

```
┌─────────────────────────────────────┐
│ ⚠ Open asks · 2                       │
│ The pricing team needs this from you. │
├─────────────────────────────────────┤
│ 📄 Document   · Structural Eng. · 3h  │
│ "Updated CAD plan with the new        │
│  mezzanine + soil-test report."       │
│  [ 📎 Attach file ]  ( + add note )   │
│  [ Mark provided ]      Can't get this│
├─────────────────────────────────────┤
│ 📍 Site visit · MEP · 1d   ⏷ scheduled│
│ "Verify riser locations before        │
│  pricing the retrofit."               │
│  Preferred: Mar 10 → Mar 14           │
│  Access contact ____  ☎ ____          │
│  Date [ 2026-03-12 ]  ( + notes )     │
│  [ Confirm visit ]                    │
└─────────────────────────────────────┘
```

### 3.5 Components named

`<OpenAsksCard>` (container) → `<DocAskRow>` + `<SiteVisitAskRow>` (the **sales** counterparts to today's engineering `<DocRequestRow>`/`<SiteVisitRow>`). Reuse `<Sheet>` only if a response needs space; inline-expand is preferred on mobile to avoid a sheet-on-sheet. File upload via a new `<FileDropButton>` wrapping `<input type=file>`.

---

## 4. Interaction state table

For each feature row: what the **user sees** in LOADING / EMPTY / ERROR / SUCCESS / PARTIAL.

| Feature                                | LOADING                                                | EMPTY                                                                                                                  | ERROR                                                                                     | SUCCESS                                                                                      | PARTIAL                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **List `/rfqs`**                       | Stacked-card / table skeleton (6 rows), header visible | First-run: "No requests yet" + "Go to leads". Filtered: "Nothing here" + "Show all". Needs-me: "You're all caught up." | In-page `<ErrorState>` + Retry; header stays                                              | Rows render, sorted by urgency, "Needs you" count populated                                  | n/a (list is all-or-nothing)                                                                                            |
| **Tracker `/rfqs/[id]`**               | `<DetailSkeleton>` (header + rail + body bars)         | Bad id → `<DetailError>` "We couldn't find this request." + Back                                                       | `<DetailError>` + Retry                                                                   | Full tracker; primary CTA = current move                                                     | Some sub-cards still loading (quote/asks) show their own inline skeletons while header is live                          |
| **Status timeline**                    | 3 ghost nodes                                          | n/a (always ≥1 node = Submitted)                                                                                       | Falls back to a plain phase badge if step data missing                                    | Nodes fill with dates; current pulses                                                        | If quote derived-state can't load: completed RFQ nodes show, derived tail greyed with "—"                               |
| **Open Asks card**                     | Skeleton row inside card                               | Card **hidden** entirely (no empty shell)                                                                              | Inline red strip in card: "Couldn't load asks." + Retry                                   | Amber card with N rows + count chip                                                          | Some asks RESOLVED (muted) + some OPEN (active) coexist — RESOLVED collapse, OPEN stay expanded                         |
| **Doc respond (attach + provide)**     | Button → "Sending…" + spinner, inputs disabled         | n/a                                                                                                                    | Field-level: "Upload failed — file may be too large (max 10MB). Try again." File retained | Row collapses to "Provided ✓ {date}", toast "Sent to the pricing team", engineer notified    | File attached but not yet submitted → "Mark provided" enabled; "Can't get this" still offered                           |
| **Site-visit respond**                 | "Confirming…" spinner                                  | n/a                                                                                                                    | "Couldn't confirm the visit. Try again." date retained                                    | Row shows confirmed-date chip, toast "Visit confirmed", engineer notified                    | Date set but no access contact → submit disabled, inline hint "Add a name and phone so the engineer can reach the site" |
| **Send to client**                     | Modal button "Sending…"                                | n/a (only shows when quote ready)                                                                                      | Modal stays open, red inline "Couldn't send — try WhatsApp instead?"                      | Modal closes, timeline → Sent, toast "Sent to {client} via WhatsApp", outcome buttons appear | Channel chosen but recipient missing → send disabled with reason                                                        |
| **Record outcome (Won/Lost/Postpone)** | Button "Saving…"                                       | n/a                                                                                                                    | Inline error, form retained                                                               | Phase → Won/Lost/Postponed, timeline terminal node, toast                                    | Won selected but no confirmation value/date → save disabled, "Add the PO value and date to log the win"                 |
| **Re-route (after decline)**           | "Re-routing…"                                          | n/a                                                                                                                    | "Couldn't re-route. Try again."                                                           | Back to Submitted with the corrected departments, toast                                      | Reason shown read-only from engineering; rep adjusting service selection before resubmit                                |

---

## 5. Status timeline visual — full ASCII (with branches)

```
 PRIMARY PATH (LTR; mirror for RTL)

  ●━━━━━━━━●━━━━━━━━●━━━━━━━━◉╌╌╌╌╌╌╌╌○╌╌╌╌╌╌╌╌○
  Submitted With     Pricing  Quote     Sent     Closed
            pricing            ready                (Won/Lost/Postponed)
  ✓Mar3    ✓Mar4    ✓Mar6     now

 DECLINED BRANCH  (engineering passed it back — baton returns to sales)

  ●━━━━━━━━●━━━━━━━━◉
  Submitted With     │
            pricing  ╲ Structural Eng. declined: "wrong department"
                      ▼
                 ◆ Passed back to you           ← red node; this is where action lives
                 ├─ [ Re-route ]  (fix services → resubmit → back to Submitted)
                 └─ [ Close — no bid ]  (terminal, muted)

 POSTPONED BRANCH  (after Sent — reopenable)

  …●━━━━━━●━━━━━━◑  Postponed
   Sent          until Aug 2026   [ Reopen → back to Sent ]

 CANCELLED  (rep or mgr stopped it)

  ●━━━━━━✕  Cancelled Mar 5   (whole strip muted, no affordances)
```

Legend: `●` complete · `◉` current (pulses) · `○` future (greyed) · `◆` red action node · `◑` muted terminal · `✕` cancel. Connectors solid for past, dotted `╌` for future.

---

## 6. Copy — real microcopy (EN + AR intent)

No happy-talk. Verbs over nouns. AR is primary; English shown with the AR _intent_ (not literal — a translator owns final AR).

**Buttons**
| EN | AR intent |
|---|---|
| Send to client | إرسال للعميل |
| Review quote | مراجعة العرض |
| Mark provided | تم التزويد |
| Can't get this | يتعذّر توفيره |
| Confirm visit | تأكيد الزيارة |
| Re-route | إعادة توجيه |
| Close — no bid | إغلاق — بدون عرض |
| Won / Lost / Postpone | فوز / خسارة / تأجيل |
| Reopen | إعادة فتح |
| Go to leads | الذهاب إلى العملاء المحتملين |

**Empty / status lines**

- List first-run: _"No requests yet. When a client needs a price, raise it from their lead — it'll land here and we'll keep you posted."_ → «لا توجد طلبات بعد. عند حاجة العميل لتسعير، ابدأ الطلب من بطاقته — سيظهر هنا وسنُبقيك على اطلاع.»
- Needs-me empty: _"You're all caught up. Nothing's waiting on you."_ → «كل شيء تحت السيطرة. لا شيء بانتظارك.»
- With-pricing (no action): _"With the pricing team — nothing needed from you right now."_ → «لدى فريق التسعير — لا حاجة لإجراء منك الآن.»
- Quote-ready: _"Quote's ready. Review it, then send it to the client."_ → «العرض جاهز. راجِعه ثم أرسِله للعميل.»

**Decline-received message (the important one)**

- _"Structural Engineering passed this back: wrong department. Re-route it to the right team, or close it as no-bid."_ → «أعاد قسم الهندسة الإنشائية الطلب: القسم غير صحيح. أعِد توجيهه للقسم المناسب أو أغلِقه دون عرض.»
- No-bid variant: _"MEP reviewed this and won't bid: out of scope. You can close it or send it elsewhere."_ → «راجع قسم الكهروميكانيك الطلب ولن يقدّم عرضاً: خارج النطاق. يمكنك إغلاقه أو توجيهه لجهة أخرى.»

**Open-asks subtitles**

- _"The pricing team needs this before they can finish your quote."_ → «يحتاج فريق التسعير هذا لإكمال عرضك.»
- Site-visit hint: _"Add a name and phone so the engineer can reach the site."_ → «أضِف اسماً ورقم هاتف ليتمكّن المهندس من الوصول للموقع.»

**Toasts** (§6: success auto-dismiss 4s, error sticky)

- Provided: _"Sent to the pricing team."_ · Confirmed: _"Visit confirmed — the engineer will be notified."_ · Sent: _"Sent to {client} via {channel}."_ · Won: _"Logged as won. Nice."_ (one beat of warmth, earned). · Error: _"That didn't go through. Try again."_

---

## 7. Responsive + accessibility

**Responsive (mobile-first — reps live on phones):**

- Single-column everywhere ≤640px. Rail becomes a bottom block. Tabs are gone (single scroll), so no horizontal tab overflow on mobile.
- Open-asks respond controls inline-expand (no nested sheets). File attach = native camera/photo picker.
- Sticky bottom **action bar** on the tracker when a primary action exists (Send / Record outcome / Answer asks) so the rep's thumb reaches it without scrolling back up — full-width 48px button.
- List: stacked cards, sticky "Needs you" chip, closed items collapsed.
- Desktop ≥1024px: two-column shell (`<DetailBody>` rail), 6-col table.

**Accessibility (§13 floors):**

- **RTL:** timeline reverses (past→right), all directional icons mirrored (back arrow, forward chevrons, drill-into-row, drawer slide); search/calendar/filter **not** mirrored. Primary CTA corner = top-**left**. Verify in both locales, not just `dir` flip (§5).
- **Touch:** every tap target ≥44px; outcome buttons and ask controls have generous hit areas. No hover-only actions (§3) — everything is a visible labeled button.
- **Numbers/IDs:** `RFQ-0042`, `QUO-118`, `187,500 SAR`, dates → `dir="ltr" font-mono`, Western digits, thousand separators (§5/§10). Currency contrast AAA (§13).
- **Color never alone (§13):** the urgency left-border is paired with a phase **label + icon**; "You" badge has text, not just color; declined node has a red ✕ **and** the word "Passed back."
- **Keyboard:** list rows reachable via Tab → Enter opens; segmented filter is a radio group; ask responders are real form fields with labels-above (§9), validation on blur not keystroke. Send-to-client modal traps focus, Esc cancels.
- **Screen-reader landmarks:** `<main>` for the tracker, `<nav aria-label="Request phases">` on the timeline with each node `aria-current="step"` on the active one, the Open-asks card is `<section aria-labelledby>` and announces the count, status badges expose `aria-label` with the full phase + waiting-on. `prefers-reduced-motion` kills the pulsing node (static heavier ring instead).

---

## 8. What is REMOVED from today's screen for sales

Hard deletions from the current `rfqs/[id]/page.tsx` (the 772-line mega-screen) for the sales surface:

1. **The entire "Team" tab** — `<PricerAssignments>`, the legacy assignment card (coordinator/technical contributor/financial reviewer), the `assignCoordinator` / `assignContributor` `<UserPicker>` blocks (lines 389–505). Sales never assigns anyone.
2. **`Start preparation` button** (`useStartPreparation`, lines 124–132, 323–332) — replaced by engineering's `startPricing` on the Quotations side. Gone from sales entirely.
3. **`Submit for approval` button** (`useSubmitForApproval`, lines 133–141, 333–342) — moves onto the Quote, owned by the Lead Pricer. Gone.
4. **`Dispatch to client` + the channel `<select>`** as the rep's main flow (lines 142–165, 343–374) — **conceptually folded into "Send to client"** on the quote card; the duplicated header-vs-overview copy of these buttons is collapsed to **one** primary.
5. **The "Requests" tab as a _raise_ surface** — the engineering `RfqRequestsPanel` (raise doc/site-visit, resolve, the `window.prompt` scheduler) does **not** appear on the sales surface at all. Sales only sees the **respond** counterpart (`<OpenAsksCard>`).
6. **The "Quote" tab as a separate destination** — promoted to an inline card in the single scroll.
7. **Duplicated action sets** — today actions appear _both_ in the header primary slot _and_ again in the Overview "Actions" `<DetailSection>` (lines 317–386). The duplication is removed: **one** canonical place per action (header primary + sticky mobile bar; never both inline and in header).
8. **Priority & coordinator** as rep-facing fields in the header/rail — these are engineering triage signals; they move to the Quotations side. The rep's rail shows quote total, client, lead link, "raised by you."
9. **The raw `RfqStatus` 10-value badge** — replaced by the collapsed `<RequestPhaseBadge>` (§0).

Net effect: the sales screen drops from a five-tab, all-roles-see-everything workboard to a **single-scroll tracker with exactly the rep's four possible moves** (answer asks, send, record outcome, re-route) and nothing else. Every control the rep sees, the rep can actually perform — no false signifiers.

---

**Files this spec touches when built:**

- `packages/web/src/app/[locale]/(dashboard)/rfqs/page.tsx` — rewrite to urgency-sorted, `<DataState>`-wrapped, segmented "Needs me" list with mobile stacked cards.
- `packages/web/src/app/[locale]/(dashboard)/rfqs/[id]/page.tsx` — strip to single-scroll tracker; delete Team tab + assign/prep/submit/dispatch controls.
- **New:** `packages/web/src/components/rfqs/open-asks-card.tsx` (`<OpenAsksCard>`, `<DocAskRow>`, `<SiteVisitAskRow>`), `packages/web/src/components/rfqs/request-timeline.tsx` (`<RequestTimeline>`), `<FileDropButton>`.
- `packages/web/src/components/ui/entity-status-badges.tsx` + `packages/web/src/lib/status-tones.ts` — add `<RequestPhaseBadge>` / phase variant mapping (do not hand-roll, §17).
- `packages/web/messages/{en,ar}.json` — new `myRequests.*` + `openAsks.*` keys (the microcopy in §6); repoint `rfq.title/subtitle`.

---

# PART B — QUOTATIONS pipeline (department surface)

I have everything I need. Here is the complete UX design for the Department surface.

---

# ABAK Quotations — Department Surface (Incoming → Pricing → Approval → Sent → Closed)

**Senior product design spec.** Lives inside `/quotes`. Module label stays **"Quotations" / عروض الأسعار**. This is the manager + pricer surface over a thin RFQ and the existing Quote. Sales never sees any of it.

A note on state vocabulary used throughout: the brief's locked decision collapses `RfqStatus` to **`SUBMITTED · ASSIGNED · PRICING · CANCELLED · DECLINED`**, with `QUOTE_READY/SENT/CLOSED` derived from `rfq.quote.status`. The current schema (`schema.prisma:1275`) still holds the legacy 10-state enum and `RfqRequestStatus` is `PENDING/RESOLVED/CANCELLED` (the panel component currently renders `OPEN`, a pre-existing drift). I design against the **target** states and flag the deltas in §11 (Migration & code deltas) so the build doesn't silently inherit the old screen's assumptions.

---

## 1. Nav + module shell

### 1.1 Sidebar — no change to the nav item

`/quotes` keeps its single sidebar entry under **Sales** (`nav.quotes`, `FileText`, perm `quote:view`). We do **not** add a second sidebar row. The department/pricing world is a _view mode inside_ Quotations, not a sibling route — adding a "Pricing" nav item would violate the lead→cash spine (§1 of MASTER: one route per activity stage) and fork the mental model.

The only sidebar consequence: the existing `quote:view` gate stays, but the **default landing view** is now role-derived (below). Sales reps who somehow reach `/quotes` (they shouldn't — their surface is `/rfqs`) get the flat list, never the board.

### 1.2 The shell: `<QuotationsShell>` — one route, three view modes + scope

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  عروض الأسعار  Quotations                          [ + عرض سعر جديد ]  [ ⟳ ]   │  ← page header
│  من الطلب إلى عرض السعر المُرسَل · إدارة التسعير                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│  [ Board ▣ ]  [ List ☰ ]      Scope: ( My queue ◉ | My dept | All )   🔎 ____  │  ← ViewToolbar
└──────────────────────────────────────────────────────────────────────────────┘
```

**Three controls, left-to-right (mirrored in RTL → board toggle sits top-right):**

- **View mode toggle** — `<SegmentedToggle>` `Board ▣ / List ☰`. Persisted per-user in `localStorage('quotes.view')`. Default resolved by role permission, not stored preference on first visit:
  - holds `rfq:assign_pricers` (manager) → **Board**
  - holds only `quote:build` (pricer, not manager) → **List**, scope pre-set to **My queue**
  - holds neither but `quote:view` (approver/CEO/finance) → **List**, scope **All**
- **Scope segmented control** — `My queue / My dept / All`. This is the visible, persistent **mode chip** that MASTER §7 demands (defeats the "mode error" slip — a pricer must never wonder _why a card vanished_; the scope chip answers it). Options gated:
  - _My queue_ = cards where I am an assignee (`RfqAssignment.assigneeId == me`) OR `quote.preparedById == me`.
  - _My dept_ = cards routed to a department I manage (`assertRfqInScope` / `rfqScopeWhere` already exists, `rfqs.service.ts:197-243`). Hidden if I manage no department.
  - _All_ = only shown to `rfq:assign_pricers` holders with org-wide scope or superusers; otherwise omitted entirely (not disabled — a disabled scope I can't use is a false signifier per §3).
- **Search** — `🔎` searches QUO#, RFQ#, client name, title. Non-directional icon → **not** mirrored in RTL.

The board and list render the **same dataset** under the same scope/search — the toggle only changes layout, never the filter. This is the single most important consistency rule: a manager flipping Board↔List must see the identical set, or trust collapses.

### 1.3 Where the old `/quotes` list + KPIs go

The current page (`quotes/page.tsx`) is the **List view**, near-verbatim, with two additions:

- A leading **`# RFQ`** column (mono, LTR) appears when a quote has a linked RFQ; blank for directly-created quotes. Makes the dual-ID legible in the table.
- A **`Stage`** column derived from the pipeline column (Incoming/Pricing/In approval/Sent/Closed), distinct from the raw `QuoteStatusBadge` — managers think in columns, the status badge stays for precision.

The **4 KPIs** (`Total / Pending / Accepted / Accepted value`) move **above the view toolbar**, shared by both Board and List — they're scope-aware (recompute under My queue / My dept / All). A pricer on _My queue_ sees their own load; a manager on _All_ sees the department's. Add one KPI relevant to the new surface:

```
┌─ Incoming ────┐ ┌─ In pricing ──┐ ┌─ Awaiting approval ┐ ┌─ Won value (90d) ──┐
│      4        │ │      11       │ │        3           │ │  1,240,000 SAR     │
│ 1 SLA-breached│ │ 2 mine ⭐     │ │ 1 mine             │ │  ▲ 12% vs prev     │
└───────────────┘ └───────────────┘ └────────────────────┘ └────────────────────┘
```

The "Incoming" KPI's red sub-line (`1 SLA-breached`) is the manager's daily alarm and the reason the board exists.

---

## 2. The Board: `<QuotePipelineBoard>`

Five fixed columns. **RTL: columns flow right→left** — Incoming is the **right-most** column (start of reading axis), Closed is left-most. This is not a CSS flip; the _temporal metaphor_ (MASTER §5: past sits right, future left) is honoured — work enters at the right and exits at the left.

```
RTL reading order  ◄─────────────────────────────────────────────────────────────────
┌── مُغلق Closed ─┐ ┌─ مُرسَل Sent ─┐ ┌ قيد الاعتماد ─┐ ┌─ التسعير Pricing ┐ ┌─ الوارد Incoming ──┐
│  WON·LOST·POST  │ │ SENT·DISC·NEG │ │ PENDING_APPR │ │ DRAFT (quote)    │ │ SUBMITTED rfq      │
│                 │ │               │ │              │ │                  │ │                    │
│ ▢ QUO-110 …     │ │ ▢ QUO-118 …   │ │ ▢ QUO-121 …  │ │ ▢ QUO-130 ⭐ …    │ │ ▢ RFQ-0042 ⏱ 1:12 │
│ ▢ QUO-104 …     │ │ ▢ QUO-115 …   │ │              │ │ ▢ QUO-128 …      │ │ ▢ RFQ-0041 ⏱ 4:55🔴│
│                 │ │               │ │              │ │ ▢ QUO-127 …      │ │ ▢ RFQ-0039 …       │
│  12 ▾           │ │   8           │ │   3          │ │   11             │ │   4                │
└─────────────────┘ └───────────────┘ └──────────────┘ └──────────────────┘ └────────────────────┘
```

Column → state mapping (single source of truth = `rfq.status` for the first two, `quote.status` for the rest):

| Column (en / ar)               | Source                        | States                                                             | Owner role                              |
| ------------------------------ | ----------------------------- | ------------------------------------------------------------------ | --------------------------------------- |
| **Incoming** / الوارد          | `rfq.status`                  | `SUBMITTED` (un-accepted)                                          | Dept Manager (`rfq:assign_pricers`)     |
| **Pricing** / التسعير          | `rfq.status` + `quote.status` | `rfq=ASSIGNED\|PRICING`, `quote=DRAFT`                             | Pricer (`quote:build`)                  |
| **In approval** / قيد الاعتماد | `quote.status`                | `PENDING_REVIEW`, `PENDING_APPROVAL`, `IN_REVISION`                | Lead pricer → Approver chain            |
| **Sent** / مُرسَل              | `quote.status`                | `APPROVED`, `SENT`, `IN_DISCUSSION`, `IN_NEGOTIATION`              | Sales (send/negotiate happens on Quote) |
| **Closed** / مُغلق             | `quote.status` + `rfq.status` | `WON`, `LOST`, `POSTPONED`, `EXPIRED`, `CANCELLED`, `rfq=DECLINED` | —                                       |

Column **count chips** are clickable → collapse to a count-only strip (the `12 ▾` in Closed) so the high-volume Closed column doesn't dominate; collapsed by default when count > 20.

Board behaviours:

- **Columns do not support free drag between every state** — only two transitions are user-driven from the board: Incoming→Pricing (via Accept sheet) and the decline-out. Everything downstream is gated by approval/quote logic and happens on `quotes/[id]`. So the board is **read + two seam-actions**, not a Trello where you drag WON. This is deliberate: dragging a quote into "Won" would bypass the loss-reason forcing function (§7 MASTER). Drag is therefore scoped to the **Incoming → Pricing** lane only (and even there it _opens the Accept sheet_ rather than silently moving — see §3.4).

---

## 3. INCOMING column + the Accept+Assign seam

### 3.1 `<IncomingRfqCard>` anatomy

```
┌────────────────────────────────────────────┐
│ RFQ-0042                       ⏱ 1:12  🟠   │ ← RFQ# (mono LTR) · SLA timer + dot
│ شركة الفيصل القابضة                          │ ← client (companyName ?? contactName)
│ ────────────────────────────────────────── │
│ [معماري] [كهروميكانيكا] [+1]                 │ ← service chips → derived departments
│ ────────────────────────────────────────── │
│ 👤 عبدالله محسن · مندوب                       │ ← requested-by sales rep
│ منذ ساعتين                                   │ ← relative time
│ ┌──────────────────┐ ┌───────────────────┐  │
│ │ ✓ قبول وتعيين ⭐  │ │ لسنا الجهة / رفض   │  │ ← primary + decline
│ └──────────────────┘ └───────────────────┘  │
└────────────────────────────────────────────┘
```

- **RFQ#** mono, LTR, top-start.
- **SLA timer `⏱`** — counts **business hours** since `rfq.submittedAt`. Tone by `slaStatusVariant` semantics (MASTER §2): green ≤ 2 biz-h (`ON_TIME`), amber 2–4 biz-h (`DUE_SOON` 🟠), **red > 4 biz-h** (`OVERDUE` 🔴, + the card gets a `ring-1 ring-error/40` and a red top hairline). Uses the existing holidays/business-hours config (admin/holidays) so it doesn't tick on weekends. The threshold (4 biz-h) is admin-configurable per the "configurable everything" rule.
- **Service chips** — from `rfq.requestedCategoryIds` mapped to service names; overflow collapses to `[+N]` with a tooltip listing the rest. Each chip's _department_ is what routing keys on — chips that map to a department I **don't** manage render in `muted` outline so a multi-dept manager sees at a glance which slice is "mine".
- **Requested-by** — sales rep avatar + name + role.
- Two actions, both **visible buttons** (never a kebab — MASTER §3 forbids primary actions in three-dot menus). Decline is the lighter-weight `outline` button with `text-muted-foreground`; it becomes red only inside its dialog.

**Permission gate:** the action buttons render only for `rfq:assign_pricers` holders whose scope covers ≥1 of the RFQ's departments. A pricer viewing Incoming (rare) sees the card read-only with a `قيد الفرز · awaiting triage` ghost badge instead of buttons.

### 3.2 Empty state — `<IncomingEmpty>`

Icon `Inbox` + **"صندوق الوارد فارغ · Inbox clear"** + sub: _"كل الطلبات الجديدة جرى فرزها. ستظهر الطلبات الجديدة هنا فور إرسالها من المبيعات."_ / _"All new requests are triaged. New requests land here the moment Sales submits them."_ No CTA (managers don't _create_ incoming work). This is the **first-run empty**; there's no filtered-empty for Incoming since it has no per-column filter.

### 3.3 The Accept+Assign sheet — `<AcceptAssignSheet>` (the seam)

Opens as a right-side `<Sheet>` (RTL: slides from the right, matching the requests panel pattern). This **is** the RFQ→Draft-Quote moment.

```
┌─ قبول الطلب وتعيين المُسعّرين ───────────────────────────── ✕ ┐
│ RFQ-0042 · شركة الفيصل القابضة                                │
│ سيتم إنشاء مسودّة عرض سعر QUO جديدة عند التأكيد.               │ ← states the consequence up-front
│ ──────────────────────────────────────────────────────────  │
│ الأقسام المعنية  (مشتقة من الخدمات المطلوبة)                   │
│                                                              │
│ ┌─ القسم المعماري ──────────────────────────────────────┐    │
│ │ [ 👤 UserPicker: اختر المُسعّر ▾ ]          ⭐ مُسعّر رئيسي │ │ ← row 1, auto-lead
│ └──────────────────────────────────────────────────────┘    │
│ ┌─ قسم الكهروميكانيكا ──────────────────────────────────┐    │
│ │ [ 👤 UserPicker: اختر المُسعّر ▾ ]          ☆ تعيين رئيسي│ │ ← row 2
│ └──────────────────────────────────────────────────────┘    │
│                                                              │
│ ⓘ يجب تعيين مُسعّر رئيسي واحد. أول قسم تُعيّنه يصبح الرئيسي     │ ← invariant explainer
│   تلقائياً.                                                    │
│ ──────────────────────────────────────────────────────────  │
│            [ إلغاء ]        [ قبول وإنشاء المسودّة ✓ ]         │
└──────────────────────────────────────────────────────────────┘
```

**Structure — one row per involved department:**

- Rows are **derived, not chosen**: `requestedCategoryIds ∩ DepartmentService → departmentIds`. The manager doesn't pick departments (that's the routing job, already done); they pick **who** prices each.
- Each row: department name (read-only) + a **`<UserPicker>`** (the existing component from `pricer-assignments.tsx`) scoped to that department's members + a **⭐ Lead Pricer** toggle (`Star`/`StarOff`, the established signifier).
- **Exactly one ⭐**, enforced client-side exactly as `pricer-assignments.tsx` does: toggling a star on one row clears the others; **first row to get an assignee auto-becomes lead** (matches `rfq-assignments.service.ts:95` auto + `:131` single-lead invariant). The inline `ⓘ` explains the rule before the user trips it (MASTER §7: explain the constraint, don't block silently).
- Confirm button **disabled until every department row has an assignee** AND exactly one lead exists; the disabled tooltip says _"عيّن مُسعّراً لكل قسم"_ (a disabled button with a stated reason — §3).

### 3.4 Multi-dept case

When the RFQ touches departments managed by **different** managers, the Accept sheet only shows rows for departments **the current manager owns**; rows for other departments appear **read-only with a `بانتظار مدير القسم · awaiting <dept> manager` chip**. Confirm is enabled once _this manager's_ rows are filled. Behaviour:

- **First** manager to confirm → `startPricing(rfqId)` fires, Draft Quote is created with one `QuoteItem.departmentId` section **per involved category** (all departments, not just theirs), `rfq.quoteId` set, `rfq.status=PRICING`, and _their_ assignments are written with the lead flag. Card moves Incoming→Pricing.
- **Subsequent** managers no longer see the card in _Incoming_ (it's now in Pricing). They assign their pricer from the **Pricing card's `[+ assign my dept]`** affordance (§5.4) — same `<UserPicker>` row, but it doesn't re-run `startPricing` (quote already exists), it just appends a `RfqAssignment`. Exactly one lead survives org-wide (the first manager's lead; the invariant at `:131` rejects a second).

This resolves the "managers of all involved depts each assign; one lead compiles" requirement without a coordination deadlock: the **first** accept creates the quote and the lead; everyone else fills in their section.

### 3.5 On confirm — the wiring

```
AcceptAssignSheet.confirm()
  → POST rfq-assignments (per row, isLeadPricer per toggle)   // existing endpoint
  → POST rfqs/:id/start-pricing                               // NEW — replaces dead linkQuote + startPreparation
       ↳ creates DRAFT Quote { clientId, leadId from rfq, items: [{departmentId} × N] }
       ↳ sets rfq.quoteId, rfq.status = PRICING
       ↳ returns { quoteId }
  → optimistic: card animates Incoming → Pricing (200ms slide)
  → toast success «تم القبول — QUO-130 جاهزة للتسعير» with [فتح المُحرِّر]
  → router.push(`/quotes/${quoteId}/build?rfqId=${rfqId}`)     // lead pricer lands in the builder
```

Non-lead assignees are **not** navigated — they stay on the board; the card surfaces in their _My queue_. Only the confirming manager (who is typically also designating themselves or the lead) routes onward; if the manager assigned someone else as lead and isn't a pricer, they stay on the board and the toast omits `[فتح المُحرِّر]`.

---

## 4. DECLINE flow — `<DeclineRfqDialog>`

Modal `<Dialog>` (a forcing function is justified: declining routes work _back to sales_ and is semi-irreversible — MASTER §7 reserves modals for consequential actions). **Reason is required.**

```
┌─ رفض الطلب · Not us / decline ──────────────────── ✕ ┐
│ RFQ-0042 · شركة الفيصل القابضة                        │
│                                                      │
│ السبب *                                              │
│ ( ◉ قسم خاطئ — يحتاج إعادة توجيه                       │ ← wrong-dept
│   ○ لن نقدّم عرضاً (no-bid)                            │ ← no-bid
│ )                                                    │
│                                                      │
│ ── if wrong-dept: ──────────────────────────────    │
│ التوجيه المقترح:  [ القسم الإنشائي ▾ ]                 │ ← suggested re-route, prefilled by mapping
│ ⓘ اقترحنا «الإنشائي» بناءً على الخدمات المطلوبة.       │
│                                                      │
│ ── if no-bid: ──────────────────────────────────    │
│ ملاحظة للمبيعات *  [ _______________________ ]       │ ← mandatory free-text
│                                                      │
│            [ إلغاء ]        [ تأكيد الرفض ]            │ ← destructive (red)
└──────────────────────────────────────────────────────┘
```

- **`wrong-dept`** → on confirm, `rfq.status = DECLINED` with `declineReason='WRONG_DEPT'` + `suggestedDepartmentId`. The suggested dept is **pre-filled** by re-running the service→department mapping minus the current dept (sensibility default, editable — MASTER §7). Lands back at Sales as **`needs-re-route`** (a sub-state of their "My Requests" track) with the suggestion attached, so the rep can re-target with one tap rather than re-keying.
- **`no-bid`** → `declineReason='NO_BID'` + mandatory note. Lands at Sales as **`closed-no-bid`**; the RFQ closes, no re-route. The note is the documented reason (business rule: all rejections need a reason).
- Confirm is the **red** destructive button, disabled until a reason note (no-bid) or a target dept (wrong-dept) is present.

**Where it lands for sales:** the RFQ leaves the department board entirely (no longer in Incoming) and surfaces in the sales **My Requests** list with a `needs-re-route` / `declined` badge + the decline note visible inline (sales already renders `req.response`-style display; the decline note rides the same channel).

**Confirmation + undo window:** Decline is reversible for **a short window**. After confirm: toast _"رُفض الطلب RFQ-0042 وأُعيد إلى المبيعات"_ with an **`[تراجع · Undo]`** action live for **8 seconds** (MASTER §7: undo beats a second dialog for reversibles). Undo restores `rfq.status=SUBMITTED`, drops the decline reason, returns the card to Incoming. After the window, the only path back is sales re-submitting — which is correct, because by then sales may have acted on the re-route.

---

## 5. PRICING column

### 5.1 `<DraftQuoteCard>` anatomy

```
┌────────────────────────────────────────────────┐
│ QUO-130   ·   من RFQ-0042            DRAFT       │ ← dual-ID + quote status badge (muted)
│ شركة الفيصل القابضة                               │
│ ────────────────────────────────────────────── │
│ ▸ معماري        👤 أ. سالم  ⭐                    │ ← dept sections, lead starred
│ ▸ كهروميكانيكا  👤 م. خالد                        │
│ ▸ إنشائي        [ + عيّن قسمي ]                   │ ← unassigned dept I manage
│ ────────────────────────────────────────────── │
│ 💬 1 طلب مستند مفتوح                              │ ← open doc/visit request indicator
│ ────────────────────────────────────────────── │
│ ┌──────────────────┐  ⋯                          │
│ │ فتح المُحرِّر       │  [طلب مستند][طلب زيارة][إرسال للاعتماد⭐]│
│ └──────────────────┘                             │
└────────────────────────────────────────────────┘
```

- **Dual-ID header**: `QUO-130 · من RFQ-0042` (mono, LTR for both IDs). The QUO# is primary (bold), the RFQ# is a `·`-separated secondary link back to the request context (scope/attachments/asks). This is the "ONE record, two IDs" decision made literal.
- **Quote status badge**: `DRAFT` renders `muted` (per `quoteStatusVariant`).
- **Dept section rows**: each `QuoteItem.departmentId` group → one row with assignee avatar; the lead carries ⭐. Departments I manage but that have **no** assignee show the inline `[+ عيّن قسمي]` button (§5.4).
- **Request indicator**: if any open doc/site-visit request exists, a `💬 N طلب مفتوح` line in `warning` tone — the pricer's reminder they're blocked on sales.
- **Actions** — primary `[فتح المُحرِّر · Open builder]`, then a tight cluster: `[طلب مستند]` `[طلب زيارة]` `[إرسال للاعتماد]`. **`إرسال للاعتماد · Submit for approval` is enabled only for the lead pricer** (`quote:submit_approval`); for non-leads it's hidden (not disabled — they never submit, so showing it is a false signifier). The `⋯` overflow holds tertiary read-only items (view RFQ context, view client).

### 5.2 `[فتح المُحرِّر]` — opens the EXISTING builder, RFQ-pre-linked

This is the critical fix: today `quotes/new` is a blank 3-step builder that **starts with a client picker**. For a pricer working a draft, that's wrong — the client, lead, and department sections already exist.

New route shape: **`/quotes/[id]/build`** (edit-mode of the existing builder, not `/quotes/new`). The same `NewQuotePage` component, parameterised:

- **Step 1 (Basic info)**: client is **pre-filled and locked** (read-only field showing the client, with a `· من RFQ-0042` caption) — no client picker. Title pre-filled from RFQ subject. Scope/deliverables pre-filled from RFQ request text where available.
- **Step 2 (Line items)**: pre-seeded with **one collapsible group per department section** (the `QuoteItem.departmentId` rows `startPricing` created). The department `<Select>` per item is **pre-set and locked** to that section's department — a pricer adds priced line items _under their department heading_, can't reassign a line to another dept. Pricers who don't own a section see it **read-only** (so multi-dept quotes stay collaborative without one pricer clobbering another's numbers).
- **Step 3 (Milestones)**: unchanged.
- Submit button becomes **"حفظ المسودّة · Save draft"** (not "Create"), `PATCH /quotes/:id`, returns to `/quotes/[id]` detail. Auto-save per MASTER §9 (quote builder is explicitly named as an auto-save form).

`router.push('/quotes/130/build?rfqId=0042')` — the `rfqId` query param keeps the breadcrumb back-link to the RFQ context panel.

### 5.3 Request docs / Request site visit from the card

Both reuse `<RfqRequestsPanel>`'s sheets (`NewDocRequestSheet`, `NewSiteVisitSheet`) — but invoked **from the Pricing card and from inside the builder**, since they're now pricer-side raise actions. They write to `RfqDocRequest` / `RfqSiteVisitRequest` keyed on the card's `rfqId` (the linkage survives because the RFQ stays the request-context anchor). See §6 for the full raise/respond loop.

**Permission split (per the locked matrix):** `[طلب مستند]` requires `rfq:request_docs`; `[طلب زيارة]` requires the **new** `rfq:request_site_visit` permission (today it incorrectly reuses `rfq:request_docs` — flagged in §11).

### 5.4 `[+ عيّن قسمي]` — late dept assignment on a live draft

For the multi-dept case where a second manager assigns _after_ the quote exists. Opens a **single-row** mini-sheet (just the `<UserPicker>` for their department) — no `startPricing`, no lead toggle (the lead is already set elsewhere; if they try to grab lead, the `:131` invariant rejects with a toast _"يوجد مُسعّر رئيسي بالفعل"_). Appends one `RfqAssignment`; the card's dept row flips from `[+ عيّن قسمي]` to the assignee avatar.

### 5.5 `[إرسال للاعتماد]` — lead-only submit

Lead pricer only. On click → `submit` (re-homed onto the Quote: `quotes.service:submit`). Pre-flight checks surface as **inline blockers**, not a silent disable (defeats memory-lapse slips, MASTER §7):

- every department section has ≥1 priced line item,
- payment milestones sum to 100% (existing rule),
- no open doc/site-visit request is _required-before-pricing_ (soft warning, not a hard block — lead can override with a confirm).

Card moves Pricing→In approval. Toast + the quote's approval chain instantiates.

---

## 6. The RAISE/RESPOND loop for doc + site-visit requests

The department **raises**; sales **responds**. Two halves of one object.

### 6.1 Raise side (department, inside Quotations/Pricing) — already built, re-sited

`<RfqRequestsPanel>` renders on **`/quotes/[id]`** (the quote detail, new "Request context" section) and its sheets are reachable from the Pricing card. The raise forms are exactly the existing `NewDocRequestSheet` (description ≥ 5 chars) and `NewSiteVisitSheet` (purpose + optional preferred-date window). Status lifecycle on the **raise** side, per the _target_ enum:

| Status      | Department sees                                         | Meaning                                     |
| ----------- | ------------------------------------------------------- | ------------------------------------------- |
| `PENDING`   | amber badge `بانتظار الرد · awaiting reply`             | raised, sales hasn't answered               |
| `RESOLVED`  | emerald `تم الرد · answered` + the response text inline | sales attached docs / answered / visit done |
| `CANCELLED` | muted, faded row                                        | pricer withdrew the ask                     |

The department-side controls on each row: `[تم الحل]` (resolve) and `[إلغاء]` (cancel) — already present. **Note the enum drift:** the panel currently renders `OPEN`; the schema enum is `PENDING`. §11 reconciles. I standardise the UI copy on `PENDING` to match the schema and the brief.

### 6.2 Respond side (sales, "My Requests") — **the new bit**

Today `req.response` is **display-only** (panel line 222 just renders it). The locked decision: **add a responder UI on the sales surface.** Spec for that sales-side component (so the department surface's raise has a real other end):

- In sales **My Requests** (`/rfqs/[id]`), open requests appear in an **"Action needed from you"** band at the top — strong signifier of who owes the response (mirrors the Norman note in the panel header).
- Each open doc request → a `<RespondDocRequest>` inline form: a **response textarea** + an **attachment upload** (`attachmentUrl`). Submit sets `status=RESOLVED`, writes `response`, fires the back-channel so the department card's `💬` indicator clears and the row flips to emerald with the answer visible.
- Each open site-visit request → sales picks/confirms a scheduled time (reuses the existing `scheduledAt` field; today it's a `window.prompt` on the _department_ side — the **scheduling moves to sales**, who owns the client calendar). On completion sales marks it done → `RESOLVED` + `completedAt`.
- **Where the response shows up for the department:** the Pricing card's `💬 N طلب مفتوح` decrements in real-time; on `/quotes/[id]` the request row shows the green response block (`req.response`) and any `attachmentUrl` link — exactly the existing render at panel lines 222-236, which is why the display side needs no new work, only the _write_ side on sales does.

This closes the loop: **department raises → sales responds → department unblocks**, with each side seeing a "who owes what" signifier.

---

## 7. In approval / Sent / Closed columns → QuoteStatus

These three columns are **read-only on the board**; every state transition happens on `quotes/[id]` (which already implements the full toolbar — submit/decide/send/accept/reject/negotiate, lines 156-213, 523-606). The board just reflects `quote.status`.

| Board column    | `quote.status`                                                      | Card surfaces                                                                                | Who acts (on detail page)                                                                                                                         |
| --------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **In approval** | `PENDING_REVIEW`, `PENDING_APPROVAL`, `IN_REVISION`                 | approval tier progress dots `●●○`, "awaiting <approver>" + ⭐ if mine                        | Approver chain (`quote:approve`); `IN_REVISION` bounces to lead pricer                                                                            |
| **Sent**        | `APPROVED`, `SENT`, `IN_DISCUSSION`, `IN_NEGOTIATION`               | sent date, "client reviewing/negotiating" sub-state                                          | **Sales** owns send + outcome (`quote:send`, `quote:set_outcome`) — but the _card lives in the dept board_ so the dept can watch its quote's fate |
| **Closed**      | `WON`, `LOST`, `POSTPONED`, `EXPIRED`, `CANCELLED` + `rfq=DECLINED` | outcome badge (`success`/`error`/`muted`), loss reason on hover, `→ مشروع` chip if converted | — (terminal); `WON` shows the convert-to-project link on detail                                                                                   |

`APPROVED` lands in **Sent** column (not approval) because the next human action is _Sales sending it_ — column = "whose move is it", which keeps the board honest about where the ball sits. The `APPROVED→SENT` gap (approved but not yet dispatched) is flagged with a small amber `جاهز للإرسال · ready to send` pip so it doesn't stall invisibly.

**Card click** anywhere on these columns → `/quotes/[id]`. Whole card is the affordance (MASTER §10), not just the QUO# link.

---

## 8. Interaction state table

Per column and per action — LOADING / EMPTY / ERROR / SUCCESS / PARTIAL.

### Per column

| Column            | LOADING                                                          | EMPTY (first-run)                                                        | EMPTY (filtered)                      | ERROR                                              | PARTIAL                                                                               |
| ----------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Board (whole)** | column skeletons: 3 `<CardSkeleton>` per column, headers visible | n/a (board always shows columns)                                         | "لا نتائج لهذا البحث" + Clear         | in-page `<ErrorState onRetry>` replacing the board | a column errors independently → that column shows retry, others render                |
| **Incoming**      | 3 card skeletons                                                 | `Inbox` icon · **"صندوق الوارد فارغ"** (no CTA)                          | "لا طلبات تطابق البحث" + Clear search | column-local retry                                 | SLA timers stream-update; if business-hours config fails, timer shows `—` not a crash |
| **Pricing**       | card skeletons w/ dept-row placeholders                          | `FileEdit` · "لا مسودّات قيد التسعير" · sub: تُنشأ تلقائياً عند قبول طلب | filtered copy                         | retry                                              | a draft with 0 priced items shows a `⚠ بلا بنود` amber pip                            |
| **In approval**   | skeleton w/ approval-dot placeholders                            | "لا عروض قيد الاعتماد"                                                   | filtered                              | retry                                              | partial approval = `●●○` progress dots                                                |
| **Sent**          | skeletons                                                        | "لا عروض مُرسَلة"                                                        | filtered                              | retry                                              | `APPROVED`-not-sent → ready-to-send pip                                               |
| **Closed**        | collapsed count chip + skeleton on expand                        | "لا عروض مُغلقة بعد"                                                     | filtered                              | retry                                              | mixed WON/LOST — each card carries its own tone                                       |
| **List view**     | `<TableSkeleton rows=8 cols=8>`                                  | existing `quotes` empty (FileText)                                       | existing filtered empty               | `<DataState>` error                                | —                                                                                     |

### Per action

| Action                   | LOADING                                             | SUCCESS                                                              | ERROR                                                                                                                                                                                                   | PARTIAL / edge                                                          |
| ------------------------ | --------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Accept & assign**      | confirm btn → spinner "جارٍ الإنشاء…", sheet locked | toast «QUO-130 جاهزة» + card slides to Pricing + nav lead            | toast (API msg) — sheet stays open, no card move (no optimistic loss)                                                                                                                                   | multi-dept: my rows confirmed, others still `awaiting <mgr>`            |
| **Designate ⭐ lead**    | star btn pressed-state                              | toast «عُيّن رئيسياً» + others' stars clear                          | toast «تعذّر التحديث» (e.g. `:131` second-lead)                                                                                                                                                         | clearing the only lead → inline warning band (existing `noLeadWarning`) |
| **Decline**              | confirm → spinner, dialog locked                    | toast «رُفض وأُعيد للمبيعات» + **[تراجع] 8s** + card leaves Incoming | toast, dialog stays open                                                                                                                                                                                | undo within window → card returns; after window → no-op                 |
| **Start pricing (seam)** | (inside Accept)                                     | quote created, rfq=PRICING                                           | rollback: assignments may have written → toast «أُنشئت التعيينات لكن تعذّر إنشاء العرض، أعد المحاولة» (idempotent retry: re-calling start-pricing on an rfq that already has quoteId is a no-op return) | —                                                                       |
| **Open builder**         | route transition skeleton (`DetailSkeleton`-style)  | builder loads pre-filled                                             | builder error → "تعذّر تحميل المسودّة" + back to board                                                                                                                                                  | another pricer editing → last-write-wins + auto-save merge warning      |
| **Raise doc/visit**      | sheet btn spinner "جارٍ الإرسال…"                   | toast + row appears `PENDING` + `💬` indicator increments            | toast «تعذّر الإرسال»                                                                                                                                                                                   | description < 5 chars → inline "صف ما تحتاجه"                           |
| **Submit for approval**  | btn spinner                                         | card → In approval + approval chain shows                            | pre-flight blocker → inline list of what's missing (not toast)                                                                                                                                          | milestones ≠ 100% → blocked w/ exact delta                              |

---

## 9. Copy + wireframes

### 9.1 Copy table (en intent / ar)

| Key                        | English                                                | Arabic                                         |
| -------------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| `quotes.view.board`        | Board                                                  | لوحة                                           |
| `quotes.view.list`         | List                                                   | قائمة                                          |
| `quotes.scope.myQueue`     | My queue                                               | مهامي                                          |
| `quotes.scope.myDept`      | My department                                          | قسمي                                           |
| `quotes.scope.all`         | All                                                    | الكل                                           |
| `quotes.col.incoming`      | Incoming                                               | الوارد                                         |
| `quotes.col.pricing`       | In pricing                                             | قيد التسعير                                    |
| `quotes.col.inApproval`    | In approval                                            | قيد الاعتماد                                   |
| `quotes.col.sent`          | Sent                                                   | مُرسَل                                         |
| `quotes.col.closed`        | Closed                                                 | مُغلق                                          |
| `incoming.empty.title`     | Inbox clear                                            | صندوق الوارد فارغ                              |
| `incoming.empty.desc`      | All new requests are triaged.                          | جرى فرز كل الطلبات الجديدة.                    |
| `incoming.accept`          | Accept & assign                                        | قبول وتعيين                                    |
| `incoming.decline`         | Not us / decline                                       | لسنا الجهة / رفض                               |
| `incoming.sla.overdue`     | SLA breached                                           | تجاوز المهلة                                   |
| `accept.consequence`       | A draft quote will be created.                         | سيتم إنشاء مسودّة عرض سعر.                     |
| `accept.leadHint`          | One lead pricer required. First assigned becomes lead. | يجب مُسعّر رئيسي واحد. أول تعيين يصبح الرئيسي. |
| `accept.confirm`           | Accept & create draft                                  | قبول وإنشاء المسودّة                           |
| `decline.reason.wrongDept` | Wrong department — needs re-route                      | قسم خاطئ — يحتاج إعادة توجيه                   |
| `decline.reason.noBid`     | No bid                                                 | لن نقدّم عرضاً                                 |
| `decline.suggested`        | Suggested re-route                                     | التوجيه المقترح                                |
| `decline.confirm`          | Confirm decline                                        | تأكيد الرفض                                    |
| `decline.undo`             | Undo                                                   | تراجع                                          |
| `pricing.openBuilder`      | Open builder                                           | فتح المُحرِّر                                  |
| `pricing.submitApproval`   | Submit for approval                                    | إرسال للاعتماد                                 |
| `pricing.assignMyDept`     | Assign my department                                   | عيّن قسمي                                      |
| `pricing.fromRfq`          | from {rfq}                                             | من {rfq}                                       |
| `request.awaitingReply`    | Awaiting reply                                         | بانتظار الرد                                   |
| `request.answered`         | Answered                                               | تم الرد                                        |
| `sent.readyToSend`         | Ready to send                                          | جاهز للإرسال                                   |

### 9.2 ASCII board wireframe (RTL, full)

```
╔══════════════════════════════════════════════════════════════════════════════════════╗
║ عروض الأسعار                                              [ + عرض سعر جديد ]   [ ⟳ ]   ║
║ من الطلب إلى عرض السعر المُرسَل                                                          ║
║ ┌Incoming 4┐ ┌Pricing 11┐ ┌Approval 3┐ ┌WonVal 1.24M SAR┐                              ║
║ [▣ لوحة][☰ قائمة]            النطاق: (مهامي ◉ | قسمي | الكل)            🔎 ____________  ║
╠══════════════════════════════════════════════════════════════════════════════════════╣
║  ◄── reading axis (RTL)                                                                 ║
║ ┌مُغلق 12▾┐ ┌─مُرسَل 8─┐ ┌قيد الاعتماد 3┐ ┌──التسعير 11──┐ ┌────الوارد 4────────┐       ║
║ │QUO-110 ✓│ │QUO-118  │ │QUO-121       │ │QUO-130 ·R0042│ │RFQ-0042   ⏱1:12 🟠 │       ║
║ │WON  →مشروع│ │SENT    │ │●●○ بانتظار م.│ │DRAFT  ⭐أ.سالم│ │الفيصل القابضة      │       ║
║ │         │ │الفيصل  │ │حسن           │ │معماري+كهرو   │ │[معماري][كهرو][+1] │       ║
║ │QUO-104 ✗│ │QUO-115 │ │              │ │💬1 طلب مفتوح  │ │👤عبدالله·منذ ساعتين│       ║
║ │LOST سعر │ │جاهز📍  │ │              │ │[فتح المُحرِّر] ⋯│ │[✓قبول وتعيين⭐]    │       ║
║ │         │ │        │ │              │ │QUO-128 ·R0040│ │[لسنا الجهة/رفض]    │       ║
║ │         │ │        │ │              │ │DRAFT 👤م.خالد │ │RFQ-0041  ⏱4:55 🔴 │       ║
║ │         │ │        │ │              │ │              │ │تجاوز المهلة        │       ║
║ └─────────┘ └────────┘ └──────────────┘ └──────────────┘ └────────────────────┘       ║
╚══════════════════════════════════════════════════════════════════════════════════════╝
```

### 9.3 Incoming card anatomy (detail)

```
┌─ ring-error/40 when SLA overdue ───────────────┐
│▔▔▔▔▔▔▔▔▔▔▔▔▔ red hairline if overdue ▔▔▔▔▔▔▔▔▔│
│ RFQ-0041 (mono,ltr)                ⏱ 4:55  🔴   │
│ شركة الفيصل القابضة                              │
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
│ [معماري] [كهروميكانيكا] [+1]   ← muted if not mine│
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
│ (👤) عبدالله محسن · مندوب مبيعات                 │
│ منذ 5 ساعات                                     │
│ ┌───────────────────┐ ┌────────────────────┐    │
│ │ ✓ قبول وتعيين  ⭐  │ │ لسنا الجهة / رفض    │    │
│ └───────────────────┘ └────────────────────┘    │
└────────────────────────────────────────────────┘
```

### 9.4 Assign sheet + decline dialog — see §3.3 and §4 ASCII above (rendered there).

---

## 10. Responsive + accessibility

### 10.1 Responsive

- **Desktop (≥1024px, managers):** full 5-column board, columns `min-w-[300px]`, horizontal scroll if viewport < 5×300. KPIs in a 4-up row.
- **Tablet (768–1023px, pricers):** board shows **2 columns at a time** with a column-pager (the scope chip usually pins a pricer to _My queue_ anyway, so they live mostly in Pricing). The Accept sheet and builder are tablet-first: `<Sheet>` goes full-height, `<UserPicker>` opens as a bottom-sheet on touch. **Default view on tablet = List** unless the user is a manager.
- **Mobile (<768px):** board **collapses to List**, period. A 5-column Kanban on a phone is hostile. The scope chips become a `<Select>`. Card actions stack vertically. (Managers are desktop per the brief; this is the fallback, not the target.)
- Builder (`/quotes/[id]/build`) inherits the existing `max-w-4xl` responsive step layout — already mobile-safe.

### 10.2 Accessibility (MASTER §3, §5, §13 + WCAG)

- **RTL:** columns flow right→left (Incoming right-most); slide/drawer direction from the right; chevrons and the card→detail drill mirror. **Numerals stay Western Arabic (0–9), LTR**: QUO#, RFQ#, SLA timer, SAR totals all `dir="ltr" font-mono`. The SLA timer's `⏱` and `🔎` search are non-directional → **not** mirrored. The Gantt inside the builder mirrors (past-right) — already noted in builder code.
- **Keyboard drag alternative (the board's a11y crux):** drag is _visual sugar only_. The canonical path to move Incoming→Pricing is the **Accept button** (keyboard-focusable, Enter-activates the sheet). There is **no action that requires a pointer drag** — this is the explicit keyboard-equivalent the brief asks for. Each card is a `role="article"` with a focusable header; `Tab` reaches its action buttons in DOM order. Column headers are `role="region" aria-label="{column} — {count}"`.
- **Focus order** within a card: status/IDs (non-interactive) → primary action → secondary → overflow. Within the Accept sheet: dept rows top-to-bottom, each row UserPicker → ⭐ toggle, then Cancel → Confirm (confirm last, so Tab+Enter doesn't accidentally confirm).
- **Star toggle** keeps the `aria-pressed` + `title` from `pricer-assignments.tsx`. SLA dot has a text equivalent (`tooltip + aria-label "تجاوز المهلة بـ 55 دقيقة"`) — color is never the sole signal.
- **Contrast:** all status tones use the `bg-{tone}/15 text-{tone}` tinted-badge rule (MASTER §2) so gold WON badges don't collide with solid-gold secondary buttons; the SLA red ring is paired with the red dot **and** text, satisfying 4.5:1 + non-color-redundancy.
- **Live regions:** SLA timers update via `aria-live="off"` (too chatty for AT); column count chips are `aria-live="polite"` so a card moving Incoming→Pricing announces "الوارد 3، التسعير 12". Toasts are `role="status"`/`alert` per success/error (MASTER §6), positioned bottom-start (bottom-right in RTL).
- **Disabled reasons:** every disabled action (Accept-confirm before rows filled, Submit before 100% milestones) carries a tooltip stating _why_ — no silent false signifiers.

---

## 11. Migration & code deltas (so the build doesn't inherit the old screen)

These are the concrete gaps between this design and current code; named so engineering can sequence them:

1. **`RfqStatus` enum collapse** — `schema.prisma:1275` has 10 states (`RECEIVED/ASSIGNED/IN_PREPARATION/PENDING_APPROVAL/APPROVED_READY_FOR_DISPATCH/SENT/WON/LOST/POSTPONED/CANCELLED`). Target: **`SUBMITTED · ASSIGNED · PRICING · CANCELLED · DECLINED`**. `DECLINED` is **new**; `SUBMITTED` renames `RECEIVED`; `PRICING` replaces `IN_PREPARATION`; the dispatch/sent/won/lost/postponed states **delete** (they DERIVE from `quote.status`). Add `declineReason` (`WRONG_DEPT|NO_BID`) + `suggestedDepartmentId` columns. Backfill: RFQs from the old `RfqsService.create:56` path have **empty `requestedCategoryIds`** → invisible to category scope; the migration must backfill from their linked services or they never appear in any dept inbox.
2. **`startPricing(rfqId)`** — new service action replacing dead `linkQuote` (`rfqs.service.ts:434`, no route/caller) and `startPreparation`. Creates the Draft Quote (clientId/leadId from rfq, one `QuoteItem.departmentId` per `requestedCategoryId`→dept), sets `rfq.quoteId` + `rfq.status=PRICING`, returns `quoteId`. Must be **idempotent** (re-call on an rfq with `quoteId` returns it, no duplicate).
3. **Delete** dead `linkQuote` + orphan `markApproved` (`rfqs.service.ts:354`). Re-home submit/approve/send/outcome onto the Quote (`quotes.service`) — they already live there; just remove the RFQ duplicates.
4. **Re-home broker Commission accrual** onto quote **accept** (not RFQ).
5. **`RfqRequestStatus` UI drift** — panel renders `OPEN` (`rfq-requests-panel.tsx:71`), schema enum is `PENDING/RESOLVED/CANCELLED`. Standardise UI on the schema (`PENDING`).
6. **New permission `rfq:request_site_visit`** — site visits currently reuse `rfq:request_docs`. Split per the matrix.
7. **Sales responder UI** — `req.response` is display-only today (panel:222). Build the _write_ side on the sales `/rfqs/[id]` surface (§6.2). Move site-visit **scheduling** from the department `window.prompt` (`rfq-requests-panel.tsx:347`) to sales.
8. **New builder route `/quotes/[id]/build`** — edit-mode of `NewQuotePage` with locked client + pre-seeded dept sections + `PATCH` save. Today only `/quotes/new` (blank) exists.
9. **Kill** `rfqs/[id]/page.tsx` (the 772-line mega-screen) — its manager bits move to this board; its sales bits move to the sales My Requests surface.

---

### Named components delivered

`QuotationsShell` · `ViewToolbar` (`SegmentedToggle` board/list + scope) · `QuotePipelineBoard` · `IncomingRfqCard` · `IncomingEmpty` · `AcceptAssignSheet` · `DeclineRfqDialog` · `DraftQuoteCard` · `RespondDocRequest` (sales side) · reused `PricerAssignments` rows, `RfqRequestsPanel` sheets, `DataState`, `StatusBadge`, `DetailShell`.

The spine: **Incoming (rfq=SUBMITTED) → [Accept+Assign = startPricing seam] → Pricing (quote=DRAFT) → [lead submits] → In approval → Sent → Closed**, with `quote.status` the single source of truth for everything past the seam, and the RFQ surviving only as the request-context anchor and the doc/site-visit channel back to sales.

---

# PART C — Data model / API / migration delta

`eventCode` is a free-form string (no enum/registry). I now have full grounding. I'll produce the complete delta as markdown.

---

# ABAK ERP — RFQ Restructure: Data-Model + API + Migration Delta

**Grounding read:** `prisma/schema.prisma` (Quote 806–890, QuoteItem 910–945, Rfq 1097–1174, RfqAssignment 1181–1217, RfqDocRequest 1223–1242, RfqSiteVisitRequest 1247–1267, RfqStatus 1275–1286, Commission 1687–1710), `rfqs/rfqs.service.ts` (1–507), `rfqs/rfqs.controller.ts`, `rfqs/rfq-assignments.{service,controller}.ts`, `quotes/quotes.service.ts` (95–841), `quotes/quotes.controller.ts`, `leads/leads.service.ts` (70–302), `auth/scope.util.ts`, `auth/guards/permission.guard.ts`, `prisma/seed-rbac.ts`.

Key facts established by the code, which drive every decision below:

- `eventCode` is a **free-form string** (`notifications.service.ts:7`, `SendNotificationInput`); no enum/registry to extend — new codes are just strings.
- `quote:build` is **already** the `POST/PATCH /quotes` permission (`quotes.controller.ts:38,73`). `startPricing` reuses it without seed changes.
- Manager actions (`rfq:assign_pricers`, `rfq:set_lead_pricer`, `project:convert`) are unlocked by `Department.managerId` in `permission.guard.ts:22-26,71-74`, NOT by role grants. `declineRfq` keys off `rfq:assign_pricers` → inherits the same manager unlock for free.
- `Rfq.quoteId` is already `String? @unique` with the relation (`schema.prisma:1135-1136`); the seam just needs to set it.
- `requestedCategoryIds String[] @default([])` **already exists** (`schema.prisma:1114`) and is populated by `leads.service.ts:215`. The legacy gap is `RfqsService.create` (`rfqs.service.ts:86-102`) which never sets it.

---

## 1. PRISMA CHANGES

### 1a. Collapse `RfqStatus` (`schema.prisma:1275-1286`)

Replace the 10-state enum with 5 real columns. `QUOTE_READY / SENT / CLOSED` are **derived** (§2), never stored.

```prisma
enum RfqStatus {
  SUBMITTED    // was RECEIVED — raised by sales, awaiting dept triage
  ASSIGNED     // pricers assigned, no draft quote yet (optional intermediate)
  PRICING      // accept+assign fired startPricing → quote exists & is being built
  CANCELLED    // sales-side cancel (non-terminal guard, rfqs.service.ts:448)
  DECLINED     // dept said "not us" (wrong_dept | no_bid)
}
```

**Dropped values** (all migrate per §8 table): `RECEIVED→SUBMITTED`, `IN_PREPARATION→PRICING`, and `PENDING_APPROVAL / APPROVED_READY_FOR_DISPATCH / SENT / WON / LOST / POSTPONED` — these duplicated `QuoteStatus` (`schema.prisma:875-890`) and now live **only** on the Quote.

### 1b. New `Rfq` fields (insert after `status RfqStatus` at `schema.prisma:1133`)

```prisma
  status RfqStatus @default(SUBMITTED)   // changed default RECEIVED → SUBMITTED

  // Decline ("Not us") audit — set by declineRfq (§4)
  declineType   RfqDeclineType?
  declineReason String?
  declinedById  String?
  declinedAt    DateTime?
```

```prisma
enum RfqDeclineType {
  WRONG_DEPT   // route back to sales as needs-re-route
  NO_BID       // close out as no-bid
}
```

`requestedCategoryIds` (1114) stays as-is — already correct.

### 1c. Deprecate (keep column, stop writing) — do NOT drop yet

These RFQ columns become legacy once submit/approve/send/outcome move to Quote. Keep for historical reads; stop writing:

- `coordinatorId / coordinatorAssignedAt` (1120-1122), `technicalContributorId` (1124), `financialReviewerId` (1127) — superseded by `RfqAssignment` rows. **Stop writing** (delete `assignCoordinator` / `assignContributor`, §5).
- `dispatchedAt / dispatchedVia` (1137-1138), `confirmationType/At/Value/DocUrl` (1140-1143), `lostReason / postponedUntil` (1145-1146) — now owned by Quote (`sentAt`/`lostReasonCode`/`postponedUntil` at `schema.prisma:842-848`) and `CommercialConfirmation`. **Stop writing.**
- `RfqDispatchChannel` (1303-1306), `ConfirmationType` on the RFQ side — the RFQ enum becomes orphaned (Quote uses its own). Leave the enum defined (it's still referenced by deprecated columns) until a later cleanup migration.

**Quote stays the lifecycle owner** — no `QuoteStatus` change. The full 14-state machine at `schema.prisma:875-890` is unchanged.

---

## 2. DERIVED STATUS (no second write)

Single source of truth: `rfq.quote.status`. The API computes a **sales-facing display status** in a pure mapper, applied in both serializers. RFQ DB status never holds SENT/WON/etc.

**New file:** `packages/api/src/modules/rfqs/rfq-display-status.ts`

```ts
import { QuoteStatus, RfqStatus } from '@prisma/client';

export type RfqDisplayStatus =
  | 'SUBMITTED'
  | 'DECLINED_WRONG_DEPT'
  | 'DECLINED_NO_BID'
  | 'CANCELLED'
  | 'PRICING'
  | 'IN_APPROVAL'
  | 'QUOTE_READY'
  | 'SENT'
  | 'WON'
  | 'LOST'
  | 'POSTPONED';

/** Compute the sales-facing status from the thin RFQ + its (optional) Quote.
 *  rfq.quote is the source of truth once it exists; RfqStatus only governs the
 *  pre-quote intake states (SUBMITTED/ASSIGNED/PRICING/CANCELLED/DECLINED). */
export function deriveRfqDisplayStatus(rfq: {
  status: RfqStatus;
  declineType?: 'WRONG_DEPT' | 'NO_BID' | null;
  quote?: { status: QuoteStatus } | null;
}): RfqDisplayStatus {
  if (rfq.status === RfqStatus.CANCELLED) return 'CANCELLED';
  if (rfq.status === RfqStatus.DECLINED)
    return rfq.declineType === 'NO_BID'
      ? 'DECLINED_NO_BID'
      : 'DECLINED_WRONG_DEPT';
  if (!rfq.quote)
    return rfq.status === RfqStatus.PRICING ? 'PRICING' : 'SUBMITTED';

  switch (rfq.quote.status) {
    case QuoteStatus.DRAFT:
    case QuoteStatus.IN_REVISION:
    case QuoteStatus.REVISED:
      return 'PRICING';
    case QuoteStatus.PENDING_REVIEW:
    case QuoteStatus.PENDING_APPROVAL:
      return 'IN_APPROVAL';
    case QuoteStatus.APPROVED:
      return 'QUOTE_READY';
    case QuoteStatus.SENT:
    case QuoteStatus.IN_DISCUSSION:
    case QuoteStatus.IN_NEGOTIATION:
      return 'SENT';
    case QuoteStatus.WON:
      return 'WON';
    case QuoteStatus.LOST:
      return 'LOST';
    case QuoteStatus.POSTPONED:
      return 'POSTPONED';
    case QuoteStatus.EXPIRED:
      return 'SENT';
    case QuoteStatus.CANCELLED:
      return 'CANCELLED';
    default:
      return 'PRICING';
  }
}
```

**Applied at:**

- **Detail:** `rfqs.service.ts:173 findOne` — `RFQ_DETAIL_INCLUDE` (`rfqs.service.ts:40-49`) already selects `quote.status`. Wrap the return: `return { ...rfq, displayStatus: deriveRfqDisplayStatus(rfq) };`
- **List:** `rfqs.service.ts:144-160 list` — the `findMany` include (148-155) currently omits `quote`. **Add** `quote: { select: { status: true } }`, then map `data.map(r => ({ ...r, displayStatus: deriveRfqDisplayStatus(r) }))` before returning at 162.

The web "My Requests" list/detail reads `displayStatus`; the department Quotations pipeline reads `quote.status` directly (it lives in `/quotes`).

---

## 3. NEW ENDPOINT — `startPricing(rfqId)` (THE SEAM)

Replaces dead `linkQuote` (`rfqs.service.ts:434`, no route/caller) **and** `startPreparation` (`rfqs.service.ts:310`).

**Route** (rfqs.controller.ts, replaces the `start-preparation` block at lines 86-95):

```ts
@Post(':id/start-pricing')
@RequirePermission('quote:build')
@ApiOperation({ summary: 'Accept & assign: create the Draft Quote from the RFQ, flip to PRICING' })
startPricing(
  @Param('id') id: string,
  @CurrentUser('id') actorId: string,
  @CurrentUser() user: ScopeUser,
  @CurrentScope('quote:build') scope: PermissionScope | undefined,
) {
  return this.service.startPricing(id, actorId, { user, scope });
}
```

**Contract**

- Request: `POST /rfqs/:id/start-pricing`, no body.
- Response: `{ quoteId: string, quoteNumber: string }` → web navigates pricer to `/quotes/:quoteId`.
- Permission: `quote:build` (the de-facto "prepare price offer"; already the `/quotes` create perm).
- Scope: `assertRfqInScope(id, scopeCtx)` (`rfqs.service.ts:231`) — dept managers/pricers see it via `requestedCategoryIds ∩ DepartmentService` (§7).

**Service** (new in `rfqs.service.ts`; `RfqsService` must add `NotificationsService` + `nextEntityNumber` — `QuotesService.nextQuoteNumber` is private, so inline the same generator):

```ts
async startPricing(id: string, actorId: string, scopeCtx?: ScopeContext) {
  await this.assertRfqInScope(id, scopeCtx);
  const rfq = await this.prisma.rfq.findUnique({
    where: { id },
    include: { client: { select: { id: true } } },
  });
  if (!rfq) throw new NotFoundException();
  if (rfq.status === RfqStatus.DECLINED || rfq.status === RfqStatus.CANCELLED)
    throw new BadRequestException('Cannot price a declined/cancelled RFQ');

  // Idempotent: if already linked, just return it (covers double-click + lazy migration §8).
  if (rfq.quoteId) {
    const q = await this.prisma.quote.findUnique({
      where: { id: rfq.quoteId }, select: { id: true, quoteNumber: true },
    });
    if (q) return { quoteId: q.id, quoteNumber: q.quoteNumber };
  }

  // leadId via the opportunity (Rfq has no direct leadId; opportunity.leadId is canonical).
  const opp = await this.prisma.pipelineEntry.findUnique({
    where: { id: rfq.opportunityId }, select: { leadId: true },
  });

  return this.prisma.$transaction(async (tx) => {
    const last = await tx.quote.findFirst({
      orderBy: { createdAt: 'desc' }, select: { quoteNumber: true },
    });
    const quoteNumber = nextEntityNumber('QUO', last?.quoteNumber);

    // One Draft-Quote section per involved service category (multi-dept = N sections).
    const cats = rfq.requestedCategoryIds ?? [];
    const sections = cats.length
      ? cats.map((departmentId, i) => ({
          departmentId, description: 'بند تسعير', quantity: 1,
          unitPrice: 0, subtotal: 0, position: i,
        }))
      : [{ description: 'بند تسعير', quantity: 1, unitPrice: 0, subtotal: 0, position: 0 }];

    const quote = await tx.quote.create({
      data: {
        quoteNumber,
        clientId: rfq.clientId,
        leadId: opp?.leadId ?? undefined,
        title: `عرض سعر — ${rfq.rfqNumber}`,
        status: QuoteStatus.DRAFT,
        preparedById: actorId,
        items: { create: sections },
      },
      select: { id: true, quoteNumber: true },
    });

    await tx.rfq.update({
      where: { id }, data: { quoteId: quote.id, status: RfqStatus.PRICING },
    });
    return { quoteId: quote.id, quoteNumber: quote.quoteNumber };
  });
}
```

Transactional steps: (1) generate `QUO-YYYY-XXXX`, (2) create DRAFT Quote with one `QuoteItem.departmentId` section per `requestedCategoryIds`, (3) set `rfq.quoteId` + `status=PRICING`. `Rfq.quoteId @unique` (1135) is the integrity guard against two quotes per RFQ.

---

## 4. NEW ENDPOINT — `declineRfq(rfqId, { type, reason })`

**Route** (rfqs.controller.ts, new):

```ts
@Post(':id/decline')
@RequirePermission('rfq:assign_pricers')
@ApiOperation({ summary: 'Not us / decline an RFQ with a required reason (wrong_dept | no_bid)' })
decline(
  @Param('id') id: string,
  @Body() dto: DeclineRfqDto,
  @CurrentUser('id') actorId: string,
  @CurrentUser() user: ScopeUser,
  @CurrentScope('rfq:assign_pricers') scope: PermissionScope | undefined,
) {
  return this.service.declineRfq(id, dto, actorId, { user, scope });
}
```

**New DTO** `rfqs/dto/decline-rfq.dto.ts`:

```ts
export class DeclineRfqDto {
  @IsEnum(RfqDeclineType) type!: 'WRONG_DEPT' | 'NO_BID';
  @IsString() @IsNotEmpty() reason!: string; // REQUIRED
}
```

**Service:**

```ts
async declineRfq(id: string, dto: DeclineRfqDto, actorId: string, scopeCtx?: ScopeContext) {
  await this.assertRfqInScope(id, scopeCtx);
  const rfq = await this.requireStatus(id, [RfqStatus.SUBMITTED, RfqStatus.ASSIGNED]);
  if (rfq.quoteId) throw new BadRequestException('Cannot decline after pricing started');
  const updated = await this.prisma.rfq.update({
    where: { id },
    data: {
      status: RfqStatus.DECLINED,
      declineType: dto.type, declineReason: dto.reason,
      declinedById: actorId, declinedAt: new Date(),
    },
    include: RFQ_DETAIL_INCLUDE,
  });
  // Notify sales (§9)
  const recipients = [rfq.originalSalesRepId, rfq.createdBy].filter(Boolean) as string[];
  if (recipients.length)
    void this.notifications.sendToMany([...new Set(recipients)], {
      eventCode: dto.type === 'NO_BID' ? 'rfq.declined_no_bid' : 'rfq.declined_wrong_dept',
      subject: `تم رفض طلب التسعير: ${rfq.rfqNumber}`,
      body: dto.type === 'NO_BID'
        ? `لن يتم التقديم — السبب: ${dto.reason}`
        : `القسم غير مختص — يحتاج إعادة توجيه — السبب: ${dto.reason}`,
      deepLink: `/rfqs/${id}`,
      payload: { rfqId: id, rfqNumber: rfq.rfqNumber, declineType: dto.type },
    });
  return { ...updated, displayStatus: deriveRfqDisplayStatus(updated) };
}
```

- Permission `rfq:assign_pricers` → inherits the manager-of-dept unlock (`permission.guard.ts:71-74`).
- Scope: `assertRfqInScope`. `WRONG_DEPT` surfaces in sales as `needs-re-route`; `NO_BID` as `closed-no-bid` (display via §2).

---

## 5. REMOVED / MOVED

| `rfqs.service.ts` method                   | Route (`rfqs.controller.ts`) | Action     | Quote equivalent                                                                                                               |
| ------------------------------------------ | ---------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `startPreparation:310`                     | `start-preparation:86`       | **DELETE** | `startPricing` (§3)                                                                                                            |
| `submitForApproval:323`                    | `submit-for-approval:97`     | **DELETE** | `QuotesService.submit` (`quotes.service.ts:372`) via `PATCH /quotes/:id/submit` (`quotes.controller.ts:97`)                    |
| `markApproved:354`                         | _(no route — orphan)_        | **DELETE** | `QuotesService.decideApproval` (`quotes.service.ts:514`) flips to `APPROVED` at 556-559                                        |
| `dispatch:363`                             | `dispatch:104`               | **DELETE** | `QuotesService.send` (`quotes.service.ts:642`) via `PATCH /quotes/:id/send` (112)                                              |
| `recordOutcome:378` (+ Commission 410-429) | `outcome:111`                | **DELETE** | won→`accept` (676), lost→`reject` (758), postponed→`postpone` (787). **Commission accrual re-homes onto `accept`** (see below) |
| `linkQuote:434`                            | _(no route — dead)_          | **DELETE** | folded into `startPricing`                                                                                                     |
| `assignCoordinator:260`                    | `assign-coordinator:62`      | **DELETE** | `RfqAssignmentsService.createAssignment` (`rfq-assignments.service.ts:83`)                                                     |
| `assignContributor:285`                    | `assign-contributor:74`      | **DELETE** | `RfqAssignment` rows (multi-dept)                                                                                              |

**Keep:** `create:56` (but backfill `requestedCategoryIds`, §7), `list:105`, `findOne:173`, `cancel:448` (sales, `rfq:request`), `stats:464`, scope helpers (`rfqScopeWhere:197`, `assertRfqInScope:231`, `assertCanAccess:251`). `requireStatus:489` now validates against the 5-state enum only.

**Commission re-home** — move the block from `rfqs.service.ts:410-429` into `QuotesService.accept` (`quotes.service.ts:697-713` transaction). The Commission FK is `rfqId` (`schema.prisma:1689`), and the Quote reaches its RFQ via the back-relation `Quote.rfq` (`schema.prisma:859`). In `accept`, after loading the quote, fetch `rfq: { select: { id, rfqNumber, brokerName, brokerPhone } }` and accrue inside the same `$transaction` when `rfq.brokerName` is set. Reads `commission_rate_broker_default` exactly as today.

**Dead DTOs to delete:** `dispatch-rfq.dto.ts`, `rfq-outcome.dto.ts` (both modified in your working tree). `RfqDispatchChannel`/`ConfirmationType` enum imports drop from `rfqs.service.ts`.

---

## 6. PERMISSION CHANGES

Split `rfq:request_docs` into two. Add to the `PERMISSIONS` catalog (`seed-rbac.ts:58`, after the existing `rfq:request_docs` line):

```ts
mk('rfq:request_docs', true, 'Request missing docs (pricer → sales)'),
mk('rfq:request_site_visit', true, 'Request a site visit before pricing (pricer → sales)'),
```

**Role grants** (`resolveGrants`, `seed-rbac.ts:164`):

- **Engineer** (227-243, `DEPARTMENT`): add `'rfq:request_site_visit'` alongside `'rfq:request_docs'`.
- **Technical Director** (244-267, `ALL`): add `'rfq:request_site_visit'`.
- Sales Rep / Sales Manager: **not granted** (sales responds, doesn't raise). Confirmed correct — neither has `rfq:request_docs` today (204-226, 176-203).

**Controller re-key** (`rfq-assignments.controller.ts`):

- Site-visit `@Post('site-visit-requests')` (161-162) + `@Patch('site-visit-requests/:requestId')` (180-181): change `@RequirePermission('rfq:request_docs')` → `'rfq:request_site_visit'` (and the matching `@CurrentScope` at 172, 190).
- Doc-request raise (111-112, 127-128) stays `rfq:request_docs`.
- **Add the sales responder UI permission path:** today doc/site-visit `update` is gated by the _raiser's_ permission, so sales (who lacks `rfq:request_docs`) can't respond. Either: (a) gate the resolve/`PATCH` on `rfq:request` (sales has it, `seed-rbac.ts:219,221`), or (b) add a dedicated `rfq:respond_request` perm. **Recommend (a)** — least new vocabulary: split the controller so raise=`request_docs`/`request_site_visit`, resolve=`rfq:request`.

**Manager action keys** — unchanged: `MANAGER_ACTION_KEYS` (`permission.guard.ts:22-26`) already covers `rfq:assign_pricers` + `rfq:set_lead_pricer`, so both `createAssignment`/`updateAssignment` (`rfq-assignments.controller.ts:47,62`) and the new `declineRfq` work for dept managers with zero seed edits.

---

## 7. SCOPE

Dept-manager inbox visibility is **already correct** and reused unchanged:

- `rfqScopeWhere` (`rfqs.service.ts:197-229`): for a `managedDeptId`, ORs `assignments.some.assigneeId ∈ deptMembers` **with** `requestedCategoryIds hasSome (DepartmentService.serviceCategoryId for the dept)` (211-223). This is exactly `requestedCategoryIds ∩ DepartmentService`. The freshly-`SUBMITTED`, unassigned RFQ is visible to the manager who must triage. `assertRfqInScope` (231) reuses the same predicate for detail+mutate — so `startPricing`/`declineRfq` are covered.
- Routing notification path: `leads.service.ts routeRfqToManagers:249-302` does the `ServiceCategory → DepartmentService → department.managerId` hop (257-267). No change.

**Empty-`requestedCategoryIds` backfill** (the §7 gap): RFQs from `RfqsService.create` (`rfqs.service.ts:86-102`) never set `requestedCategoryIds`, so they're invisible to the category-scope branch. Two fixes:

1. **Forward:** in `create`, derive categories from the opportunity/lead service selection (or accept `requestedCategoryIds` on `CreateRfqDto`) and persist them, matching `leads.service.ts:215`.
2. **Backfill** (migration §8): for legacy RFQs with `requestedCategoryIds = []`, map `serviceType`/`projectScope` → `ServiceCategory` ids via the existing `DepartmentService`/service catalog where resolvable; otherwise leave `[]` (those stay manager-invisible by category but remain visible via assignments — acceptable, all in-flight ones get assignments in the migration).

---

## 8. MIGRATION PLAN (new migration: `2026xxxx_rfq_restructure_thin_rfq`)

**Status mapping (old → new + Quote effect):**

| Old `RfqStatus`               | New `RfqStatus` | Quote action                                                                               |
| ----------------------------- | --------------- | ------------------------------------------------------------------------------------------ |
| `RECEIVED`                    | `SUBMITTED`     | none                                                                                       |
| `ASSIGNED`                    | `ASSIGNED`      | none                                                                                       |
| `IN_PREPARATION`              | `PRICING`       | ensure linked Draft Quote (below)                                                          |
| `PENDING_APPROVAL`            | `PRICING`       | ensure quote; set quote `PENDING_APPROVAL` if it has approvals, else `DRAFT`               |
| `APPROVED_READY_FOR_DISPATCH` | `PRICING`       | ensure quote; set quote `APPROVED`                                                         |
| `SENT`                        | `PRICING`       | ensure quote; set quote `SENT` + copy `dispatchedAt→sentAt`                                |
| `WON`                         | `PRICING`       | ensure quote; set quote `WON` + `wonAt`; migrate confirmation\* → `CommercialConfirmation` |
| `LOST`                        | `PRICING`       | ensure quote; set quote `LOST` + `lostReason`                                              |
| `POSTPONED`                   | `PRICING`       | ensure quote; set quote `POSTPONED` + `postponedUntil`                                     |
| `CANCELLED`                   | `CANCELLED`     | none                                                                                       |

Because terminal/lifecycle states now live on the Quote, every non-intake legacy RFQ maps to `PRICING` and its real state is read from `rfq.quote.status` via §2. (Display correctly shows WON/LOST/SENT/etc.)

**Migration steps (SQL + a TS data script `prisma/migrations/.../data-backfill.ts`):**

1. **Pre-rename data fix (run before enum swap):** for every RFQ where `quoteId IS NULL` AND old status ∈ {IN_PREPARATION, PENDING_APPROVAL, APPROVED_READY_FOR_DISPATCH, SENT, WON, LOST, POSTPONED} → create a linked Draft Quote (same body as §3 `startPricing`, one section per `requestedCategoryIds` or one bare section), set `rfq.quoteId`. **Alternative (lazy):** leave `quoteId` null and let the first `startPricing` open mint it (idempotent guard in §3 handles this) — but eager is safer for reporting.
2. Set each linked quote's `status` per the table; copy `dispatchedAt→sentAt`, `lostReason`, `postponedUntil`, and `confirmation*` → a `CommercialConfirmation` row for WON.
3. **Enum swap:** add new `RfqStatus` values, `UPDATE rfqs SET status = <mapped>`, drop old values. (Postgres enum migration: create new type, alter column with `USING`, drop old type — Prisma generates this from the schema change.)
4. Add columns: `declineType RfqDeclineType?`, `declineReason text`, `declinedById text`, `declinedAt timestamp`; create `RfqDeclineType` enum.
5. **Backfill `requestedCategoryIds`** for `[]` rows (§7) where resolvable; ensure every in-flight (non-terminal) RFQ has at least one `RfqAssignment` (preserve legacy `coordinatorId`/contributors as the seed assignee + lead pricer so the single-lead invariant holds).
6. **Preserve legacy fields read-only:** keep `coordinatorId`, `technicalContributorId`, `financialReviewerId`, `dispatchedAt/Via`, `confirmation*`, `lostReason`, `postponedUntil` columns (no drop) for audit; app code stops writing them.
7. Run `seed-rbac.ts` after migrate to add `rfq:request_site_visit` + new grants (§6).

---

## 9. NOTIFICATIONS (event → recipients)

All via `NotificationsService.send` / `sendToMany` (free-form `eventCode`, Arabic subject/body, `deepLink`). Existing codes reused where present.

| Event                     | Trigger (where)                                                           | Recipients                                                                              | eventCode                                                 | deepLink                                      |
| ------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------- |
| RFQ submitted             | `leads.service.ts:269-277 routeRfqToManagers` (existing)                  | dept managers (`DepartmentService→managerId`); multi-dept also Sales Managers (278-298) | `rfq.received` / `rfq.multi_dept_received` _(existing)_   | `/rfqs/:id`                                   |
| Pricer assigned           | `RfqAssignmentsService.createAssignment` (`:104`) — **add**               | the `assigneeId` (esp. `isLeadPricer`)                                                  | `rfq.assigned` _(new)_                                    | `/quotes/:quoteId` if linked else `/rfqs/:id` |
| RFQ declined              | `declineRfq` (§4) — **new**                                               | `originalSalesRepId` + `createdBy`                                                      | `rfq.declined_wrong_dept` / `rfq.declined_no_bid` _(new)_ | `/rfqs/:id`                                   |
| Doc request raised        | `createDocRequest` (`:209`) — **add**                                     | RFQ's `originalSalesRepId`/`createdBy` (sales)                                          | `rfq.doc_requested` _(new)_                               | `/rfqs/:id`                                   |
| Site-visit request raised | `createSiteVisitRequest` (`:266`) — **add**                               | sales (as above)                                                                        | `rfq.site_visit_requested` _(new)_                        | `/rfqs/:id`                                   |
| Doc/site-visit resolved   | `updateDocRequest:236` / `updateSiteVisitRequest` on `RESOLVED` — **add** | the request's `requestedById` (the engineer)                                            | `rfq.request_resolved` _(new)_                            | `/quotes/:quoteId`                            |
| Quote ready (approved)    | `decideApproval` all-approved (`quotes.service.ts:603-611`) _(existing)_  | `quote.preparedById`                                                                    | `quote.all_approved` _(existing)_                         | `/quotes/:id`                                 |
| Quote sent                | `QuotesService.send:642` — **add**                                        | sales owner / preparer (FYI)                                                            | `quote.sent` _(new)_                                      | `/quotes/:id`                                 |
| Outcome WON               | `accept:725-734,744-753` _(existing)_                                     | Finance/Sales managers                                                                  | `quote.won` / `po.generated` _(existing)_                 | `/quotes/:id`                                 |
| Approval needed           | `submit` / `decideApproval:567-578` _(existing)_                          | next-tier approver                                                                      | `quote.submitted_for_approval` _(existing)_               | `/quotes/:id`                                 |

New codes are plain strings — no enum/registry to extend (`notifications.service.ts:7`).

---

### Implementer checklist (files to touch)

- `prisma/schema.prisma` — RfqStatus enum 1275-1286; Rfq fields after 1133; new `RfqDeclineType`.
- `prisma/migrations/2026xxxx_rfq_restructure_thin_rfq/` + `data-backfill.ts` (§8).
- `prisma/seed-rbac.ts` — add `rfq:request_site_visit` perm (58) + Engineer/Tech-Director grants (227-267).
- **New:** `rfqs/rfq-display-status.ts`; `rfqs/dto/decline-rfq.dto.ts`.
- `rfqs/rfqs.service.ts` — delete 260-446 lifecycle methods; add `startPricing`, `declineRfq`; inject `NotificationsService`; apply `deriveRfqDisplayStatus` in `list`/`findOne`; add `quote.status` to list include (148-155).
- `rfqs/rfqs.controller.ts` — replace routes 62-116 (`start-pricing`, `decline` only; drop coordinator/contributor/submit/dispatch/outcome).
- `rfqs/rfq-assignments.controller.ts` — re-key site-visit to `rfq:request_site_visit`; resolve-paths to `rfq:request`; assignment/doc-request notifications.
- `quotes/quotes.service.ts:697-713` — fold in broker Commission accrual from old `rfqs.service.ts:410-429`.
- Delete dead DTOs: `dispatch-rfq.dto.ts`, `rfq-outcome.dto.ts`.
