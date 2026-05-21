# Design System MASTER — UX Rulebook

**Companion to** [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) (brand colors, typography, logo).
**Source of truth for** how screens _behave_ — colors used semantically, error handling, RTL, signifiers, empty states, accessibility, AI features.

This is the rulebook every screen in `packages/web` must follow. When a screen disagrees with this doc, the doc wins; update the screen. When this doc disagrees with reality you _want_, update the doc _first_, then the screens.

The rules below are grounded in Don Norman's design framework (`Design of Everyday Things` (2013), `Living with Complexity` (2010), `Design for a Better World` (2023)). The vocabulary in [`norman-design-thinking`](https://github.com/anthropics/claude-skills) is used freely.

---

## 0. The frame

Every screen passes two tests:

- **Discoverability** — can the user figure out what actions are possible, where they live, how to perform them?
- **Understanding** — can they figure out what each control does and what each state means?

Every workflow gets walked through Norman's seven stages before shipping: **goal → plan → specify → perform → perceive → interpret → compare**. Stages 2–4 cross the _Gulf of Execution_ (can I do what I want?), stages 5–7 cross the _Gulf of Evaluation_ (did it work?). Most ABAK admin screens leak at evaluation — fix evaluation first.

## 1. Conceptual model spine

The app's spine is **lead → cash**. Every primary route corresponds to one stage of that activity. The sidebar groups (`Sales / Delivery / Insight / Admin`) make this visible. Don't add nav items that don't fit one of those activities — propose a route under the right group or push back on the feature.

Out-of-scope routes are documented in [`MVP_SCOPE.md`](./MVP_SCOPE.md). They remain in the codebase but not in the sidebar until the addendum is signed.

## 2. Status color tokens — use semantically, not visually

Tailwind config (`packages/web/tailwind.config.ts`) already defines `success / warning / error / info`. **Use the tokens; do not write `bg-amber-100` ad-hoc.** Doing so creates description-similarity slips between pages — "amber" means "due today" on one page and "pending approval" on another.

**Canonical status semantics:**

| Token     | Hex               | Meaning everywhere         | Used for                                          |
| --------- | ----------------- | -------------------------- | ------------------------------------------------- |
| `success` | `#A78B42` (gold)  | Achieved end-state         | WON, APPROVED, COMPLETED, PAID, ACTIVE-good       |
| `warning` | `#D97706` (amber) | Needs human attention soon | PENDING_APPROVAL, DUE_TODAY, AT_RISK, IN_REVISION |
| `error`   | `#DC2626` (red)   | Failed / lost / overdue    | LOST, REJECTED, OVERDUE, FAILED, STUCK            |
| `info`    | `#3B82F6` (blue)  | Neutral informational      | NEW, DRAFT, INFO toasts                           |
| `muted`   | gray              | Inactive / archived        | ARCHIVED, DISQUALIFIED, CLOSED-neutral            |

**Open issue to fix in code:** gold (`success`) is also our brand-secondary. A gold "WON" badge sitting next to a gold secondary-action button is a description-similarity slip waiting to happen. **Rule:** badges use `bg-success/15 text-success` (tinted), buttons use solid gold. The tint vs solid is the disambiguating signal.

A central `<StatusBadge variant="success|warning|error|info|muted">` should exist in `components/ui/`. New status maps in page files are a code smell — extract to the badge.

## 3. Signifier conventions — what the user can see

> "Signifiers are of far more importance to designers than are affordances." — Norman, DOET-R p.14

**Required:**

- Primary actions are **visible buttons** with text labels. Not hover-revealed, not behind a three-dot menu, not gesture-only.
- Icons used as buttons always have a `aria-label` AND a tooltip.
- Disabled state is paired with a tooltip or inline help text explaining _why_ — a disabled button with no reason is a false signifier (the user sees the action exists but can't perform it and doesn't know why).
- Focus states are visible on every interactive element. The shadcn defaults are sufficient; don't override them away.

