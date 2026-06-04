'use client';

import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Star, Loader2, PencilRuler, Undo2, AlertTriangle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useQuoteSections, useSubmitSection } from '@/lib/hooks/use-quotes';
import { useUnacceptRfq } from '@/lib/hooks/use-rfqs';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useAuthStore } from '@/lib/auth';
import type { Quote, QuoteSection } from '@/lib/types/quote';
import { cn } from '@/lib/utils';

// QP-8: a draft that's sat in Pricing for a while with nothing submitted yet is
// "stale" — surfaces an accepted-but-never-worked draft to the manager.
const STALE_AFTER_DAYS = 3;
const STALE_MS = STALE_AFTER_DAYS * 86_400_000;

// QP-5 — the Pricing-column card. Shows section progress ("2/3 submitted"), each
// section's pricer + status, and a per-section [Submit to lead] shown ONLY to
// that section's pricer (disabled while the section's subtotal is 0). [Open
// builder] links to the quote for now — the pre-linked builder edit-mode is
// split out as QP-5b (logged on the roadmap).

function sectionSubtotal(s: QuoteSection): number {
  return s.items.reduce((sum, it) => sum + it.subtotal, 0);
}

export function DraftQuoteCard({
  quote,
  locale,
}: {
  quote: Quote;
  locale: string;
}) {
  const t = useTranslations('quotations.pricing');
  const tCur = useTranslations('quoteDetail'); // RV3b-6: shared translated currency
  const dir = useLocale() === 'ar' ? 'rtl' : 'ltr';
  const sections = useQuoteSections(quote.id);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const submit = useSubmitSection(quote.id);
  const { can } = usePermissions();
  const unaccept = useUnacceptRfq(quote.rfq?.id ?? '');

  const list = sections.data ?? [];
  const submitted = list.filter((s) => s.status === 'SUBMITTED_TO_LEAD').length;

  // QP-8 staleness (manager signal): accepted but nothing submitted, sitting a while.
  const stale =
    submitted === 0 &&
    Date.now() - new Date(quote.createdAt).getTime() > STALE_MS;
  // QP-9: un-accept (return to triage) — a manager-only reversal of an
  // accidental accept while the draft is still empty.
  const canUnaccept = can('rfq:assign_pricers') && !!quote.rfq?.id;

  async function onSubmit(sectionId: string) {
    try {
      await submit.mutateAsync(sectionId);
      toast.success(t('submitToast'));
    } catch (err) {
      toast.error(errMessage(err, t('submitFailed')));
    }
  }

  async function onUnaccept() {
    if (!quote.rfq?.id) return;
    try {
      await unaccept.mutateAsync();
      toast.success(t('unacceptToast'));
    } catch (err) {
      toast.error(errMessage(err, t('unacceptFailed')));
    }
  }

  return (
    <div className="rounded-md border bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-medium" dir="ltr">
          {quote.quoteNumber}
        </span>
        <span className="flex items-center gap-1">
          {stale && (
            <span
              className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
              title={t('staleTitle', { days: STALE_AFTER_DAYS })}
            >
              <AlertTriangle className="h-3 w-3" />
              {t('stale')}
            </span>
          )}
          {list.length > 0 && (
            <span
              className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
              title={t('progressTitle')}
            >
              {t('progress', { done: submitted, total: list.length })}
            </span>
          )}
        </span>
      </div>
      <p className="mt-1 truncate text-sm font-medium">
        {quote.client.companyName ?? quote.client.contactName}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-abak-blue" dir="ltr">
        {quote.totalAmount.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}{' '}
        <span className="text-xs font-normal text-muted-foreground">
          {tCur('currency')}
        </span>
      </p>

      {sections.isLoading ? (
        <div className="mt-2 h-8 animate-pulse rounded bg-muted" />
      ) : list.length > 0 ? (
        <ul className="mt-2 space-y-1.5" dir={dir}>
          {list.map((s) => {
            const priced = sectionSubtotal(s) > 0;
            const mine = !!currentUserId && s.pricerId === currentUserId;
            const isDraft = s.status === 'DRAFT';
            const pricerName = s.pricer
              ? [s.pricer.firstName, s.pricer.lastName]
                  .filter(Boolean)
                  .join(' ') || s.pricer.email
              : t('noPricer');
            return (
              <li
                key={s.id}
                className="rounded border bg-background/60 px-2 py-1.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 truncate font-medium">
                    {s.isLead && (
                      <Star className="h-3 w-3 shrink-0 fill-amber-500 text-amber-500" />
                    )}
                    {(locale === 'ar'
                      ? s.department?.nameAr
                      : s.department?.name) ??
                      s.department?.name ??
                      s.departmentId}
                  </span>
                  <SectionStatusPill status={s.status} t={t} />
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-muted-foreground">
                    {pricerName}
                  </span>
                  {mine && isDraft && (
                    <button
                      type="button"
                      onClick={() => onSubmit(s.id)}
                      disabled={!priced || submit.isPending}
                      title={!priced ? t('unpricedHint') : undefined}
                      className="inline-flex min-h-[28px] items-center gap-1 rounded bg-abak-blue px-2 text-[11px] font-semibold text-white disabled:opacity-50"
                    >
                      {submit.isPending && (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                      {t('submitToLead')}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <Link
        href={`/quotes/${quote.id}`}
        className="mt-2 inline-flex min-h-[32px] w-full items-center justify-center gap-1 rounded border text-xs font-medium text-abak-blue hover:bg-muted/40"
      >
        <PencilRuler className="h-3.5 w-3.5" />
        {t('openBuilder')}
      </Link>

      {canUnaccept && (
        <button
          type="button"
          onClick={onUnaccept}
          disabled={unaccept.isPending}
          className="mt-1.5 inline-flex min-h-[28px] w-full items-center justify-center gap-1 rounded text-[11px] font-medium text-muted-foreground hover:text-destructive disabled:opacity-50"
        >
          {unaccept.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Undo2 className="h-3 w-3" />
          )}
          {t('unaccept')}
        </button>
      )}
    </div>
  );
}

function errMessage(err: unknown, fallback: string): string {
  const message =
    (err as { response?: { data?: { message?: string | string[] } } })?.response
      ?.data?.message ?? fallback;
  return Array.isArray(message) ? message.join(', ') : String(message);
}

function SectionStatusPill({
  status,
  t,
}: {
  status: QuoteSection['status'];
  t: ReturnType<typeof useTranslations>;
}) {
  const submitted = status === 'SUBMITTED_TO_LEAD';
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
        submitted
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-amber-100 text-amber-700',
      )}
    >
      {submitted ? t('statusSubmitted') : t('statusDraft')}
    </span>
  );
}
