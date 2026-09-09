import Link from 'next/link';
import Navbar from '@/components/Navbar';
import RechargeButton from '@/components/RechargeButton';
import MarqueeBar from '@/components/MarqueeBar';
import VitrineDynamic from '@/components/VitrineDynamic';
import VipPacks from '@/components/VipPacks';
import InvestorDisclaimer from '@/components/InvestorDisclaimer';
import Community from '@/components/Community';
import Reviews from '@/components/Reviews';
import Footer from '@/components/Footer';

export default function HomePage() {
  return (
    <main>
      <Navbar />

      {/* Bandeau défilant — directement sous le header */}
      <MarqueeBar />

      {/* Hero */}
      <section id="home" className="relative min-h-screen flex items-center justify-center pt-10 px-6">
        <div className="absolute top-20 left-10 w-64 h-64 bg-gold/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-electric/10 rounded-full blur-3xl" />
        <div className="text-center z-10 max-w-4xl">
          <span className="inline-block px-4 py-1 rounded-full border border-gold/30 text-gold text-xs font-bold mb-6 uppercase tracking-widest">
            Officiel &amp; Certifié
          </span>
          <h1 className="text-5xl md:text-8xl font-black mb-6 leading-none italic">
            MAXIMISE TES <span className="text-gold">GAINS</span>
          </h1>
          <p className="text-gray-400 text-lg md:text-xl mb-10 max-w-2xl mx-auto">
            Utilise le code promo{' '}
            <span className="text-white font-bold underline decoration-gold">JOVKEY</span> sur 1xBet
            et reçois jusqu&apos;à 200% de bonus immédiat.
          </p>
          <div className="flex flex-col items-center gap-3">
            {/* CTA principal : groupe général gratuit d'abord (conversion vers le Pack Flash), puis groupe VIP */}
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <a href="#community" className="bg-electric text-black px-8 rounded-xl font-black text-base md:text-lg shadow-2xl tap-target flex items-center justify-center text-center">
                REJOINDRE LE GROUPE GÉNÉRAL GRATUITEMENT
              </a>
              <a href="#vip" className="gold-gradient text-black px-8 rounded-xl font-black text-base md:text-lg shadow-2xl animate-pulseGold tap-target flex items-center justify-center text-center">
                REJOINDRE LE GROUPE VIP
              </a>
            </div>
            <div className="text-sm text-gray-500">
              Déjà membre ?{' '}
              <Link href="/login" className="text-gold underline">Connexion</Link>
            </div>
            {/* Coupon gratuit : va DIRECTEMENT à la cote gratuite (pas au carrousel). */}
            <a href="#coupon-gratuit" className="glass px-8 rounded-xl font-bold text-base hover:bg-white/10 transition tap-target flex items-center justify-center">
              COUPON GRATUIT
            </a>
            {/* Recharger / retrait : plus petits, juste en dessous. */}
            <div className="flex flex-row gap-2 justify-center mt-1">
              <RechargeButton mode="deposit" />
              <RechargeButton mode="withdraw" />
            </div>
          </div>
        </div>
      </section>

      {/* Marquee + Carrousel + Cote gratuite + Tunnel (dynamique, piloté par le CMS) */}
      <div id="coupons">
        <VitrineDynamic />
      </div>

      <VipPacks />
      <InvestorDisclaimer />
      <Community />
      <Reviews />
      <Footer />
    </main>
  );
}
