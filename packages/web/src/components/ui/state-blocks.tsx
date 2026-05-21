'use client';

import type { ComponentType, ReactNode } from 'react';
import { AlertTriangle, Inbox, type LucideProps } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from './button';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

type IconType = ComponentType<LucideProps>;

export type StateAction =
  | { label: string; onClick: () => void; href?: never }
  | { label: string; href: string; onClick?: never };

export interface EmptyStateProps {
  /**
   * Visual anchor. Pick something semantically related to the activity
   * (Briefcase for clients, Inbox for leads). Avoid generic "empty box".
   */
  icon?: IconType;
  title: string;
  description?: string;
  /** Primary CTA. Per §8, omit for filtered-empty — let user clear filters instead. */
  action?: StateAction;
  /** Optional secondary action (e.g. "Clear filters" next to "Create first"). */
  secondaryAction?: StateAction;
  className?: string;
  /** When inside a card/section, dial down padding with `compact`. */
  compact?: boolean;
}

/**
 * EmptyState — for first-run and filtered-empty surfaces.
 * See DESIGN_SYSTEM_MASTER.md §8.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 text-center',
        compact ? 'px-6 py-8' : 'px-8 py-14',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-abak-blue/10 text-abak-blue',
          compact ? 'h-10 w-10' : 'h-12 w-12',
        )}
      >
        <Icon className={compact ? 'h-5 w-5' : 'h-6 w-6'} aria-hidden />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-dark-text">{title}</h3>
      {description && (
        <p className="mt-1 max-w-md text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action && <ActionButton action={action} />}
          {secondaryAction && (
            <ActionButton action={secondaryAction} variant="outline" />
          )}
        </div>
      )}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  compact?: boolean;
}

/**
 * ErrorState — for in-page errors (persistent). Transient errors stay as toasts.
 * Copy rule per §7: never blame the user. "We couldn't load…" not "You failed…".
 */
export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel,
  className,
  compact = false,
}: ErrorStateProps) {
  const t = useTranslations();
  const resolvedTitle = title ?? t('dataState.errorTitle');
  const resolvedDescription = description ?? t('dataState.errorDescription');
  const resolvedRetryLabel = retryLabel ?? t('common.retry');
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-error/30 bg-error/5 text-center',
        compact ? 'px-6 py-8' : 'px-8 py-12',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-error/10 text-error',
          compact ? 'h-10 w-10' : 'h-12 w-12',
        )}
      >
        <AlertTriangle
          className={compact ? 'h-5 w-5' : 'h-6 w-6'}
          aria-hidden
        />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-error">{resolvedTitle}</h3>
      {resolvedDescription && (
        <p className="mt-1 max-w-md text-xs text-muted-foreground">
          {resolvedDescription}
        </p>
      )}
      {onRetry && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onRetry}
          className="mt-4 border-error/40 text-error hover:bg-error/10 hover:text-error"
        >
          {resolvedRetryLabel}
        </Button>
      )}
    </div>
  );
}

// ─── Internal ─────────────────────────────────────────────────────────

function ActionButton({
  action,
  variant = 'default',
}: {
  action: StateAction;
  variant?: 'default' | 'outline';
}) {
  const content: ReactNode = action.label;
  if ('href' in action && action.href) {
    return (
      <Button asChild size="sm" variant={variant}>
        <Link href={action.href}>{content}</Link>
      </Button>
    );
  }
  return (
    <Button type="button" size="sm" variant={variant} onClick={action.onClick}>
      {content}
    </Button>
  );
}
