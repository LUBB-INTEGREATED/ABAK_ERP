'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAdminUsers } from '@/lib/hooks/use-admin-users';
import { usePermissions } from '@/lib/hooks/use-permissions';
import type { AdminUser, UserStatus } from '@/lib/types/admin';
import { CreateEmployeeDialog } from './create-employee-dialog';
import { EditEmployeeDialog } from './edit-employee-dialog';

const STATUS_TONE: Record<UserStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  INACTIVE: 'bg-gray-100 text-gray-600',
  SUSPENDED: 'bg-red-100 text-red-700',
};

export default function EmployeesPage() {
  const t = useTranslations('adminEmployees');
  const locale = useLocale();
  const { data: users, isLoading } = useAdminUsers();
  const { can } = usePermissions();
  const canManage = can('users:manage');

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const sorted = useMemo(
    () =>
      [...(users ?? [])].sort((a, b) => fullName(a).localeCompare(fullName(b))),
    [users],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-abak-blue">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t('addEmployee')}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">{t('loading')}</div>
      ) : sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t('empty')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('col.name')}</TableHead>
                <TableHead>{t('col.department')}</TableHead>
                <TableHead>{t('col.roles')}</TableHead>
                <TableHead>{t('col.status')}</TableHead>
                <TableHead className="text-end">{t('col.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium text-dark-text">
                      {fullName(u) || u.email}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {u.email}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {u.department
                      ? locale === 'ar'
                        ? (u.department.nameAr ?? u.department.name)
                        : u.department.name
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {t('noRoles')}
                        </span>
                      ) : (
                        u.roles.map((r) => (
                          <Badge key={r.id} variant="secondary">
                            {locale === 'ar' ? (r.nameAr ?? r.name) : r.name}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[u.status]}`}
                    >
                      {t(`status.${u.status}`)}
                    </span>
                  </TableCell>
                  <TableCell className="text-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(u)}
                    >
                      {canManage ? t('manage') : t('view')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateEmployeeDialog open={createOpen} onOpenChange={setCreateOpen} />
      {editing && (
        <EditEmployeeDialog
          user={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          canManage={canManage}
        />
      )}
    </div>
  );
}

function fullName(u: AdminUser) {
  return [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
}
