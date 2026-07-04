'use client';
import { useState } from 'react';
import { Sparkles, Copy, Gift, PlayCircle } from 'lucide-react';
import { Prediction } from '@/lib/types';
import { openFunnel } from '@/lib/funnel';
import { copyText } from '@/lib/clipboard';
import { track } from '@/lib/api';
import { PROMO_CODE, mediaUrl } from '@/lib/config';

interface VideoSetting { provider?: string; embedId?: string; url?: string }

export default function FreeCoupon({
  prediction,
  video,
  settings,
}: {
  prediction: Prediction | null;
  video?: VideoSetting;
  settings?: Record<string, any>;
}) {
  const [revealed, setRevealed] = useState(false);

  // Textes éditables depuis le panel (CMS) avec valeurs par défaut.
  const title = settings?.free_coupon_title?.text || 'Cote du jour — Gratuite';
  const ctaLabel = settings?.free_coupon_cta?.text || 'Copier le coupon gratuit';
  const message =
    settings?.free_coupon_message?.text ||
    'Coupon copié ✅ Regarde la vidéo, crée ton compte 1xBet avec le code JOVKEY et rejoins la communauté pour recevoir GRATUITEMENT les grosses cotes, les cadeaux de la semaine et les pronostics de l’IA.';

  const code = prediction?.couponCode || PROMO_CODE;

  const copy = () => {
    copyText(code, 'Coupon gratuit copié !');
    track('coupon_copy', '/');
    setRevealed(true);
  };

  return (
    <section className="px-4 max-w-3xl mx-auto mt-12">
      <div className="glass rounded-3xl p-6 border-l-4 border-gold">
        <div className="flex items-center gap-2 text-gold text-xs font-black uppercase tracking-widest mb-3">
          <Sparkles size={16} /> {title}
        </div>

        {prediction ? (
          <>
            <div className="text-2xl font-black">{prediction.match}</div>
            <div className="text-gray-400 text-sm mb-1">
              {prediction.market} · {prediction.selection}
            </div>
            <div className="flex items-center gap-4 my-4">
              <span className="text-3xl font-black text-gold">{prediction.odds.toFixed(2)}</span>
              <span className="text-xs uppercase text-live font-bold">
                Fiabilité {prediction.reliability}%
              </span>
            </div>
          </>
        ) : (
          <div className="text-gray-400 py-6">
            La cote gratuite du jour est en cours de validation par l&apos;administration.
          </div>
        )}

        {/* Copie LIBRE — aucune création de compte exigée */}
        <button
          onClick={copy}
          className="w-full gold-gradient text-black rounded-xl font-black tap-target flex items-center justify-center gap-2 hover:scale-[1.02] transition"
        >
          <Copy size={18} /> {ctaLabel}
        </button>

        {/* Après copie : message + vidéo démo + invitation communauté (sans bloquer) */}
        {revealed && (
          <div className="mt-5 rounded-2xl border border-gold/30 bg-black/20 p-4">
            <p className="text-sm text-gray-200 mb-4">{message}</p>
            <div className="grid md:grid-cols-2 gap-4 items-center">
              <div className="aspect-[9/16] max-w-[200px] mx-auto w-full rounded-2xl overflow-hidden bg-black border border-white/10">
                {video?.provider === 'cloudinary' && video?.url ? (
                  <video className="w-full h-full object-cover" src={video.url} controls playsInline />
                ) : video?.provider === 'upload' && video?.url ? (
                  <video className="w-full h-full object-cover" src={mediaUrl(video.url)} controls playsInline />
                ) : (
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${video?.embedId || 'dQw4w9WgXcQ'}`}
                    title="Tutoriel 1xBet JOVKEY"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => openFunnel('flash')}
                  className="w-full gold-gradient text-black rounded-xl font-black tap-target flex items-center justify-center gap-2 hover:scale-[1.02] transition"
                >
                  <Gift size={18} /> Créer mon compte & rejoindre
                </button>
                <button
                  onClick={() => openFunnel('flash')}
                  className="w-full glass rounded-xl font-bold tap-target flex items-center justify-center gap-2 hover:bg-white/10 transition"
                >
                  <PlayCircle size={18} /> Voir la vidéo en grand
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
