'use client';

import Image from 'next/image';
import { useState, type ComponentType } from 'react';
import {
  LayoutDashboard,
  UsersRound,
  Briefcase,
  FileText,
  FileSearch,
  FolderKanban,
  Wallet,
  Landmark,
  ShieldCheck,
  Blocks,
  Menu,
  Settings,
  Sliders,
  CalendarCheck,
  User,
  X,
  LogOut,
  BarChart2,
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
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { isRtlLocale } from '@/i18n/routing';
import { LanguageSwitcher } from '@/components/language-switcher';

type NavItem = {
  href: string;
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
};

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
      { href: '/leads', labelKey: 'nav.leads', icon: UsersRound },
      { href: '/clients', labelKey: 'nav.clients', icon: Briefcase },
      { href: '/pipeline', labelKey: 'nav.pipeline', icon: Blocks },
      { href: '/rfqs', labelKey: 'nav.rfqs', icon: FileSearch },
      { href: '/quotes', labelKey: 'nav.quotes', icon: FileText },
    ],
  },
  {
    labelKey: 'nav.groupDelivery',
    items: [
      { href: '/projects', labelKey: 'nav.projects', icon: FolderKanban },
      { href: '/finance', labelKey: 'nav.finance', icon: Wallet },
      {
        href: '/gov-transactions',
        labelKey: 'nav.govTransactions',
        icon: Landmark,
      },
    ],
  },
  {
    labelKey: 'nav.groupInsight',
    items: [{ href: '/reports', labelKey: 'nav.reports', icon: BarChart2 }],
  },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: '/admin/services', labelKey: 'nav.services', icon: Settings },
  { href: '/admin/settings', labelKey: 'nav.adminSettings', icon: Sliders },
  { href: '/admin/holidays', labelKey: 'nav.holidays', icon: CalendarCheck },
  { href: '/admin/audit', labelKey: 'nav.audit', icon: ShieldCheck },
];

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN']);

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const router = useRouter();
  const t = useTranslations();

  const initials = user?.firstName
    ? `${user.firstName.charAt(0)}${user.lastName?.charAt(0) ?? ''}`.toUpperCase()
    : (user?.email?.charAt(0).toUpperCase() ?? '?');

  async function signOut() {
    await logout();
    onNavigate?.();
    router.replace('/login');
  }

  return (
    <div className="flex h-full w-full flex-col bg-abak-blue text-white">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <Image
          src="/images/logo.jpg"
          alt="ABAK"
          width={36}
          height={36}
          className="rounded-md bg-white"
        />
        <span className="font-semibold tracking-tight">
          {t('common.appName')}
        </span>
      </div>

      <nav
        className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4"
        aria-label={t('common.navigation')}
      >
        {NAV_GROUPS.map((group, idx) => (
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
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-white/15 font-semibold'
                      : 'text-white/85 hover:bg-white/10',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{t(item.labelKey)}</span>
                </Link>
              );
            })}
          </div>
        ))}

        {user && ADMIN_ROLES.has(user.role) && (
          <div className="pt-4">
            <div className="px-3 pb-1 text-[11px] uppercase tracking-wide text-white/50">
              {t('nav.admin')}
            </div>
            {ADMIN_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-white/15 font-semibold'
                      : 'text-white/85 hover:bg-white/10',
                  )}
                >
                  <Icon className="h-4 w-4" />
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
