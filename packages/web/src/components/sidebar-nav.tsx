'use client';

import Image from 'next/image';
import { useState } from 'react';
import {
  LayoutDashboard,
  UsersRound,
  Briefcase,
  FileText,
  FileSearch,
  FolderKanban,
  Wallet,
  ShieldCheck,
  Blocks,
  Menu,
  Settings,
  Sliders,
  CalendarCheck,
  Landmark,
  Percent,
  User,
  UserCog,
  KeyRound,
  Building2,
  X,
  LogOut,
  BarChart2,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { isRtlLocale } from '@/i18n/routing';
import { LanguageSwitcher } from '@/components/language-switcher';

type NavItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  /** Permission that reveals this item (in addition to legacy admin roles). */
  perm?: string;
};

// The admin *navigation cluster* is for administration, so a read-only oversight
// account (e.g. VIEWER, which is seeded with the admin `:view` perms for
// deep-link read access) must NOT see the full admin menu (RBAC-P1-3). We reveal
// the admin section only when the user holds at least one genuine admin-
// MANAGEMENT permission — i.e. they actually administer something. Read-only
// users can still reach an admin page by URL; the route guard allows their
// `:view`, but the menu stays clean. SUPER_ADMIN bypasses (sees everything).
const ADMIN_MANAGE_PERMS = [
  'users:manage',
  'roles:manage',
  'departments:manage',
  'services:manage',
  'settings:manage',
  'settings:manage_pricing_policy',
  'settings:manage_holidays',
];

type NavGroup = {
  labelKey?: string;
  items: NavItem[];
};

// MVP scope — 4 contract modules organised as the lead-to-cash activity spine.
// Out-of-scope routes (marketing, executive, pro, targets, projects/resources,
// notifications-as-nav) remain reachable via direct URL for now but are hidden
// from the sidebar until the addendum is signed. See MVP_SCOPE.md.
const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/dashboard', labelKey: 'nav.overview', icon: LayoutDashboard },
    ],
  },
  {
    labelKey: 'nav.groupSales',
    items: [
      {
        href: '/leads',
        labelKey: 'nav.leads',
        icon: UsersRound,
        perm: 'leads:view',
      },
      {
        href: '/clients',
        labelKey: 'nav.clients',
        icon: Briefcase,
        perm: 'clients:view',
      },
      {
        href: '/pipeline',
        labelKey: 'nav.pipeline',
        icon: Blocks,
        perm: 'pipeline:view',
      },
      {
        href: '/rfqs',
        labelKey: 'nav.rfqs',
        icon: FileSearch,
        perm: 'rfq:view',
      },
      {
        href: '/quotes',
        labelKey: 'nav.quotes',
        icon: FileText,
        perm: 'quote:view',
      },
    ],
  },
  {
    labelKey: 'nav.groupDelivery',
    items: [
      {
        href: '/projects',
        labelKey: 'nav.projects',
        icon: FolderKanban,
        perm: 'project:view',
      },
      {
        href: '/finance',
        labelKey: 'nav.finance',
        icon: Wallet,
        perm: 'finance:view',
      },
      {
        href: '/gov-transactions',
        labelKey: 'nav.appliedApplications',
        icon: Landmark,
        perm: 'gov:view',
      },
    ],
  },
  {
    labelKey: 'nav.groupInsight',
    items: [
      {
        href: '/reports',
        labelKey: 'nav.reports',
        icon: BarChart2,
        perm: 'reports:view',
      },
    ],
  },
];

const ADMIN_ITEMS: NavItem[] = [
  {
    href: '/admin/employees',
    labelKey: 'nav.employees',
    icon: UserCog,
    perm: 'users:view',
  },
  {
    href: '/admin/roles',
    labelKey: 'nav.roles',
    icon: KeyRound,
    perm: 'roles:view',
  },
  {
    href: '/admin/departments',
    labelKey: 'nav.departments',
    icon: Building2,
    perm: 'departments:view',
  },
  {
    href: '/admin/services',
    labelKey: 'nav.services',
    icon: Settings,
    perm: 'services:view',
  },
  {
    href: '/admin/settings',
    labelKey: 'nav.adminSettings',
    icon: Sliders,
    perm: 'settings:view',
  },
  {
    href: '/admin/pricing-policy',
    labelKey: 'nav.pricingPolicy',
    icon: Percent,
    perm: 'settings:manage_pricing_policy',
  },
  {
    href: '/admin/holidays',
    labelKey: 'nav.holidays',
    icon: CalendarCheck,
    perm: 'settings:manage_holidays',
  },
  {
    href: '/admin/audit',
    labelKey: 'nav.audit',
    icon: ShieldCheck,
    perm: 'audit:view',
  },
];

