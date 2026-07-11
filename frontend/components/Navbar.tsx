'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { copyText } from '@/lib/clipboard';
import { track } from '@/lib/api';
import { PROMO_CODE } from '@/lib/config';

// Chemins absolus (/#vip) plutôt que relatifs (#vip) : la navbar est réutilisée sur
// /login et /signup, où un simple #vip ne ferait rien (pas de section à cet id sur ces
// pages) — /#vip revient d'abord sur l'accueil puis scrolle jusqu'à la section.
const LINKS = [
  { href: '/#home', label: 'Accueil' },
  { href: '/#vip', label: 'VIP' },
  { href: '/#coupons', label: 'Coupons' },
  { href: '/#community', label: 'Communauté' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  const copyPromo = () => {
    track('promo_click', '/');
    copyText(PROMO_CODE, `Code ${PROMO_CODE} copié ! Profite de ton bonus.`);
  };

  return (
    <nav className="fixed w-full z-50 glass px-4 md:px-6 py-3 md:py-4">
      <div className="flex justify-between items-center gap-3">
        <div className="text-xl md:text-2xl font-black tracking-tighter text-gold italic shrink-0">
          JOVKEY<span className="text-white">-1XBET</span>
        </div>
        <div className="hidden md:flex space-x-8 font-medium uppercase text-sm tracking-widest">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-gold transition">{l.label}</a>
          ))}
          <Link href="/signup" className="hover:text-gold transition">S&apos;inscrire</Link>
          <Link href="/login" className="hover:text-gold transition">Connexion</Link>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Toujours visible (aussi replié) : le code promo doit rester copiable en 1 tap, où qu'on soit. */}
          <button
            onClick={copyPromo}
            className="gold-gradient px-3 md:px-6 py-2 rounded-full font-bold text-xs md:text-sm shadow-lg hover:brightness-110 transition tap-target whitespace-nowrap"
          >
            CODE : {PROMO_CODE}
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
            className="md:hidden glass rounded-xl p-2 tap-target"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden mt-3 pb-2 flex flex-col gap-1 font-medium uppercase text-sm tracking-widest">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}
              className="px-3 py-3 rounded-xl hover:bg-white/10 hover:text-gold transition">
              {l.label}
            </a>
          ))}
          <Link href="/signup" onClick={() => setOpen(false)} className="px-3 py-3 rounded-xl hover:bg-white/10 hover:text-gold transition">
            S&apos;inscrire
          </Link>
          <Link href="/login" onClick={() => setOpen(false)} className="px-3 py-3 rounded-xl hover:bg-white/10 hover:text-gold transition">
            Connexion
          </Link>
        </div>
      )}
    </nav>
  );
}
