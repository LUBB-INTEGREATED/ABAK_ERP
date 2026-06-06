'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { useAuthStore } from '@/lib/auth';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { ruleForPath } from '@/lib/auth/route-permissions';
import { NoAccess } from '@/components/auth/no-access';

/**
 * RouteGuard — the per-route permission trust boundary (FE-1).
 *
 * Sits *inside* AuthGuard (which only proves you're logged in) and decides, for
 * the current pathname, whether the user holds the permission that route
 * requires (see `route-permissions.ts`). If not, it renders a dedicated 403
 * page *instead of the module shell* — so a Sales Rep typing `/ar/admin/employees`
 * or `/ar/finance` in the address bar gets "no permission", not the HR/Finance UI.
 *
 * The API still enforces every call; this just stops the UI leaking module
 * structure + misleading empty states to users who can't use the module.
 *
 *   - SUPER_ADMIN bypasses (break-glass), matching the sidebar.
 *   - While the permission set is still loading, render nothing rather than
 *     flashing either the shell or a false 403.
 *   - Routes with no rule (dashboard, profile, notifications) pass through.
 */
const SUPERUSER_ROLES = new Set(['SUPER_ADMIN']);

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const { canAny, isLoading } = usePermissions();
  const t = useTranslations();

  const rule = ruleForPath(pathname);

  // No rule → open to any authenticated user.
  if (!rule) return <>{children}</>;

  const isSuperuser = !!user && SUPERUSER_ROLES.has(user.role);
  if (isSuperuser) return <>{children}</>;

  // Don't decide until the effective-permission set has loaded, otherwise the
  // first paint (empty perm map) would wrongly 403 an authorized user.
  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  if (canAny(rule.anyOf)) return <>{children}</>;

  return <NoAccess variant="page" />;
}
