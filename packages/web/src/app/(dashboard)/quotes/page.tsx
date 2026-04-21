'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { RefreshCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

const STATUS_BADGE: Record<QuoteStatus, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-600',
  PENDING_REVIEW: 'bg-sky-100 text-sky-700',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-abak-blue/10 text-abak-blue',
  SENT: 'bg-indigo-100 text-indigo-700',
  VIEWED: 'bg-indigo-200 text-indigo-700',
  UNDER_NEGOTIATION: 'bg-abak-gold/20 text-abak-gold',
  REVISED: 'bg-sky-200 text-sky-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  EXPIRED: 'bg-zinc-200 text-zinc-700',
};

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
  const { data, isLoading, refetch, isFetching } = useQuotes(filter);
  const stats = useQuoteStats();

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
              {isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && data?.data.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No quotes match the current filters.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading &&
                data?.data.map((quote) => (
                  <QuoteRow key={quote.id} quote={quote} />
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
        <Badge className={cn('border-transparent', STATUS_BADGE[quote.status])}>
          {QUOTE_STATUS_LABELS[quote.status]}
        </Badge>
      </TableCell>
      <TableCell className="text-sm">{prep}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true })}
      </TableCell>
    </TableRow>
  );
}
