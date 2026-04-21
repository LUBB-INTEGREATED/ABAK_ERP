import { cn } from '@/lib/utils';

interface DateChipProps {
  plannedEnd: string;
  status?:
    | 'NOT_STARTED'
    | 'IN_PROGRESS'
    | 'BLOCKED'
    | 'UNDER_REVIEW'
    | 'COMPLETED'
    | 'SKIPPED';
  labels: {
    overdueBy: (days: number) => string;
    daysLeft: (days: number) => string;
    dueToday: string;
    completed: string;
  };
}

// Shows "N days left" / "overdue by N" / "due today" with sensible colors.
export function DateChip({ plannedEnd, status, labels }: DateChipProps) {
  if (status === 'COMPLETED' || status === 'SKIPPED') {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
        {labels.completed}
      </span>
    );
  }
  const end = new Date(plannedEnd);
  const now = new Date();
  const ms = end.getTime() - now.setHours(0, 0, 0, 0);
  const days = Math.round(ms / 86_400_000);
  let tone = 'border-sky-200 bg-sky-50 text-sky-700';
  let text: string;
  if (days < 0) {
    tone = 'border-rose-200 bg-rose-50 text-rose-700';
    text = labels.overdueBy(Math.abs(days));
  } else if (days === 0) {
    tone = 'border-amber-200 bg-amber-50 text-amber-800';
    text = labels.dueToday;
  } else if (days <= 3) {
    tone = 'border-amber-200 bg-amber-50 text-amber-800';
    text = labels.daysLeft(days);
  } else {
    text = labels.daysLeft(days);
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        tone,
      )}
    >
      {text}
    </span>
  );
}
