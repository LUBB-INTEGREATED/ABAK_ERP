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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useCreateDepartment,
  useUpdateDepartment,
} from '@/lib/hooks/use-departments';
import { useAdminUsers } from '@/lib/hooks/use-admin-users';
import { extractApiError } from '@/lib/utils';
import type { Department, DeptType } from '@/lib/types/admin';

const DEPT_TYPES: DeptType[] = [
  'TECHNICAL',
  'SALES',
  'FINANCE',
  'HR',
  'EXECUTIVE',
  'SUPPORT',
];

type Props =
  | {
      mode: 'create';
      open: boolean;
      onOpenChange: (open: boolean) => void;
      department?: undefined;
      canManage?: undefined;
    }
  | {
      mode: 'edit';
      department: Department;
      canManage: boolean;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    };

export function DepartmentDialog(props: Props) {
  const { mode, open, onOpenChange } = props;
  const t = useTranslations('adminDepartments');
  const create = useCreateDepartment();
  const update = useUpdateDepartment();
  const { data: users } = useAdminUsers();

  const dept = mode === 'edit' ? props.department : undefined;
  const canManage = mode === 'edit' ? props.canManage : true;

  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [type, setType] = useState<DeptType>('TECHNICAL');
  const [order, setOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [managerId, setManagerId] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(dept?.name ?? '');
    setNameAr(dept?.nameAr ?? '');
    setType(dept?.type ?? 'TECHNICAL');
    setOrder(String(dept?.order ?? 0));
    setIsActive(dept?.isActive ?? true);
    setManagerId(dept?.managerId ?? '');
  }, [open, dept]);

  // The manager must be a member of this department.
  const eligibleManagers = (users ?? []).filter(
    (u) => dept && u.department?.id === dept.id,
  );

  async function submit() {
    try {
      if (mode === 'create' || !dept) {
        await create.mutateAsync({
          name: name.trim(),
          nameAr: nameAr.trim() || undefined,
          type,
          order: Number(order) || 0,
        });
      } else {
        await update.mutateAsync({
          id: dept.id,
          payload: {
            name: name.trim(),
            nameAr: nameAr.trim() || undefined,
            type,
            order: Number(order) || 0,
            isActive,
            managerId: managerId || null,
          },
        });
      }
      toast.success(t('savedSuccess'));
      onOpenChange(false);
    } catch (error) {
      toast.error(extractApiError(error, t('saveFailed')));
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? t('newDepartment') : t('editDepartment')}
          </DialogTitle>
          <DialogDescription>{t('formDescription')}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dept-name">{t('field.name')}</Label>
            <Input
              id="dept-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canManage}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dept-name-ar">{t('field.nameAr')}</Label>
            <Input
              id="dept-name-ar"
              dir="rtl"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              disabled={!canManage}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dept-type">{t('field.type')}</Label>
            <select
              id="dept-type"
              value={type}
              onChange={(e) => setType(e.target.value as DeptType)}
              className="input-base w-full"
              disabled={!canManage}
            >
              {DEPT_TYPES.map((tp) => (
                <option key={tp} value={tp}>
                  {t(`type.${tp}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dept-order">{t('field.order')}</Label>
            <Input
              id="dept-order"
              type="number"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              disabled={!canManage}
            />
          </div>

          {mode === 'edit' && (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="dept-manager">{t('field.manager')}</Label>
              <select
                id="dept-manager"
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="input-base w-full"
                disabled={!canManage}
              >
                <option value="">{t('field.noManager')}</option>
                {eligibleManagers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {[u.firstName, u.lastName].filter(Boolean).join(' ') ||
                      u.email}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {t('field.managerHint')}
              </p>
            </div>
          )}
        </div>

        {mode === 'edit' && (
          <label
            htmlFor="dept-active"
            className="flex items-center gap-2 text-sm"
          >
            <Checkbox
              id="dept-active"
              checked={isActive}
              onCheckedChange={(v) => setIsActive(v === true)}
              disabled={!canManage}
            />
            {t('field.active')}
          </label>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {canManage ? t('cancel') : t('close')}
          </Button>
          {canManage && (
            <Button
              onClick={submit}
              disabled={name.trim().length < 2 || pending}
            >
              {pending ? t('saving') : t('save')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