**Forbidden:**

- Hover-only revelation of primary actions on desktop.
- Three-dot menus containing the only path to a primary action (edit, approve, send).
- Destructive actions that look identical to non-destructive ones — destructive = red text or red icon + confirm step.
- Flat colored text as the only signifier that something is clickable. Links underline on hover at minimum; buttons look like buttons.

## 4. Action hierarchy & placement

Per screen at most one **primary** action, one **secondary** action, and a small set of **tertiary** menu items. Anything beyond that signals the screen is doing too many activities — split it.

- **Primary** = the one thing the user came to this screen to do (Send Quote, Approve, Convert Lead). Solid `abak-blue`. Top-right of the page header in LTR; top-left in RTL.
- **Secondary** = supporting (Save Draft, Add Note). Outline style.
- **Destructive** = Reject, Archive, Disqualify. Red text + dialog with mandatory reason.

In RTL (Arabic), the primary-action corner is **top-left**, not top-right. Mirror the layout, not just the text direction.

## 5. Mappings — RTL and Arabic

Arabic is the **primary** language. English is secondary. This means:

- Reading axis is RTL → the F-pattern becomes a Γ-pattern with the strong information corner at **top-right**. KPI cards and most-important info land there.
- **Mirror** directional iconography: next/previous arrows, indent, drill-into-row, approve-forward, breadcrumb chevrons, drawer slide-in direction.
- **Do not mirror** non-directional iconography: search, settings/gear, filter, calendar, mail.
- **Numerical columns stay LTR** even inside an RTL page — totals, prices, IDs (`QUO-2026-0123`), dates in ISO form. Use `dir="ltr" class="font-mono"` for table cells. This matches global accounting convention and Gulf usage.
- **Digits:** Gulf uses Western Arabic digits (0–9). Do not switch to Hindi-Arabic numerals (٠–٩).
- **Time metaphor:** in Arabic timelines, past sits to the right, future to the left. Gantt charts and timelines must be mirrored, not just text-flipped.
- **Dates:** support both Hijri and Gregorian; Gregorian primary in the UI, Hijri on demand. ISO format (`2026-05-18`) for IDs and logs.

A `dir="rtl"` CSS flip is **not** an Arabic design. Whenever you ship an Arabic-relevant change, run the screen in both locales and verify the spatial metaphors, not just the text glyphs.

## 6. Feedback — narrow both gulfs

**Execution gulf:** every action gets an immediate visible response within 100ms (button press state, spinner inside the button, optimistic UI where safe).

**Evaluation gulf:** every action that mutates state shows what happened.

| Scale                             | Pattern                                                                   |
| --------------------------------- | ------------------------------------------------------------------------- |
| Single-field inline edit          | Inline check icon + brief toast                                           |
| Form submission                   | Toast (success/error) + page state update                                 |
| Background job (cron, email send) | In-app notification + status badge changes on the affected entity         |
| Destructive / irreversible        | Modal confirmation, then toast + audit-log entry                          |
| Approval workflow                 | Status badge changes + activity timeline entry visible on the entity page |

Toasts are positional: bottom-end (`bottom-left` in RTL, `bottom-right` in LTR). Auto-dismiss `success` after 4s; `error` toasts stay until dismissed.

## 7. Error design

> "Human error usually is a result of poor design: it should be called system error." — Norman, DOET-R p.162

**Defaults:**

- **Undo is the default recovery mechanism** for reversible actions. A toast with "Undo" beats a confirmation dialog every time.
- **Forcing functions (modal confirmations) are reserved for truly irreversible operations**: closing a period, deleting a tenant, sending a quote to a client, submitting a government filing. Overuse trains users to dismiss the modal.
- **All rejections, losses, disqualifications require a documented reason** (already a business rule). The reason field is mandatory and appears in the audit log.
- **Sensibility checks over blocking validation.** When user input is ambiguous (e.g., "12-05" — May 12 or December 5?), surface the system's interpretation as a confirmation step rather than rejecting the input.
- **Never blame the user.** Error copy reframes as _"the action was an approximation of intent"_: "We didn't recognise this date format — did you mean 2026-05-12?" not "Invalid date".

