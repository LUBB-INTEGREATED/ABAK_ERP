'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useProjectsList, useProjectStats } from '@/lib/hooks/use-projects';
import type { ProjectStatus } from '@/lib/types/project';
import { Link } from '@/i18n/navigation';
import { PROJECT_TONE, StatusPill } from '@/components/projects/status-dot';
import { UserAvatar } from '@/components/ui/user-avatar';
import { ProgressBar } from '@/components/ui/progress-bar';
import { NewProjectDialog } from '@/components/projects/new-project-dialog';
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

export default function ProjectsListPage() {
  const t = useTranslations();
  const [status, setStatus] = useState<ProjectStatus | ''>('');
  const [search, setSearch] = useState('');
  const [newOpen, setNewOpen] = useState(false);

  const { data: stats } = useProjectStats();
  const { data, isLoading } = useProjectsList({
    status: status || undefined,
    search: search || undefined,
    pageSize: 50,
  });

  const counts = useMemo(() => {
    const map: Partial<Record<ProjectStatus, number>> = {};
    stats?.byStatus.forEach((b) => {
      map[b.status] = b.count;
    });
    return map;
  }, [stats]);

  const total = stats?.total ?? 0;
  const active = counts.ACTIVE ?? 0;
  const atRisk = (counts.AT_RISK ?? 0) + (stats?.atRisk ?? 0);
  const closing = counts.CLOSING ?? 0;
  const closed = counts.CLOSED ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-abak-blue">
            {t('project.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('project.subtitle')}
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          {t('project.createNew')}
        </Button>
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
          accent="text-emerald-600"
        />
        <KpiTile
          label={t('project.kpi.atRisk')}
          value={atRisk}
          accent="text-rose-600"
        />
        <KpiTile
          label={t('project.kpi.closing')}
          value={closing}
          accent="text-indigo-600"
        />
        <KpiTile
          label={t('project.kpi.closed')}
          value={closed}
          accent="text-zinc-500"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-3">
          <div className="relative min-w-[14rem] flex-1 max-w-sm">
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

      {/* List */}
      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t('common.loading')}
          </CardContent>
        </Card>
      ) : !data || data.data.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <div className="mx-auto max-w-md space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-abak-blue/10 text-abak-blue">
                <Plus className="h-6 w-6" />
              </div>
              <div className="text-sm text-muted-foreground">
                {t('project.empty')}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('project.emptyCta')}
              </p>
              <Button onClick={() => setNewOpen(true)}>
                {t('project.createNew')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.data.map((project) => (
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
                    <StatusPill
                      tone={PROJECT_TONE[project.status]}
                      label={t(`project.status.${project.status}`)}
                    />
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate">
                      {project.client.companyName ?? project.client.contactName}
                    </span>
                    <span>·</span>
                    <UserAvatar
                      firstName={project.pm.firstName}
                      lastName={project.pm.lastName}
                      email={project.pm.email}
                      size="xs"
                    />
                    <span className="truncate">
                      {`${project.pm.firstName ?? ''} ${project.pm.lastName ?? ''}`.trim() ||
                        project.pm.email}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {t('project.actualProgress')}
                      </span>
                      <span className="font-medium tabular-nums">
                        {project.actualProgress.toFixed(1)}%
                      </span>
                    </div>
                    <ProgressBar
                      value={project.actualProgress}
                      size="sm"
                      variant={
                        project.actualProgress >= 90
                          ? 'success'
                          : project.actualProgress >= 40
                            ? 'default'
                            : 'muted'
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between border-t pt-2 text-xs">
                    <span className="text-muted-foreground">
                      {t('project.contractValue')}
                    </span>
                    <span className="font-mono font-semibold text-abak-blue">
                      {project.contractValue.toLocaleString()} {t('units.sar')}
                    </span>
                  </div>

                  {project._count && (
                    <div className="text-[11px] text-muted-foreground">
                      {project._count.phases} {t('project.tabs.phases')} ·{' '}
                      {project._count.tasks} {t('phase.tasksLabel')}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <NewProjectDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
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
        <div className={cn('mt-1 text-2xl font-semibold tabular-nums', accent)}>
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
            'rounded-full px-1.5 py-0.5 text-[10px]',
            active ? 'bg-white/20' : 'bg-muted',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
