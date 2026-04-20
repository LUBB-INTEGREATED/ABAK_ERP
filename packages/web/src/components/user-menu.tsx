'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';

export default function UserMenu() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  async function onSignOut() {
    await logout();
    router.replace('/login');
  }

  return (
    <div className="flex items-center gap-3">
      {user && (
        <div className="text-right text-sm leading-tight hidden sm:block">
          <div className="font-medium">
            {user.firstName ?? user.email}
            {user.lastName ? ` ${user.lastName}` : ''}
          </div>
          <div className="text-white/70 text-xs">{user.role}</div>
        </div>
      )}
      <button type="button" onClick={onSignOut} className="nav-item">
        Sign out
      </button>
    </div>
  );
}
