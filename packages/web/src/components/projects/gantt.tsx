'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Phase, ProjectDetail, Task } from '@/lib/types/project';
import { PHASE_TONE, TASK_TONE } from './status-dot';
import { UserAvatar } from '@/components/ui/user-avatar';
import { cn } from '@/lib/utils';

type Scope = 'phases' | 'all';

interface RangeBar {
  startPct: number;
  widthPct: number;
}

const MIN_BAR_WIDTH_PCT = 0.6;
const DAY_MS = 86_400_000;

export function ProjectGantt({ project }: { project: ProjectDetail }) {
  const t = useTranslations();
  const [scope, setScope] = useState<Scope>('phases');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const range = useMemo(() => computeRange(project), [project]);

  if (!range || project.phases.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {t('project.gantt.empty')}
        </p>
      </div>
    );
  }

  const rangeMs = range.end.getTime() - range.start.getTime();
  const todayPct = clampPct(
    ((Date.now() - range.start.getTime()) / rangeMs) * 100,
  );
  const showToday = todayPct >= 0 && todayPct <= 100;
  const axisTicks = computeMonthTicks(range.start, range.end);

  const allExpanded =
    expanded.size > 0 && expanded.size === project.phases.length;

  function toggleAll() {
    if (allExpanded) {
      setExpanded(new Set());
    } else {
      setExpanded(new Set(project.phases.map((p) => p.id)));
    }
  }

  function togglePhase(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-dark-text">
            {t('project.gantt.title')}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('project.gantt.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Legend />
          <ScopeToggle scope={scope} onChange={setScope} />
          {scope === 'all' && (
            <button
              type="button"
              onClick={toggleAll}
              className="rounded-md border bg-white px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/40"
            >
              {allExpanded
                ? t('project.gantt.collapseAll')
                : t('project.gantt.expandAll')}
            </button>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <div className="min-w-[640px]">
          {/* Axis */}
          <div className="grid grid-cols-[minmax(180px,1fr)_3fr] border-b bg-muted/40">
            <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              {t('project.tabs.phases')}
            </div>
            <div className="relative h-8">
              {axisTicks.map((tick) => (
                <div
                  key={tick.iso}
                  className="absolute top-0 bottom-0 border-s border-dashed border-muted-foreground/20 ps-1.5 text-[10px] text-muted-foreground"
                  style={{ insetInlineStart: `${tick.pct}%` }}
                >
                  <span className="whitespace-nowrap">{tick.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div className="relative">
            {/* Today line — drawn once, spans all rows */}
            {showToday && (
              <div
                className="pointer-events-none absolute bottom-0 z-20 w-px bg-abak-blue"
                style={{
                  insetInlineStart: `calc((100% - 180px) * ${todayPct / 100} + 180px)`,
                  top: 0,
                }}
                aria-hidden
              >
                <div className="absolute -top-2 -translate-x-1/2 rounded-sm bg-abak-blue px-1 py-px text-[9px] font-medium text-white rtl:translate-x-1/2">
                  {t('project.gantt.today')}
                </div>
              </div>
            )}

            {project.phases
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((phase) => (
                <PhaseGanttRow
                  key={phase.id}
                  phase={phase}
                  range={range}
                  expanded={expanded.has(phase.id)}
                  showTasks={scope === 'all'}
                  onToggle={() => togglePhase(phase.id)}
                />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Rows ───────────────────────────────────────────────────────────

function PhaseGanttRow({
  phase,
  range,
  expanded,
  showTasks,
  onToggle,
}: {
  phase: Phase;
  range: { start: Date; end: Date };
  expanded: boolean;
  showTasks: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations();
  const planned = computeBar(phase.plannedStart, phase.plannedEnd, range);
  const actualEnd = phase.actualEnd ?? new Date().toISOString();
  const actual = phase.actualStart
    ? computeBar(phase.actualStart, actualEnd, range)
    : null;
  const isSlipping =
    phase.status !== 'COMPLETED' &&
    phase.status !== 'SKIPPED' &&
    new Date(phase.plannedEnd).getTime() < Date.now() &&
    phase.progressPct < 100;

  const tone = PHASE_TONE[phase.status];

  return (
    <div className="border-b last:border-0">
      <div className="grid grid-cols-[minmax(180px,1fr)_3fr] items-center">
        <div className="flex min-w-0 items-center gap-2 px-3 py-2.5">
          {showTasks && phase.tasks.length > 0 ? (
            <button
              type="button"
              onClick={onToggle}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted/40"
              aria-label={
                expanded
                  ? t('project.gantt.collapseAll')
                  : t('project.gantt.expandAll')
              }
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <UserAvatar
            firstName={phase.owner.firstName}
            lastName={phase.owner.lastName}
            email={phase.owner.email}
            size="xs"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{phase.name}</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {t(`phase.status.${phase.status}`)} ·{' '}
              {phase.progressPct.toFixed(0)}%
            </div>
          </div>
        </div>
        <BarTrack
          planned={planned}
          actual={actual}
          progressPct={phase.progressPct}
          tone={tone}
          isSlipping={isSlipping}
          tooltip={<PhaseTip phase={phase} />}
        />
      </div>

      {expanded && showTasks && phase.tasks.length > 0 && (
        <div className="bg-muted/10">
          {phase.tasks.map((task) => (
            <TaskGanttRow key={task.id} task={task} range={range} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskGanttRow({
  task,
  range,
}: {
  task: Task;
  range: { start: Date; end: Date };
}) {
  const t = useTranslations();
  if (!task.plannedStart || !task.plannedEnd) {
    return (
      <div className="grid grid-cols-[minmax(180px,1fr)_3fr] items-center border-t border-dashed">
        <div className="flex items-center gap-2 px-3 py-1.5 ps-10">
          <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {task.title}
          </div>
        </div>
        <div className="px-3 py-1.5 text-[11px] text-muted-foreground">
          {t('project.gantt.tip.noActual')}
        </div>
      </div>
    );
  }

  const planned = computeBar(task.plannedStart, task.plannedEnd, range);
  const actualEnd = task.actualEnd ?? new Date().toISOString();
  const actual = task.actualStart
    ? computeBar(task.actualStart, actualEnd, range)
    : null;
  const isSlipping =
    task.status !== 'DONE' &&
    task.status !== 'CANCELLED' &&
    new Date(task.plannedEnd).getTime() < Date.now();
  const tone = TASK_TONE[task.status];
  const progressPct =
    task.status === 'DONE' ? 100 : task.status === 'IN_PROGRESS' ? 50 : 0;

  return (
    <div className="grid grid-cols-[minmax(180px,1fr)_3fr] items-center border-t border-dashed">
      <div className="flex items-center gap-2 px-3 py-1.5 ps-10">
        {task.assignee && (
          <UserAvatar
            firstName={task.assignee.firstName}
            lastName={task.assignee.lastName}
            email={task.assignee.email}
            size="xs"
          />
        )}
        <div className="min-w-0 flex-1 truncate text-xs">{task.title}</div>
      </div>
      <BarTrack
        planned={planned}
        actual={actual}
        progressPct={progressPct}
        tone={tone}
        isSlipping={isSlipping}
        height="h-3"
        tooltip={<TaskTip task={task} />}
      />
    </div>
  );
}

// ─── Bar primitives ─────────────────────────────────────────────────

function BarTrack({
  planned,
  actual,
  progressPct,
  tone,
  isSlipping,
  height = 'h-5',
  tooltip,
}: {
  planned: RangeBar;
  actual: RangeBar | null;
  progressPct: number;
  tone:
    | 'slate'
    | 'sky'
    | 'indigo'
    | 'amber'
    | 'emerald'
    | 'rose'
    | 'zinc'
    | 'zinc-dark';
  isSlipping: boolean;
  height?: string;
  tooltip?: React.ReactNode;
}) {
  const fillClass = TONE_BAR_FILL[tone];
  return (
    <div className="relative px-3 py-2">
      <div
        className={cn(
          'relative w-full overflow-visible rounded-sm bg-muted/30',
          height,
        )}
      >
        {/* Planned bar (outline) */}
        <div
          className={cn(
            'group/bar absolute top-0 bottom-0 rounded-sm border',
            isSlipping
              ? 'border-rose-400 bg-rose-50/40'
              : 'border-slate-300 bg-slate-50',
          )}
          style={{
            insetInlineStart: `${planned.startPct}%`,
            width: `${planned.widthPct}%`,
          }}
        >
          {/* Progress fill inside planned */}
          <div
            className={cn('absolute top-0 bottom-0 rounded-sm', fillClass)}
            style={{
              insetInlineStart: 0,
              width: `${Math.max(0, Math.min(100, progressPct))}%`,
            }}
          />
          {/* Hover tooltip anchor */}
          {tooltip && (
            <div className="invisible absolute -top-1 z-30 -translate-y-full whitespace-nowrap rounded-md bg-dark-text px-2.5 py-1.5 text-[11px] text-white shadow-lg group-hover/bar:visible">
              {tooltip}
            </div>
          )}
        </div>

        {/* Actual extension beyond planned (slip area) */}
        {actual &&
          actual.startPct + actual.widthPct >
            planned.startPct + planned.widthPct && (
            <div
              className="absolute top-0 bottom-0 rounded-sm bg-rose-300/60"
              style={{
                insetInlineStart: `${planned.startPct + planned.widthPct}%`,
                width: `${actual.startPct + actual.widthPct - (planned.startPct + planned.widthPct)}%`,
              }}
            />
          )}
      </div>
    </div>
  );
}

const TONE_BAR_FILL: Record<string, string> = {
  slate: 'bg-slate-300',
  sky: 'bg-sky-500',
  indigo: 'bg-indigo-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  zinc: 'bg-zinc-400',
  'zinc-dark': 'bg-zinc-600',
};

// ─── Tooltips ───────────────────────────────────────────────────────

function PhaseTip({ phase }: { phase: Phase }) {
  const t = useTranslations();
  const owner =
    `${phase.owner.firstName ?? ''} ${phase.owner.lastName ?? ''}`.trim() ||
    phase.owner.email;
  return (
    <div className="space-y-0.5">
      <div className="font-semibold">{phase.name}</div>
      <TipRow label={t('project.gantt.tip.owner')} value={owner ?? '—'} />
      <TipRow
        label={t('project.gantt.tip.planned')}
        value={`${phase.plannedStart.slice(0, 10)} → ${phase.plannedEnd.slice(0, 10)}`}
      />
      <TipRow
        label={t('project.gantt.tip.actual')}
        value={
          phase.actualStart
            ? `${phase.actualStart.slice(0, 10)} → ${phase.actualEnd?.slice(0, 10) ?? '…'}`
            : t('project.gantt.tip.noActual')
        }
      />
      <TipRow
        label={t('project.gantt.tip.progress')}
        value={`${phase.progressPct.toFixed(0)}%`}
      />
      <TipRow
        label={t('project.gantt.tip.status')}
        value={t(`phase.status.${phase.status}`)}
      />
    </div>
  );
}

function TaskTip({ task }: { task: Task }) {
  const t = useTranslations();
  return (
    <div className="space-y-0.5">
      <div className="font-semibold">{task.title}</div>
      <TipRow
        label={t('project.gantt.tip.planned')}
        value={`${task.plannedStart?.slice(0, 10) ?? '—'} → ${task.plannedEnd?.slice(0, 10) ?? '—'}`}
      />
      <TipRow
        label={t('project.gantt.tip.actual')}
        value={
          task.actualStart
            ? `${task.actualStart.slice(0, 10)} → ${task.actualEnd?.slice(0, 10) ?? '…'}`
            : t('project.gantt.tip.noActual')
        }
      />
      <TipRow
        label={t('project.gantt.tip.status')}
        value={t(`task.status.${task.status}`)}
      />
    </div>
  );
}

function TipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-[11px]">
      <span className="text-white/60">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// ─── Legend & toggle ────────────────────────────────────────────────

function Legend() {
  const t = useTranslations();
  return (
    <div className="hidden items-center gap-3 text-[11px] text-muted-foreground sm:flex">
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-3 rounded-sm border border-slate-300 bg-slate-50" />
        {t('project.gantt.planned')}
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-3 rounded-sm bg-sky-500" />
        {t('project.gantt.actual')}
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-3 rounded-sm bg-rose-300/70" />
        {t('project.gantt.slip')}
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-px bg-abak-blue" />
        {t('project.gantt.today')}
      </span>
    </div>
  );
}

function ScopeToggle({
  scope,
  onChange,
}: {
  scope: Scope;
  onChange: (s: Scope) => void;
}) {
  const t = useTranslations();
  return (
    <div className="inline-flex rounded-md border bg-white p-0.5 text-xs">
      {(['phases', 'all'] as Scope[]).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={cn(
            'rounded px-2.5 py-1 font-medium transition-colors',
            scope === s
              ? 'bg-abak-blue text-white'
              : 'text-muted-foreground hover:bg-muted/40',
          )}
        >
          {s === 'phases'
            ? t('project.gantt.scopePhases')
            : t('project.gantt.scopeAll')}
        </button>
      ))}
    </div>
  );
}

// ─── Range math ─────────────────────────────────────────────────────

function computeRange(project: ProjectDetail) {
  const dates: number[] = [];
  for (const phase of project.phases) {
    dates.push(new Date(phase.plannedStart).getTime());
    dates.push(new Date(phase.plannedEnd).getTime());
    if (phase.actualStart) dates.push(new Date(phase.actualStart).getTime());
    if (phase.actualEnd) dates.push(new Date(phase.actualEnd).getTime());
    for (const task of phase.tasks) {
      if (task.plannedStart) dates.push(new Date(task.plannedStart).getTime());
      if (task.plannedEnd) dates.push(new Date(task.plannedEnd).getTime());
    }
  }
  if (project.startDate) dates.push(new Date(project.startDate).getTime());
  if (project.expectedEndDate)
    dates.push(new Date(project.expectedEndDate).getTime());
  if (dates.length === 0) return null;
  const startMs = Math.min(...dates);
  const endMs = Math.max(...dates, Date.now());
  // Pad by one week on each side for readability.
  const start = new Date(startMs - 7 * DAY_MS);
  const end = new Date(endMs + 7 * DAY_MS);
  return { start, end };
}

function computeBar(
  startIso: string,
  endIso: string,
  range: { start: Date; end: Date },
): RangeBar {
  const rangeMs = range.end.getTime() - range.start.getTime();
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  const startPct = clampPct(
    ((startMs - range.start.getTime()) / rangeMs) * 100,
  );
  const widthPct = Math.max(
    MIN_BAR_WIDTH_PCT,
    clampPct(((endMs - startMs) / rangeMs) * 100),
  );
  return { startPct, widthPct };
}

function clampPct(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function computeMonthTicks(start: Date, end: Date) {
  const ticks: { iso: string; label: string; pct: number }[] = [];
  const rangeMs = end.getTime() - start.getTime();
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  // Step forward one month at a time until we pass `end`.
  while (cursor <= end) {
    const pct = ((cursor.getTime() - start.getTime()) / rangeMs) * 100;
    if (pct >= 0 && pct <= 100) {
      ticks.push({
        iso: cursor.toISOString(),
        label: cursor.toLocaleDateString(undefined, {
          month: 'short',
          year: cursor.getMonth() === 0 ? 'numeric' : undefined,
        }),
        pct,
      });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return ticks;
}
