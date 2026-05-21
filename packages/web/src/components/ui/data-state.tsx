'use client';

import type { ReactNode } from 'react';
import {
  EmptyState,
  ErrorState,
  type EmptyStateProps,
  type ErrorStateProps,
} from './state-blocks';
import { TableSkeleton } from './skeleton-layouts';

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
  if (isError) {
    return <ErrorState onRetry={onRetry} {...errorState} />;
  }
  if (isEmpty) {
    const content = hasFilters ? (emptyFiltered ?? empty) : empty;
    return <EmptyState {...content} />;
  }
  return <>{children}</>;
}
