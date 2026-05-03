'use client';

import { useTranslations } from 'next-intl';
import { Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import {
  useResourceWorkload,
  type ResourceWorkload,
} from '@/lib/hooks/use-projects';
import { cn } from '@/lib/utils';

const MAX_VISIBLE_TASKS = 10;

function statusColor(status: ResourceWorkload['utilizationStatus']) {
  switch (status) {
    case 'AVAILABLE':
      return 'bg-emerald-500';
    case 'BUSY':
      return 'bg-amber-400';
    case 'OVERLOADED':
      return 'bg-rose-500';
  }
}

function statusBg(status: ResourceWorkload['utilizationStatus']) {
  switch (status) {
    case 'AVAILABLE':
      return 'border-emerald-200 bg-emerald-50/40';
    case 'BUSY':
      return 'border-amber-200 bg-amber-50/40';
    case 'OVERLOADED':
      return 'border-rose-200 bg-rose-50/40';
  }
}

function statusLabel(
  status: ResourceWorkload['utilizationStatus'],
  t: ReturnType<typeof useTranslations>,
) {
  switch (status) {
    case 'AVAILABLE':
      return t('resources.status.available');
    case 'BUSY':
      return t('resources.status.busy');
    case 'OVERLOADED':
      return t('resources.status.overloaded');
  }
}

function statusTextColor(status: ResourceWorkload['utilizationStatus']) {
  switch (status) {
    case 'AVAILABLE':
      return 'text-emerald-700';
    case 'BUSY':
      return 'text-amber-700';
    case 'OVERLOADED':
      return 'text-rose-700';
  }
}

function ResourceCard({ employee }: { employee: ResourceWorkload }) {
  const t = useTranslations();
  const fullName =
    `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim() ||
    employee.userId;
  const initials =
    [employee.firstName?.[0], employee.lastName?.[0]]
      .filter(Boolean)
      .join('')
      .toUpperCase() || '?';
  const taskBarValue = Math.min(
    (employee.activeTasks / MAX_VISIBLE_TASKS) * 100,
    100,
  );

  return (
    <Card className={cn('border', statusBg(employee.utilizationStatus))}>
      <CardContent className="space-y-3 p-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-abak-blue/10 text-sm font-semibold text-abak-blue">
              {initials}
            </div>
            <span
              className={cn(
                'absolute -end-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white',
                statusColor(employee.utilizationStatus),
              )}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-dark-text">
              {fullName}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {employee.role}
            </div>
          </div>
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-[11px] font-medium',
              statusBg(employee.utilizationStatus),
              statusTextColor(employee.utilizationStatus),
            )}
          >
            {statusLabel(employee.utilizationStatus, t)}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 rounded-md bg-white/60 p-2 text-center text-xs">
          <div>
            <div className="text-lg font-bold tabular-nums text-abak-blue">
              {employee.activeTasks}
            </div>
            <div className="text-muted-foreground">
              {t('resources.activeTasks')}
            </div>
          </div>
          <div>
            <div className="text-lg font-bold tabular-nums text-abak-blue">
              {employee.totalPlannedHours.toFixed(0)}
            </div>
            <div className="text-muted-foreground">
              {t('resources.plannedHours')}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{t('resources.taskLoad')}</span>
            <span className="tabular-nums">
              {employee.activeTasks} / {MAX_VISIBLE_TASKS}+
            </span>
          </div>
          <ProgressBar
            value={taskBarValue}
            size="sm"
            variant={
              employee.utilizationStatus === 'AVAILABLE'
                ? 'success'
                : employee.utilizationStatus === 'OVERLOADED'
                  ? 'danger'
                  : 'warning'
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function ResourceWorkloadPage() {
  const t = useTranslations();
  const { data: employees, isLoading } = useResourceWorkload();

  const available =
    employees?.filter((e) => e.utilizationStatus === 'AVAILABLE').length ?? 0;
  const busy =
    employees?.filter((e) => e.utilizationStatus === 'BUSY').length ?? 0;
  const overloaded =
    employees?.filter((e) => e.utilizationStatus === 'OVERLOADED').length ?? 0;

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-abak-blue/10 text-abak-blue">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-abak-blue">
            {t('resources.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('resources.subtitle')}
          </p>
        </div>
      </div>

      {/* Summary KPIs */}
      {!isLoading && employees && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
            <div className="text-2xl font-bold text-emerald-700">
              {available}
            </div>
            <div className="text-xs text-emerald-600">
              {t('resources.status.available')}
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
            <div className="text-2xl font-bold text-amber-700">{busy}</div>
            <div className="text-xs text-amber-600">
              {t('resources.status.busy')}
            </div>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-center">
            <div className="text-2xl font-bold text-rose-700">{overloaded}</div>
            <div className="text-xs text-rose-600">
              {t('resources.status.overloaded')}
            </div>
          </div>
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-44 w-full animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      )}

      {/* Employee cards */}
      {!isLoading && employees && employees.length === 0 && (
        <div className="py-16 text-center text-muted-foreground">
          {t('resources.empty')}
        </div>
      )}

      {!isLoading && employees && employees.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {employees.map((employee) => (
            <ResourceCard key={employee.userId} employee={employee} />
          ))}
        </div>
      )}
    </div>
  );
}
