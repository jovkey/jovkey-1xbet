'use client';
import Link from 'next/link';
import { Crown, Gem, ArrowLeft, Zap } from 'lucide-react';
import { openFunnel } from '@/lib/funnel';
import { GOLD_PRICE_XOF, CURRENCY } from '@/lib/config';
import Navbar from '@/components/Navbar';

export default function SignupChooser() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 pt-24 pb-10">
      <Navbar />
      <div className="w-full max-w-3xl">
        <Link href="/" className="text-xs text-gray-400 hover:text-gold flex items-center gap-1 mb-6">
          <ArrowLeft size={14} /> Retour à l’accueil
        </Link>
        <h1 className="text-3xl font-black mb-2">Créer un compte</h1>
        <p className="text-gray-400 mb-8 text-sm">
          La création de compte est réservée aux offres <b className="text-gold">Gold</b> et{' '}
          <b className="text-electric">Investisseur</b>. Le Pack Flash, lui, ne demande pas de compte —
          juste un formulaire après la vidéo.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <Link href="/signup/gold" className="vip-card rounded-3xl p-7 block hover:scale-[1.01] transition">
            <Crown className="text-gold mb-4" size={34} />
            <h2 className="text-xl font-black mb-1">Pack Gold</h2>
            <div className="text-gold font-black mb-3">{GOLD_PRICE_XOF.toLocaleString('fr-FR')} {CURRENCY}/mois</div>
            <p className="text-gray-400 text-sm">
              Pronostics IA exclusifs (cote 5, 10, scores exacts, montantes), sans publicité.
              Paiement requis à l’inscription.
            </p>
          </Link>

          <Link href="/signup/investor" className="vip-card rounded-3xl p-7 block hover:scale-[1.01] transition">
            <Gem className="text-electric mb-4" size={34} />
            <h2 className="text-xl font-black mb-1">Pack Investisseur</h2>
            <div className="text-electric font-black mb-3">Sans paiement immédiat</div>
            <p className="text-gray-400 text-sm">
              Créez votre espace, suivez vos soldes et rechargez votre capital quand vous voulez.
              Tout retrait est validé par l’administration.
            </p>
          </Link>
        </div>

        <button
          onClick={() => openFunnel('flash')}
          className="mt-6 w-full glass rounded-2xl p-5 flex items-center gap-3 hover:bg-white/10 transition text-left"
        >
          <Zap className="text-gold shrink-0" size={26} />
          <span className="text-sm">
            <b>Pack Flash (gratuit)</b> — pas de compte : regardez la vidéo et remplissez le formulaire
            WhatsApp + ID 1xBet.
          </span>
        </button>
      </div>
    </main>
  );
}
