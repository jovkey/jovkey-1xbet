'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Crown, ArrowLeft, CreditCard } from 'lucide-react';
import { api } from '@/lib/api';
import { GOLD_PRICE_XOF, CURRENCY } from '@/lib/config';
import Navbar from '@/components/Navbar';

export default function GoldSignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [price, setPrice] = useState(GOLD_PRICE_XOF);

  useEffect(() => {
    api('/cms/public').then((c: any) => {
      const amount = Number(c.settings?.gold_price?.amount);
      if (amount > 0) setPrice(amount);
    }).catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError('Email invalide.');
    if (password.length < 6) return setError('Mot de passe : 6 caractères minimum.');
    setLoading(true);
    try {
      const res = await api<{ paymentUrl?: string }>('/auth/signup/gold', {
        method: 'POST',
        body: { email, password, country },
      });
      if (res.paymentUrl) {
        // Redirection vers le paiement FedaPay (activation auto au retour).
        window.location.href = res.paymentUrl;
      } else {
        setError('Paiement indisponible. Réessayez plus tard.');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Inscription impossible.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh flex items-center justify-center px-6 pt-24 pb-10">
      <Navbar />
      <form onSubmit={submit} className="glass rounded-3xl p-8 w-full max-w-md">
        <Link href="/" className="text-xs text-gray-400 hover:text-gold flex items-center gap-1 mb-4">
          <ArrowLeft size={14} /> Retour
        </Link>
        <div className="flex items-center gap-2 mb-1">
          <Crown className="text-gold" size={22} />
          <h1 className="text-2xl font-black">Inscription Gold</h1>
        </div>
        <p className="text-gray-400 text-sm mb-6">
          Abonnement <b className="text-gold">{price.toLocaleString('fr-FR')} {CURRENCY}/mois</b>.
          Paiement sécurisé (MTN, Moov, Orange, Wave, carte bancaire…) — accès <b>immédiat</b> après paiement.
        </p>

        <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoCapitalize="none" placeholder="vous@email.com"
          className="w-full glass rounded-xl px-4 mb-4 tap-target outline-none focus:border-gold" />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
              className="w-full glass rounded-xl px-4 mb-4 tap-target outline-none focus:border-gold" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Pays</label>
            <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Togo"
              className="w-full glass rounded-xl px-4 mb-4 tap-target outline-none focus:border-gold" />
          </div>
        </div>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button disabled={loading}
          className="w-full gold-gradient text-black rounded-xl font-black tap-target disabled:opacity-60 hover:scale-[1.02] transition flex items-center justify-center gap-2">
          <CreditCard size={18} /> {loading ? 'Redirection vers le paiement…' : `Payer ${price.toLocaleString('fr-FR')} ${CURRENCY}`}
        </button>
        <p className="text-[11px] text-gray-500 mt-4 text-center">
          Déjà membre ? <Link href="/login" className="text-gold underline">Connexion</Link>
        </p>
      </form>
    </main>
  );
}
