'use client';

import { ShieldX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

/**
 * NoAccess — the single source of truth for "you can't see this" in the UI.
 *
 * Three presentations, one component, so the copy + look never drift:
 *   - `page` (default): a full-height 403 for an unauthorized *route* (FE-1).
 *   - `inline`: a card-sized block for a forbidden *data call* on an otherwise
 *     allowed page — replaces the misleading "no records yet" empty state (FE-4).
 *   - `record`: a record-level denial on a detail page — replaces the raw
 *     "Request failed with status code 403" axios string (FE-5).
 *
 * RTL-safe: relies on logical spacing + centered layout, no left/right.
 */
export type NoAccessVariant = 'page' | 'inline' | 'record';

export function NoAccess({
  variant = 'page',
  title,
  description,
  className,
}: {
  variant?: NoAccessVariant;
  title?: string;
  description?: string;
  className?: string;
}) {
  const t = useTranslations('noAccess');

  const resolvedTitle =
    title ??
    (variant === 'record'
      ? t('recordTitle')
      : variant === 'inline'
        ? t('inlineTitle')
        : t('title'));
  const resolvedDescription =
    description ??
    (variant === 'record'
      ? t('recordDescription')
      : variant === 'inline'
        ? t('inlineDescription')
        : t('description'));

  const body = (
    <div
      className={
        'flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-8 py-12 text-center ' +
        (className ?? '')
      }
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10 text-warning">
        <ShieldX className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="mt-3 text-base font-semibold text-dark-text">
        {resolvedTitle}
      </h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {resolvedDescription}
      </p>
      {variant === 'page' && (
        <Button asChild size="sm" className="mt-5">
          <Link href="/dashboard">{t('backHome')}</Link>
        </Button>
      )}
    </div>
  );

  if (variant === 'page') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="w-full max-w-lg">{body}</div>
      </div>
    );
  }
  return body;
}
