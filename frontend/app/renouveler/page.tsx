'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';

type Status = 'redirecting' | 'error';

function RenouvelerInner() {
  const token = useSearchParams().get('token');
  const [status, setStatus] = useState<Status>(token ? 'redirecting' : 'error');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    api<{ paymentUrl: string }>('/payments/fedapay/renew-by-token', { method: 'POST', body: { token } })
      .then((res) => {
        window.location.href = res.paymentUrl;
      })
      .catch((err: any) => {
        setStatus('error');
        setError(err.message || 'Lien invalide ou expiré.');
      });
  }, [token]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="glass rounded-3xl p-8 w-full max-w-md text-center">
        <div className="mx-auto w-20 h-20 rounded-full bg-live/20 flex items-center justify-center mb-5">
          {status === 'redirecting'
            ? <Loader2 className="text-amber-500 animate-spin" size={40} />
            : <XCircle className="text-red-500" size={40} />}
        </div>
        <h1 className="text-2xl font-black mb-2">
          {status === 'redirecting' ? 'Préparation de ton paiement…' : 'Lien invalide'}
        </h1>
        <p className="text-gray-400 text-sm mb-6">
          {status === 'redirecting'
            ? 'Redirection vers le paiement sécurisé FedaPay, un instant.'
            : `${error} Connecte-toi à ton espace pour renouveler manuellement.`}
        </p>
        {status === 'error' && (
          <Link href="/login" className="block w-full gold-gradient text-black rounded-xl font-black tap-target leading-[48px]">
            Me connecter à mon espace
          </Link>
        )}
      </div>
    </main>
  );
}

export default function RenouvelerPage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center text-gray-500">Chargement…</main>}>
      <RenouvelerInner />
    </Suspense>
  );
}
