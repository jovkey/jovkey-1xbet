'use client';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CarouselSlide } from '@/lib/types';
import { openFunnel, FunnelTunnel } from '@/lib/funnel';
import { mediaUrl } from '@/lib/config';

export default function Carousel({ slides }: { slides: CarouselSlide[] }) {
  const [index, setIndex] = useState(0);

  // Défilement automatique (7 s). `index` dans les dépendances : chaque navigation
  // manuelle (flèches / points) relance le compte à rebours, pour ne pas sauter juste après.
  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 7000);
    return () => clearInterval(t);
  }, [slides.length, index]);

  if (!slides.length) return null;
  const slide = slides[index];
  const go = (dir: number) => setIndex((i) => (i + dir + slides.length) % slides.length);

  return (
    <section className="px-4 max-w-sm mx-auto mt-6">
      <div className="relative">
        {/* Cadre format mobile (portrait) — rendu identique à l'écran d'un téléphone */}
        <button
          onClick={() => openFunnel((slide.linkTunnel as FunnelTunnel) || 'flash')}
          className="relative block w-full overflow-hidden rounded-3xl glass group text-left aspect-[9/16]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl(slide.imageUrl)}
            alt={slide.caption || 'Promotion'}
            className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition"
          />
          {slide.caption && (
            <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-night via-night/60 to-transparent">
              <span className="text-xl md:text-2xl font-black italic">{slide.caption}</span>
            </div>
          )}
        </button>

        {/* Flèches gauche/droite (seulement s'il y a plusieurs images). Elles sont hors
            du bouton principal → cliquer une flèche ne déclenche pas l'ouverture du tunnel. */}
        {slides.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); go(-1); }}
              aria-label="Image précédente"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur flex items-center justify-center text-white tap-target transition"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); go(1); }}
              aria-label="Image suivante"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur flex items-center justify-center text-white tap-target transition"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>

      <div className="flex justify-center gap-2 mt-3">
        {slides.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setIndex(i)}
            aria-label={`Slide ${i + 1}`}
            className={`h-2 rounded-full transition-all ${
              i === index ? 'w-6 bg-gold' : 'w-2 bg-white/20'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
