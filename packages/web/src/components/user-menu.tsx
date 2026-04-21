'use client';

import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/lib/auth';
import { useRouter } from '@/i18n/navigation';

export default function UserMenu() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const t = useTranslations();

  async function onSignOut() {
    await logout();
    router.replace('/login');
  }

  return (
    <div className="flex items-center gap-3">
      {user && (
        <div className="hidden text-right text-sm leading-tight sm:block">
          <div className="font-medium">
            {user.firstName ?? user.email}
            {user.lastName ? ` ${user.lastName}` : ''}
          </div>
          <div className="text-xs text-white/70">{user.role}</div>
        </div>
      )}
      <button type="button" onClick={onSignOut} className="nav-item">
        {t('common.signOut')}
      </button>
    </div>
  );
}
