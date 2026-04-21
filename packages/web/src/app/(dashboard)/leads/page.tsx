'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { RefreshCcw, Search, Sliders } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { useLeadsList, useLeadStats } from '@/lib/hooks/use-leads';
import {
  CHANNEL_LABELS,
  LEAD_CHANNELS,
  LEAD_PRIORITIES,
  LEAD_STATUSES,
  PRIORITY_LABELS,
  SLA_LABELS,
  SLA_STATUSES,
  STATUS_LABELS,
  type Lead,
  type LeadChannel,
  type LeadFilter,
  type LeadPriority,
  type LeadStatus,
  type SLAStatus,
} from '@/lib/types/lead';

const PAGE_SIZE = 50;
const ALL = '__all__';

const STATUS_BADGE: Record<LeadStatus, string> = {
  NEW: 'bg-sky-100 text-sky-700',
  ASSIGNED: 'bg-abak-blue/10 text-abak-blue',
  CONTACTED: 'bg-indigo-100 text-indigo-700',
  QUALIFIED: 'bg-abak-gold/15 text-abak-gold',
  UNQUALIFIED: 'bg-zinc-100 text-zinc-600',
  CONVERTED: 'bg-emerald-100 text-emerald-700',
  LOST: 'bg-rose-100 text-rose-700',
  DUPLICATE: 'bg-amber-100 text-amber-700',
};

const SLA_BADGE: Record<SLAStatus, string> = {
  ON_TIME: 'bg-emerald-100 text-emerald-700',
  DUE_SOON: 'bg-amber-100 text-amber-700',
  OVERDUE: 'bg-rose-100 text-rose-700',
};

function StatCard({ label, value }: { label: string; value: number | string }) {
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

export default function LeadsListPage() {
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState<LeadChannel | undefined>();
  const [status, setStatus] = useState<LeadStatus | undefined>();
  const [priority, setPriority] = useState<LeadPriority | undefined>();
  const [slaStatus, setSlaStatus] = useState<SLAStatus | undefined>();
  const [page, setPage] = useState(1);

  const filter = useMemo<LeadFilter>(
    () => ({
      search: search.trim() || undefined,
      channel,
      status,
      priority,
      slaStatus,
      page,
      limit: PAGE_SIZE,
      sort: 'createdAt',
      order: 'desc',
    }),
    [search, channel, status, priority, slaStatus, page],
  );

  const stats = useLeadStats();
  const { data, isLoading, isError, error, refetch, isFetching } =
    useLeadsList(filter);

  const total = data?.pagination.total ?? 0;
  const pages = data?.pagination.pages ?? 1;

  const overdueCount =
    stats.data?.bySla.find((row) => row.slaStatus === 'OVERDUE')?.count ?? 0;

  function resetFilters() {
    setSearch('');
    setChannel(undefined);
    setStatus(undefined);
    setPriority(undefined);
    setSlaStatus(undefined);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-abak-blue">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Track every incoming opportunity across all six channels.
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
            <Link href="/leads/new">New lead</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total leads" value={stats.data?.total ?? '—'} />
        <StatCard label="Today" value={stats.data?.todayCount ?? '—'} />
        <StatCard label="Overdue SLA" value={overdueCount} />
        <StatCard
          label="Filtered"
          value={isLoading ? '…' : total.toLocaleString()}
        />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="min-w-[240px] flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Lead number, name, phone, email…"
                className="pl-9"
              />
            </div>
          </div>

          <FilterSelect
            label="Channel"
            value={channel}
            onChange={(value) => {
              setChannel(value);
              setPage(1);
            }}
            options={LEAD_CHANNELS.map((ch) => ({
              value: ch,
              label: CHANNEL_LABELS[ch],
            }))}
          />
          <FilterSelect
            label="Status"
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={LEAD_STATUSES.map((st) => ({
              value: st,
              label: STATUS_LABELS[st],
            }))}
          />
          <FilterSelect
            label="Priority"
            value={priority}
            onChange={(value) => {
              setPriority(value);
              setPage(1);
            }}
            options={LEAD_PRIORITIES.map((p) => ({
              value: p,
              label: PRIORITY_LABELS[p],
            }))}
          />
          <FilterSelect
            label="SLA"
            value={slaStatus}
            onChange={(value) => {
              setSlaStatus(value);
              setPage(1);
            }}
            options={SLA_STATUSES.map((s) => ({
              value: s,
              label: SLA_LABELS[s],
            }))}
          />

          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <Sliders className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Lead #</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>SLA</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <SkeletonRows rows={8} />}
              {isError && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-destructive"
                  >
                    {error instanceof Error
                      ? error.message
                      : 'Failed to load leads.'}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !isError && data?.data.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No leads match the current filters.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading &&
                !isError &&
                data?.data.map((lead) => <LeadRow key={lead.id} lead={lead} />)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {data && data.data.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span>
              Page {page} / {pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
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
          <SelectValue placeholder={`All ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All {label.toLowerCase()}</SelectItem>
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

function SkeletonRows({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, idx) => (
        <TableRow key={idx}>
          <TableCell colSpan={7} className="py-3">
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

function LeadRow({ lead }: { lead: Lead }) {
  const assigneeName = lead.assignedTo
    ? [lead.assignedTo.firstName, lead.assignedTo.lastName]
        .filter(Boolean)
        .join(' ') || lead.assignedTo.email
    : 'Unassigned';

  return (
    <TableRow className="cursor-pointer">
      <TableCell className="font-mono text-sm">
        <Link
          href={`/leads/${lead.id}`}
          className="text-abak-blue hover:underline"
        >
          {lead.leadNumber}
        </Link>
      </TableCell>
      <TableCell>
        <div className="font-medium">{lead.contactName}</div>
        <div className="text-xs text-muted-foreground">
          {lead.companyName ?? lead.phone}
        </div>
      </TableCell>
      <TableCell>{CHANNEL_LABELS[lead.channel]}</TableCell>
      <TableCell>
        <Badge className={cn('border-transparent', STATUS_BADGE[lead.status])}>
          {STATUS_LABELS[lead.status]}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge className={cn('border-transparent', SLA_BADGE[lead.slaStatus])}>
          {SLA_LABELS[lead.slaStatus]}
        </Badge>
      </TableCell>
      <TableCell className="text-sm">{assigneeName}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}
      </TableCell>
    </TableRow>
  );
}
