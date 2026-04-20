import Image from 'next/image';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-off-white">
      <aside className="hidden lg:flex flex-col justify-between p-12 bg-abak-blue text-white">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/images/logo.jpg"
            alt="ABAK"
            width={48}
            height={48}
            className="rounded-md"
          />
          <span className="text-xl font-semibold">ABAK ERP</span>
        </Link>
        <div>
          <h2 className="text-3xl font-bold mb-3">Engineering Consultancy, organised.</h2>
          <p className="text-white/80">
            Leads, CRM, pipelines, quotations, and marketing — one system.
          </p>
        </div>
        <p className="text-sm text-white/60">© {new Date().getFullYear()} ABAK Engineering Consultancy</p>
      </aside>
      <section className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">{children}</div>
      </section>
    </div>
  );
}
