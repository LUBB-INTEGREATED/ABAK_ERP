'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useResetUserPassword,
  useSetUserRoles,
  useUpdateUser,
} from '@/lib/hooks/use-admin-users';
import { useRoles } from '@/lib/hooks/use-roles';
import { useDepartments } from '@/lib/hooks/use-departments';
import { extractApiError } from '@/lib/utils';
import type { AdminUser, LegacyRole, UserStatus } from '@/lib/types/admin';

const STATUSES: UserStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
const LEGACY_ROLES: LegacyRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'SALES_MANAGER',
  'SALES_REPRESENTATIVE',
  'TECHNICAL_MANAGER',
  'FINANCE_MANAGER',
  'PRO',
  'VIEWER',
];

export function EditEmployeeDialog({
  user,
  open,
  onOpenChange,
  canManage,
}: {
  user: AdminUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
}) {
  const t = useTranslations('adminEmployees');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {[user.firstName, user.lastName].filter(Boolean).join(' ') ||
              user.email}
          </DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile">
          <TabsList className="w-full">
            <TabsTrigger value="profile" className="flex-1">
              {t('tab.profile')}
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex-1">
              {t('tab.roles')}
            </TabsTrigger>
            <TabsTrigger value="security" className="flex-1">
              {t('tab.security')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileTab
              user={user}
              canManage={canManage}
              onDone={() => onOpenChange(false)}
            />
          </TabsContent>
          <TabsContent value="roles">
            <RolesTab user={user} canManage={canManage} />
          </TabsContent>
          <TabsContent value="security">
            <SecurityTab user={user} canManage={canManage} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ProfileTab({
  user,
  canManage,
  onDone,
}: {
  user: AdminUser;
  canManage: boolean;
  onDone: () => void;
}) {
  const t = useTranslations('adminEmployees');
  const locale = useLocale();
  const update = useUpdateUser();
  const { data: departments } = useDepartments();

  const [firstName, setFirstName] = useState(user.firstName ?? '');
  const [lastName, setLastName] = useState(user.lastName ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [status, setStatus] = useState<UserStatus>(user.status);
  const [legacyRole, setLegacyRole] = useState<LegacyRole>(user.role);
  const [departmentId, setDepartmentId] = useState(user.department?.id ?? '');

  async function save() {
    try {
      await update.mutateAsync({
        id: user.id,
        payload: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          status,
          legacyRole,
          departmentId: departmentId || null,
        },
      });
      toast.success(t('savedSuccess'));
      onDone();
    } catch (error) {
      toast.error(extractApiError(error, t('saveFailed')));
    }
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          id="firstName"
          label={t('field.firstName')}
          value={firstName}
          onChange={setFirstName}
          disabled={!canManage}
        />
        <Field
          id="lastName"
          label={t('field.lastName')}
          value={lastName}
          onChange={setLastName}
          disabled={!canManage}
        />
        <Field
          id="phone"
          label={t('field.phone')}
          value={phone}
          onChange={setPhone}
          disabled={!canManage}
        />
        <div className="space-y-2">
          <Label htmlFor="status">{t('field.status')}</Label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as UserStatus)}
            className="input-base w-full"
            disabled={!canManage}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="department">{t('field.department')}</Label>
          <select
            id="department"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="input-base w-full"
            disabled={!canManage}
          >
            <option value="">{t('field.noDepartment')}</option>
            {(departments ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {locale === 'ar' ? (d.nameAr ?? d.name) : d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="legacyRole">{t('field.legacyRole')}</Label>
          <select
            id="legacyRole"
            value={legacyRole}
            onChange={(e) => setLegacyRole(e.target.value as LegacyRole)}
            className="input-base w-full"
            disabled={!canManage}
          >
            {LEGACY_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            {t('field.legacyRoleHint')}
          </p>
        </div>
      </div>

      {canManage && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? t('saving') : t('save')}
          </Button>
        </div>
      )}
    </div>
  );
}

function RolesTab({
  user,
  canManage,
}: {
  user: AdminUser;
  canManage: boolean;
}) {
  const t = useTranslations('adminEmployees');
  const locale = useLocale();
  const { data: roles } = useRoles();
  const setRoles = useSetUserRoles();
  const [roleIds, setRoleIds] = useState<string[]>(user.roles.map((r) => r.id));

  function toggle(id: string) {
    setRoleIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  }

  async function save() {
    try {
      await setRoles.mutateAsync({ id: user.id, roleIds });
      toast.success(t('rolesSaved'));
    } catch (error) {
      toast.error(extractApiError(error, t('saveFailed')));
    }
  }

  return (
    <div className="space-y-4 pt-4">
      <p className="text-sm text-muted-foreground">{t('rolesHelp')}</p>
      <div className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-2">
        {(roles ?? []).map((r) => (
          <label
            key={r.id}
            htmlFor={`edit-role-${r.id}`}
            className="flex items-start gap-2 text-sm"
          >
            <Checkbox
              id={`edit-role-${r.id}`}
              checked={roleIds.includes(r.id)}
              onCheckedChange={() => toggle(r.id)}
              disabled={!canManage}
            />
            <span>
              <span className="font-medium">
                {locale === 'ar' ? (r.nameAr ?? r.name) : r.name}
              </span>
              {r.description && (
                <span className="block text-xs text-muted-foreground">
                  {r.description}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={setRoles.isPending}>
            {setRoles.isPending ? t('saving') : t('saveRoles')}
          </Button>
        </div>
      )}
    </div>
  );
}

function SecurityTab({
  user,
  canManage,
}: {
  user: AdminUser;
  canManage: boolean;
}) {
  const t = useTranslations('adminEmployees');
  const reset = useResetUserPassword();
  const [password, setPassword] = useState('');

  async function submit() {
    try {
      await reset.mutateAsync({ id: user.id, password });
      setPassword('');
      toast.success(t('passwordReset'));
    } catch (error) {
      toast.error(extractApiError(error, t('saveFailed')));
    }
  }

  if (!canManage) {
    return (
      <p className="pt-4 text-sm text-muted-foreground">{t('noManageHint')}</p>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      <p className="text-sm text-muted-foreground">{t('resetPasswordHelp')}</p>
      <Field
        id="newPassword"
        label={t('field.newPassword')}
        type="password"
        value={password}
        onChange={setPassword}
        hint={t('field.passwordHint')}
      />
      <div className="flex justify-end">
        <Button
          onClick={submit}
          disabled={password.length < 8 || reset.isPending}
        >
          {reset.isPending ? t('saving') : t('resetPassword')}
        </Button>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type,
  hint,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type ?? 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
