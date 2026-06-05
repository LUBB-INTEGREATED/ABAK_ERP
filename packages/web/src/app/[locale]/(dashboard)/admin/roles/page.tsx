'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Lock, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeleteRole, useRoles } from '@/lib/hooks/use-roles';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { extractApiError } from '@/lib/utils';
import type { Role } from '@/lib/types/admin';
import { RoleFormDialog } from './role-form-dialog';
import { RolePermissionsDialog } from './role-permissions-dialog';

export default function RolesPage() {
  const t = useTranslations('adminRoles');
  const locale = useLocale();
  const { data: roles, isLoading } = useRoles();
  const { can } = usePermissions();
  const canManage = can('roles:manage');
  const del = useDeleteRole();

  const [formRole, setFormRole] = useState<Role | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [permsRole, setPermsRole] = useState<Role | null>(null);

  async function remove(role: Role) {
    if (!window.confirm(t('confirmDelete', { name: role.name }))) return;
    try {
      await del.mutateAsync({ id: role.id });
      toast.success(t('deleted'));
    } catch (error) {
      toast.error(extractApiError(error, t('saveFailed')));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-abak-blue">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setFormRole(null);
              setFormOpen(true);
            }}
          >
            <Plus className="me-2 h-4 w-4" />
            {t('newRole')}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">{t('loading')}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(roles ?? []).map((role) => (
            <Card key={role.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">
                    {locale === 'ar' ? (role.nameAr ?? role.name) : role.name}
                  </CardTitle>
                  {role.isSystem ? (
                    <Badge variant="outline" className="shrink-0 gap-1">
                      <Lock className="h-3 w-3" />
                      {t('system')}
                    </Badge>
                  ) : null}
                </div>
                {role.description && (
                  <p className="text-xs text-muted-foreground">
                    {role.description}
                  </p>
                )}
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5">
                    <ShieldCheck className="h-3 w-3" />
                    {t('permissionCount', { count: role.permissions.length })}
                  </span>
                  <span className="rounded border px-1.5 py-0.5">
                    {t('memberCount', { count: role.assignmentCount })}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPermsRole(role)}
                  >
                    {canManage && !role.isSystem
                      ? t('editPermissions')
                      : t('viewPermissions')}
                  </Button>
                  {canManage && !role.isSystem && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFormRole(role);
                          setFormOpen(true);
                        }}
                      >
                        {t('rename')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => remove(role)}
                        disabled={role.assignmentCount > 0}
                        title={
                          role.assignmentCount > 0
                            ? t('deleteBlocked')
                            : undefined
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RoleFormDialog
        role={formRole}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
      {permsRole && (
        <RolePermissionsDialog
          role={permsRole}
          open={!!permsRole}
          onOpenChange={(o) => !o && setPermsRole(null)}
          canManage={canManage && !permsRole.isSystem}
        />
      )}
    </div>
  );
}
