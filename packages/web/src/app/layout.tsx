import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { PWARegister } from '@/components/pwa-register';
import { InstallPrompt } from '@/components/install-prompt';

const inter = Inter({ subsets: ['latin'] });

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
  themeColor: '#236382',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {children}
        <Toaster />
        <PWARegister />
        <InstallPrompt />
      </body>
    </html>
  );
}
