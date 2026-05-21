import { Skeleton } from './skeleton';
import { cn } from '@/lib/utils';

/**
 * Layout-matching skeletons for the default DataState.loading slot.
 *
 * The point per MASTER §8 is "skeleton rows = same height and column structure
 * so layout doesn't jump." A generic spinner in the middle of the page fails
 * that test because the data renders 200ms later in a totally different shape.
 *
 * Use these directly, or pass a custom skeleton to <DataState loading={…} />.
 */

export interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  showHeader?: boolean;
  className?: string;
}

export function TableSkeleton({
  rows = 5,
  cols = 6,
  showHeader = true,
  className,
}: TableSkeletonProps) {
  return (
    <div className={cn('w-full overflow-hidden rounded-md border', className)}>
      <table className="w-full">
        {showHeader && (
          <thead>
            <tr className="border-b bg-muted/40">
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-3 py-2">
                  <Skeleton className="h-3 w-20" />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="border-b last:border-0">
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} className="px-3 py-3">
                  <Skeleton
                    className={cn(
                      'h-3.5',
                      c === 0 ? 'w-24' : c === cols - 1 ? 'w-12' : 'w-32',
                    )}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface ListSkeletonProps {
  rows?: number;
  className?: string;
}

export function ListSkeleton({ rows = 4, className }: ListSkeletonProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border bg-white p-3"
        >
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

export interface CardGridSkeletonProps {
  count?: number;
  /** Tailwind `md:grid-cols-N` value. Defaults to 3. */
  cols?: 2 | 3 | 4;
  className?: string;
}

export function CardGridSkeleton({
  count = 6,
  cols = 3,
  className,
}: CardGridSkeletonProps) {
  const gridCols =
    cols === 2
      ? 'md:grid-cols-2'
      : cols === 4
        ? 'md:grid-cols-4'
        : 'md:grid-cols-3';
  return (
    <div className={cn('grid gap-3', gridCols, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-white p-4 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

/**
 * For detail pages — a tall card-style skeleton matching the typical
 * hero + tabs + content layout (e.g. clients/[id], quotes/[id]).
 */
export function DetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      <Skeleton className="h-28 w-full rounded-lg" />
      <Skeleton className="h-10 w-72 rounded-md" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
