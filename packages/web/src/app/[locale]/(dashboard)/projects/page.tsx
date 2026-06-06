'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Download, LayoutGrid, Plus, Search, Table2, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataState } from '@/components/ui/data-state';
import { ViewToggle } from '@/components/ui/view-toggle';
import { useProjectsList, useProjectStats } from '@/lib/hooks/use-projects';
import type { ProjectListItem, ProjectStatus } from '@/lib/types/project';
import { Link, useRouter } from '@/i18n/navigation';
import { ProjectStatusBadge } from '@/components/ui/entity-status-badges';
import { UserAvatar } from '@/components/ui/user-avatar';
import { ProgressBar } from '@/components/ui/progress-bar';
import { NewProjectDialog } from '@/components/projects/new-project-dialog';
import { Can, useCan } from '@/components/auth/can';
import { cn } from '@/lib/utils';

const STATUS_ORDER: ProjectStatus[] = [
  'PLANNING',
  'ACTIVE',
  'ON_HOLD',
  'AT_RISK',
  'CLOSING',
  'CLOSED',
  'CANCELLED',
];

type ProjectsView = 'table' | 'cards';

export default function ProjectsListPage() {
  const t = useTranslations();
  const router = useRouter();
  const { can } = useCan();
  const [status, setStatus] = useState<ProjectStatus | ''>('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ProjectsView>('table');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newOpen, setNewOpen] = useState(false);

  const { data: stats } = useProjectStats();
  const { data, isLoading, isError, error, refetch } = useProjectsList({
    status: status || undefined,
    search: search || undefined,
    pageSize: 50,
  });

  const rows = data?.data ?? [];

  const counts = useMemo(() => {
    const map: Partial<Record<ProjectStatus, number>> = {};
    stats?.byStatus.forEach((b) => {
      map[b.status] = b.count;
    });
    return map;
  }, [stats]);

  const total = stats?.total ?? 0;
  const active = counts.ACTIVE ?? 0;
  // Status-based count only. `stats.atRisk` is the orthogonal financialRiskFlagged
  // tally — summing them double-counts projects that are both, and can exceed total.
  const atRisk = counts.AT_RISK ?? 0;
  const closing = counts.CLOSING ?? 0;
  const closed = counts.CLOSED ?? 0;

  const hasFilters = status !== '' || search.trim() !== '';

  // Selection is intersected with the currently-visible rows so stale ids never
  // leak into bulk actions when filters change.
  const selectedRows = useMemo(
    () => rows.filter((p) => selected.has(p.id)),
    [rows, selected],
  );
  const allSelected = rows.length > 0 && selectedRows.length === rows.length;

  function toggleAll() {
    setSelected((prev) => {
      if (rows.length > 0 && rows.every((p) => prev.has(p.id))) {
        const next = new Set(prev);
        rows.forEach((p) => next.delete(p.id));
        return next;
      }
      const next = new Set(prev);
      rows.forEach((p) => next.add(p.id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportSelected() {
    const target = selectedRows.length > 0 ? selectedRows : rows;
    downloadCsv(target);
    toast.success(t('projectsList.bulk.exported', { count: target.length }));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-display-md text-primary">
            {t('project.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('project.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle<ProjectsView>
            value={view}
            onChange={setView}
            options={[
              {
                value: 'table',
                icon: Table2,
                label: t('projectsList.view.table'),
              },
              {
                value: 'cards',
                icon: LayoutGrid,
                label: t('projectsList.view.cards'),
              },
            ]}
          />
          <Can permission="project:convert">
            <Button onClick={() => setNewOpen(true)}>
              <Plus className="me-2 h-4 w-4" />
              {t('project.createNew')}
            </Button>
          </Can>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiTile
          label={t('project.kpi.total')}
          value={total}
          accent="text-abak-blue"
        />
        <KpiTile
          label={t('project.kpi.active')}
          value={active}
          accent="text-success"
        />
        <KpiTile
          label={t('project.kpi.atRisk')}
          value={atRisk}
          accent="text-warning"
        />
        <KpiTile
          label={t('project.kpi.closing')}
          value={closing}
          accent="text-info"
        />
        <KpiTile
          label={t('project.kpi.closed')}
          value={closed}
          accent="text-muted-foreground"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-3">
          <div className="relative min-w-[14rem] max-w-sm flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search')}
              className="input-base ps-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip
              active={status === ''}
              label={t('project.filterAll')}
              onClick={() => setStatus('')}
            />
            {STATUS_ORDER.map((s) => (
              <FilterChip
                key={s}
                active={status === s}
                label={t(`project.status.${s}`)}
                onClick={() => setStatus(s)}
                count={counts[s]}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bulk action bar (table view only) */}
      {view === 'table' && selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-primary px-4 py-2.5 text-primary-foreground shadow-md">
          <span className="text-sm font-semibold">
            {t('projectsList.bulk.selected', { count: selectedRows.length })}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={exportSelected}
              className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/10"
            >
              <Download className="h-4 w-4" />
              {t('projectsList.bulk.export')}
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/10"
            >
              <X className="h-4 w-4" />
              {t('projectsList.bulk.clear')}
            </button>
          </div>
        </div>
      )}

      {/* Data surface */}
      <DataState
        isLoading={isLoading}
        isError={isError}
        error={error}
        isEmpty={rows.length === 0}
        hasFilters={hasFilters}
        onRetry={refetch}
        empty={{
          icon: Plus,
          title: t('project.empty'),
          description: t('project.emptyCta'),
          action: can('project:convert')
            ? { label: t('project.createNew'), onClick: () => setNewOpen(true) }
            : undefined,
        }}
        emptyFiltered={{
          title: t('common.noResults'),
          description: t('common.noResultsHint'),
          action: {
            label: t('common.clearFilters'),
            onClick: () => {
              setStatus('');
              setSearch('');
            },
          },
        }}
      >
        {view === 'table' ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleAll}
                        aria-label={t('projectsList.bulk.selectAll')}
                      />
                    </TableHead>
                    <TableHead>{t('projectsList.col.title')}</TableHead>
                    <TableHead className="hidden md:table-cell">
                      {t('projectsList.col.client')}
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      {t('projectsList.col.pm')}
                    </TableHead>
                    <TableHead>{t('projectsList.col.progress')}</TableHead>
                    <TableHead>{t('projectsList.col.status')}</TableHead>
                    <TableHead className="hidden text-end xl:table-cell">
                      {t('projectsList.col.contractValue')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((project) => (
                    <TableRow
                      key={project.id}
                      onClick={() => router.push(`/projects/${project.id}`)}
                      data-state={
                        selected.has(project.id) ? 'selected' : undefined
                      }
                      className="cursor-pointer"
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(project.id)}
                          onCheckedChange={() => toggleOne(project.id)}
                          aria-label={project.title}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-xs text-muted-foreground">
                          {project.projectNumber}
                        </div>
                        <div className="mt-0.5 font-medium text-dark-text">
                          {project.title}
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-sm md:table-cell">
                        {project.client.companyName ??
                          project.client.contactName}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            firstName={project.pm.firstName}
                            lastName={project.pm.lastName}
                            size="xs"
                          />
                          <span className="truncate text-sm">
                            {pmName(project)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="w-28 space-y-1">
                          <ProgressBar
                            value={project.actualProgress}
                            size="sm"
                            variant={progressVariant(project.actualProgress)}
                          />
                          <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span className="num">
                              {project.actualProgress.toFixed(0)}%
                            </span>
                            {project._count && (
                              <span className="num">
                                {project._count.phases}·{project._count.tasks}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <ProjectStatusBadge status={project.status} />
                      </TableCell>
                      <TableCell className="hidden text-end xl:table-cell">
                        <span className="num font-mono text-sm font-semibold text-abak-blue">
                          {project.contractValue.toLocaleString()}
                        </span>{' '}
                        <span className="text-xs text-muted-foreground">
                          {t('units.sar')}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group block"
              >
                <Card className="h-full transition-shadow group-hover:shadow-md">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs text-muted-foreground">
                          {project.projectNumber}
                        </div>
                        <div className="mt-0.5 truncate text-sm font-semibold text-dark-text group-hover:text-abak-blue">
                          {project.title}
                        </div>
                      </div>
                      <ProjectStatusBadge status={project.status} />
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">
                        {project.client.companyName ??
                          project.client.contactName}
                      </span>
                      <span>·</span>
                      <UserAvatar
                        firstName={project.pm.firstName}
                        lastName={project.pm.lastName}
                        size="xs"
                      />
                      <span className="truncate">{pmName(project)}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {t('project.actualProgress')}
                        </span>
                        <span className="num font-medium">
                          {project.actualProgress.toFixed(1)}%
                        </span>
                      </div>
                      <ProgressBar
                        value={project.actualProgress}
                        size="sm"
                        variant={progressVariant(project.actualProgress)}
                      />
                    </div>

                    <div className="flex items-center justify-between border-t pt-2 text-xs">
                      <span className="text-muted-foreground">
                        {t('project.contractValue')}
                      </span>
                      <span className="num font-mono font-semibold text-abak-blue">
                        {project.contractValue.toLocaleString()}{' '}
                        {t('units.sar')}
                      </span>
                    </div>

                    {project._count && (
                      <div className="text-[11px] text-muted-foreground">
                        <span className="num">{project._count.phases}</span>{' '}
                        {t('project.tabs.phases')} ·{' '}
                        <span className="num">{project._count.tasks}</span>{' '}
                        {t('phase.tasksLabel')}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </DataState>

      <NewProjectDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}

function progressVariant(value: number): 'success' | 'default' | 'muted' {
  if (value >= 90) return 'success';
  if (value >= 40) return 'default';
  return 'muted';
}

function pmName(project: ProjectListItem) {
  return (
    `${project.pm.firstName ?? ''} ${project.pm.lastName ?? ''}`.trim() ||
    project.pm.email ||
    '—'
  );
}

function csvCell(value: string | number | null | undefined) {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(rows: ProjectListItem[]) {
  const header = [
    'Number',
    'Title',
    'Client',
    'Project manager',
    'Status',
    'Progress %',
    'Contract value',
    'Start',
    'Expected end',
  ];
  const body = rows.map((p) =>
    [
      p.projectNumber,
      p.title,
      p.client.companyName ?? p.client.contactName,
      pmName(p),
      p.status,
      p.actualProgress.toFixed(1),
      p.contractValue,
      p.startDate?.slice(0, 10) ?? '',
      p.expectedEndDate?.slice(0, 10) ?? '',
    ]
      .map(csvCell)
      .join(','),
  );
  const csv = '\uFEFF' + [header.join(','), ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `projects-${rows.length}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function KpiTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className={cn('num mt-1 text-2xl font-semibold', accent)}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function FilterChip({
  active,
  label,
  onClick,
  count,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
        active
          ? 'border-abak-blue bg-abak-blue text-white'
          : 'border-border text-muted-foreground hover:bg-muted/50',
      )}
    >
      <span>{label}</span>
      {count != null && count > 0 && (
        <span
          className={cn(
            'num rounded-full px-1.5 py-0.5 text-[10px]',
            active ? 'bg-white/20' : 'bg-muted',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
