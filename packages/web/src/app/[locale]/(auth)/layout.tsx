import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from '@/components/language-switcher';

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AuthChrome>{children}</AuthChrome>;
}

function AuthChrome({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  return (
    <div className="grid min-h-screen bg-off-white lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-abak-blue p-12 text-white lg:flex">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/images/logo.jpg"
            alt="ABAK"
            width={48}
            height={48}
            className="rounded-md"
          />
          <span className="text-xl font-semibold">{t('common.appName')}</span>
        </Link>
        <div>
          <h2 className="mb-3 text-3xl font-bold">{t('auth.asideHeading')}</h2>
          <p className="text-white/80">{t('auth.asideDescription')}</p>
        </div>
        <p className="text-sm text-white/60">
          {t('auth.copyright', { year: new Date().getFullYear() })}
        </p>
      </aside>
      <section className="flex flex-col items-center justify-center gap-6 p-8">
        <div className="w-full max-w-md">{children}</div>
        <LanguageSwitcher />
      </section>
    </div>
  );
}
