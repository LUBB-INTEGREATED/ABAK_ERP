import type { ComponentType, SVGProps } from 'react';
import { Check, CircleAlert, CircleDot, Minus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Canonical status variants — see DESIGN_SYSTEM_MASTER.md §2.
 *
 * These are the only five semantic colors a badge may carry. Avoid
 * introducing more — when in doubt, pick the closest.
 *
 *   success → achieved end-state (WON, APPROVED, COMPLETED, PAID)
 *   warning → needs human attention soon (PENDING, AT_RISK, DUE_TODAY)
 *   error   → failed / lost / overdue (LOST, REJECTED, EXPIRED, FAILED)
 *   info    → neutral in-flight (NEW, IN_PROGRESS, SENT, DRAFT)
 *   muted   → inactive / archived (ARCHIVED, CANCELLED, POSTPONED)
 *
 * Each variant has a *shape* glyph (not just colour) so colorblind users
 * can read the dashboard without relying on hue alone — UI audit Tier 3 #14.
 */
export type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'muted';

const VARIANT_CLASSES: Record<
  StatusVariant,
  {
    bg: string;
    text: string;
    dot: string;
    icon: ComponentType<SVGProps<SVGSVGElement>>;
  }
> = {
  success: {
    bg: 'bg-success/15',
    text: 'text-success',
    dot: 'bg-success',
    icon: Check,
  },
  warning: {
    bg: 'bg-warning/15',
    text: 'text-warning',
    dot: 'bg-warning',
    icon: CircleAlert,
  },
  error: {
    bg: 'bg-error/10',
    text: 'text-error',
    dot: 'bg-error',
    icon: X,
  },
  info: {
    bg: 'bg-abak-blue/10',
    text: 'text-abak-blue',
    dot: 'bg-abak-blue',
    icon: CircleDot,
  },
  muted: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    dot: 'bg-muted-foreground/60',
    icon: Minus,
  },
};

export interface StatusBadgeProps {
  variant: StatusVariant;
  /** Visible label. Keep it short (≤ 2 words). */
  label: string;
  /** Show a colored dot before the label. Useful in dense tables. */
  dot?: boolean;
  /** Solid fill instead of tint. Use sparingly — solid screams. */
  solid?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  /** Native HTML title tooltip — show full description if label is abbreviated. */
  title?: string;
}

export function StatusBadge({
  variant,
  label,
  dot = false,
  solid = false,
  size = 'sm',
  className,
  title,
}: StatusBadgeProps) {
  const v = VARIANT_CLASSES[variant];
  const Icon = v.icon;
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium leading-tight whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        solid ? cn(v.dot, 'text-white') : cn(v.bg, v.text),
        className,
      )}
    >
      {dot && (
        <Icon
          className={cn(size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5', 'shrink-0')}
          strokeWidth={2.5}
          aria-hidden
        />
      )}
      {label}
    </span>
  );
}