**Slips to anticipate and defang:**

| Slip type              | ABAK example                                  | Mitigation                                                             |
| ---------------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| Description-similarity | Two clients named "Al-Faisal Holding"         | Show CR# / city / phone tail in the picker, not just name              |
| Mode error             | "Current period" silently changes filter      | Make the active period a persistent visible chip, not a hidden default |
| Capture error          | Common action overrides the intended rare one | Separate destructive actions visually + extra click                    |
| Memory-lapse           | Forgot to attach the PO before approving      | Approval button disabled until checklist complete, with inline reason  |

## 8. Empty / Loading / Error states

Every list, table, and dashboard widget has all four states designed, not just the populated one:

- **Empty (first run)** — illustration or icon + one sentence explaining what this surface will show + a primary CTA to create the first item. Not "No data".
- **Empty (filtered)** — different copy: "No leads match these filters." + "Clear filters" button. Don't show the create-first CTA here.
- **Loading** — skeleton rows matching the final layout (not a spinner in the middle of the page). Skeleton rows = same height and column structure so layout doesn't jump.
- **Error** — one-sentence problem + one-sentence what to do next + Retry button. No stack traces. Toast for transient errors, in-page card for persistent ones.

**Implementation:** `<DataState>` (`components/ui/data-state.tsx`) is the canonical 4-state wrapper. It composes three primitives:

- `<EmptyState icon title description action>` (`components/ui/state-blocks.tsx`)
- `<ErrorState onRetry title? description?>` (same file)
- Layout-matching skeletons: `<TableSkeleton rows cols>`, `<ListSkeleton rows>`, `<CardGridSkeleton count cols>`, `<DetailSkeleton>` (`components/ui/skeleton-layouts.tsx`)

The `<DataState>` API forces every data surface to think about all four states explicitly:

```tsx
<DataState
  isLoading={query.isLoading}
  isError={query.isError}
  isEmpty={!data || data.length === 0}
  hasFilters={hasActiveFilters} // toggles empty ↔ emptyFiltered
  onRetry={query.refetch}
  loading={<TableSkeleton rows={6} cols={7} />}
  empty={{
    icon: FileText,
    title: 'No quotes yet',
    description:
      'Quotes are created from RFQs, or directly from a client card.',
    action: { label: 'New quote', href: '/quotes/new' },
  }}
  emptyFiltered={{
    icon: FileText,
    title: 'No matches',
    description: 'Try widening the search or clearing the status filter.',
    action: { label: 'Clear filters', onClick: clearFilters },
  }}
>
  <Card>…the populated table…</Card>
</DataState>
```

**Reference migrations** (canonical use):

- `app/[locale]/(dashboard)/quotes/page.tsx`
- `app/[locale]/(dashboard)/leads/page.tsx`

**Hard rules:**

- New list/dashboard surfaces without `<DataState>` (or equivalent four-state coverage) **fail review**.
- "Empty (first-run)" and "Empty (filtered)" must read differently. The wrapper splits them via `hasFilters` — if you only pass `empty`, both states show the create-first CTA, which is the slip we're trying to prevent.
- Loading uses a layout-matching skeleton, **not** a centered spinner. Pick the right skeleton primitive or pass a custom one; never fall back to a spinner-in-the-middle.

## 9. Forms

