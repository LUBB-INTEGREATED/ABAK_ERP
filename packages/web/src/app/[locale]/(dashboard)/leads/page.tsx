'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { RefreshCcw, Search, Sliders, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { DataState } from '@/components/ui/data-state';
import {
  LeadStatusBadge,
  SlaStatusBadge,
} from '@/components/ui/entity-status-badges';
import { TableSkeleton } from '@/components/ui/skeleton-layouts';
import { useLeadsList, useLeadStats, useServices } from '@/lib/hooks/use-leads';
import { useAuthStore } from '@/lib/auth';
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

type QuickFilter = 'my-leads' | 'overdue' | 'new-today' | null;

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function LeadsListPage() {
  const currentUser = useAuthStore((state) => state.user);
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState<LeadChannel | undefined>();
  const [status, setStatus] = useState<LeadStatus | undefined>();
  const [priority, setPriority] = useState<LeadPriority | undefined>();
  const [slaStatus, setSlaStatus] = useState<SLAStatus | undefined>();
  const [assignedToId, setAssignedToId] = useState<string | undefined>();
  const [serviceId, setServiceId] = useState<string | undefined>();
  const [location, setLocation] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [page, setPage] = useState(1);
  const [quick, setQuick] = useState<QuickFilter>(null);

  const services = useServices();

  const filter = useMemo<LeadFilter>(
    () => ({
      search: search.trim() || undefined,
      channel,
      status,
      priority,
      slaStatus,
      assignedToId,
      serviceId,
      location: location.trim() || undefined,
      budgetMin: budgetMin ? Number(budgetMin) : undefined,
      budgetMax: budgetMax ? Number(budgetMax) : undefined,
      createdFrom: createdFrom || undefined,
      page,
      limit: PAGE_SIZE,
      sort: 'createdAt',
      order: 'desc',
    }),
    [
      search,
      channel,
      status,
      priority,
      slaStatus,
      assignedToId,
      serviceId,
      location,
      budgetMin,
      budgetMax,
      createdFrom,
      page,
    ],
  );

  function applyQuickFilter(next: QuickFilter) {
    setQuick((prev) => (prev === next ? null : next));
    setPage(1);
    if (next === 'my-leads') {
      setAssignedToId(currentUser?.id);
      setSlaStatus(undefined);
      setCreatedFrom('');
    } else if (next === 'overdue') {
      setAssignedToId(undefined);
      setSlaStatus('OVERDUE');
      setCreatedFrom('');
    } else if (next === 'new-today') {
      setAssignedToId(undefined);
      setSlaStatus(undefined);
      setCreatedFrom(startOfTodayIso());
    } else {
      setAssignedToId(undefined);
      setSlaStatus(undefined);
      setCreatedFrom('');
    }
  }

  const stats = useLeadStats();
  const { data, isLoading, isError, refetch, isFetching } =
    useLeadsList(filter);

  const total = data?.pagination.total ?? 0;
  const pages = data?.pagination.pages ?? 1;

  const overdueCount =
    stats.data?.bySla.find((row) => row.slaStatus === 'OVERDUE')?.count ?? 0;

  const hasActiveFilters = Boolean(
    search.trim() ||
    channel ||
    status ||
    priority ||
    slaStatus ||
    assignedToId ||
    serviceId ||
    location.trim() ||
    budgetMin ||
    budgetMax ||
    createdFrom ||
    quick,
  );

  function resetFilters() {
    setSearch('');
    setChannel(undefined);
    setStatus(undefined);
    setPriority(undefined);
    setSlaStatus(undefined);
    setAssignedToId(undefined);
    setServiceId(undefined);
    setLocation('');
    setBudgetMin('');
    setBudgetMax('');
    setCreatedFrom('');
    setQuick(null);
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

      <div className="flex flex-wrap gap-2">
        <QuickChip
          label="My leads"
          active={quick === 'my-leads'}
          onClick={() => applyQuickFilter('my-leads')}
        />
        <QuickChip
          label="Overdue SLA"
          active={quick === 'overdue'}
          onClick={() => applyQuickFilter('overdue')}
        />
        <QuickChip
          label="New today"
          active={quick === 'new-today'}
          onClick={() => applyQuickFilter('new-today')}
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

          <FilterSelect
            label="Service"
            value={serviceId}
            onChange={(value) => {
              setServiceId(value);
              setPage(1);
            }}
            options={(services.data ?? []).map((svc) => ({
              value: svc.id,
              label: `${svc.name} (${svc.code})`,
            }))}
          />

          <div className="w-40">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Location
            </label>
            <Input
              value={location}
              onChange={(event) => {
                setLocation(event.target.value);
                setPage(1);
              }}
              placeholder="Riyadh…"
            />
          </div>

          <div className="w-28">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Min budget
            </label>
            <Input
              type="number"
              min={0}
              value={budgetMin}
              onChange={(event) => {
                setBudgetMin(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="w-28">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Max budget
            </label>
            <Input
              type="number"
              min={0}
              value={budgetMax}
              onChange={(event) => {
                setBudgetMax(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <Sliders className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </CardContent>
      </Card>

      <DataState
        isLoading={isLoading}
        isError={isError}
        isEmpty={!data || data.data.length === 0}
        hasFilters={hasActiveFilters}
        onRetry={() => refetch()}
        loading={<TableSkeleton rows={8} cols={7} />}
        empty={{
          icon: UsersRound,
          title: 'No leads yet',
          description:
            'Leads land here automatically from the 6 intake channels. You can also log one manually.',
          action: { label: 'New lead', href: '/leads/new' },
        }}
        emptyFiltered={{
          icon: UsersRound,
          title: 'No leads match these filters',
          description:
            'Try widening the search or clearing one filter at a time.',
          action: { label: 'Clear filters', onClick: resetFilters },
        }}
      >
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
                {data?.data.map((lead) => (
                  <LeadRow key={lead.id} lead={lead} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </DataState>

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

function QuickChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-abak-blue bg-abak-blue text-white'
          : 'border-input bg-background text-muted-foreground hover:bg-muted',
      )}
    >
      {label}
    </button>
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
        <LeadStatusBadge status={lead.status} />
      </TableCell>
      <TableCell>
        <SlaStatusBadge status={lead.slaStatus} dot />
      </TableCell>
      <TableCell className="text-sm">{assigneeName}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}
      </TableCell>
    </TableRow>
  );
}
