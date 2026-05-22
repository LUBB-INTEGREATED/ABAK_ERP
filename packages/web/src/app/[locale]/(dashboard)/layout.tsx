import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import AuthGuard from '@/components/auth-guard';
import { DesktopSidebar, MobileSidebar } from '@/components/sidebar-nav';
import { LanguageSwitcher } from '@/components/language-switcher';
import { NotificationBell } from '@/components/notification-bell';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <AuthGuard>
      <DashboardChrome>{children}</DashboardChrome>
    </AuthGuard>
  );
}

function DashboardChrome({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  return (
    <div className="flex min-h-screen bg-off-white">
      <DesktopSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-white px-4 py-3">
          <div className="md:hidden">
            <MobileSidebar />
          </div>
          <span className="font-semibold text-abak-blue md:hidden">
            {t('common.appName')}
          </span>
          <div className="ms-auto flex items-center gap-2">
            <NotificationBell />
            <div className="md:hidden">
              <LanguageSwitcher />
            </div>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