- **Labels above inputs**, not floating, not placeholder-only. Floating labels and placeholder-as-label fail in RTL and for screen readers.
- **Required fields marked with `*`** + a legend; not "required" badges.
- **Inline validation fires on blur**, not on every keystroke. Per-keystroke validation is hostile.
- **Submit button shows pending state** (`Saving…` + spinner) and is disabled during submission to prevent double-submit.
- **Server errors map to the offending field** when possible; only fall back to a top-level error banner when the error is cross-cutting.
- **Long forms (>8 fields) get section headers** or wizard steps. The lead-intake form is the existing example to mirror.
- **Drafts auto-save** for forms that span 2+ minutes of expected user time (lead intake, quote builder). "Save draft" as an explicit secondary action even when auto-save is on, for user reassurance.

## 10. Tables

- **Sticky header row** on tables that scroll.
- **Numeric columns right-aligned**, monospaced, LTR even in RTL pages, with thousand separators (Gulf convention: `1,234,567.89` SAR).
- **Row click opens the entity** (the whole row is the affordance, not just the ID column). Cursor: pointer; hover state on the row.
- **No more than 6 columns by default**; additional fields go behind a per-row "expand" or on the detail page.
- **Filter chips persist across navigation** within the session; saved filter presets are a P1 feature on Leads and Pipeline.
- **Pagination over infinite scroll** for admin lists — users need to find specific records, not browse.

## 11. Tab pages (entity 360° view)

Pattern established by `clients/[id]`. Each entity detail page has:

- **Header card** — primary info (name, ID, status badge, key meta), primary CTA, secondary CTA, three-dot menu for tertiary.
- **Tab strip** — Profile · Interactions · related-entities · Notes · Documents · Audit. Default tab is Profile.
- **Sidebar (or right rail in RTL)** — at-a-glance KPIs and quick actions specific to this entity.

When adding a new entity detail page, mirror this anatomy rather than inventing a new one.

## 12. Approval / escalation visual language

- **Approval chain visualization:** show the requested → in-review → approved/rejected ladder inline on the quote/RFQ page. Not a separate "approvals" page.
- Each step displays: who, when, decision, comment (if any). A rejected step shows the mandatory reason inline.
- The current pending step pulses subtly. The next step is greyed.
- For BR-07 mandatory L1+L2 quote approvals: both steps render explicitly; the L2 step is greyed until L1 approves. Hidden tier-2 = hidden affordance = users wonder if the quote is "really" approved.

## 13. Accessibility floor

These are floors, not targets:

- Body text ≥ 16px. Table density ≥ 14px.
- Contrast ratio AA minimum. AAA on critical financial figures.
- Every interactive element keyboard-reachable; visible focus state.
- No hover-only revelation of primary actions or essential information.
- All form controls labeled (for screen readers).
- Iconography paired with text label OR `aria-label` + visible tooltip.
- Color is never the only signal — pair with icon and/or text.
- Animation respects `prefers-reduced-motion`.

## 14. AI features

Where the app uses AI (currently: lead chatbot intake, planned: quote suggestions), the mental model is _senior reviewing junior's work_, not autopilot:

- **Augmentation, not replacement.** The user remains the responsible party. AI proposes; user accepts.
- **Inspectable reasoning.** Show why the AI suggested what it did. Never a black box.
- **Visible uncertainty.** Confidence scores are readable. Low-confidence suggestions are visually distinguished.
- **Reversible actions.** AI may _propose_ irreversible operations; it may not _commit_ them.
- **Cited sources.** When AI extracts a value from a document, show the source span.

## 15. What to flag at code review

If you see one of these in a PR, push back:

1. New `bg-amber-100 text-amber-700` instead of `bg-warning/15 text-warning` (or the StatusBadge component once it lands).
2. A new top-level nav item not in `MVP_SCOPE.md`.
3. A three-dot menu containing the only path to a primary action.
4. A confirmation modal for a reversible action where "Undo toast" would do.
5. A list page with no empty / loading / error state.
6. A form using placeholder-as-label.
7. A numeric column not LTR/monospaced in an Arabic page.
8. A directional icon that wasn't mirrored in RTL (or, conversely, a non-directional icon that was).
9. New status semantics that don't map to the five-token table (Section 2).
10. An AI suggestion committed automatically without a user accept step.

