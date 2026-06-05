'use client';

import { useState } from 'react';
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
import { useDepartments } from '@/lib/hooks/use-departments';
import { usePermissions } from '@/lib/hooks/use-permissions';
import type { Department } from '@/lib/types/admin';
import { DepartmentDialog } from './department-dialog';

export default function DepartmentsPage() {
  const t = useTranslations('adminDepartments');
  const locale = useLocale();
  const { data: departments, isLoading } = useDepartments();
  const { can } = usePermissions();
  const canManage = can('departments:manage');

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);

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
            {t('newDepartment')}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">{t('loading')}</div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('col.name')}</TableHead>
                <TableHead>{t('col.type')}</TableHead>
                <TableHead>{t('col.manager')}</TableHead>
                <TableHead className="text-center">
                  {t('col.members')}
                </TableHead>
                <TableHead>{t('col.status')}</TableHead>
                <TableHead className="text-end">{t('col.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(departments ?? []).map((d) => (
                <TableRow key={d.id} className={d.isActive ? '' : 'opacity-60'}>
                  <TableCell>
                    <div className="font-medium text-dark-text">
                      {locale === 'ar' ? (d.nameAr ?? d.name) : d.name}
                    </div>
                    {d.nameAr && locale !== 'ar' && (
                      <div className="text-xs text-muted-foreground" dir="rtl">
                        {d.nameAr}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {t(`type.${d.type}`)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {d.manager
                      ? [d.manager.firstName, d.manager.lastName]
                          .filter(Boolean)
                          .join(' ') || d.manager.email
                      : '—'}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {d.memberCount}
                  </TableCell>
                  <TableCell>
                    <Badge variant={d.isActive ? 'default' : 'secondary'}>
                      {d.isActive ? t('active') : t('inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(d)}
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

      <DepartmentDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      {editing && (
        <DepartmentDialog
          mode="edit"
          department={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          canManage={canManage}
        />
      )}
    </div>
  );
}
