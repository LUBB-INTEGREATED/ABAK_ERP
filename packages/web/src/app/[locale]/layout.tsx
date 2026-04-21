import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Cairo, Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { PWARegister } from '@/components/pwa-register';
import { InstallPrompt } from '@/components/install-prompt';
import { routing, isRtlLocale } from '@/i18n/routing';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const dir = isRtlLocale(locale) ? 'rtl' : 'ltr';

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${cairo.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body className={isRtlLocale(locale) ? 'font-arabic' : 'font-latin'}>
        <NextIntlClientProvider>
          {children}
          <Toaster />
          <PWARegister />
          <InstallPrompt />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