// Only SUPER_ADMIN bypasses permission gating (break-glass superuser). Every
// other role — INCLUDING the legacy ADMIN role — is gated by the permissions
// actually granted to it, so the sidebar reflects real access. (A Sales Manager
// seeded as role=ADMIN must not see Projects/Finance/Gov just from the role;
// only their granted perms count. SUPER_ADMIN holds every perm anyway, so this
// bypass is purely defensive.)
const SUPERUSER_ROLES = new Set(['SUPER_ADMIN']);

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const router = useRouter();
  const t = useTranslations();
  const { can, canAny } = usePermissions();

  // A superuser sees everything; everyone else (incl. ADMIN role) sees an item
  // only when they actually hold its permission. Items without a perm (e.g.
  // dashboard) are always visible.
  const isSuperuser = !!user && SUPERUSER_ROLES.has(user.role);
  const canSee = (item: NavItem) => isSuperuser || !item.perm || can(item.perm);
  const navGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(canSee),
  })).filter((group) => group.items.length > 0);
  // Reveal the admin cluster only to actual administrators (any admin-manage
  // perm). A read-only VIEWER — even though it holds the admin `:view` perms —
  // gets a clean operational sidebar, not the full HR/Roles/Settings menu.
  const isAdministrator = isSuperuser || canAny(ADMIN_MANAGE_PERMS);
  const adminItems = isAdministrator
    ? ADMIN_ITEMS.filter((item) => isSuperuser || (item.perm && can(item.perm)))
    : [];

  const initials = user?.firstName
    ? `${user.firstName.charAt(0)}${user.lastName?.charAt(0) ?? ''}`.toUpperCase()
    : (user?.email?.charAt(0).toUpperCase() ?? '?');

  async function signOut() {
    await logout();
    onNavigate?.();
    router.replace('/login');
  }

  return (
    <div className="relative flex h-full w-full flex-col bg-abak-blue text-white">
      <div className="relative flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <Image
          src="/images/logo.jpg"
          alt="ABAK"
          width={36}
          height={36}
          className="rounded-md bg-white"
        />
        <span className="font-display text-lg leading-none tracking-wide text-white">
          {t('common.appName')}
        </span>
        {/* Hairline gold rule — single brand-anchor moment per page */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-abak-gold/60 to-transparent"
        />
      </div>

      <nav
        className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4"
        aria-label={t('common.navigation')}
      >
        {navGroups.map((group, idx) => (
          <div
            key={group.labelKey ?? `group-${idx}`}
            className={idx > 0 ? 'pt-4' : undefined}
          >
            {group.labelKey && (
              <div className="px-3 pb-1 text-[11px] uppercase tracking-wide text-white/50">
                {t(group.labelKey)}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-white/15 font-semibold text-white'
                      : 'text-white/75 hover:bg-white/10 hover:text-white',
                  )}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-abak-gold"
                    />
                  )}
                  <Icon
                    className={cn(
                      'h-4 w-4 transition-transform',
                      active ? 'text-abak-gold' : 'text-white/75',
                    )}
                    strokeWidth={active ? 2.25 : 1.75}
                  />
                  <span>{t(item.labelKey)}</span>
                </Link>
              );
            })}
          </div>
        ))}

        {adminItems.length > 0 && (
          <div className="pt-4">
            <div className="px-3 pb-1 text-[11px] uppercase tracking-wide text-white/50">
              {t('nav.admin')}
            </div>
            {adminItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-white/15 font-semibold text-white'
                      : 'text-white/75 hover:bg-white/10 hover:text-white',
                  )}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-abak-gold"
                    />
                  )}
                  <Icon
                    className={cn(
                      'h-4 w-4 transition-transform',
                      active ? 'text-abak-gold' : 'text-white/75',
                    )}
                    strokeWidth={active ? 2.25 : 1.75}
                  />
                  <span>{t(item.labelKey)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      <div className="border-t border-white/10 p-4">
        {user && (
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-semibold">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {user.firstName ?? user.email}
                {user.lastName ? ` ${user.lastName}` : ''}
              </div>
              <div className="truncate text-xs text-white/60">{user.role}</div>
            </div>
          </div>
        )}
        <Link
          href="/settings/profile"
          onClick={onNavigate}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/85 transition-colors hover:bg-white/10"
        >
          <User className="h-4 w-4" />
          {t('nav.profile')}
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/85 transition-colors hover:bg-white/10"
        >
          <LogOut className="h-4 w-4" />
          {t('common.signOut')}
        </button>
        <LanguageSwitcher variant="sidebar" className="mt-3" />
      </div>
    </div>
  );
}

export function DesktopSidebar() {
  return (
    <aside className="hidden h-screen w-64 shrink-0 md:sticky md:top-0 md:block">
      <SidebarContent />
    </aside>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const locale = useLocale();
  const t = useTranslations();
  const side = isRtlLocale(locale) ? 'right' : 'left';

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={t('common.openNavigation')}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side={side} className="w-64 bg-abak-blue p-0 text-white">
        <SheetHeader className="sr-only">
          <SheetTitle>{t('common.navigation')}</SheetTitle>
        </SheetHeader>
        <SidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

export function DismissButton({ onDismiss }: { onDismiss: () => void }) {
  const t = useTranslations();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onDismiss}
      aria-label={t('common.close')}
    >
      <X className="h-5 w-5" />
    </Button>
  );
}
