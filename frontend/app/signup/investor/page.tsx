'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Gem, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import Navbar from '@/components/Navbar';

export default function InvestorSignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError('Email invalide.');
    if (password.length < 6) return setError('Mot de passe : 6 caractères minimum.');
    setLoading(true);
    try {
      // Le backend pose un cookie httpOnly de session — rien à stocker côté client.
      await api('/auth/signup/investor', {
        method: 'POST',
        body: { email, password, country },
      });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Inscription impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6 pt-24 pb-10">
      <Navbar />
      <form onSubmit={submit} className="glass rounded-3xl p-8 w-full max-w-md">
        <Link href="/" className="text-xs text-gray-400 hover:text-gold flex items-center gap-1 mb-4">
          <ArrowLeft size={14} /> Retour
        </Link>
        <div className="flex items-center gap-2 mb-1">
          <Gem className="text-electric" size={22} />
          <h1 className="text-2xl font-black">Inscription Investisseur</h1>
        </div>
        <p className="text-gray-400 text-sm mb-6">
          Aucun paiement maintenant. Vous créez votre compte, puis vous{' '}
          <b className="text-white">rechargez votre capital</b> quand vous le souhaitez depuis votre espace.
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
          className="w-full gold-gradient text-black rounded-xl font-black tap-target disabled:opacity-60 hover:scale-[1.02] transition">
          {loading ? 'Création…' : 'Créer mon espace investisseur'}
        </button>
        <p className="text-[11px] text-gray-500 mt-4 text-center">
          Déjà membre ? <Link href="/login" className="text-gold underline">Connexion</Link>
        </p>
      </form>
    </main>
  );
}
