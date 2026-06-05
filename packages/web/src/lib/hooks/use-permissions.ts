'use client';

import { useMemo } from 'react';
import { useMyProfile } from './use-profile';
import type { PermissionScope } from '@/lib/types/profile';

/**
 * Effective-permission gating for the web client. Reads the same /users/me
 * payload as the profile screen (cached by React Query), so it is cheap to
 * call from many components. `can(key)` answers "does the current user hold
 * this permission at all"; `scopeFor(key)` returns the widest granted scope.
 *
 * This is UI affordance only — the API independently enforces every action.
 */
export function usePermissions() {
  const { data, isLoading } = useMyProfile();

  return useMemo(() => {
    const map = new Map<string, PermissionScope>(
      (data?.permissions ?? []).map((p) => [p.key, p.scope]),
    );
    return {
      isLoading,
      permissions: map,
      can: (key: string) => map.has(key),
      canAny: (keys: string[]) => keys.some((k) => map.has(k)),
      scopeFor: (key: string): PermissionScope | null => map.get(key) ?? null,
    };
  }, [data, isLoading]);
}