## 16. What we deliberately _do not_ do (Norman anti-patterns)

- We don't ship Excel-as-mental-model. Spreadsheets are escape hatches, not the primary surface.
- We don't ship aesthetic minimalism that hides controls. Beauty must serve function, not replace it.
- We don't treat "engagement" as a design goal. The KPI is _user finishes the activity faster with fewer errors_.
- We don't design for personas (`the small-business owner`); we design for **activities** (close the period, approve the quote, file the tender).
- We don't lock users into wizards that can't be paused and resumed.
- We don't English-first / Arabic-as-translation-layer. Arabic is primary.

## 17. Status-badge architecture & migration status

The 5-token model from §2 is implemented as a small stack:

1. **`<StatusBadge variant="success|warning|error|info|muted">`** — the canonical primitive at `components/ui/status-badge.tsx`. Always uses brand tokens (`bg-success/15 text-success`, etc.) — never inline Tailwind hues.
2. **`lib/status-tones.ts`** — per-entity functions (`quoteStatusVariant`, `rfqStatusVariant`, `projectStatusVariant`, …) that map every enum value to one of the 5 variants. **Single source of truth.** When you add a new enum value, add a case here.
3. **Typed entity wrappers** at `components/ui/entity-status-badges.tsx` — `<QuoteStatusBadge>`, `<RfqStatusBadge>`, `<ProjectStatusBadge>`, `<PhaseStatusBadge>`, `<TaskStatusBadge>`, `<ClientStatusBadge>`, `<ClientClassificationBadge>`, `<FollowUpStatusBadge>`, `<LeadStatusBadge>`, `<LeadPriorityBadge>`, `<RfqPriorityBadge>`, `<SlaStatusBadge>`, `<GovTxStatusBadge>`, `<InvoiceStatusBadge>`. Each one combines variant mapping + i18n label in one prop (`status`). **Always prefer these in pages** over hand-rolling `<StatusBadge variant=… label=… />`.

**Migrated so far (status badges):**

- `quotes/page.tsx`, `quotes/[id]/page.tsx`, `quotes/[id]/print/page.tsx`
- `rfqs/page.tsx`, `rfqs/[id]/page.tsx`
- `clients/page.tsx`, `clients/[id]/page.tsx`
- `leads/page.tsx`, `leads/[id]/page.tsx`
- `lib/lead-ui.ts` (STATUS_BADGE / SLA_BADGE / PRIORITY_BADGE dropped)

**Still to migrate (incremental):**

- Project pages — still use the older `<StatusPill>` from `components/projects/status-dot.tsx`. That file is now marked `@deprecated`. Migrate to `<ProjectStatusBadge>` / `<PhaseStatusBadge>` / `<TaskStatusBadge>` next time you touch those pages.
- Gov-tx pages — replace ad-hoc tone arrays with `<GovTxStatusBadge>`.
- Finance pages — `<InvoiceStatusBadge>` is ready.
- Pipeline kanban column tones — define `pipelineStageVariant` in `status-tones.ts` and a `<PipelineStageBadge>` wrapper.
- Various inline `bg-amber-100 text-amber-700` callouts (warning banners, etc.). These are _not_ badges and may stay until we have a `<Callout>` primitive, but they should also follow the 5-token rule.

**Hard rule going forward:** new `STATUS_BADGE: Record<X, string>` maps inside page files **fail review**. If a new entity status appears, add it to `status-tones.ts` + create a wrapper in `entity-status-badges.tsx` — don't shortcut.

---

## Appendix — Norman quotes worth memorizing

> _"Two of the most important characteristics of good design are discoverability and understanding."_

> _"Make actions reversible; provide undo. Make irreversible actions difficult."_

> _"True beauty in a product has to be more than skin deep… aesthetic minimalism at the expense of function is a fraud."_

> _"Complexity is a state of the world. Complicated is a state of mind."_

When in doubt, re-read those four and decide.
