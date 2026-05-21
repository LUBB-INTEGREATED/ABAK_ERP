/**
 * @deprecated Prefer <StatusBadge> + the typed entity wrappers in
 * '@/components/ui/entity-status-badges' (e.g. <ProjectStatusBadge>,
 * <PhaseStatusBadge>, <TaskStatusBadge>). See DESIGN_SYSTEM_MASTER.md §2.
 *
 * StatusPill and the 8-tone (Tone) system here predate the 5-token semantic
 * model. New code should not import from this file. Existing callers are
 * migrated incrementally — when this file has no remaining importers,
 * delete it along with the PROJECT_TONE / PHASE_TONE / TASK_TONE maps.
 */
import type {
  PhaseStatus,
  ProjectStatus,
  TaskStatus,
} from '@/lib/types/project';
import { cn } from '@/lib/utils';

type Tone =
  | 'slate'
  | 'sky'
  | 'indigo'
  | 'amber'
  | 'emerald'
  | 'rose'
  | 'zinc'
  | 'zinc-dark';

const TONE_CLASS: Record<Tone, { dot: string; text: string; bg: string }> = {
  slate: { dot: 'bg-slate-400', text: 'text-slate-800', bg: 'bg-slate-100' },
  sky: { dot: 'bg-sky-500', text: 'text-sky-800', bg: 'bg-sky-100' },
  indigo: {
    dot: 'bg-indigo-500',
    text: 'text-indigo-800',
    bg: 'bg-indigo-100',
  },
  amber: { dot: 'bg-amber-500', text: 'text-amber-900', bg: 'bg-amber-100' },
  emerald: {
    dot: 'bg-emerald-500',
    text: 'text-emerald-800',
    bg: 'bg-emerald-100',
  },
  rose: { dot: 'bg-rose-500', text: 'text-rose-800', bg: 'bg-rose-100' },
  zinc: { dot: 'bg-zinc-400', text: 'text-zinc-700', bg: 'bg-zinc-100' },
  'zinc-dark': {
    dot: 'bg-zinc-600',
    text: 'text-white',
    bg: 'bg-zinc-500',
  },
};

export const PROJECT_TONE: Record<ProjectStatus, Tone> = {
  PLANNING: 'slate',
  ACTIVE: 'emerald',
  ON_HOLD: 'amber',
  AT_RISK: 'rose',
  CLOSING: 'indigo',
  CLOSED: 'zinc',
  CANCELLED: 'zinc-dark',
};

export const PHASE_TONE: Record<PhaseStatus, Tone> = {
  NOT_STARTED: 'slate',
  IN_PROGRESS: 'sky',
  BLOCKED: 'rose',
  UNDER_REVIEW: 'amber',
  COMPLETED: 'emerald',
  SKIPPED: 'zinc',
};

export const TASK_TONE: Record<TaskStatus, Tone> = {
  NOT_STARTED: 'slate',
  IN_PROGRESS: 'sky',
  BLOCKED: 'rose',
  REVIEW: 'amber',
  DONE: 'emerald',
  CANCELLED: 'zinc',
};

interface StatusPillProps {
  tone: Tone;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusPill({
  tone,
  label,
  size = 'sm',
  className,
}: StatusPillProps) {
  const t = TONE_CLASS[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        t.bg,
        t.text,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', t.dot)} />
      {label}
    </span>
  );
}
