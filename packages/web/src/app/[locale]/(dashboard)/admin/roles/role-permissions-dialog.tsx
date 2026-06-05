'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  usePermissionCatalog,
  useSetRolePermissions,
} from '@/lib/hooks/use-roles';
import { extractApiError } from '@/lib/utils';
import type { PermissionScope, Role } from '@/lib/types/admin';

const SCOPES: PermissionScope[] = ['OWN', 'DEPARTMENT', 'ALL'];

export function RolePermissionsDialog({
  role,
  open,
  onOpenChange,
  canManage,
}: {
  role: Role;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
}) {
  const t = useTranslations('adminRoles');
  const { data: catalog, isLoading } = usePermissionCatalog();
  const save = useSetRolePermissions();

  // key -> granted scope. Absence = not granted.
  const [granted, setGranted] = useState<Map<string, PermissionScope>>(
    new Map(),
  );

  useEffect(() => {
    if (open) {
      setGranted(new Map(role.permissions.map((p) => [p.key, p.scope])));
    }
  }, [open, role]);

  function toggle(key: string) {
    setGranted((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        // New grants default to the widest scope; non-scopeable perms are
        // pinned to ALL server-side regardless.
        next.set(key, 'ALL');
      }
      return next;
    });
  }

  function setScope(key: string, scope: PermissionScope) {
    setGranted((prev) => {
      const next = new Map(prev);
      next.set(key, scope);
      return next;
    });
  }

  async function submit() {
    try {
      await save.mutateAsync({
        id: role.id,
        permissions: [...granted.entries()].map(([key, scope]) => ({
          key,
          scope,
        })),
      });
      toast.success(t('permissionsSaved'));
      onOpenChange(false);
    } catch (error) {
      toast.error(extractApiError(error, t('saveFailed')));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t('permissionsFor', { name: role.name })}</DialogTitle>
          <DialogDescription>
            {canManage ? t('permissionsHelp') : t('permissionsReadOnly')}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-6 max-h-[55vh] space-y-5 overflow-y-auto px-6">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">{t('loading')}</div>
          ) : (
            (catalog ?? []).map((group) => (
              <section key={group.module} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-abak-blue">
                  {t(`module.${group.module}`)}
                </h3>
                <div className="divide-y rounded-lg border">
                  {group.permissions.map((perm) => {
                    const isGranted = granted.has(perm.key);
                    const scope = granted.get(perm.key);
                    return (
                      <div
                        key={perm.key}
                        className="flex items-center justify-between gap-3 px-3 py-2"
                      >
                        <label
                          htmlFor={`perm-${perm.key}`}
                          className="flex min-w-0 flex-1 items-start gap-2"
                        >
                          <Checkbox
                            id={`perm-${perm.key}`}
                            checked={isGranted}
                            onCheckedChange={() => toggle(perm.key)}
                            disabled={!canManage}
                          />
                          <span className="min-w-0">
                            <span className="block text-sm">
                              {perm.description ?? perm.key}
                            </span>
                            <span className="block font-mono text-[11px] text-muted-foreground">
                              {perm.key}
                            </span>
                          </span>
                        </label>
                        {perm.scopeable && isGranted && (
                          <select
                            value={scope}
                            onChange={(e) =>
                              setScope(
                                perm.key,
                                e.target.value as PermissionScope,
                              )
                            }
                            className="input-base w-36 shrink-0"
                            disabled={!canManage}
                          >
                            {SCOPES.map((s) => (
                              <option key={s} value={s}>
                                {t(`scope.${s}`)}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {canManage ? t('cancel') : t('close')}
          </Button>
          {canManage && (
            <Button onClick={submit} disabled={save.isPending}>
              {save.isPending ? t('saving') : t('savePermissions')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
