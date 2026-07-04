'use client';
import { PlayCircle, Gift } from 'lucide-react';
import { openFunnel } from '@/lib/funnel';
import { PROMO_CODE, mediaUrl } from '@/lib/config';

interface VideoSetting {
  provider?: string;
  embedId?: string;
  url?: string;
}

/**
 * Vidéo de création de compte visible en permanence près de l'accueil.
 * On la regarde pour comprendre comment ouvrir un compte 1xBet avec le code JOVKEY,
 * puis on débloque les avantages via le Pack Flash.
 */
export default function TutorialVideo({ video }: { video?: VideoSetting }) {
  const embedId = video?.embedId || 'dQw4w9WgXcQ';

  return (
    <section id="tutoriel" className="px-4 max-w-5xl mx-auto mt-12">
      <div className="glass rounded-3xl p-6 md:p-8 grid md:grid-cols-2 gap-8 items-center">
        <div>
          <div className="inline-flex items-center gap-2 text-gold text-xs font-black uppercase tracking-widest mb-3">
            <PlayCircle size={16} /> Tutoriel
          </div>
          <h2 className="text-3xl md:text-4xl font-black leading-tight mb-3">
            Crée ton compte 1xBet<br />avec le code <span className="text-gold">{PROMO_CODE}</span>
          </h2>
          <p className="text-gray-400 mb-6">
            Regarde la vidéo : tu y vois comment t’inscrire, entrer le code{' '}
            <b className="text-white">{PROMO_CODE}</b> et activer ton bonus de 200%. C’est l’étape
            qui débloque l’accès à la communauté privée et à tous ses avantages.
          </p>
          <button
            onClick={() => openFunnel('flash')}
            className="gold-gradient text-black px-8 rounded-xl font-black tap-target flex items-center gap-2 hover:scale-[1.02] transition"
          >
            <Gift size={18} /> Débloquer mes avantages (Pack Flash)
          </button>
        </div>

        {/* Lecteur en format mobile (portrait), cadré comme un écran de téléphone */}
        <div className="aspect-[9/16] w-full max-w-[300px] mx-auto rounded-3xl overflow-hidden bg-black border border-white/10 shadow-2xl">
          {video?.provider === 'cloudinary' && video?.url ? (
            // URL Cloudinary déjà absolue (secure_url) — pas de préfixe mediaUrl() ici.
            <video className="w-full h-full object-cover" src={video.url} controls playsInline />
          ) : video?.provider === 'upload' && video?.url ? (
            // Ancien mode (upload local /uploads) — conservé pour compat des réglages existants.
            <video className="w-full h-full object-cover" src={mediaUrl(video.url)} controls playsInline />
          ) : (
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${embedId}`}
              title="Tutoriel création de compte 1xBet avec le code JOVKEY"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      </div>
    </section>
  );
}
