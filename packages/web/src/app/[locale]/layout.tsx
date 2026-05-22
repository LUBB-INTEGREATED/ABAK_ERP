import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import {
  Cairo,
  Inter,
  Noto_Naskh_Arabic,
  Cormorant_Garamond,
} from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { PWARegister } from '@/components/pwa-register';
import { InstallPrompt } from '@/components/install-prompt';
import Providers from '@/components/providers';
import { routing, isRtlLocale } from '@/i18n/routing';
import '../globals.css';

export const metadata: Metadata = {
  title: 'ABAK ERP - Engineering Consultancy Management',
  description: 'Complete ERP system for engineering consultancy firms',
  manifest: '/manifest.webmanifest',
  applicationName: 'ABAK ERP',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ABAK ERP',
  },
  icons: {
    icon: '/images/logo.jpg',
    apple: '/images/logo.jpg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0B1F33',
};

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

// Editorial display tier — Noto Naskh for Arabic headings (formal traditional gravitas),
// Cormorant Garamond for Latin headings (serif counterpoint to Cairo body).
const notoNaskh = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  variable: '--font-naskh',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['500', '600', '700'],
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
      className={`${cairo.variable} ${inter.variable} ${notoNaskh.variable} ${cormorant.variable}`}
      suppressHydrationWarning
    >
      <body className={isRtlLocale(locale) ? 'font-arabic' : 'font-latin'}>
        <NextIntlClientProvider>
          <Providers>
            {children}
            <Toaster />
            <PWARegister />
            <InstallPrompt />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
