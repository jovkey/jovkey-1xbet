import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'JOVKEY-1XBET — Pronostics & Gestion de capital',
  description:
    'Plateforme privée de pronostics sportifs et de gestion de capital. Code promo JOVKEY.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'JOVKEY' },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-night text-ink antialiased">{children}</body>
    </html>
  );
}
