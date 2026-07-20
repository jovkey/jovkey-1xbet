'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, Clock } from 'lucide-react';
import { api } from '@/lib/api';

type Status = 'checking' | 'activated' | 'pending' | 'error';

/**
 * Retour après paiement Chariow (redirect_url=…?sale={sale_id}). On revérifie la vente
 * côté serveur (qui la confirme auprès de Chariow) et on active le Gold. Filet en plus du
 * webhook : même si celui-ci a du retard, le client débloque son accès en revenant ici.
 */
function RetourInner() {
  const saleId = useSearchParams().get('sale');
  const [status, setStatus] = useState<Status>(saleId ? 'checking' : 'error');

  useEffect(() => {
    if (!saleId) return;
    let cancelled = false;
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      try {
        const r = await api<{ activated: boolean }>(`/checkout/chariow/status/${saleId}`, { auth: true });
        if (r.activated) { if (!cancelled) setStatus('activated'); return; }
      } catch { /* on retente */ }
      if (attempts >= 20) { if (!cancelled) setStatus('pending'); return; }
      if (!cancelled) setTimeout(tick, 3000);
    };
    tick();
    return () => { cancelled = true; };
  }, [saleId]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="glass rounded-3xl p-8 max-w-md w-full text-center">
        {status === 'checking' && (
          <>
            <Loader2 className="animate-spin text-gold mx-auto mb-4" size={40} />
            <h1 className="text-xl font-black mb-2">Vérification de ton paiement…</h1>
            <p className="text-gray-400 text-sm">Cela prend quelques secondes.</p>
          </>
        )}
        {status === 'activated' && (
          <>
            <CheckCircle2 className="text-live mx-auto mb-4" size={48} />
            <h1 className="text-2xl font-black mb-2">Pack Gold activé ✅</h1>
            <p className="text-gray-300 text-sm mb-5">Ton accès est débloqué. Bienvenue !</p>
            <Link href="/dashboard" className="gold-gradient text-black px-6 py-3 rounded-xl font-black tap-target inline-block">
              Accéder à mon espace
            </Link>
          </>
        )}
        {(status === 'pending' || status === 'error') && (
          <>
            <Clock className="text-gray-400 mx-auto mb-4" size={40} />
            <h1 className="text-xl font-black mb-2">Paiement en cours de confirmation</h1>
            <p className="text-gray-400 text-sm mb-5">
              Si tu as bien payé avec l’email de ton compte, ton accès s’activera automatiquement
              d’ici quelques minutes. Reconnecte-toi ensuite.
            </p>
            <Link href="/dashboard" className="glass px-6 py-3 rounded-xl font-black tap-target inline-block border border-gold/30 text-gold">
              Retour à mon espace
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

export default function ChariowRetourPage() {
  return (
    <Suspense fallback={null}>
      <RetourInner />
    </Suspense>
  );
}
