'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, KeyRound } from 'lucide-react';
import { api } from '@/lib/api';
import { showToast } from '@/lib/clipboard';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email } });
      showToast(res.message);
      setStep('code');
    } catch (err: any) {
      setError(err.message || 'Échec de la demande.');
    } finally {
      setLoading(false);
    }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) return setError('Nouveau mot de passe : 6 caractères minimum.');
    setLoading(true);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { email, code, newPassword } });
      showToast('Mot de passe réinitialisé ! Connecte-toi.');
      router.push('/login');
    } catch (err: any) {
      setError(err.message || 'Code invalide ou expiré.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={step === 'email' ? requestCode : reset} autoComplete="off" className="glass rounded-3xl p-8 w-full max-w-sm">
        <Link href="/login" className="text-xs text-gray-400 hover:text-gold flex items-center gap-1 mb-4">
          <ArrowLeft size={14} /> Retour à la connexion
        </Link>
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="text-gold" size={20} />
          <h1 className="text-xl font-black">Mot de passe oublié</h1>
        </div>

        {step === 'email' ? (
          <>
            <p className="text-gray-400 text-sm mb-6">
              Entre l&apos;email de ton compte, on t&apos;envoie un code à copier depuis ta boîte mail.
            </p>
            <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Email</label>
            <input type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full glass rounded-xl px-4 mb-4 tap-target outline-none focus:border-gold" placeholder="vous@email.com" />
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <button disabled={loading} className="w-full gold-gradient text-black rounded-xl font-black tap-target flex items-center justify-center gap-2 disabled:opacity-60">
              <Mail size={18} /> {loading ? 'Envoi…' : 'Recevoir le code'}
            </button>
          </>
        ) : (
          <>
            <p className="text-gray-400 text-sm mb-6">
              Copie le code reçu par email à <b className="text-white">{email}</b> et colle-le ici avec ton nouveau mot de passe.
            </p>
            <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Code reçu par email</label>
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} autoComplete="off"
              inputMode="numeric" maxLength={6}
              className="w-full glass rounded-xl px-4 mb-3 tap-target outline-none focus:border-gold text-center tracking-[0.5em] font-black text-xl" placeholder="——————" />
            <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Nouveau mot de passe</label>
            <input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              className="w-full glass rounded-xl px-4 mb-4 tap-target outline-none focus:border-gold" placeholder="••••••••" />
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <button disabled={loading} className="w-full gold-gradient text-black rounded-xl font-black tap-target disabled:opacity-60">
              {loading ? 'Validation…' : 'Réinitialiser le mot de passe'}
            </button>
            <button type="button" onClick={() => setStep('email')} className="w-full text-xs text-gray-500 mt-3 hover:text-gold">
              Mauvais email ? Recommencer
            </button>
          </>
        )}
      </form>
    </main>
  );
}
