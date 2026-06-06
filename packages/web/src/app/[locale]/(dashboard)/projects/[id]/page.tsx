'use client';

import { use, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
  UserCog,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  useAdjustPhaseProgress,
  useCompletePhase,
  useInitiateClosure,
  useProject,
  useRemoveDependency,
  useSetClosureGate,
  useTransitionTaskStatus,
} from '@/lib/hooks/use-projects';
import type {
  ClosureGate,
  Phase,
  ProjectDetail,
  Task,
  TaskStatus,
} from '@/lib/types/project';
import {
  PhaseStatusBadge,
  ProjectStatusBadge,
  TaskStatusBadge,
} from '@/components/ui/entity-status-badges';
import { DateChip } from '@/components/projects/date-chip';
import { ProgressBar } from '@/components/ui/progress-bar';
import { UserAvatar } from '@/components/ui/user-avatar';
import {
  AddDependencyDialog,
  AddPhaseDialog,
  AddTaskDialog,
  ReassignOwnerDialog,
} from '@/components/projects/phase-dialogs';
import { ProjectGantt } from '@/components/projects/gantt';
import { LicencesTab } from '@/components/projects/licences-tab';
import { DocumentPanel } from '@/components/documents/document-panel';
import { ProjectTasksTab } from '@/components/projects/tasks-tab';
import { ProjectTeamTab } from '@/components/projects/team-tab';
import { ProjectActivityTab } from '@/components/projects/activity-tab';
import { cn } from '@/lib/utils';
import { isForbiddenError } from '@/lib/api-client';
import { NoAccess } from '@/components/auth/no-access';

const GATES: ClosureGate[] = [
  'ALL_PHASES_COMPLETED',
  'DELIVERABLES_SUBMITTED',
  'CLIENT_APPROVAL_RECEIVED',
  'FINAL_PAYMENT_RECEIVED',
  'FINANCE_CLEARANCE_ISSUED',
];

const FINANCE_GATES: Set<ClosureGate> = new Set([
  'FINAL_PAYMENT_RECEIVED',
  'FINANCE_CLEARANCE_ISSUED',
]);

