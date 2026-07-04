'use client';
import Link from 'next/link';
import { copyText } from '@/lib/clipboard';
import { track } from '@/lib/api';
import { PROMO_CODE } from '@/lib/config';

export default function Navbar() {
  const copyPromo = () => {
    track('promo_click', '/');
    copyText(PROMO_CODE, `Code ${PROMO_CODE} copié ! Profite de ton bonus.`);
  };

  return (
    <nav className="fixed w-full z-50 glass px-6 py-4 flex justify-between items-center">
      <div className="text-2xl font-black tracking-tighter text-gold italic">
        JOVKEY<span className="text-white">-1XBET</span>
      </div>
      <div className="hidden md:flex space-x-8 font-medium uppercase text-sm tracking-widest">
        <a href="#home" className="hover:text-gold transition">Accueil</a>
        <a href="#vip" className="hover:text-gold transition">VIP</a>
        <a href="#coupons" className="hover:text-gold transition">Coupons</a>
        <a href="#community" className="hover:text-gold transition">Communauté</a>
        <Link href="/signup" className="hover:text-gold transition">S&apos;inscrire</Link>
        <Link href="/login" className="hover:text-gold transition">Connexion</Link>
      </div>
      <button
        onClick={copyPromo}
        className="gold-gradient px-6 rounded-full font-bold text-sm shadow-lg hover:brightness-110 transition tap-target"
      >
        CODE : {PROMO_CODE}
      </button>
    </nav>
  );
}
