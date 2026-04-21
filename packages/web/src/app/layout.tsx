import type { Metadata, Viewport } from 'next';
import './globals.css';

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
  return children;
}
