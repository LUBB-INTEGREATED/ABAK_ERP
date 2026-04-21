import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { formatEntityId } from 'shared-utils';
import { Link } from '@/i18n/navigation';

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HomeContent />;
}

function HomeContent() {
  const t = useTranslations('home');
  const sampleId = formatEntityId('LEAD', new Date().getFullYear(), 1);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-off-white p-24">
      <div className="max-w-2xl text-center">
        <Image
          src="/images/logo.jpg"
          alt="ABAK Engineering Consultancy"
          width={220}
          height={170}
          className="mx-auto mb-8 rounded-lg"
          priority
        />
        <h1 className="mb-4 text-4xl font-bold text-abak-blue">{t('title')}</h1>
        <p className="mb-8 text-xl text-muted-foreground">{t('subtitle')}</p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/login" className="btn-primary">
            {t('loginCta')}
          </Link>
          <Link href="/dashboard" className="btn-secondary">
            {t('dashboardCta')}
          </Link>
          <Link href="/register" className="btn-outline">
            {t('registerCta')}
          </Link>
        </div>
        <p className="mt-12 text-sm text-muted-foreground">
          <span
            dangerouslySetInnerHTML={{
              __html: t.raw('sampleIdLabel') as string,
            }}
          />{' '}
          <span className="badge-active font-mono">{sampleId}</span>
        </p>
      </div>
    </main>
  );
}
