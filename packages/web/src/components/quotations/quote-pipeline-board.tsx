'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Inbox, Clock, Star } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useRfqsList } from '@/lib/hooks/use-rfqs';
import { useQuotes } from '@/lib/hooks/use-quotes';
import { usePermissions } from '@/lib/hooks/use-permissions';
import type { Quote, QuoteStatus } from '@/lib/types/quote';
import type { RfqListItem } from '@/lib/types/rfq';
import { QuoteStatusBadge } from '@/components/ui/entity-status-badges';
import { ErrorState } from '@/components/ui/state-blocks';
import { ListSkeleton } from '@/components/ui/skeleton-layouts';
import { cn } from '@/lib/utils';
import { AcceptAssignSheet } from './accept-assign-sheet';
import { DeclineRfqDialog } from './decline-rfq-dialog';

// QP-1/2/10 — the department pipeline board. Five fixed columns; RTL flow puts
// Incoming at the reading start (right). Incoming is sourced from the thin RFQ
// (displayStatus SUBMITTED = un-accepted); the four downstream columns are the
// linked Quote grouped by quote.status. The board is "read + two seam actions"
// (Accept+Assign / Decline on Incoming) — every downstream transition happens on
// /quotes/[id]. Drag is intentionally NOT supported (it would bypass the
// loss-reason forcing function).

type ColKey = 'incoming' | 'pricing' | 'approval' | 'sent' | 'closed';
const COLUMNS: ColKey[] = ['incoming', 'pricing', 'approval', 'sent', 'closed'];

const QUOTE_COLUMN: Record<QuoteStatus, Exclude<ColKey, 'incoming'>> = {
  DRAFT: 'pricing',
  REVISED: 'pricing',
  PENDING_REVIEW: 'approval',
  PENDING_APPROVAL: 'approval',
  IN_REVISION: 'approval',
  APPROVED: 'sent',
  SENT: 'sent',
  IN_DISCUSSION: 'sent',
  IN_NEGOTIATION: 'sent',
  WON: 'closed',
  LOST: 'closed',
  POSTPONED: 'closed',
  EXPIRED: 'closed',
  CANCELLED: 'closed',
};

const COL_BORDER: Record<ColKey, string> = {
  incoming: 'border-t-amber-400',
  pricing: 'border-t-sky-400',
  approval: 'border-t-violet-400',
  sent: 'border-t-emerald-400',
  closed: 'border-t-muted-foreground/30',
};

/**
 * Business-hours-ish elapsed time since an ISO timestamp: wall-clock hours minus
 * whole weekend days (Fri/Sat in KSA). An approximation of the SLA clock — the
 * precise holidays/business-hours integration is a backend concern (logged).
 */
function bizHoursSince(iso: string, now: number): number {
  const start = new Date(iso).getTime();
  let ms = now - start;
  const days = Math.floor(ms / 86_400_000);
  let weekendDays = 0;
  for (let i = 0; i < days; i++) {
    const dow = new Date(start + i * 86_400_000).getUTCDay(); // 5=Fri,6=Sat
    if (dow === 5 || dow === 6) weekendDays++;
  }
  ms -= weekendDays * 86_400_000;
  return Math.max(0, ms / 3_600_000);
}

function slaTone(hours: number): { dot: string; ring: string; red: boolean } {
  if (hours > 4)
    return { dot: 'bg-rose-500', ring: 'ring-1 ring-rose-300', red: true };
  if (hours > 2) return { dot: 'bg-amber-500', ring: '', red: false };
  return { dot: 'bg-emerald-500', ring: '', red: false };
}

