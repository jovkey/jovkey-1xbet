'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { api } from '@/lib/api';
import Navbar from '@/components/Navbar';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Le backend pose un cookie httpOnly de session — rien à stocker côté client.
      await api('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh flex items-center justify-center px-6 pt-24 pb-6">
      <Navbar />
      <form onSubmit={submit} className="glass rounded-3xl p-8 w-full max-w-sm" autoComplete="off">
        <Link href="/" className="text-2xl font-black text-gold italic block mb-6 text-center">
          JOVKEY-1XBET
        </Link>
        <h1 className="text-xl font-black mb-1">Espace membre</h1>
        <p className="text-gray-400 text-sm mb-6">Réservé aux membres Gold et Investisseurs.</p>

        <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          className="w-full glass rounded-xl px-4 mb-4 tap-target outline-none focus:border-gold"
          placeholder="vous@email.com"
        />
        <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Mot de passe</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          className="w-full glass rounded-xl px-4 mb-4 tap-target outline-none focus:border-gold"
          placeholder="••••••••"
        />
        <div className="text-right -mt-2 mb-4">
          <Link href="/mot-de-passe-oublie" className="text-[11px] text-gray-500 hover:text-gold underline">
            Mot de passe oublié ?
          </Link>
        </div>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button
          disabled={loading}
          className="w-full gold-gradient text-black rounded-xl font-black tap-target flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <LogIn size={18} /> {loading ? 'Connexion…' : 'Se connecter'}
        </button>
        <div className="text-[11px] text-gray-500 mt-4 text-center space-y-1">
          <p>
            Pas encore de compte ?{' '}
            <Link href="/signup/gold" className="text-gold underline">Gold</Link>
            {' · '}
            <Link href="/signup/investor" className="text-electric underline">Investisseur</Link>
          </p>
          <p>Le Pack Flash et la communauté gratuite ne nécessitent aucun compte.</p>
        </div>
      </form>
    </main>
  );
}
