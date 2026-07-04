'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Zap, Crown, Gem, Check } from 'lucide-react';
import { openFunnel } from '@/lib/funnel';
import { api } from '@/lib/api';

const packs = [
  {
    icon: Zap, tunnel: 'flash' as const, featured: false, title: 'Pack Flash',
    price: 'Gratuit — sur validation',
    pitch: 'La porte d’entrée obligatoire vers la communauté PRIVÉE.',
    features: [
      'Vidéo de création de compte avec le code JOVKEY (obligatoire)',
      'Accès à la communauté PRIVÉE (pas la gratuite)',
      'Coupons exclusifs de la communauté',
      'Cadeaux & dépôts gratuits chaque semaine',
    ],
    cta: 'Débloquer le Pack Flash',
  },
  {
    icon: Crown, tunnel: 'gold' as const, featured: true, title: 'Pack Gold Elite',
    price: '10$ / 5600 FCFA par mois', pitch: 'Le choix des parieurs sérieux.',
    features: [
      'Pronostics générés par l’IA',
      'Cotes agressives (5, 10, scores exacts, montantes)',
      'Zéro publicité · canal privé Telegram',
    ],
    cta: 'Accès immédiat',
  },
  {
    icon: Gem, tunnel: 'investor' as const, featured: false, title: 'Pack Investisseur',
    price: 'Gestion de capital pro', pitch: 'Déléguez la gestion de vos mises.',
    features: ['Capital géré par nos experts', 'Graphique de performance', 'Gestion du risque (Stop-Loss)'],
    cta: 'Rejoindre le club',
  },
];

export default function VipPacks() {
  // Prix Gold piloté par le CMS : texte libre éditable, sinon calculé depuis le montant.
  const [goldPrice, setGoldPrice] = useState('10$ / 5600 FCFA par mois');
  useEffect(() => {
    api('/cms/public').then((c: any) => {
      const label = c.settings?.gold_price_label?.text;
      const amount = Number(c.settings?.gold_price?.amount);
      if (label) setGoldPrice(label);
      else if (amount > 0) setGoldPrice(`${amount.toLocaleString('fr-FR')} FCFA / mois`);
    }).catch(() => {});
  }, []);

  return (
    <section id="vip" className="py-24 px-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-end mb-16">
        <div>
          <h2 className="text-4xl font-black mb-2">
            ESPACE <span className="text-gold">VIP</span>
          </h2>
          <p className="text-gray-400">Accède aux analyses de nos meilleurs experts.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {packs.map((p) => {
          const Icon = p.icon;
          return (
            <div
              key={p.title}
              className={`vip-card p-8 rounded-3xl relative overflow-hidden ${
                p.featured ? 'border-gold md:scale-105 z-10 shadow-2xl' : ''
              }`}
            >
              {p.featured && (
                <div className="absolute top-0 right-0 gold-gradient text-black px-4 py-1 text-xs font-black rounded-bl-xl uppercase">
                  Populaire
                </div>
              )}
              <div className="text-gold text-4xl mb-6"><Icon size={40} /></div>
              <h3 className="text-2xl font-bold mb-1">{p.title}</h3>
              <div className="text-gold font-black mb-3">{p.tunnel === 'gold' ? goldPrice : p.price}</div>
              <p className="text-gray-400 mb-6 italic text-sm">&quot;{p.pitch}&quot;</p>
              <ul className="space-y-3 mb-8 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="text-live mt-0.5 shrink-0" size={16} /> {f}
                  </li>
                ))}
              </ul>
              {p.tunnel === 'flash' ? (
                <button
                  onClick={() => openFunnel('flash')}
                  className="w-full rounded-xl font-black tap-target transition hover:scale-[1.02] bg-white/5 hover:bg-white/10 border border-white/10"
                >
                  {p.cta}
                </button>
              ) : (
                <Link
                  href={`/signup/${p.tunnel}`}
                  className={`w-full rounded-xl font-black tap-target transition hover:scale-[1.02] flex items-center justify-center ${
                    p.featured ? 'gold-gradient text-black' : 'bg-white/5 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  {p.cta}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
