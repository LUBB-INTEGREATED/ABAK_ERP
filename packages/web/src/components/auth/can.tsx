'use client';

import type { ReactNode } from 'react';
import { useAuthStore } from '@/lib/auth';
import { usePermissions } from '@/lib/hooks/use-permissions';

/**
 * Action-level permission gating (FE-2).
 *
 * `<Can permission="clients:create">` renders its children only when the current
 * user holds the permission — used to hide create / edit / approve / assign
 * controls from users who can't perform the action (a read-only VIEWER must see
 * no "عميل جديد" / "مشروع جديد" button, no working create form). The API still
 * rejects the write; this removes the misleading affordance.
 *
 *   - SUPER_ADMIN passes every check (matches sidebar + route guard).
 *   - Pass `permission` for a single key, or `anyOf` for "holds any of".
 *   - `fallback` renders when denied (default: nothing).
 *
 * `useCan()` is the imperative form for disabling submit buttons / branching.
 */
const SUPERUSER_ROLES = new Set(['SUPER_ADMIN']);

export function useCan() {
  const user = useAuthStore((state) => state.user);
  const { can, canAny, isLoading } = usePermissions();
  const isSuperuser = !!user && SUPERUSER_ROLES.has(user.role);
  return {
    isLoading,
    can: (key: string) => isSuperuser || can(key),
    canAny: (keys: string[]) => isSuperuser || canAny(keys),
  };
}

export function Can({
  permission,
  anyOf,
  children,
  fallback = null,
}: {
  /** A single permission key. */
  permission?: string;
  /** Or an "any of these" list (e.g. view OR manage). */
  anyOf?: string[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { canAny } = useCan();
  const keys = anyOf ?? (permission ? [permission] : []);
  const allowed = keys.length === 0 ? true : canAny(keys);
  return <>{allowed ? children : fallback}</>;
}
