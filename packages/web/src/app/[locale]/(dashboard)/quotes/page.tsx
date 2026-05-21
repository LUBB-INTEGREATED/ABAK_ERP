'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
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
  QUOTE_STATUS_LABELS,
  type Quote,
  type QuoteStatus,
} from '@/lib/types/quote';

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
          <h1 className="text-2xl font-bold text-abak-blue">Quotes</h1>
          <p className="text-sm text-muted-foreground">
            Draft, approve, send, and accept client proposals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCcw
              className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')}
            />
            Refresh
          </Button>
          <Button asChild size="sm">
            <Link href="/quotes/new">New quote</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {kpi('Total quotes', stats.data?.total ?? '—')}
        {kpi('Pending approval', stats.data?.pendingApproval ?? '—')}
        {kpi('Accepted', stats.data?.acceptedCount ?? '—')}
        {kpi(
          'Accepted value',
          stats.data
            ? `${Math.round(stats.data.acceptedValue).toLocaleString()} SAR`
            : '—',
        )}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="min-w-[240px] flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Search
            </label>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Quote number, title, client name…"
            />
          </div>
          <div className="w-48">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Status
            </label>
            <Select
              value={status ?? ALL}
              onValueChange={(value) =>
                setStatus(value === ALL ? undefined : (value as QuoteStatus))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {QUOTE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {QUOTE_STATUS_LABELS[s]}
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
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prepared by</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((quote) => (
                  <QuoteRow key={quote.id} quote={quote} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </DataState>
    </div>
  );
}

function QuoteRow({ quote }: { quote: Quote }) {
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
      <TableCell>{quote.totalAmount.toLocaleString()} SAR</TableCell>
      <TableCell>
        <QuoteStatusBadge status={quote.status} />
      </TableCell>
      <TableCell className="text-sm">{prep}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true })}
      </TableCell>
    </TableRow>
  );
}
