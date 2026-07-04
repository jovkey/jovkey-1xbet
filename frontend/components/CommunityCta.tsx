'use client';
import { Crown } from 'lucide-react';
import { openFunnel } from '@/lib/funnel';

/** Renvoie vers le Pack Flash depuis la section communauté gratuite. */
export default function CommunityCta() {
  return (
    <button
      onClick={() => openFunnel('flash')}
      className="mt-4 gold-gradient text-black px-6 rounded-xl font-black tap-target flex items-center gap-2 hover:scale-[1.02] transition"
    >
      <Crown size={18} /> Passer à la communauté privée (Pack Flash)
    </button>
  );
}