function fmtTimer(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function QuotePipelineBoard({ search }: { search: string }) {
  const t = useTranslations('quotations.board');
  const locale = useLocale();
  const { can } = usePermissions();
  const canAssign = can('rfq:assign_pricers');

  const rfqs = useRfqsList({ pageSize: 100 });
  const quotes = useQuotes();

  // Stamp "now" once per render so all SLA timers share a baseline.
  const now = useMemo(() => Date.now(), [rfqs.data, quotes.data]);

  const [acceptId, setAcceptId] = useState<string | null>(null);
  const [declineId, setDeclineId] = useState<string | null>(null);

  const q = search.trim().toLowerCase();
  const match = (parts: (string | null | undefined)[]) =>
    !q || parts.filter(Boolean).join(' ').toLowerCase().includes(q);

  const incoming = useMemo(
    () =>
      (rfqs.data?.data ?? [])
        .filter((r) => r.displayStatus === 'SUBMITTED')
        .filter((r) =>
          match([
            r.rfqNumber,
            r.client?.companyName,
            r.client?.contactName,
            r.serviceType,
          ]),
        ),
    [rfqs.data, q],
  );

  const byColumn = useMemo(() => {
    const groups: Record<Exclude<ColKey, 'incoming'>, Quote[]> = {
      pricing: [],
      approval: [],
      sent: [],
      closed: [],
    };
    for (const quote of quotes.data?.data ?? []) {
      if (
        !match([
          quote.quoteNumber,
          quote.client.companyName,
          quote.client.contactName,
          quote.title,
        ])
      )
        continue;
      groups[QUOTE_COLUMN[quote.status]].push(quote);
    }
    return groups;
  }, [quotes.data, q]);

  const counts: Record<ColKey, number> = {
    incoming: incoming.length,
    pricing: byColumn.pricing.length,
    approval: byColumn.approval.length,
    sent: byColumn.sent.length,
    closed: byColumn.closed.length,
  };

  const isLoading = rfqs.isLoading || quotes.isLoading;
  const isError = rfqs.isError || quotes.isError;

  if (isLoading) return <ListSkeleton rows={4} />;
  if (isError)
    return (
      <ErrorState
        description={t('error')}
        onRetry={() => {
          rfqs.refetch();
          quotes.refetch();
        }}
      />
    );

  const acceptRfq = incoming.find((r) => r.id === acceptId) ?? null;
  const declineRfq = incoming.find((r) => r.id === declineId) ?? null;

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((col) => (
          <section
            key={col}
            className={cn(
              'flex w-72 shrink-0 flex-col rounded-lg border border-t-2 bg-muted/20',
              COL_BORDER[col],
            )}
            aria-label={t(`col.${col}`)}
          >
            <header className="flex items-center justify-between px-3 py-2">
              <h3 className="text-sm font-semibold">{t(`col.${col}`)}</h3>
              <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {counts[col]}
              </span>
            </header>
            <div className="flex flex-col gap-2 px-2 pb-2">
              {col === 'incoming' ? (
                incoming.length === 0 ? (
                  <ColumnEmpty icon={Inbox} text={t('empty.incoming')} />
                ) : (
                  incoming.map((r) => (
                    <IncomingRfqCard
                      key={r.id}
                      rfq={r}
                      now={now}
                      canAssign={canAssign}
                      onAccept={() => setAcceptId(r.id)}
                      onDecline={() => setDeclineId(r.id)}
                    />
                  ))
                )
              ) : counts[col] === 0 ? (
                <ColumnEmpty text={t(`empty.${col}`)} />
              ) : (
                byColumn[col].map((quote) => (
                  <QuoteCard key={quote.id} quote={quote} locale={locale} />
                ))
              )}
            </div>
          </section>
        ))}
      </div>

      {acceptRfq && (
        <AcceptAssignSheet
          rfq={acceptRfq}
          open
          onClose={() => setAcceptId(null)}
        />
      )}
      {declineRfq && (
        <DeclineRfqDialog
          rfq={declineRfq}
          open
          onClose={() => setDeclineId(null)}
        />
      )}
    </>
  );
}

function ColumnEmpty({
  icon: Icon,
  text,
}: {
  icon?: typeof Inbox;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
      {Icon && <Icon className="h-5 w-5" />}
      <span className="px-3">{text}</span>
    </div>
  );
}

// QP-2 — Incoming card: RFQ#, SLA timer (business-hours-ish), client, service,
// and the two seam actions (gated by rfq:assign_pricers).
function IncomingRfqCard({
  rfq,
  now,
  canAssign,
  onAccept,
  onDecline,
}: {
  rfq: RfqListItem;
  now: number;
  canAssign: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const t = useTranslations('quotations.board');
  const hours = bizHoursSince(rfq.createdAt, now);
  const sla = slaTone(hours);

  return (
    <article
      className={cn(
        'rounded-md border bg-card p-3 shadow-sm',
        sla.ring,
        sla.red && 'border-t-2 border-t-rose-500',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-medium" dir="ltr">
          {rfq.rfqNumber}
        </span>
        <span
          className="inline-flex items-center gap-1 text-xs text-muted-foreground"
          dir="ltr"
          title={t('slaTitle')}
        >
          <Clock className="h-3.5 w-3.5" />
          {fmtTimer(hours)}
          <span className={cn('h-2 w-2 rounded-full', sla.dot)} />
        </span>
      </div>
      <p className="mt-1 truncate text-sm font-medium">
        {rfq.client?.companyName ?? rfq.client?.contactName ?? '—'}
      </p>
      <p className="truncate text-xs text-muted-foreground">
        {rfq.serviceType}
      </p>

      {canAssign ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onAccept}
            className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1 rounded-md bg-abak-blue px-2 text-xs font-semibold text-white hover:bg-abak-blue/90"
          >
            <Star className="h-3.5 w-3.5" />
            {t('accept')}
          </button>
          <button
            type="button"
            onClick={onDecline}
            className="min-h-[40px] rounded-md border px-2 text-xs font-medium text-muted-foreground hover:bg-muted/50"
          >
            {t('decline')}
          </button>
        </div>
      ) : (
        <p className="mt-2 text-xs italic text-muted-foreground">
          {t('awaitingTriage')}
        </p>
      )}
    </article>
  );
}

function QuoteCard({ quote, locale }: { quote: Quote; locale: string }) {
  return (
    <Link
      href={`/quotes/${quote.id}`}
      className="block rounded-md border bg-card p-3 shadow-sm transition hover:bg-muted/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-medium" dir="ltr">
          {quote.quoteNumber}
        </span>
        <QuoteStatusBadge status={quote.status} />
      </div>
      <p className="mt-1 truncate text-sm font-medium">
        {quote.client.companyName ?? quote.client.contactName}
      </p>
      <p className="mt-1 text-sm font-semibold text-abak-blue" dir="ltr">
        {quote.totalAmount.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}{' '}
        <span className="text-xs font-normal text-muted-foreground">SAR</span>
      </p>
    </Link>
  );
}
