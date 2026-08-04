import type { Metadata, Viewport } from 'next';
import './globals.css';
import RechargeModal from '@/components/RechargeModal';

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
      <body className="bg-night text-ink antialiased">
        {children}
        {/* Formulaire « Recharger mon compte 1xBet » — monté une fois, ouvert partout via openRecharge(). */}
        <RechargeModal />
      </body>
    </html>
  );
}
