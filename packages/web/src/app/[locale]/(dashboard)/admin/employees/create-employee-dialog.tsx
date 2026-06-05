'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
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
import { useCreateUser } from '@/lib/hooks/use-admin-users';
import { useRoles } from '@/lib/hooks/use-roles';
import { useDepartments } from '@/lib/hooks/use-departments';
import { extractApiError } from '@/lib/utils';

export function CreateEmployeeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('adminEmployees');
  const locale = useLocale();
  const create = useCreateUser();
  const { data: roles } = useRoles();
  const { data: departments } = useDepartments();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);

  function reset() {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setDepartmentId('');
    setRoleIds([]);
  }

  function toggleRole(id: string) {
    setRoleIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  }

  async function submit() {
    try {
      await create.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        departmentId: departmentId || undefined,
        roleIds: roleIds.length ? roleIds : undefined,
      });
      toast.success(t('createdSuccess'));
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(extractApiError(error, t('saveFailed')));
    }
  }

  const valid =
    firstName.trim() && lastName.trim() && email.trim() && password.length >= 8;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('addEmployee')}</DialogTitle>
          <DialogDescription>{t('createDescription')}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            id="firstName"
            label={t('field.firstName')}
            value={firstName}
            onChange={setFirstName}
          />
          <Field
            id="lastName"
            label={t('field.lastName')}
            value={lastName}
            onChange={setLastName}
          />
          <Field
            id="email"
            label={t('field.email')}
            type="email"
            value={email}
            onChange={setEmail}
          />
          <Field
            id="phone"
            label={t('field.phone')}
            value={phone}
            onChange={setPhone}
          />
          <Field
            id="password"
            label={t('field.password')}
            type="password"
            value={password}
            onChange={setPassword}
            hint={t('field.passwordHint')}
          />
          <div className="space-y-2">
            <Label htmlFor="department">{t('field.department')}</Label>
            <select
              id="department"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="input-base w-full"
            >
              <option value="">{t('field.noDepartment')}</option>
              {(departments ?? [])
                .filter((d) => d.isActive)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {locale === 'ar' ? (d.nameAr ?? d.name) : d.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('field.roles')}</Label>
          <div className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-2">
            {(roles ?? []).map((r) => (
              <label
                key={r.id}
                className="flex items-center gap-2 text-sm"
                htmlFor={`role-${r.id}`}
              >
                <Checkbox
                  id={`role-${r.id}`}
                  checked={roleIds.includes(r.id)}
                  onCheckedChange={() => toggleRole(r.id)}
                />
                <span>{locale === 'ar' ? (r.nameAr ?? r.name) : r.name}</span>
              </label>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={submit} disabled={!valid || create.isPending}>
            {create.isPending ? t('saving') : t('create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type ?? 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