async function runWithToast<T>(t: (k: string) => string, fn: () => Promise<T>) {
  try {
    await fn();
    toast.success(t('common.success'));
    return true;
  } catch (err) {
    const msg =
      (err as { response?: { data?: { message?: string | string[] } } })
        ?.response?.data?.message ?? t('errors.generic');
    toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    return false;
  }
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations();
  const { data: project, isLoading, error } = useProject(id);

  const [addPhaseOpen, setAddPhaseOpen] = useState(false);

  const allTasks = useMemo(() => {
    if (!project) return [];
    return project.phases.flatMap((p) => p.tasks);
  }, [project]);

  // Record-level scope denial → friendly no-access (FE-5), not an endless skeleton.
  if (isForbiddenError(error)) {
    return <NoAccess variant="record" />;
  }
  if (isLoading || !project) {
    return (
      <div className="space-y-4">
        <div className="h-24 w-full animate-pulse rounded-lg bg-muted" />
        <div className="h-48 w-full animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  const isReadOnly =
    project.status === 'CLOSED' || project.status === 'CANCELLED';

  return (
    <div className="space-y-6">
      {project.financialRiskFlagged && (
        <div className="flex items-start gap-3 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-rose-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {t('projectDetail.progressWarning')}
            </p>
            {project.financialRiskFlaggedAt && (
              <p className="mt-0.5 text-sm text-rose-700">
                {t('project.riskFlaggedAt')}:{' '}
                {new Date(project.financialRiskFlaggedAt).toLocaleDateString(
                  'ar-SA-u-ca-islamic',
                )}
              </p>
            )}
          </div>
        </div>
      )}

      <ProjectHero project={project} />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">
            {t('project.tabs.overview')}
          </TabsTrigger>
          <TabsTrigger value="tasks">
            {t('project.tabs.tasks')} · {allTasks.length}
          </TabsTrigger>
          <TabsTrigger value="phases">
            {t('project.tabs.phases')} · {project.phases.length}
          </TabsTrigger>
          <TabsTrigger value="gantt">{t('project.tabs.gantt')}</TabsTrigger>
          <TabsTrigger value="team">{t('project.tabs.team')}</TabsTrigger>
          <TabsTrigger value="licences">
            {t('project.tabs.authority')}
          </TabsTrigger>
          <TabsTrigger value="documents">{t('documents.heading')}</TabsTrigger>
          <TabsTrigger value="activity">
            {t('project.tabs.activity')}
          </TabsTrigger>
          <TabsTrigger value="closure">
            {t('project.tabs.closure')}
            {project.closureChecklist?.closedAt && (
              <CheckCircle2 className="ms-1.5 h-3.5 w-3.5 text-emerald-600" />
            )}
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <OverviewPanel project={project} />
        </TabsContent>

        {/* Tasks (list + Kanban board) */}
        <TabsContent value="tasks">
          <ProjectTasksTab
            project={project}
            projectId={id}
            isReadOnly={isReadOnly}
          />
        </TabsContent>

        {/* Phases */}
        <TabsContent value="phases" className="space-y-3">
          {project.phases.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <div className="mx-auto max-w-sm space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-abak-blue/10 text-abak-blue">
                    <Plus className="h-6 w-6" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('phase.nothingHere')}
                  </p>
                  <Button
                    onClick={() => setAddPhaseOpen(true)}
                    disabled={isReadOnly}
                  >
                    <Plus className="me-2 h-4 w-4" />
                    {t('phase.addPhase')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {project.phases.map((phase) => (
                <PhaseCard
                  key={phase.id}
                  projectId={id}
                  phase={phase}
                  allTasks={allTasks}
                  isReadOnly={isReadOnly}
                />
              ))}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setAddPhaseOpen(true)}
                  disabled={isReadOnly}
                >
                  <Plus className="me-2 h-4 w-4" />
                  {t('phase.addPhase')}
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        {/* Gantt */}
        <TabsContent value="gantt">
          <ProjectGantt project={project} />
        </TabsContent>

        {/* Team */}
        <TabsContent value="team">
          <ProjectTeamTab project={project} />
        </TabsContent>

        {/* Authority (government licences / portal tracking) */}
        <TabsContent value="licences">
          <LicencesTab
            projectId={id}
            phases={project.phases.map((p) => ({
              id: p.id,
              name: p.name,
              status: p.status,
              licenceOverrideJustification: p.licenceOverrideJustification,
              licenceOverrideById: p.licenceOverrideById,
              licenceOverrideAt: p.licenceOverrideAt,
            }))}
          />
        </TabsContent>

        {/* Documents (WS-D / DOC-A — real upload + list, scope-checked) */}
        <TabsContent value="documents">
          <DocumentPanel entityType="PROJECT" entityId={id} />
        </TabsContent>

        {/* Activity (stub — no event-stream backend yet) */}
        <TabsContent value="activity">
          <ProjectActivityTab />
        </TabsContent>

        {/* Closure */}
        <TabsContent value="closure">
          <ClosurePanel projectId={id} project={project} />
        </TabsContent>
      </Tabs>

      <AddPhaseDialog
        open={addPhaseOpen}
        onOpenChange={setAddPhaseOpen}
        projectId={id}
        defaultOwnerId={project.pm.id}
        defaultPosition={project.phases.length}
        defaultStart={
          project.phases.length > 0
            ? project.phases[project.phases.length - 1].plannedEnd.slice(0, 10)
            : (project.startDate?.slice(0, 10) ??
              new Date().toISOString().slice(0, 10))
        }
      />
    </div>
  );
}

// ─── Hero ───────────────────────────────────────────────────────

function ProjectHero({ project }: { project: ProjectDetail }) {
  const t = useTranslations();
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {project.projectNumber}
              </span>
              <ProjectStatusBadge status={project.status} />
              {project.financialRiskFlagged && (
                <span className="inline-flex items-center gap-1 rounded-full bg-error/10 px-2 py-0.5 text-xs font-medium text-error">
                  <AlertTriangle className="h-3 w-3" />
                  {t('project.kpi.atRisk')}
                </span>
              )}
            </div>
            <h1 className="mt-1 text-2xl font-bold text-abak-blue">
              {project.title}
            </h1>
            {project.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {project.description}
              </p>
            )}
          </div>

          <div className="text-end">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {t('project.contractValue')}
            </div>
            <div className="font-mono text-lg font-bold text-abak-blue">
              {project.contractValue.toLocaleString()} {t('units.sar')}
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-t pt-4 md:grid-cols-4">
          <HeroMeta
            label={t('project.client')}
            value={project.client.companyName ?? project.client.contactName}
          />
          <HeroMeta
            label={t('project.pm')}
            value={
              `${project.pm.firstName ?? ''} ${project.pm.lastName ?? ''}`.trim() ||
              (project.pm.email ?? '—')
            }
            avatar={
              <UserAvatar
                firstName={project.pm.firstName}
                lastName={project.pm.lastName}
                email={project.pm.email}
                size="sm"
              />
            }
          />
          <HeroMeta
            label={t('project.startDate')}
            value={project.startDate?.slice(0, 10) ?? '—'}
          />
          <HeroMeta
            label={t('project.expectedEnd')}
            value={project.expectedEndDate?.slice(0, 10) ?? '—'}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {t('project.actualProgress')}
            </span>
            <span className="font-semibold tabular-nums text-abak-blue">
              {project.actualProgress.toFixed(1)}%
            </span>
          </div>
          <ProgressBar
            value={project.actualProgress}
            size="lg"
            variant={
              project.actualProgress >= 90
                ? 'success'
                : project.financialRiskFlagged
                  ? 'danger'
                  : 'default'
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

function HeroMeta({
  label,
  value,
  avatar,
}: {
  label: string;
  value: string;
  avatar?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-sm font-medium">
        {avatar}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

// ─── Overview Tab ───────────────────────────────────────────────

function OverviewPanel({ project }: { project: ProjectDetail }) {
  const t = useTranslations();

  const phaseBreakdown = project.phases.map((p) => ({
    name: p.name,
    pct: p.progressPct,
  }));

  const taskTotals = project.phases.reduce(
    (acc, p) => {
      acc.total += p.tasks.length;
      acc.done += p.tasks.filter((ta) => ta.status === 'DONE').length;
      return acc;
    },
    { total: 0, done: 0 },
  );

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('project.tabs.phases')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {phaseBreakdown.length === 0 && (
            <div className="text-sm text-muted-foreground">
              {t('phase.nothingHere')}
            </div>
          )}
          {phaseBreakdown.map((row) => (
            <div key={row.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate">{row.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {row.pct.toFixed(0)}%
                </span>
              </div>
              <ProgressBar value={row.pct} size="sm" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('phase.tasksLabel')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <OverviewRow
            label={t('project.po')}
            value={`${project.po.poNumber} · ${project.po.contractValue.toLocaleString()} ${t(
              'units.sar',
            )}`}
          />
          <OverviewRow
            label={t('phase.tasksLabel')}
            value={t('phase.tasksOf', {
              done: taskTotals.done,
              total: taskTotals.total,
            })}
          />
          <OverviewRow
            label={t('project.actualEnd')}
            value={project.actualEndDate?.slice(0, 10) ?? '—'}
          />
          <OverviewRow
            label={t('project.plannedProgress')}
            value={`${project.plannedProgress.toFixed(1)}%`}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function OverviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// ─── Phase Card ─────────────────────────────────────────────────

function PhaseCard({
  projectId,
  phase,
  allTasks,
  isReadOnly,
}: {
  projectId: string;
  phase: Phase;
  allTasks: Task[];
  isReadOnly: boolean;
}) {
  const t = useTranslations();
  const completeMutation = useCompletePhase(projectId);
  const adjustMutation = useAdjustPhaseProgress(projectId);

  const [completeOpen, setCompleteOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const completed = phase.status === 'COMPLETED';
  const duration = Math.max(
    1,
    Math.round(
      (new Date(phase.plannedEnd).getTime() -
        new Date(phase.plannedStart).getTime()) /
        86_400_000,
    ),
  );

  const taskCounts = useMemo(
    () => ({
      total: phase.tasks.length,
      done: phase.tasks.filter((ta) => ta.status === 'DONE').length,
    }),
    [phase.tasks],
  );

  const rowLocked = isReadOnly || completed;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-abak-blue/10 px-2 py-0.5 text-[11px] font-semibold text-abak-blue">
                {t(`phase.code.${phase.phaseCode}`)}
              </span>
              <h3 className="truncate font-semibold text-dark-text">
                {phase.name}
              </h3>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <UserAvatar
                  firstName={phase.owner.firstName}
                  lastName={phase.owner.lastName}
                  email={phase.owner.email}
                  size="xs"
                />
                <span className="truncate">
                  {`${phase.owner.firstName ?? ''} ${phase.owner.lastName ?? ''}`.trim() ||
                    phase.owner.email}
                </span>
              </span>
              <span>·</span>
              <span>
                {phase.plannedStart.slice(5, 10)} →{' '}
                {phase.plannedEnd.slice(5, 10)}
              </span>
              <span>·</span>
              <span>
                {duration} {t('phase.daysUnit')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PhaseStatusBadge status={phase.status} />
            <DateChip
              plannedEnd={phase.plannedEnd}
              status={phase.status}
              labels={{
                overdueBy: (d) => t('phase.countOverdue', { days: d }),
                daysLeft: (d) => t('phase.countDaysLeft', { days: d }),
                dueToday: t('phase.countDueToday'),
                completed: t('phase.countDone'),
              }}
            />
            {!rowLocked && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    aria-label={t('phase.actions')}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="text-xs">
                    {phase.name}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setCompleteOpen(true)}>
                    <CheckCircle2 className="me-2 h-4 w-4" />
                    {t('phase.markComplete')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAdjustOpen(true)}>
                    <SlidersHorizontal className="me-2 h-4 w-4" />
                    {t('phase.adjustProgress')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setReassignOpen(true)}>
                    <UserCog className="me-2 h-4 w-4" />
                    {t('phase.reassignOwner')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <ProgressBar
            value={phase.progressPct}
            size="md"
            showLabel={false}
            variant={
              completed
                ? 'success'
                : phase.status === 'BLOCKED'
                  ? 'danger'
                  : phase.status === 'UNDER_REVIEW'
                    ? 'warning'
                    : 'default'
            }
          />
          {phase.pmAdjustmentNote && (
            <p className="text-[11px] text-muted-foreground">
              {t('phase.adjustNote', { note: phase.pmAdjustmentNote })}
            </p>
          )}
        </div>

        {/* Tasks */}
        <div className="space-y-2 rounded-md border bg-muted/20 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">
              {t('phase.tasksLabel')} ·{' '}
              {t('phase.tasksOf', {
                done: taskCounts.done,
                total: taskCounts.total,
              })}
            </span>
            {!rowLocked && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setAddTaskOpen(true)}
              >
                <Plus className="me-1 h-3.5 w-3.5" />
                {taskCounts.total === 0
                  ? t('phase.addFirstTask')
                  : t('phase.tasksLabel')}
              </Button>
            )}
          </div>

          {phase.tasks.length === 0 ? (
            <div className="py-3 text-center text-xs text-muted-foreground">
              {t('phase.noTasksYet')}
            </div>
          ) : (
            <ul className="space-y-1.5">
              {phase.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  projectId={projectId}
                  allTasks={allTasks}
                  locked={rowLocked}
                />
              ))}
            </ul>
          )}
        </div>
      </CardContent>

      {/* Dialogs */}
      <CompletePhaseDialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        onSubmit={async (body) => {
          const ok = await runWithToast(t, () =>
            completeMutation.mutateAsync({
              phaseId: phase.id,
              ...body,
            }),
          );
          if (ok) setCompleteOpen(false);
        }}
        pending={completeMutation.isPending}
      />

      <AdjustProgressDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        initial={phase.progressPct}
        onSubmit={async (body) => {
          const ok = await runWithToast(t, () =>
            adjustMutation.mutateAsync({
              phaseId: phase.id,
              ...body,
            }),
          );
          if (ok) setAdjustOpen(false);
        }}
        pending={adjustMutation.isPending}
      />

      <ReassignOwnerDialog
        open={reassignOpen}
        onOpenChange={setReassignOpen}
        projectId={projectId}
        phase={phase}
      />

      <AddTaskDialog
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
        projectId={projectId}
        phase={phase}
      />
    </Card>
  );
}

// ─── Task Row ───────────────────────────────────────────────────

function TaskRow({
  task,
  projectId,
  allTasks,
  locked,
}: {
  task: Task;
  projectId: string;
  allTasks: Task[];
  locked: boolean;
}) {
  const t = useTranslations();
  const transition = useTransitionTaskStatus(projectId);
  const removeDep = useRemoveDependency(projectId);

  const [depOpen, setDepOpen] = useState(false);

  const candidates = useMemo(() => {
    const blockerIds = new Set(task.blockers.map((b) => b.blocker.id));
    return allTasks.filter((x) => x.id !== task.id && !blockerIds.has(x.id));
  }, [allTasks, task]);

  const nextStatuses: TaskStatus[] =
    task.status === 'NOT_STARTED'
      ? ['IN_PROGRESS']
      : task.status === 'IN_PROGRESS'
        ? ['REVIEW', 'DONE', 'BLOCKED']
        : task.status === 'REVIEW'
          ? ['DONE', 'IN_PROGRESS']
          : task.status === 'BLOCKED'
            ? ['IN_PROGRESS']
            : [];

  async function doTransition(status: TaskStatus) {
    await runWithToast(t, () =>
      transition.mutateAsync({ taskId: task.id, status }),
    );
  }

  async function doRemoveDep(blockerTaskId: string) {
    await runWithToast(t, () =>
      removeDep.mutateAsync({ taskId: task.id, blockerTaskId }),
    );
  }

  return (
    <li className="group rounded-md border bg-card p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 truncate text-sm font-medium">
          {task.title}
        </span>
        <TaskStatusBadge status={task.status} dot />
        <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
          {t(`task.priority.${task.priority}`)}
        </span>
        {task.assignee && (
          <UserAvatar
            firstName={task.assignee.firstName}
            lastName={task.assignee.lastName}
            email={task.assignee.email}
            size="xs"
          />
        )}

        {!locked && (
          <div className="flex items-center gap-1 md:opacity-0 md:transition-opacity group-hover:md:opacity-100">
            {nextStatuses.map((s) => (
              <Button
                key={s}
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px]"
                onClick={() => doTransition(s)}
              >
                {t(`task.status.${s}`)}
              </Button>
            ))}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setDepOpen(true)}
              aria-label={t('dialogs.addDependencyTitle')}
            >
              <Link2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {task.blockers.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
          <Link2 className="h-3 w-3" />
          {task.blockers.map((b) => (
            <span
              key={b.blocker.id}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5',
                b.blocker.status === 'DONE'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800',
              )}
            >
              {b.blocker.title}
              {!locked && (
                <button
                  type="button"
                  onClick={() => doRemoveDep(b.blocker.id)}
                  className="rounded-full hover:bg-black/5"
                  aria-label={t('common.delete')}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <AddDependencyDialog
        open={depOpen}
        onOpenChange={setDepOpen}
        projectId={projectId}
        task={task}
        candidates={candidates}
      />
    </li>
  );
}

// ─── Complete phase dialog ──────────────────────────────────────

function CompletePhaseDialog({
  open,
  onOpenChange,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (body: {
    evidenceNote?: string;
    clientAcknowledgedAt?: string;
  }) => Promise<void>;
  pending: boolean;
}) {
  const t = useTranslations();
  const [evidenceNote, setEvidenceNote] = useState('');
  const [clientAck, setClientAck] = useState('');

  const canSubmit =
    evidenceNote.trim().length >= 50 || clientAck.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('dialogs.confirmComplete')}</DialogTitle>
          <DialogDescription>
            {t('dialogs.confirmCompleteSubtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ev">{t('phase.evidenceNote')}</Label>
            <Textarea
              id="ev"
              rows={4}
              value={evidenceNote}
              onChange={(e) => setEvidenceNote(e.target.value)}
            />
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">
                {t('phase.evidenceHint')}
              </span>
              <span
                className={cn(
                  'tabular-nums',
                  evidenceNote.length >= 50
                    ? 'text-emerald-600'
                    : 'text-muted-foreground',
                )}
              >
                {evidenceNote.length} / 50
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ack">{t('phase.clientAcknowledged')}</Label>
            <Input
              id="ack"
              type="date"
              value={clientAck}
              onChange={(e) => setClientAck(e.target.value)}
              className="max-w-[12rem]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!canSubmit || pending}
            onClick={() =>
              onSubmit({
                evidenceNote: evidenceNote.trim() || undefined,
                clientAcknowledgedAt: clientAck
                  ? new Date(clientAck).toISOString()
                  : undefined,
              })
            }
          >
            {t('phase.markComplete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Adjust progress dialog ─────────────────────────────────────

function AdjustProgressDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: number;
  onSubmit: (body: { progressPct: number; reason: string }) => Promise<void>;
  pending: boolean;
}) {
  const t = useTranslations();
  const [pct, setPct] = useState(initial);
  const [reason, setReason] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('phase.adjustProgress')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pct">%</Label>
            <div className="flex items-center gap-2">
              <Input
                id="pct"
                type="range"
                min={0}
                max={100}
                value={pct}
                onChange={(e) => setPct(Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-14 text-end font-mono text-sm font-semibold tabular-nums">
                {pct}%
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r">{t('phase.adjustReason')}</Label>
            <Textarea
              id="r"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={pending || reason.trim().length < 10}
            onClick={() =>
              onSubmit({ progressPct: pct, reason: reason.trim() })
            }
          >
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Closure Panel ──────────────────────────────────────────────

function ClosurePanel({
  projectId,
  project,
}: {
  projectId: string;
  project: ProjectDetail;
}) {
  const t = useTranslations();
  const initiate = useInitiateClosure(projectId);
  const setGate = useSetClosureGate(projectId);
  const checklist = project.closureChecklist;

  const passed = checklist
    ? GATES.reduce(
        (n, g) =>
          (checklist as unknown as Record<string, boolean>)[gateField(g)]
            ? n + 1
            : n,
        0,
      )
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('closure.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('closure.subtitle')}</p>

        {!checklist ? (
          <div className="space-y-3 rounded-md border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              {t('closure.notInitiated')}
            </p>
            <Button
              onClick={async () => {
                await runWithToast(t, () => initiate.mutateAsync());
              }}
              disabled={initiate.isPending}
            >
              {t('closure.initiate')}
            </Button>
          </div>
        ) : (
          <>
            {/* Progress */}
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {t('closurePanel.progressOf', {
                    passed,
                    total: GATES.length,
                  })}
                </span>
                {checklist.closedAt && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" />
                    {t('closurePanel.completedBadge')}
                  </span>
                )}
              </div>
              <div className="mt-2">
                <ProgressBar
                  value={(passed / GATES.length) * 100}
                  size="md"
                  variant={passed === GATES.length ? 'success' : 'default'}
                />
              </div>
            </div>

            {/* Gates */}
            <ul className="space-y-2">
              {GATES.map((gate) => {
                const field = gateField(gate);
                const checked = (
                  checklist as unknown as Record<string, boolean>
                )[field];
                const atField = `${field}At`;
                const at = (
                  checklist as unknown as Record<string, string | null>
                )[atField];
                const isFinance = FINANCE_GATES.has(gate);
                const disabled = setGate.isPending || !!checklist.closedAt;
                return (
                  <li
                    key={gate}
                    className={cn(
                      'flex items-center gap-3 rounded-md border p-3',
                      checked && 'border-emerald-200 bg-emerald-50/40',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        runWithToast(t, () =>
                          setGate.mutateAsync({
                            gate,
                            value: e.target.checked,
                          }),
                        )
                      }
                      disabled={disabled}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="font-medium">
                        {t(`closure.gates.${gate}`)}
                      </div>
                      {at && (
                        <div className="text-[11px] text-muted-foreground">
                          {at.slice(0, 10)}
                        </div>
                      )}
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        isFinance
                          ? 'bg-abak-gold/20 text-abak-gold'
                          : 'bg-abak-blue/10 text-abak-blue',
                      )}
                      title={
                        isFinance
                          ? t('closurePanel.roleHintFinance')
                          : t('closurePanel.roleHintPm')
                      }
                    >
                      {isFinance
                        ? t('closure.ownerFinance')
                        : t('closure.ownerPm')}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function gateField(gate: ClosureGate) {
  switch (gate) {
    case 'ALL_PHASES_COMPLETED':
      return 'allPhasesCompleted';
    case 'DELIVERABLES_SUBMITTED':
      return 'deliverablesSubmitted';
    case 'CLIENT_APPROVAL_RECEIVED':
      return 'clientApprovalReceived';
    case 'FINAL_PAYMENT_RECEIVED':
      return 'finalPaymentReceived';
    case 'FINANCE_CLEARANCE_ISSUED':
      return 'financeClearanceIssued';
  }
}
