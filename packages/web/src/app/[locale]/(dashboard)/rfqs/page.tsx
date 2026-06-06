'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FileText } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useRfqsList } from '@/lib/hooks/use-rfqs';
import type { RfqListItem } from '@/lib/types/rfq';
import { RequestPhaseBadge } from '@/components/ui/entity-status-badges';
import { DataState } from '@/components/ui/data-state';
import { ListSkeleton } from '@/components/ui/skeleton-layouts';
import { cn } from '@/lib/utils';

// SALES-1 — "My Requests". Action-sorted (who-owes-the-next-move), not date.

type BandKey =
  | 'reroute'
  | 'quoteReady'
  | 'asks'
  | 'sent'
  | 'inflight'
  | 'closed';

const BAND_ORDER: Record<BandKey, number> = {
  reroute: 1,
  quoteReady: 2,
  asks: 3,
  sent: 4,
  inflight: 5,
  closed: 6,
};

const BAND_BORDER: Record<BandKey, string> = {
  reroute: 'border-s-rose-500',
  quoteReady: 'border-s-amber-400',
  asks: 'border-s-amber-500',
  sent: 'border-s-sky-400',
  inflight: 'border-s-transparent',
  closed: 'border-s-transparent',
};

function bandOf(item: RfqListItem): BandKey {
  const d = item.displayStatus;
  if (d === 'DECLINED_WRONG_DEPT') return 'reroute';
  if (d === 'QUOTE_READY') return 'quoteReady';
  if (
    item.openAskCount > 0 &&
    (d === 'SUBMITTED' || d === 'PRICING' || d === 'SENT')
  )
    return 'asks';
  if (d === 'SENT') return 'sent';
  if (d === 'SUBMITTED' || d === 'PRICING' || d === 'IN_APPROVAL')
    return 'inflight';
  return 'closed';
}

type Segment = 'needsMe' | 'inProgress' | 'sent' | 'closed' | 'all';
const SEGMENTS: Segment[] = ['needsMe', 'inProgress', 'sent', 'closed', 'all'];

function inSegment(band: BandKey, item: RfqListItem, seg: Segment): boolean {
  switch (seg) {
    case 'needsMe':
      return BAND_ORDER[band] <= 4;
    case 'inProgress':
      return band === 'inflight';
    case 'sent':
      return item.displayStatus === 'SENT';
    case 'closed':
      return band === 'closed';
    case 'all':
      return true;
  }
}

function relativeTime(iso: string, locale: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const min = Math.round(diffMs / 60000);
  if (Math.abs(min) < 60) return rtf.format(-min, 'minute');
  const hr = Math.round(min / 60);
  if (Math.abs(hr) < 24) return rtf.format(-hr, 'hour');
  return rtf.format(-Math.round(hr / 24), 'day');
}

export default function RfqsListPage() {
  const t = useTranslations('rfq.list');
  const locale = useLocale();
  const [segment, setSegment] = useState<Segment>('needsMe');
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, error, refetch } = useRfqsList({
    pageSize: 100,
  });

  const rows = useMemo(() => data?.data ?? [], [data]);

  const needsYouCount = useMemo(
    () => rows.filter((r) => BAND_ORDER[bandOf(r)] <= 3).length,
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => inSegment(bandOf(r), r, segment))
      .filter((r) => {
        if (!q) return true;
        return [
          r.rfqNumber,
          r.quote?.quoteNumber ?? '',
          r.client?.companyName ?? '',
          r.client?.contactName ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const ord = BAND_ORDER[bandOf(a)] - BAND_ORDER[bandOf(b)];
        if (ord !== 0) return ord;
        return +new Date(b.createdAt) - +new Date(a.createdAt);
      });
  }, [rows, segment, search]);

  const hasFilters = segment !== 'all' || search.trim().length > 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            {t('title')}
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
              {t('needsYou', { count: needsYouCount })}
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Link
          href="/leads"
          className="text-sm font-medium text-abak-blue hover:underline"
        >
          {t('raiseFromLead')}
        </Link>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
          {SEGMENTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSegment(s)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-sm transition',
                segment === s
                  ? 'bg-abak-blue text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70',
              )}
            >
              {t(`segment.${s}`)}
            </button>
          ))}
        </div>
        <input
          type="search"
          dir="auto"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search')}
          className="ms-auto h-9 w-full max-w-xs rounded-md border bg-background px-3 text-sm"
        />
      </div>

      <DataState
        isLoading={isLoading}
        isError={isError}
        error={error}
        isEmpty={filtered.length === 0}
        hasFilters={hasFilters}
        onRetry={() => refetch()}
        loading={<ListSkeleton rows={6} />}
        empty={{
          icon: FileText,
          title: t('empty.firstTitle'),
          description: t('empty.firstBody'),
          action: { label: t('empty.firstAction'), href: '/leads' },
        }}
        emptyFiltered={{
          icon: FileText,
          title:
            segment === 'needsMe'
              ? t('empty.caughtUp')
              : t('empty.filteredTitle'),
          description: segment === 'needsMe' ? '' : t('empty.filteredBody'),
          action:
            segment === 'needsMe'
              ? undefined
              : {
                  label: t('empty.filteredAction'),
                  onClick: () => {
                    setSegment('all');
                    setSearch('');
                  },
                },
        }}
        errorState={{ description: t('error') }}
      >
        <RfqRows rows={filtered} locale={locale} />
      </DataState>
    </main>
  );
}

