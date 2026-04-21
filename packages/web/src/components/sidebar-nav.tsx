'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ComponentType } from 'react';
import {
  LayoutDashboard,
  UsersRound,
  Briefcase,
  FileText,
  Megaphone,
  Blocks,
  Menu,
  Settings,
  X,
  LogOut,
} from 'lucide-react';
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
import { useRouter } from 'next/navigation';

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads', icon: UsersRound },
  { href: '/clients', label: 'Clients', icon: Briefcase },
  { href: '/pipeline', label: 'Pipeline', icon: Blocks },
  { href: '/quotes', label: 'Quotes', icon: FileText },
  { href: '/marketing', label: 'Marketing', icon: Megaphone },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: '/admin/services', label: 'Services', icon: Settings },
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
        <span className="font-semibold tracking-tight">ABAK ERP</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
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
              <span>{item.label}</span>
            </Link>
          );
        })}

        {user && ADMIN_ROLES.has(user.role) && (
          <div className="pt-4">
            <div className="px-3 pb-1 text-[11px] uppercase tracking-wide text-white/50">
              Admin
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
                  <span>{item.label}</span>
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
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/85 transition-colors hover:bg-white/10"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-abak-blue p-0 text-white">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <SidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

export function DismissButton({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Button variant="ghost" size="icon" onClick={onDismiss} aria-label="Close">
      <X className="h-5 w-5" />
    </Button>
  );
}
