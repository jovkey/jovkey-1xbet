'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, Wallet, ArrowDownToLine, Home, Crown, Gift, Users, UserPlus, LogIn } from 'lucide-react';
import { copyText } from '@/lib/clipboard';
import { track } from '@/lib/api';
import { PROMO_CODE } from '@/lib/config';
import { openRecharge } from '@/lib/recharge';

// Chemins absolus (/#vip) plutôt que relatifs (#vip) : la navbar est réutilisée sur
// /login et /signup, où un simple #vip ne ferait rien (pas de section à cet id sur ces
// pages) — /#vip revient d'abord sur l'accueil puis scrolle jusqu'à la section.
const LINKS = [
  { href: '/#home', label: 'Accueil', icon: Home },
  { href: '/#vip', label: 'VIP', icon: Crown },
  { href: '/#coupon-gratuit', label: 'Coupons', icon: Gift },
  { href: '/#community', label: 'Communauté', icon: Users },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  const copyPromo = () => {
    track('promo_click', '/');
    copyText(PROMO_CODE, `Code ${PROMO_CODE} copié ! Profite de ton bonus.`);
  };

  return (
    // top-0 explicite : un `fixed` sans inset garde sa position "statique" d'origine
    // (ici centrée par les pages login/signup en flex items-center) au lieu de se
    // fixer en haut — d'où le menu qui apparaissait au milieu/bas de l'écran.
    <nav className="fixed top-0 left-0 w-full z-50 glass px-4 md:px-6 py-3 md:py-4">
      <div className="flex justify-between items-center gap-3">
        <div className="shrink-0 leading-none">
          <div className="text-xl md:text-2xl font-black tracking-tighter text-gold italic">
            Coupon<span className="text-white"> Gratuit</span>
          </div>
          <div className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-gray-400 font-semibold mt-0.5">de JovGroup</div>
        </div>
        <div className="hidden md:flex space-x-8 font-medium uppercase text-sm tracking-widest">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-gold transition">{l.label}</a>
          ))}
          <button onClick={() => openRecharge('deposit')} className="hover:text-gold transition inline-flex items-center gap-1 uppercase">
            <Wallet size={14} /> Recharger
          </button>
          <button onClick={() => openRecharge('withdraw')} className="hover:text-gold transition inline-flex items-center gap-1 uppercase">
            <ArrowDownToLine size={14} /> Retrait
          </button>
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
            className={`md:hidden rounded-xl p-3 tap-target shadow-lg transition ${
              open ? 'bg-white text-black' : 'gold-gradient text-black'
            }`}
          >
            {open ? <X size={26} strokeWidth={3} /> : <Menu size={26} strokeWidth={3} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden absolute left-0 right-0 top-full mt-2 mx-3 p-3 rounded-2xl bg-night border border-white/10 shadow-2xl flex flex-col gap-2 font-black uppercase text-base tracking-wide z-50">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}
              className="px-4 py-4 rounded-xl bg-white/5 active:bg-gold/20 hover:bg-white/10 hover:text-gold transition flex items-center gap-3">
              <l.icon size={22} className="text-gold shrink-0" /> {l.label}
            </a>
          ))}
          <button
            onClick={() => { setOpen(false); openRecharge('deposit'); }}
            className="text-left px-4 py-4 rounded-xl bg-gold/10 active:bg-gold/20 hover:bg-gold/20 transition flex items-center gap-3 text-gold"
          >
            <Wallet size={22} className="shrink-0" /> Recharger mon compte
          </button>
          <button
            onClick={() => { setOpen(false); openRecharge('withdraw'); }}
            className="text-left px-4 py-4 rounded-xl bg-gold/10 active:bg-gold/20 hover:bg-gold/20 transition flex items-center gap-3 text-gold"
          >
            <ArrowDownToLine size={22} className="shrink-0" /> Faire un retrait
          </button>
          <Link href="/signup" onClick={() => setOpen(false)}
            className="px-4 py-4 rounded-xl bg-white/5 active:bg-gold/20 hover:bg-white/10 hover:text-gold transition flex items-center gap-3">
            <UserPlus size={22} className="text-gold shrink-0" /> S&apos;inscrire
          </Link>
          <Link href="/login" onClick={() => setOpen(false)}
            className="px-4 py-4 rounded-xl bg-white/5 active:bg-gold/20 hover:bg-white/10 hover:text-gold transition flex items-center gap-3">
            <LogIn size={22} className="text-gold shrink-0" /> Connexion
          </Link>
        </div>
      )}
    </nav>
  );
}