function RfqRows({ rows, locale }: { rows: RfqListItem[]; locale: string }) {
  const t = useTranslations('rfq.list');

  function waitingOn(band: BandKey, item: RfqListItem) {
    switch (band) {
      case 'reroute':
        return { text: t('waitingOn.youReroute'), you: true };
      case 'quoteReady':
        return { text: t('waitingOn.youSend'), you: true };
      case 'asks':
        return {
          text: t('waitingOn.youAsks', { count: item.openAskCount }),
          you: true,
        };
      case 'sent':
        return { text: t('waitingOn.client'), you: false };
      case 'inflight':
        return { text: t('waitingOn.pricingTeam'), you: false };
      case 'closed':
        return { text: t('waitingOn.none'), you: false };
    }
  }

  const COLS = 'grid-cols-[7rem_1.4fr_1.2fr_auto_1fr_5rem]';

  return (
    <>
      {/* Desktop table (≥1024px) — the wide-screen triage surface (§1.5). */}
      <div className="hidden overflow-hidden rounded-lg border lg:block">
        <div
          className={cn(
            'grid items-center gap-x-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground',
            COLS,
          )}
        >
          <span>{t('col.ref')}</span>
          <span>{t('col.client')}</span>
          <span>{t('col.scope')}</span>
          <span>{t('col.phase')}</span>
          <span>{t('col.waitingOn')}</span>
          <span className="text-end">{t('col.updated')}</span>
        </div>
        {rows.map((r) => {
          const band = bandOf(r);
          const w = waitingOn(band, r);
          return (
            <Link
              key={r.id}
              href={`/rfqs/${r.id}`}
              className={cn(
                'grid items-center gap-x-4 border-b border-s-[3px] px-4 py-3 text-sm transition last:border-b-0 hover:bg-muted/40',
                COLS,
                BAND_BORDER[band],
                band === 'closed' && 'opacity-60',
              )}
            >
              <span className="min-w-0">
                <span
                  className="block truncate font-mono font-medium"
                  dir="ltr"
                >
                  {r.rfqNumber}
                </span>
                {r.quote?.quoteNumber && (
                  <span
                    className="block truncate font-mono text-xs text-muted-foreground"
                    dir="ltr"
                  >
                    {r.quote.quoteNumber}
                  </span>
                )}
              </span>
              <span className="min-w-0 truncate font-medium">
                {r.client?.companyName ?? r.client?.contactName ?? '—'}
              </span>
              <span className="min-w-0 truncate text-muted-foreground">
                {r.serviceType}
              </span>
              <span>
                <RequestPhaseBadge status={r.displayStatus} />
              </span>
              <span
                className={cn(
                  'min-w-0 truncate',
                  w.you && 'font-semibold text-amber-900',
                )}
              >
                {w.you && <span className="me-1">⚠</span>}
                {w.text}
              </span>
              <span className="text-end text-xs text-muted-foreground">
                {relativeTime(r.createdAt, locale)}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Mobile stacked cards (<1024px) — the rep's primary device (§1.6). */}
      <ul className="space-y-2 lg:hidden">
        {rows.map((r) => {
          const band = bandOf(r);
          const w = waitingOn(band, r);
          return (
            <li key={r.id}>
              <Link
                href={`/rfqs/${r.id}`}
                className={cn(
                  'flex items-start gap-3 rounded-lg border border-s-[3px] bg-card p-3 transition hover:bg-muted/40',
                  BAND_BORDER[band],
                  band === 'closed' && 'opacity-60',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-medium" dir="ltr">
                      {r.rfqNumber}
                    </span>
                    {r.quote?.quoteNumber && (
                      <span
                        className="font-mono text-xs text-muted-foreground"
                        dir="ltr"
                      >
                        {r.quote.quoteNumber}
                      </span>
                    )}
                    <RequestPhaseBadge status={r.displayStatus} />
                  </div>
                  <p className="mt-1 truncate text-sm font-medium">
                    {r.client?.companyName ?? r.client?.contactName ?? '—'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.serviceType}
                  </p>
                  <div
                    className={cn(
                      'mt-2 inline-flex rounded-md px-2 py-1 text-xs',
                      w.you
                        ? 'bg-amber-100 font-semibold text-amber-900'
                        : 'text-muted-foreground',
                    )}
                  >
                    {w.you && <span className="me-1">⚠</span>}
                    {w.text}
                  </div>
                </div>
                <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                  {relativeTime(r.createdAt, locale)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
