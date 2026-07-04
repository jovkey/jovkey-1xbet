'use client';
import { MarqueeMessage } from '@/lib/types';

export default function Marquee({ messages }: { messages: MarqueeMessage[] }) {
  const items = messages.length
    ? messages
    : [{ id: 'fallback', text: 'CODE PROMO : JOVKEY (+200% BONUS)' }];

  // §2 — la vitesse se recalcule selon la longueur totale du texte injecté.
  const totalChars = items.reduce((n, m) => n + m.text.length, 0);
  const duration = Math.max(12, Math.min(60, Math.round(totalChars / 4)));

  const loop = [...items, ...items]; // duplication pour boucle continue

  return (
    <div className="bg-gold text-black py-3 overflow-hidden whitespace-nowrap">
      <div
        className="inline-block animate-marquee"
        style={{ ['--marquee-duration' as any]: `${duration}s` }}
      >
        {loop.map((m, i) => (
          <span key={`${m.id}-${i}`} className="font-black mx-10">
            {m.text}
          </span>
        ))}
      </div>
    </div>
  );
}
