import AuthGuard from '@/components/auth-guard';
import Providers from '@/components/providers';
import { DesktopSidebar, MobileSidebar } from '@/components/sidebar-nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <AuthGuard>
        <div className="flex min-h-screen bg-off-white">
          <DesktopSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-white px-4 py-3 md:hidden">
              <MobileSidebar />
              <span className="font-semibold text-abak-blue">ABAK ERP</span>
            </header>
            <main className="flex-1 p-6">{children}</main>
          </div>
        </div>
      </AuthGuard>
    </Providers>
  );
}
