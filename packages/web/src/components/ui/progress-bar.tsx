import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number; // 0-100
  variant?: 'default' | 'muted' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const VARIANT_FILL: Record<NonNullable<ProgressBarProps['variant']>, string> = {
  default: 'bg-abak-blue',
  muted: 'bg-zinc-400',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
};

const SIZE_HEIGHT: Record<NonNullable<ProgressBarProps['size']>, string> = {
  sm: 'h-1',
  md: 'h-1.5',
  lg: 'h-2',
};

export function ProgressBar({
  value,
  variant = 'default',
  size = 'md',
  showLabel,
  className,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'flex-1 overflow-hidden rounded-full bg-zinc-100',
          SIZE_HEIGHT[size],
        )}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all',
            VARIANT_FILL[variant],
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="min-w-[3ch] text-xs font-medium tabular-nums text-muted-foreground">
          {clamped.toFixed(0)}%
        </span>
      )}
    </div>
  );
}
