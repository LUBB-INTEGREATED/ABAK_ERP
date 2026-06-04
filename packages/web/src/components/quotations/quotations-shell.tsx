'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatDistanceToNow } from 'date-fns';
import { ar as arLocale } from 'date-fns/locale';
import {
  FileText,
  RefreshCcw,
  LayoutGrid,
  List as ListIcon,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataState } from '@/components/ui/data-state';
import { QuoteStatusBadge } from '@/components/ui/entity-status-badges';
import { Input } from '@/components/ui/input';
import { TableSkeleton } from '@/components/ui/skeleton-layouts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useQuotes, useQuoteStats } from '@/lib/hooks/use-quotes';
import type { Quote } from '@/lib/types/quote';
import { QuotePipelineBoard } from './quote-pipeline-board';

// QP-1 — the Quotations module shell. One route, two view modes (Board / List)
// over the same scope+search dataset, with the 4 KPIs on top. View defaults by
// role: managers (rfq:assign_pricers) land on the Board; everyone else on the
// List. The scope segmented control (My queue / My dept / All) is deferred — it
// needs assignee/dept fields on the list serializers to filter precisely
// (logged in EPIC23_NIGHT_DECISIONS.md); today the data is already
// permission-scoped server-side.

type View = 'board' | 'list';

export function QuotationsShell() {
  const t = useTranslations('quotations.shell');
  const locale = useLocale();
  const numLocale = locale === 'ar' ? 'ar-SA' : 'en-US';
  const { can, isLoading: permsLoading } = usePermissions();

  const stats = useQuoteStats();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View | null>(null);

  // RV2-6 + §6.2: the Board is the DEPARTMENT surface — managers (who triage +
  // assign) AND pricers (who price + submit their section) both work it. Gate it
  // to department roles (rfq:assign_pricers OR rfq:price_section); a sales rep /
  // sales manager (neither) sees the flat List only. The Accept/Decline + submit
  // controls inside the board stay separately permission-gated.
  const canBoard = can('rfq:assign_pricers') || can('rfq:price_section');

  // Default view by role on first mount; then user toggle wins (persisted).
  useEffect(() => {
    if (view !== null || permsLoading) return;
    const stored =
      typeof window !== 'undefined'
        ? (localStorage.getItem('quotes.view') as View | null)
        : null;
    setView(canBoard ? (stored ?? 'board') : 'list');
  }, [view, permsLoading, canBoard]);

  function pick(v: View) {
    setView(v);
    if (typeof window !== 'undefined') localStorage.setItem('quotes.view', v);
  }

  // Non-managers are pinned to List regardless of any stored preference.
  const resolved: View = canBoard ? (view ?? 'list') : 'list';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-abak-blue">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              stats.refetch();
            }}
            aria-label={t('refresh')}
            title={t('refresh')}
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <Button asChild size="sm">
            <Link href="/quotes/new">{t('newQuote')}</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Kpi label={t('kpiTotal')} value={stats.data?.total ?? '—'} />
        <Kpi
          label={t('kpiPending')}
          value={stats.data?.pendingApproval ?? '—'}
        />
        <Kpi
          label={t('kpiAccepted')}
          value={stats.data?.acceptedCount ?? '—'}
        />
        <Kpi
          label={t('kpiAcceptedValue')}
          value={
            stats.data
              ? `${Math.round(stats.data.acceptedValue).toLocaleString(numLocale)} SAR`
              : '—'
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {canBoard && (
          <div className="inline-flex rounded-md border p-0.5">
            <ViewBtn
              active={resolved === 'board'}
              onClick={() => pick('board')}
              icon={LayoutGrid}
              label={t('viewBoard')}
            />
            <ViewBtn
              active={resolved === 'list'}
              onClick={() => pick('list')}
              icon={ListIcon}
              label={t('viewList')}
            />
          </div>
        )}
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search')}
          dir="auto"
          className="h-9 w-full max-w-xs"
        />
      </div>

      {resolved === 'board' ? (
        <QuotePipelineBoard search={search} />
      ) : (
        <QuotesListView search={search} numLocale={numLocale} />
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-2xl font-semibold text-abak-blue">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function ViewBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof LayoutGrid;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex min-h-[40px] items-center gap-1.5 rounded px-3 text-sm font-medium',
        active
          ? 'bg-abak-blue text-white'
          : 'text-muted-foreground hover:bg-muted/50',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

// QP-1 — the List view: the existing flat quotes table, folded in. Search is
// owned by the shell and shared with the Board.
function QuotesListView({
  search,
  numLocale,
}: {
  search: string;
  numLocale: string;
}) {
  const t = useTranslations('quotations.list');
  const locale = useLocale();
  const dateLocale = locale === 'ar' ? arLocale : undefined;
  const filter = useMemo(
    () => ({ search: search.trim() || undefined }),
    [search],
  );
  const { data, isLoading, isError, refetch } = useQuotes(filter);
  const hasFilters = Boolean(search.trim());

  return (
    <DataState
      isLoading={isLoading}
      isError={isError}
      isEmpty={!data || data.data.length === 0}
      hasFilters={hasFilters}
      onRetry={() => refetch()}
      loading={<TableSkeleton rows={6} cols={6} />}
      empty={{
        icon: FileText,
        title: t('empty'),
        description: t('emptyDesc'),
        action: { label: t('newQuote'), href: '/quotes/new' },
      }}
      emptyFiltered={{
        icon: FileText,
        title: t('noMatches'),
        description: t('noMatchesDesc'),
      }}
    >
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('quoteNumber')}</TableHead>
                <TableHead>{t('client')}</TableHead>
                <TableHead>{t('titleCol')}</TableHead>
                <TableHead>{t('total')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('created')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data.map((quote) => (
                <QuoteRow
                  key={quote.id}
                  quote={quote}
                  numLocale={numLocale}
                  dateLocale={dateLocale}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DataState>
  );
}

function QuoteRow({
  quote,
  numLocale,
  dateLocale,
}: {
  quote: Quote;
  numLocale: string;
  dateLocale: typeof arLocale | undefined;
}) {
  return (
    <TableRow>
      <TableCell className="font-mono text-sm">
        <Link
          href={`/quotes/${quote.id}`}
          className="text-abak-blue hover:underline"
          dir="ltr"
        >
          {quote.quoteNumber}
        </Link>
      </TableCell>
      <TableCell>
        <div className="font-medium">{quote.client.contactName}</div>
        <div className="text-xs text-muted-foreground">
          {quote.client.companyName ?? quote.client.clientNumber}
        </div>
      </TableCell>
      <TableCell>{quote.title}</TableCell>
      <TableCell dir="ltr">
        {quote.totalAmount.toLocaleString(numLocale)} SAR
      </TableCell>
      <TableCell>
        <QuoteStatusBadge status={quote.status} />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDistanceToNow(new Date(quote.createdAt), {
          addSuffix: true,
          locale: dateLocale,
        })}
      </TableCell>
    </TableRow>
  );
}
