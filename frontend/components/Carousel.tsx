'use client';
import { useEffect, useState } from 'react';
import { CarouselSlide } from '@/lib/types';
import { openFunnel, FunnelTunnel } from '@/lib/funnel';
import { mediaUrl } from '@/lib/config';

export default function Carousel({ slides }: { slides: CarouselSlide[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length]);

  if (!slides.length) return null;
  const slide = slides[index];

  return (
    <section className="px-4 max-w-sm mx-auto mt-6">
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
