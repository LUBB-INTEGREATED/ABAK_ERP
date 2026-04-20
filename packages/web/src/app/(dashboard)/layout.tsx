import Image from 'next/image';
import Link from 'next/link';

const nav = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/leads', label: 'Leads' },
  { href: '/clients', label: 'Clients' },
  { href: '/pipeline', label: 'Pipeline' },
  { href: '/quotes', label: 'Quotes' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-off-white">
      <header className="nav-abak">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-3">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Image
              src="/images/logo.jpg"
              alt="ABAK"
              width={36}
              height={36}
              className="rounded-md bg-white"
            />
            <span className="font-semibold">ABAK ERP</span>
          </Link>
          <nav className="flex gap-1">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="nav-item">
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/login" className="nav-item">
            Sign out
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
