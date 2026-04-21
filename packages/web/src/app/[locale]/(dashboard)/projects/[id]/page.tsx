'use client';

import { use, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useAdjustPhaseProgress,
  useCompletePhase,
  useInitiateClosure,
  useProject,
  useSetClosureGate,
  useTransitionTaskStatus,
} from '@/lib/hooks/use-projects';
import type {
  ClosureGate,
  Phase,
  ProjectStatus,
  Task,
  TaskStatus,
} from '@/lib/types/project';

const STATUS_BADGE: Record<ProjectStatus, string> = {
  PLANNING: 'bg-slate-200 text-slate-800',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  ON_HOLD: 'bg-amber-100 text-amber-800',
  AT_RISK: 'bg-rose-100 text-rose-800',
  CLOSING: 'bg-indigo-100 text-indigo-800',
  CLOSED: 'bg-zinc-200 text-zinc-700',
  CANCELLED: 'bg-zinc-400 text-white',
};

const GATES: ClosureGate[] = [
  'ALL_PHASES_COMPLETED',
  'DELIVERABLES_SUBMITTED',
  'CLIENT_APPROVAL_RECEIVED',
  'FINAL_PAYMENT_RECEIVED',
  'FINANCE_CLEARANCE_ISSUED',
];

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations();
  const { data: project, isLoading } = useProject(id);

  if (isLoading || !project) {
    return (
      <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-bold text-abak-blue">
            {project.projectNumber}
          </h1>
          <span
            className={`rounded-full px-3 py-0.5 text-xs font-medium ${STATUS_BADGE[project.status]}`}
          >
            {t(`project.status.${project.status}`)}
          </span>
          {project.financialRiskFlagged && (
            <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs text-white">
              ⚠ Risk
            </span>
          )}
        </div>
        <h2 className="mt-1 text-lg font-semibold">{project.title}</h2>
        <p className="text-sm text-muted-foreground">
          {project.client.companyName ?? project.client.contactName} ·{' '}
          {`${project.pm.firstName ?? ''} ${project.pm.lastName ?? ''}`.trim()}
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            {t('project.tabs.overview')}
          </TabsTrigger>
          <TabsTrigger value="phases">{t('project.tabs.phases')}</TabsTrigger>
          <TabsTrigger value="closure">{t('project.tabs.closure')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('project.tabs.overview')}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 text-sm">
              <Info
                label={t('project.po')}
                value={`${project.po.poNumber} · ${project.po.contractValue.toLocaleString()} ${t('units.sar')}`}
              />
              <Info
                label={t('project.contractValue')}
                value={`${project.contractValue.toLocaleString()} ${t('units.sar')}`}
              />
              <Info
                label={t('project.startDate')}
                value={project.startDate ?? '—'}
              />
              <Info
                label={t('project.expectedEnd')}
                value={project.expectedEndDate ?? '—'}
              />
              <Info
                label={t('project.actualEnd')}
                value={project.actualEndDate ?? '—'}
              />
              <Info
                label={t('project.plannedProgress')}
                value={`${project.plannedProgress.toFixed(1)}%`}
              />
              <Info
                label={t('project.actualProgress')}
                value={`${project.actualProgress.toFixed(1)}%`}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="phases" className="space-y-3">
          {project.phases.length === 0 && (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                {t('phase.nothingHere')}
              </CardContent>
            </Card>
          )}
          {project.phases.map((phase) => (
            <PhaseCard key={phase.id} projectId={id} phase={phase} />
          ))}
        </TabsContent>

        <TabsContent value="closure">
          <ClosurePanel projectId={id} project={project} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PhaseCard({ projectId, phase }: { projectId: string; phase: Phase }) {
  const t = useTranslations();
  const completeMutation = useCompletePhase(projectId);
  const adjustMutation = useAdjustPhaseProgress(projectId);
  const taskTransition = useTransitionTaskStatus(projectId);

  const [evidenceNote, setEvidenceNote] = useState('');
  const [clientAck, setClientAck] = useState('');
  const [adjustPct, setAdjustPct] = useState<number>(phase.progressPct);
  const [adjustReason, setAdjustReason] = useState('');

  async function onComplete() {
    try {
      await completeMutation.mutateAsync({
        phaseId: phase.id,
        evidenceNote: evidenceNote || undefined,
        clientAcknowledgedAt: clientAck
          ? new Date(clientAck).toISOString()
          : undefined,
      });
      toast.success(t('common.success'));
      setEvidenceNote('');
      setClientAck('');
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? t('errors.generic');
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  }

  async function onAdjust() {
    try {
      await adjustMutation.mutateAsync({
        phaseId: phase.id,
        progressPct: adjustPct,
        reason: adjustReason,
      });
      toast.success(t('common.success'));
      setAdjustReason('');
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? t('errors.generic');
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  }

  async function onTaskTransition(taskId: string, status: TaskStatus) {
    try {
      await taskTransition.mutateAsync({ taskId, status });
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? t('errors.generic');
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">
            {t(`phase.code.${phase.phaseCode}`)} · {phase.name}
          </CardTitle>
          <div className="mt-1 text-xs text-muted-foreground">
            {t('phase.owner')}:{' '}
            {`${phase.owner.firstName ?? ''} ${phase.owner.lastName ?? ''}`.trim()}{' '}
            · {t('phase.plannedStart')}: {phase.plannedStart.slice(0, 10)} ·{' '}
            {t('phase.plannedEnd')}: {phase.plannedEnd.slice(0, 10)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border px-2 py-0.5 text-xs">
            {t(`phase.status.${phase.status}`)}
          </span>
          <span className="rounded-full border px-2 py-0.5 text-xs">
            {phase.progressPct.toFixed(1)}%
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {phase.tasks.length === 0 ? (
          <div className="text-sm text-muted-foreground">—</div>
        ) : (
          <div className="space-y-1">
            {phase.tasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
              >
                <div>
                  <div className="font-medium">{task.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t(`task.status.${task.status}`)} ·{' '}
                    {t(`task.priority.${task.priority}`)}
                    {task.assignee &&
                      ` · ${task.assignee.firstName ?? ''} ${task.assignee.lastName ?? ''}`.trim()}
                  </div>
                </div>
                <TaskActions task={task} onTransition={onTaskTransition} />
              </div>
            ))}
          </div>
        )}

        {phase.status !== 'COMPLETED' && (
          <div className="rounded-md border bg-muted/40 p-3 space-y-2">
            <div className="font-medium text-sm">{t('phase.markComplete')}</div>
            <div className="text-xs text-muted-foreground">
              {t('phase.evidenceHint')}
            </div>
            <textarea
              rows={2}
              value={evidenceNote}
              onChange={(e) => setEvidenceNote(e.target.value)}
              placeholder={t('phase.evidenceNote')}
              className="input-base"
            />
            <input
              type="date"
              value={clientAck}
              onChange={(e) => setClientAck(e.target.value)}
              className="input-base max-w-xs"
            />
            <Button
              size="sm"
              onClick={onComplete}
              disabled={completeMutation.isPending}
            >
              {t('phase.markComplete')}
            </Button>
          </div>
        )}

        <div className="rounded-md border p-3 space-y-2">
          <div className="font-medium text-sm">{t('phase.adjustProgress')}</div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              value={adjustPct}
              onChange={(e) => setAdjustPct(Number(e.target.value))}
              className="input-base w-24"
            />
            <input
              type="text"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder={t('phase.adjustReason')}
              className="input-base flex-1 min-w-[200px]"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={onAdjust}
              disabled={adjustMutation.isPending || !adjustReason.trim()}
            >
              {t('common.save')}
            </Button>
          </div>
          {phase.pmAdjustmentNote && (
            <div className="text-xs text-muted-foreground">
              {phase.pmAdjustmentNote}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TaskActions({
  task,
  onTransition,
}: {
  task: Task;
  onTransition: (taskId: string, status: TaskStatus) => void;
}) {
  const t = useTranslations();
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
  if (nextStatuses.length === 0) return null;
  return (
    <div className="flex gap-1">
      {nextStatuses.map((s) => (
        <Button
          key={s}
          size="sm"
          variant="outline"
          onClick={() => onTransition(task.id, s)}
        >
          → {t(`task.status.${s}`)}
        </Button>
      ))}
    </div>
  );
}

function ClosurePanel({
  projectId,
  project,
}: {
  projectId: string;
  project: import('@/lib/types/project').ProjectDetail;
}) {
  const t = useTranslations();
  const initiate = useInitiateClosure(projectId);
  const setGate = useSetClosureGate(projectId);

  async function onInit() {
    try {
      await initiate.mutateAsync();
      toast.success(t('common.success'));
    } catch {
      toast.error(t('errors.generic'));
    }
  }

  async function onFlip(gate: ClosureGate, value: boolean) {
    try {
      await setGate.mutateAsync({ gate, value });
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? t('errors.generic');
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  }

  const checklist = project.closureChecklist;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('closure.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('closure.subtitle')}</p>

        {!checklist ? (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              {t('closure.notInitiated')}
            </div>
            <Button onClick={onInit} disabled={initiate.isPending}>
              {t('closure.initiate')}
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {GATES.map((gate) => {
              const field = gateField(gate);
              const checked = (checklist as unknown as Record<string, boolean>)[
                field
              ];
              const isFinanceGate =
                gate === 'FINAL_PAYMENT_RECEIVED' ||
                gate === 'FINANCE_CLEARANCE_ISSUED';
              return (
                <label
                  key={gate}
                  className="flex items-center gap-3 py-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onFlip(gate, e.target.checked)}
                    disabled={setGate.isPending || !!checklist.closedAt}
                    className="h-4 w-4"
                  />
                  <span className="flex-1">{t(`closure.gates.${gate}`)}</span>
                  <span className="text-xs text-muted-foreground">
                    {isFinanceGate
                      ? t('closure.ownerFinance')
                      : t('closure.ownerPm')}
                  </span>
                </label>
              );
            })}
            {checklist.closedAt && (
              <div className="pt-3 text-sm text-emerald-700">
                ✓ {t('closure.closedAt')}: {checklist.closedAt.slice(0, 10)}
              </div>
            )}
          </div>
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

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}
