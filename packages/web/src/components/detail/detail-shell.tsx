'use client';

/**
 * Shared detail-page shell — one consistent template for every entity 360° view
 * (lead, client, RFQ, quote/price-offer). Built on the Norman + data-dense
 * dashboard principles:
 *
 *  - DetailHeader: back link (RTL-mirrored), identity (eyebrow number + title +
 *    subtitle), status badges, and a clear action hierarchy — ONE primary CTA,
 *    a secondary cluster, and destructive/rare actions tucked into an overflow
 *    menu. Bridges the Gulf of Execution: the next step is always top-end.
 *  - DetailBody: main activity column + a sticky summary rail that surfaces the
 *    high-signal "at a glance" facts (knowledge in the world, not in the head).
 *  - DetailSection / Field / FieldGrid: scannable, grouped, hierarchy via size
 *    and weight — not a flat wall of identical rows. Numerics render LTR with
 *    tabular figures so columns line up under RTL.
 *
 * Presentational only — pages keep all data, hooks, dialogs and mutations.
 */

import * as React from 'react';
// Locale-aware Link so the back ("العودة") button keeps the /ar|/en prefix and
// navigates client-side instead of falling through to a server redirect (CRM-2).
import { Link } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

export interface DetailHeaderProps {
  backHref: string;
  backLabel: string;
  /** Short identifier shown above the title (e.g. LEAD-2026-0007). Rendered mono. */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Status / priority / SLA badges. */
  badges?: React.ReactNode;
  /** The single most important next action. Rendered as the lone primary CTA. */
  primary?: React.ReactNode;
  /** Secondary actions (outline buttons). Kept visually subordinate to `primary`. */
  actions?: React.ReactNode;
  /** Overflow / destructive actions — pass a <DropdownMenu> trigger+content. */
  menu?: React.ReactNode;
}

export function DetailHeader({
  backHref,
  backLabel,
  eyebrow,
  title,
  subtitle,
  badges,
  primary,
  actions,
  menu,
}: DetailHeaderProps) {
  return (
    <div className="space-y-4 border-b pb-5">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {backLabel}
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1.5">
          {eyebrow ? (
            <div
              dir="ltr"
              className="font-mono text-xs tracking-wide text-muted-foreground"
            >
              {eyebrow}
            </div>
          ) : null}
          <h1 className="truncate text-2xl font-bold leading-tight text-abak-blue">
            {title}
          </h1>
          {subtitle ? (
            <div className="text-sm text-muted-foreground">{subtitle}</div>
          ) : null}
          {badges ? (
            <div className="flex flex-wrap items-center gap-2 pt-1.5">
              {badges}
            </div>
          ) : null}
        </div>

        {primary || actions || menu ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
            {primary}
            {menu}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Body: main column + sticky summary rail
// ---------------------------------------------------------------------------

export function DetailBody({
  rail,
  children,
  className,
}: {
  rail?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  if (!rail) {
    return <div className={cn('space-y-6', className)}>{children}</div>;
  }
  return (
    <div className={cn('grid gap-6 lg:grid-cols-3 lg:items-start', className)}>
      <div className="space-y-6 lg:col-span-2">{children}</div>
      <aside className="space-y-4 lg:sticky lg:top-6">{rail}</aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section (card with header + optional icon / description / action)
// ---------------------------------------------------------------------------

export function DetailSection({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  contentClassName,
  bodyPadded = true,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  /** Set false for flush content like tables. */
  bodyPadded?: boolean;
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      {title || action ? (
        <div className="flex items-start justify-between gap-3 border-b px-5 py-3.5">
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              {Icon ? (
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : null}
              {title ? (
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  {title}
                </h2>
              ) : null}
            </div>
            {description ? (
              <p className="text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn(bodyPadded ? 'p-5' : '', contentClassName)}>
        {children}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Field (label / value) — stacked, scannable, hierarchy via size + weight
// ---------------------------------------------------------------------------

type FieldEmphasis = 'default' | 'strong' | 'money' | 'mono' | 'muted';

export function FieldGrid({
  children,
  cols = 2,
  className,
}: {
  children: React.ReactNode;
  cols?: 1 | 2 | 3;
  className?: string;
}) {
  const colClass =
    cols === 1
      ? 'grid-cols-1'
      : cols === 3
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2';
  return (
    <dl className={cn('grid gap-x-6 gap-y-4', colClass, className)}>
      {children}
    </dl>
  );
}

export function Field({
  label,
  value,
  children,
  emphasis = 'default',
  hint,
  className,
}: {
  label: React.ReactNode;
  /** Convenience: a primitive value. Use `children` for rich content. */
  value?: string | number | null;
  children?: React.ReactNode;
  emphasis?: FieldEmphasis;
  hint?: React.ReactNode;
  className?: string;
}) {
  const hasValue =
    children !== undefined && children !== null && children !== false
      ? true
      : value !== undefined && value !== null && value !== '';

  const numeric = emphasis === 'money' || emphasis === 'mono';
  const valueClass = cn(
    'text-sm',
    emphasis === 'strong' && 'text-base font-semibold text-foreground',
    emphasis === 'money' &&
      'text-base font-semibold tabular-nums text-foreground',
    emphasis === 'mono' && 'font-mono text-foreground',
    emphasis === 'muted' && 'text-muted-foreground',
    emphasis === 'default' && 'font-medium text-foreground',
  );

  return (
    <div className={cn('min-w-0 space-y-1', className)}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={cn('break-words', valueClass)}>
        {hasValue ? (
          // Numeric values keep LTR digit order via an inner span, while the dd
          // inherits the page direction so it aligns to the start side
          // (right in RTL, left in LTR) instead of being pinned left by dir.
          numeric ? (
            <span dir="ltr" className="inline-block">
              {children ?? value}
            </span>
          ) : (
            (children ?? value)
          )
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </dd>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary rail
// ---------------------------------------------------------------------------

export function DetailRail({
  title,
  children,
  className,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('p-5', className)}>
      {title ? (
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
      ) : null}
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

/** A prominent single figure for the rail (e.g. total amount, lifetime value). */
export function RailStat({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'default' | 'success' | 'brand';
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          'text-2xl font-bold tabular-nums leading-none',
          tone === 'success' && 'text-success',
          tone === 'brand' && 'text-abak-blue',
          tone === 'default' && 'text-foreground',
        )}
      >
        {/* LTR digit order kept on the inner span; the block inherits page
            direction so the figure aligns to the start side (right in RTL). */}
        <span dir="ltr" className="inline-block">
          {value}
        </span>
      </div>
      {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading / error states
// ---------------------------------------------------------------------------

export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3 border-b pb-5">
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="h-48 animate-pulse rounded-lg bg-muted" />
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="h-72 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}

export function DetailError({
  backHref,
  backLabel,
  message,
}: {
  backHref: string;
  backLabel: string;
  message: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {backLabel}
      </Link>
      <Card>
        <CardContent className="py-12 text-center text-sm text-destructive">
          {message}
        </CardContent>
      </Card>
    </div>
  );
}
