'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useUsers } from '@/lib/hooks/use-leads';

export interface UserPickerProps {
  value: string;
  onChange: (userId: string) => void;
  placeholder?: string;
  /**
   * Restrict to specific role codes. Empty/undefined = any active user.
   */
  rolesAllowed?: string[];
  disabled?: boolean;
  className?: string;
  /**
   * Optional exclusion list, e.g. to prevent picking the same person twice.
   */
  excludeIds?: string[];
}

/**
 * UserPicker — shadcn Select that shows name + role per option.
 *
 * Role is displayed alongside the name so two name-similar teammates
 * (e.g. two "Mohammed Ali"s) can be told apart at the moment of choice,
 * defusing the description-similarity slip.
 */
export function UserPicker({
  value,
  onChange,
  placeholder,
  rolesAllowed,
  disabled,
  className,
  excludeIds,
}: UserPickerProps) {
  const t = useTranslations();
  const { data: users, isLoading } = useUsers();

  const filtered = useMemo(() => {
    if (!users) return [];
    const excluded = new Set(excludeIds ?? []);
    return users
      .filter((u) => u.status === 'ACTIVE')
      .filter((u) => !excluded.has(u.id))
      .filter((u) => !rolesAllowed || rolesAllowed.includes(u.role));
  }, [users, rolesAllowed, excludeIds]);

  const placeholderText =
    placeholder ??
    (isLoading ? t('common.loading') : t('common.selectUserPlaceholder'));

  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholderText} />
      </SelectTrigger>
      <SelectContent>
        {filtered.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {t('common.noUsersAvailable')}
          </div>
        ) : (
          filtered.map((user) => {
            const name =
              [user.firstName, user.lastName].filter(Boolean).join(' ') ||
              user.email;
            return (
              <SelectItem key={user.id} value={user.id}>
                <div className="flex items-center gap-2">
                  <UserAvatar
                    firstName={user.firstName}
                    lastName={user.lastName}
                    email={user.email}
                    size="xs"
                  />
                  <span className="truncate">{name}</span>
                  <span className="ms-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {user.role.replace(/_/g, ' ')}
                  </span>
                </div>
              </SelectItem>
            );
          })
        )}
      </SelectContent>
    </Select>
  );
}
