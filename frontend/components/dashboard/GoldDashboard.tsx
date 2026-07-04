'use client';
import { useEffect, useState } from 'react';
import { Copy, Flame, Trophy, Crown, Sparkles, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { copyText } from '@/lib/clipboard';
import { useRealtime } from '@/lib/useRealtime';
import { Prediction } from '@/lib/types';

const sportLabel: Record<string, string> = {
  football: 'Football',
  basketball: 'Basketball',
  hockey: 'Hockey',
  tennis_table: 'Tennis de table',
};

export default function GoldDashboard() {
  const [feed, setFeed] = useState<Prediction[]>([]);

  const load = () => api<Prediction[]>('/predictions/feed', { auth: true }).then(setFeed).catch(() => {});
  useEffect(() => { load(); }, []);
  useRealtime((type) => { if (type === 'prediction.new' || type === 'message') load(); });

  return (
    <div className="space-y-6">
      {/* Bandeau abonnement — sans publicité */}
      <div className="vip-card rounded-3xl p-6 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-gold font-black mb-1">
            <Crown size={20} /> Pack Gold Elite — actif
          </div>
          <p className="text-gray-400 text-sm flex items-center gap-2">
            <ShieldCheck size={14} className="text-live" /> Espace 100% sans publicité · pronostics générés par l’IA
          </p>
        </div>
        <Sparkles className="text-gold shrink-0 hidden md:block" size={36} />
      </div>

      <div className="flex items-center gap-2">
        <Flame className="text-gold" />
        <h2 className="text-2xl font-black">Flux privé d’opportunités</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {feed.map((p) => (
          <div key={p.id} className="glass rounded-2xl p-5 border-l-4 border-gold">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] uppercase tracking-widest text-gray-400">
                {sportLabel[p.sport] || p.sport} · {p.market}
              </span>
              <span className="text-xs font-black text-live flex items-center gap-1">
                <Trophy size={12} /> {p.reliability}%
              </span>
            </div>
            <div className="font-bold text-lg">{p.match}</div>
            <div className="text-gray-400 text-sm mb-3">{p.selection}</div>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-black text-gold">{p.odds.toFixed(2)}</span>
              <button
                onClick={() => copyText(p.couponCode, 'Code coupon 1xBet copié !')}
                className="gold-gradient text-black px-5 rounded-xl font-black tap-target flex items-center gap-2 hover:scale-[1.03] transition"
              >
                <Copy size={16} /> Copier le code
              </button>
            </div>
          </div>
        ))}
        {!feed.length && (
          <p className="text-gray-500 text-sm col-span-2">
            Aucune opportunité active pour le moment. Le moteur d’analyse pousse les coups dès
            qu’une valeur est détectée.
          </p>
        )}
      </div>
    </div>
  );
}
