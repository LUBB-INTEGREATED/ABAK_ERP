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
import { Textarea } from '@/components/ui/textarea';
import { useCreateRole, useUpdateRole } from '@/lib/hooks/use-roles';
import { extractApiError } from '@/lib/utils';
import type { Role } from '@/lib/types/admin';

export function RoleFormDialog({
  role,
  open,
  onOpenChange,
}: {
  role: Role | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('adminRoles');
  const create = useCreateRole();
  const update = useUpdateRole();
  const isEdit = !!role;

  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      setName(role?.name ?? '');
      setNameAr(role?.nameAr ?? '');
      setDescription(role?.description ?? '');
    }
  }, [open, role]);

  async function submit() {
    try {
      if (isEdit && role) {
        await update.mutateAsync({
          id: role.id,
          name: name.trim(),
          nameAr: nameAr.trim() || undefined,
          description: description.trim() || undefined,
        });
      } else {
        await create.mutateAsync({
          name: name.trim(),
          nameAr: nameAr.trim() || undefined,
          description: description.trim() || undefined,
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
          <DialogTitle>{isEdit ? t('rename') : t('newRole')}</DialogTitle>
          <DialogDescription>{t('formDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role-name">{t('field.name')}</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role-name-ar">{t('field.nameAr')}</Label>
            <Input
              id="role-name-ar"
              dir="rtl"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role-desc">{t('field.description')}</Label>
            <Textarea
              id="role-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={submit} disabled={name.trim().length < 2 || pending}>
            {pending ? t('saving') : t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
