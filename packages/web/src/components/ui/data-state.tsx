'use client';

import type { ReactNode } from 'react';
import {
  EmptyState,
  ErrorState,
  type EmptyStateProps,
  type ErrorStateProps,
} from './state-blocks';
import { TableSkeleton } from './skeleton-layouts';
import { NoAccess } from '@/components/auth/no-access';
import { isForbiddenError } from '@/lib/api-client';

/**
 * DataState — the canonical 4-state wrapper for any data surface.
 * See DESIGN_SYSTEM_MASTER.md §8.
 *
 * The component enforces a few rules:
 *   - Loading shows a layout-matching skeleton (no center spinner).
 *   - Empty (first-run) and Empty (filtered) are visually + textually distinct.
 *   - Errors never blame the user; offer a Retry.
 *   - Until data lands, children are not rendered at all (no flicker).
 *
 * Typical usage:
 *
 *     <DataState
 *       isLoading={query.isLoading}
 *       isError={query.isError}
 *       isEmpty={data.length === 0}
 *       hasFilters={hasActiveFilters}
 *       onRetry={query.refetch}
 *       empty={{
 *         icon: Briefcase,
 *         title: t('client.empty'),
 *         description: t('client.emptyHint'),
 *         action: { label: t('client.createNew'), href: '/clients/new' },
 *       }}
 *       emptyFiltered={{
 *         title: t('common.noResults'),
 *         description: t('common.noResultsHint'),
 *         action: { label: t('common.clearFilters'), onClick: clearFilters },
 *       }}
 *     >
 *       <ClientsTable data={data} />
 *     </DataState>
 */
export interface DataStateProps {
  isLoading: boolean;
  isError?: boolean;
  isEmpty: boolean;
  /**
   * When true (or when `error` is an axios 403), the data call was forbidden —
   * render the no-access component ("ليس لديك صلاحية") instead of the error or a
   * misleading "no records yet" empty state (FE-4). Pass the React Query `error`
   * to let DataState auto-detect a 403 without the caller inspecting it.
   */
  forbidden?: boolean;
  /** React Query error object — auto-detects a 403 → no-access (FE-4/FE-5). */
  error?: unknown;
  /**
   * True when the user has any active filter — picks the `emptyFiltered`
   * slot instead of `empty`. Default false (treat as first-run empty).
   */
  hasFilters?: boolean;
  onRetry?: () => void;

  /** Loading slot. Defaults to a 5×6 table skeleton — pass your own if your layout isn't tabular. */
  loading?: ReactNode;
  /** Empty (first-run) slot — usually has a "Create first" CTA. */
  empty: EmptyStateProps;
  /** Empty (filtered) slot — usually has a "Clear filters" action and NO create CTA. */
  emptyFiltered?: EmptyStateProps;
  /** Error slot. Defaults to ErrorState with i18n copy + onRetry. */
  errorState?: ErrorStateProps;

  children: ReactNode;
}

export function DataState({
  isLoading,
  isError = false,
  isEmpty,
  forbidden = false,
  error,
  hasFilters = false,
  onRetry,
  loading,
  empty,
  emptyFiltered,
  errorState,
  children,
}: DataStateProps) {
  if (isLoading) {
    return <>{loading ?? <TableSkeleton />}</>;
  }
  // A 403 is a permission denial, not a load failure — surface no-access before
  // the generic error/empty states so the user is never told "no records yet"
  // or "we couldn't load this" when the truth is "you don't have access".
  if (forbidden || isForbiddenError(error)) {
    return <NoAccess variant="inline" />;
  }
  if (isError) {
    return <ErrorState onRetry={onRetry} {...errorState} />;
  }
  if (isEmpty) {
    const content = hasFilters ? (emptyFiltered ?? empty) : empty;
    return <EmptyState {...content} />;
  }
  return <>{children}</>;
}
