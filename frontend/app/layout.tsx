import type { Metadata, Viewport } from 'next';
import './globals.css';
import RechargeModal from '@/components/RechargeModal';
import InstallAppButton from '@/components/InstallAppButton';

export const metadata: Metadata = {
  title: 'Coupon Gratuit — Pronostics & Coupons sportifs',
  description:
    'Plateforme de pronostics sportifs et de coupons gratuits. Code promo JOVKEY.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Coupon Gratuit' },
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
        {/* Bouton flottant « Installer l'appli » (PWA) — visible tant que non installée. */}
        <InstallAppButton />
      </body>
    </html>
  );
}
