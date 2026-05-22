'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ar as arLocale } from 'date-fns/locale';
import { RefreshCcw, Search, Sliders } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ClientClassificationBadge,
  ClientStatusBadge,
} from '@/components/ui/entity-status-badges';
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
import { useClientsList, useClientStats } from '@/lib/hooks/use-clients';
import {
  CLIENT_CLASSIFICATIONS,
  CLIENT_STATUSES,
  type Client,
  type ClientClassification,
  type ClientFilter,
  type ClientStatus,
} from '@/lib/types/client';
import { useEnumLabel } from '@/lib/i18n/enum-labels';

const PAGE_SIZE = 50;
const ALL = '__all__';

function KpiCard({ label, value }: { label: string; value: string | number }) {
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

export default function ClientsListPage() {
  const tC = useTranslations('clients.list');
  const locale = useLocale();
  const classificationLabel = useEnumLabel('clientClassification');
  const statusLabel = useEnumLabel('clientStatus');

  const [search, setSearch] = useState('');
  const [classification, setClassification] = useState<
    ClientClassification | undefined
  >();
  const [status, setStatus] = useState<ClientStatus | undefined>();
  const [city, setCity] = useState('');
  const [page, setPage] = useState(1);

  const filter = useMemo<ClientFilter>(
    () => ({
      search: search.trim() || undefined,
      classification,
      status,
      city: city.trim() || undefined,
      page,
      limit: PAGE_SIZE,
      sort: 'createdAt',
      order: 'desc',
    }),
    [search, classification, status, city, page],
  );

  const stats = useClientStats();
  const { data, isLoading, isError, error, refetch, isFetching } =
    useClientsList(filter);

  const total = data?.pagination.total ?? 0;
  const pages = data?.pagination.pages ?? 1;

  const vipCount =
    stats.data?.byClassification.find((r) => r.classification === 'VIP')
      ?.count ?? 0;
  const dormantCount =
    stats.data?.byClassification.find((r) => r.classification === 'DORMANT')
      ?.count ?? 0;

  function reset() {
    setSearch('');
    setClassification(undefined);
    setStatus(undefined);
    setCity('');
    setPage(1);
  }

  const numLocale = locale === 'ar' ? 'ar-SA' : 'en-US';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-abak-blue">{tC('title')}</h1>
          <p className="text-sm text-muted-foreground">{tC('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label={tC('refresh')}
            title={tC('refresh')}
          >
            <RefreshCcw
              className={cn('h-4 w-4', isFetching && 'animate-spin')}
            />
          </Button>
          <Button asChild size="sm">
            <Link href="/clients/new">{tC('newClient')}</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <KpiCard label={tC('totalClients')} value={stats.data?.total ?? '—'} />
        <KpiCard label={tC('vip')} value={vipCount} />
        <KpiCard label={tC('dormant')} value={dormantCount} />
        <KpiCard
          label={tC('avgLifetimeValue')}
          value={
            stats.data
              ? `${Math.round(stats.data.averageLifetimeValue).toLocaleString(numLocale)} ${tC('currency')}`
              : '—'
          }
        />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="min-w-[240px] flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {tC('search')}
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder={tC('searchPlaceholderShort')}
                className="ps-9"
              />
            </div>
          </div>
          <FilterSelect
            label={tC('classification')}
            allLabel={tC('allClassifications')}
            value={classification}
            onChange={(value) => {
              setClassification(value);
              setPage(1);
            }}
            options={CLIENT_CLASSIFICATIONS.map((c) => ({
              value: c,
              label: classificationLabel(c),
            }))}
          />
          <FilterSelect
            label={tC('status')}
            allLabel={tC('allStatuses')}
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={CLIENT_STATUSES.map((s) => ({
              value: s,
              label: statusLabel(s),
            }))}
          />
          <div className="w-40">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {tC('city')}
            </label>
            <Input
              value={city}
              onChange={(event) => {
                setCity(event.target.value);
                setPage(1);
              }}
              placeholder={tC('cityPlaceholder')}
            />
          </div>
          <Button variant="ghost" size="sm" onClick={reset}>
            <Sliders className="me-2 h-4 w-4" /> {tC('reset')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tC('number')}</TableHead>
                <TableHead>{tC('contact')}</TableHead>
                <TableHead>{tC('classification')}</TableHead>
                <TableHead>{tC('status')}</TableHead>
                <TableHead>{tC('accountManager')}</TableHead>
                <TableHead>{tC('interactions')}</TableHead>
                <TableHead>{tC('lifetimeValue')}</TableHead>
                <TableHead>{tC('lastContact')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {tC('loading')}
                  </TableCell>
                </TableRow>
              )}
              {isError && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-destructive"
                  >
                    {error instanceof Error
                      ? error.message
                      : tC('failedToLoad')}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !isError && data?.data.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {tC('noResults')}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading &&
                !isError &&
                data?.data.map((client) => (
                  <ClientRow key={client.id} client={client} />
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {data && data.data.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            {tC('showing', {
              from: (page - 1) * PAGE_SIZE + 1,
              to: Math.min(page * PAGE_SIZE, total),
              total: total.toLocaleString(numLocale),
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {tC('previous')}
            </Button>
            <span>{tC('pageOf', { page, pages })}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              {tC('next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect<T extends string>({
  label,
  allLabel,
  value,
  onChange,
  options,
}: {
  label: string;
  allLabel: string;
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="w-44">
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Select
        value={value ?? ALL}
        onValueChange={(next) =>
          onChange(next === ALL ? undefined : (next as T))
        }
      >
        <SelectTrigger>
          <SelectValue placeholder={allLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ClientRow({ client }: { client: Client }) {
  const tC = useTranslations('clients.list');
  const locale = useLocale();
  const numLocale = locale === 'ar' ? 'ar-SA' : 'en-US';

  const manager = client.accountManager
    ? [client.accountManager.firstName, client.accountManager.lastName]
        .filter(Boolean)
        .join(' ') || client.accountManager.email
    : tC('unassigned');

  return (
    <TableRow className="cursor-pointer">
      <TableCell className="font-mono text-sm">
        <Link
          href={`/clients/${client.id}`}
          className="text-abak-blue hover:underline"
        >
          {client.clientNumber}
        </Link>
      </TableCell>
      <TableCell>
        <div className="font-medium">{client.contactName}</div>
        <div className="text-xs text-muted-foreground">
          {client.companyName ?? client.phone}
        </div>
      </TableCell>
      <TableCell>
        <ClientClassificationBadge classification={client.classification} />
      </TableCell>
      <TableCell>
        <ClientStatusBadge status={client.status} />
      </TableCell>
      <TableCell className="text-sm">{manager}</TableCell>
      <TableCell className="text-sm">
        {client._count?.interactions ?? 0}
      </TableCell>
      <TableCell className="text-sm">
        {client.lifetimeValue.toLocaleString(numLocale)} {tC('currency')}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {client.lastInteractionAt
          ? formatDistanceToNow(new Date(client.lastInteractionAt), {
              addSuffix: true,
              locale: locale === 'ar' ? arLocale : undefined,
            })
          : '—'}
      </TableCell>
    </TableRow>
  );
}
