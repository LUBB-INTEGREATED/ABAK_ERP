'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ar as arLocale } from 'date-fns/locale';
import { FileText, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataState } from '@/components/ui/data-state';
import { QuoteStatusBadge } from '@/components/ui/entity-status-badges';
import { Input } from '@/components/ui/input';
import { TableSkeleton } from '@/components/ui/skeleton-layouts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useQuotes, useQuoteStats } from '@/lib/hooks/use-quotes';
import {
  QUOTE_STATUSES,
  type Quote,
  type QuoteStatus,
} from '@/lib/types/quote';
import { useEnumLabel } from '@/lib/i18n/enum-labels';

const ALL = '__all__';

function kpi(label: string, value: string | number) {
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

export default function QuotesListPage() {
  const t = useTranslations('quoteList');
  const locale = useLocale();
  const quoteStatusLabel = useEnumLabel('quoteStatus');
  const numLocale = locale === 'ar' ? 'ar-SA' : 'en-US';
  const dateLocale = locale === 'ar' ? arLocale : undefined;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<QuoteStatus | undefined>();
  const filter = useMemo(
    () => ({
      search: search.trim() || undefined,
      status,
    }),
    [search, status],
  );
  const { data, isLoading, isError, refetch, isFetching } = useQuotes(filter);
  const stats = useQuoteStats();
  const hasFilters = Boolean(search.trim() || status);
  const clearFilters = () => {
    setSearch('');
    setStatus(undefined);
  };

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
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label={t('refresh')}
            title={t('refresh')}
          >
            <RefreshCcw
              className={cn('h-4 w-4', isFetching && 'animate-spin')}
            />
          </Button>
          <Button asChild size="sm">
            <Link href="/quotes/new">{t('newQuote')}</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {kpi(t('kpiTotal'), stats.data?.total ?? '—')}
        {kpi(t('kpiPending'), stats.data?.pendingApproval ?? '—')}
        {kpi(t('kpiAccepted'), stats.data?.acceptedCount ?? '—')}
        {kpi(
          t('kpiAcceptedValue'),
          stats.data
            ? `${Math.round(stats.data.acceptedValue).toLocaleString(numLocale)} SAR`
            : '—',
        )}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="min-w-[240px] flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t('search')}
            </label>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('searchPlaceholder')}
            />
          </div>
          <div className="w-48">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t('status')}
            </label>
            <Select
              value={status ?? ALL}
              onValueChange={(value) =>
                setStatus(value === ALL ? undefined : (value as QuoteStatus))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t('allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('allStatuses')}</SelectItem>
                {QUOTE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {quoteStatusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <DataState
        isLoading={isLoading}
        isError={isError}
        isEmpty={!data || data.data.length === 0}
        hasFilters={hasFilters}
        onRetry={() => refetch()}
        loading={<TableSkeleton rows={6} cols={7} />}
        empty={{
          icon: FileText,
          title: t('noQuotes'),
          description: t('noQuotesDesc'),
          action: { label: t('newQuote'), href: '/quotes/new' },
        }}
        emptyFiltered={{
          icon: FileText,
          title: t('noMatches'),
          description: t('noMatchesDesc'),
          action: { label: t('clearFilters'), onClick: clearFilters },
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
                  <TableHead>{t('preparedBy')}</TableHead>
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
    </div>
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
  const prep = quote.preparedBy
    ? [quote.preparedBy.firstName, quote.preparedBy.lastName]
        .filter(Boolean)
        .join(' ') || quote.preparedBy.email
    : '—';
  return (
    <TableRow>
      <TableCell className="font-mono text-sm">
        <Link
          href={`/quotes/${quote.id}`}
          className="text-abak-blue hover:underline"
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
      <TableCell>{quote.totalAmount.toLocaleString(numLocale)} SAR</TableCell>
      <TableCell>
        <QuoteStatusBadge status={quote.status} />
      </TableCell>
      <TableCell className="text-sm">{prep}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDistanceToNow(new Date(quote.createdAt), {
          addSuffix: true,
          locale: dateLocale,
        })}
      </TableCell>
    </TableRow>
  );
}
