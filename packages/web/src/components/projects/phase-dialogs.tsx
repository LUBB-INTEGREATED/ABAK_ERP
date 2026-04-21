'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useAddPhase,
  useAddTask,
  useAddDependency,
  useEligiblePms,
  useReassignPhaseOwner,
} from '@/lib/hooks/use-projects';
import type { Phase, PhaseCode, Task, TaskPriority } from '@/lib/types/project';

const PHASE_CODES: PhaseCode[] = [
  'INITIATION',
  'KICKOFF',
  'EXECUTION',
  'REVIEW',
  'SUBMISSION',
  'REVISIONS',
  'CLOSURE',
  'CUSTOM',
];

const PRIORITIES: TaskPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

async function runWithToast<T>(
  t: (k: string) => string,
  fn: () => Promise<T>,
  success = 'common.success',
) {
  try {
    const out = await fn();
    toast.success(t(success));
    return out;
  } catch (err) {
    const msg =
      (err as { response?: { data?: { message?: string | string[] } } })
        ?.response?.data?.message ?? t('errors.generic');
    toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    return null;
  }
}

// ─── Add Phase ──────────────────────────────────────────────────

export function AddPhaseDialog({
  open,
  onOpenChange,
  projectId,
  defaultOwnerId,
  defaultPosition,
  defaultStart,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  defaultOwnerId: string;
  defaultPosition: number;
  defaultStart: string;
}) {
  const t = useTranslations();
  const addPhase = useAddPhase(projectId);
  const { data: pms } = useEligiblePms(open);

  const [phaseCode, setPhaseCode] = useState<PhaseCode>('CUSTOM');
  const [name, setName] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [ownerId, setOwnerId] = useState(defaultOwnerId);
  const [plannedStart, setPlannedStart] = useState(defaultStart);
  const [plannedEnd, setPlannedEnd] = useState(() => {
    const d = new Date(defaultStart);
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [evidenceRequired, setEvidenceRequired] = useState(true);

  useEffect(() => {
    if (open) {
      setPhaseCode('CUSTOM');
      setName('');
      setCustomLabel('');
      setOwnerId(defaultOwnerId);
      setPlannedStart(defaultStart);
      const d = new Date(defaultStart);
      d.setDate(d.getDate() + 7);
      setPlannedEnd(d.toISOString().slice(0, 10));
      setEvidenceRequired(true);
    }
  }, [open, defaultOwnerId, defaultStart]);

  useEffect(() => {
    if (phaseCode !== 'CUSTOM' && !name) {
      setName(t(`phase.code.${phaseCode}`));
    }
  }, [phaseCode, name, t]);

  const canSubmit =
    name.trim().length >= 2 &&
    ownerId &&
    plannedStart &&
    plannedEnd &&
    new Date(plannedEnd) >= new Date(plannedStart);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('phase.addPhaseTitle')}</DialogTitle>
          <DialogDescription>
            {t('dialogs.addPhaseDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>{t('phase.code.CUSTOM')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {PHASE_CODES.map((code) => (
                <button
                  type="button"
                  key={code}
                  onClick={() => {
                    setPhaseCode(code);
                    if (code !== 'CUSTOM') setName(t(`phase.code.${code}`));
                  }}
                  className={
                    'rounded-full border px-2.5 py-1 text-xs transition-colors ' +
                    (phaseCode === code
                      ? 'border-abak-blue bg-abak-blue/10 text-abak-blue'
                      : 'border-border text-muted-foreground hover:bg-muted/50')
                  }
                >
                  {t(`phase.code.${code}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phase-name">{t('project.projectTitle')}</Label>
            <Input
              id="phase-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {phaseCode === 'CUSTOM' && (
            <div className="space-y-1.5">
              <Label htmlFor="custom-label">
                {t('phase.code.CUSTOM')} label
              </Label>
              <Input
                id="custom-label"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="owner">{t('phase.owner')}</Label>
            <select
              id="owner"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="input-base"
            >
              {pms?.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {`${pm.firstName ?? ''} ${pm.lastName ?? ''}`.trim() ||
                    pm.email}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-start">{t('phase.plannedStart')}</Label>
              <Input
                id="p-start"
                type="date"
                value={plannedStart}
                onChange={(e) => setPlannedStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-end">{t('phase.plannedEnd')}</Label>
              <Input
                id="p-end"
                type="date"
                value={plannedEnd}
                onChange={(e) => setPlannedEnd(e.target.value)}
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm">
            <Checkbox
              checked={evidenceRequired}
              onCheckedChange={(v) => setEvidenceRequired(v === true)}
            />
            <span>{t('phase.evidenceHint')}</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!canSubmit || addPhase.isPending}
            onClick={async () => {
              const ok = await runWithToast(t, () =>
                addPhase.mutateAsync({
                  name: name.trim(),
                  phaseCode,
                  customLabel:
                    phaseCode === 'CUSTOM' && customLabel.trim()
                      ? customLabel.trim()
                      : undefined,
                  position: defaultPosition,
                  ownerId,
                  plannedStart: new Date(plannedStart).toISOString(),
                  plannedEnd: new Date(plannedEnd).toISOString(),
                  evidenceRequired,
                }),
              );
              if (ok) onOpenChange(false);
            }}
          >
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Task ───────────────────────────────────────────────────

export function AddTaskDialog({
  open,
  onOpenChange,
  projectId,
  phase,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  phase: Phase;
}) {
  const t = useTranslations();
  const addTask = useAddTask(projectId);
  const { data: pms } = useEligiblePms(open);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [plannedStart, setPlannedStart] = useState('');
  const [plannedEnd, setPlannedEnd] = useState('');
  const [hours, setHours] = useState<string>('');

  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setAssigneeId('');
      setPriority('NORMAL');
      setPlannedStart('');
      setPlannedEnd('');
      setHours('');
    }
  }, [open]);

  const canSubmit = title.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('dialogs.addTaskTitle')}</DialogTitle>
          <DialogDescription>
            {t('dialogs.addTaskSubtitle', { phase: phase.name })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">{t('dialogs.taskTitleLabel')}</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('dialogs.taskTitlePlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-desc">{t('dialogs.taskDescription')}</Label>
            <Textarea
              id="task-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-assignee">{t('dialogs.taskAssignee')}</Label>
              <select
                id="task-assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="input-base"
              >
                <option value="">
                  {phase.owner.firstName ?? ''} {phase.owner.lastName ?? ''} (
                  {t('phase.owner')})
                </option>
                {pms?.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {`${pm.firstName ?? ''} ${pm.lastName ?? ''}`.trim() ||
                      pm.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-priority">{t('dialogs.taskPriority')}</Label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="input-base"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {t(`task.priority.${p}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-start">
                {t('dialogs.taskPlannedStart')}
              </Label>
              <Input
                id="task-start"
                type="date"
                value={plannedStart}
                onChange={(e) => setPlannedStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-end">{t('dialogs.taskPlannedEnd')}</Label>
              <Input
                id="task-end"
                type="date"
                value={plannedEnd}
                onChange={(e) => setPlannedEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-hours">
              {t('dialogs.taskEstimatedHours')}
            </Label>
            <Input
              id="task-hours"
              type="number"
              min={0}
              step={0.5}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="max-w-[10rem]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!canSubmit || addTask.isPending}
            onClick={async () => {
              const ok = await runWithToast(t, () =>
                addTask.mutateAsync({
                  phaseId: phase.id,
                  title: title.trim(),
                  description: description.trim() || undefined,
                  assigneeId: assigneeId || phase.ownerId,
                  priority,
                  plannedStart: plannedStart
                    ? new Date(plannedStart).toISOString()
                    : undefined,
                  plannedEnd: plannedEnd
                    ? new Date(plannedEnd).toISOString()
                    : undefined,
                  estimatedHours: hours ? Number(hours) : undefined,
                }),
              );
              if (ok) onOpenChange(false);
            }}
          >
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reassign Owner ─────────────────────────────────────────────

export function ReassignOwnerDialog({
  open,
  onOpenChange,
  projectId,
  phase,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  phase: Phase;
}) {
  const t = useTranslations();
  const reassign = useReassignPhaseOwner(projectId);
  const { data: pms } = useEligiblePms(open);

  const [ownerId, setOwnerId] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setOwnerId('');
      setReason('');
    }
  }, [open]);

  const canSubmit =
    ownerId.trim().length > 0 &&
    ownerId !== phase.ownerId &&
    reason.trim().length >= 10;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('dialogs.reassignOwnerTitle')}</DialogTitle>
          <DialogDescription>
            {t('dialogs.reassignOwnerSubtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="rounded-md border bg-muted/40 p-2 text-sm">
            <span className="text-muted-foreground">{t('phase.owner')}:</span>{' '}
            <span className="font-medium">
              {`${phase.owner.firstName ?? ''} ${phase.owner.lastName ?? ''}`.trim()}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-owner">
              {t('dialogs.reassignOwnerNewLabel')}
            </Label>
            <select
              id="new-owner"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="input-base"
            >
              <option value="">—</option>
              {pms
                ?.filter((pm) => pm.id !== phase.ownerId)
                .map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {`${pm.firstName ?? ''} ${pm.lastName ?? ''}`.trim() ||
                      pm.email}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">
              {t('dialogs.reassignOwnerReasonLabel')}
            </Label>
            <Textarea
              id="reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              {t('dialogs.reassignOwnerReasonHint')}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!canSubmit || reassign.isPending}
            onClick={async () => {
              const ok = await runWithToast(t, () =>
                reassign.mutateAsync({
                  phaseId: phase.id,
                  ownerId,
                  reason: reason.trim(),
                }),
              );
              if (ok) onOpenChange(false);
            }}
          >
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Dependency ─────────────────────────────────────────────

export function AddDependencyDialog({
  open,
  onOpenChange,
  projectId,
  task,
  candidates,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  task: Task;
  candidates: Task[]; // all tasks in the project minus self + existing blockers
}) {
  const t = useTranslations();
  const addDep = useAddDependency(projectId);

  const [blockerTaskId, setBlockerTaskId] = useState('');

  useEffect(() => {
    if (open) setBlockerTaskId('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('dialogs.addDependencyTitle')}</DialogTitle>
          <DialogDescription>
            {t('dialogs.addDependencySubtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="rounded-md border bg-muted/40 p-2 text-sm">
            <span className="text-muted-foreground">
              {t('dialogs.taskTitleLabel')}:
            </span>{' '}
            <span className="font-medium">{task.title}</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="blocker">{t('dialogs.addDependencyBlocker')}</Label>
            <select
              id="blocker"
              value={blockerTaskId}
              onChange={(e) => setBlockerTaskId(e.target.value)}
              className="input-base"
            >
              <option value="">—</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} — {t(`task.status.${c.status}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!blockerTaskId || addDep.isPending}
            onClick={async () => {
              const ok = await runWithToast(t, () =>
                addDep.mutateAsync({
                  taskId: task.id,
                  blockerTaskId,
                }),
              );
              if (ok) onOpenChange(false);
            }}
          >
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
