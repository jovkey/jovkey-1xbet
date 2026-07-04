'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { API_URL } from '@/lib/config';
import { pollPaymentStatus } from '@/lib/fedapayCheckout';

type Status = 'checking' | 'validated' | 'rejected' | 'pending' | 'error';

/**
 * Interroge le statut réel du paiement (filet de sécurité si le webhook FedaPay
 * n'a pas encore été délivré) au lieu de se contenter d'un message statique.
 */
function useFedapayStatus(tx: string | null) {
  const [status, setStatus] = useState<Status>(tx ? 'checking' : 'error');

  useEffect(() => {
    if (!tx) return;
    let cancelled = false;
    pollPaymentStatus(API_URL, tx).then((result) => {
      if (!cancelled) setStatus(result);
    });
    return () => { cancelled = true; };
  }, [tx]);

  return status;
}

function RetourInner() {
  const tx = useSearchParams().get('tx');
  const status = useFedapayStatus(tx);

  const content: Record<Status, { icon: JSX.Element; title: string; body: string }> = {
    checking: {
      icon: <Loader2 className="text-amber-500 animate-spin" size={40} />,
      title: 'Vérification du paiement…',
      body: 'On confirme ton paiement auprès de FedaPay, quelques secondes.',
    },
    validated: {
      icon: <CheckCircle2 className="text-live" size={40} />,
      title: 'Paiement confirmé !',
      body: 'Ton accès est actif. Connecte-toi pour retrouver ton espace.',
    },
    rejected: {
      icon: <XCircle className="text-red-500" size={40} />,
      title: 'Paiement refusé',
      body: 'Le paiement n’a pas abouti. Réessaie l’inscription/recharge pour relancer un paiement.',
    },
    pending: {
      icon: <Loader2 className="text-amber-500" size={40} />,
      title: 'Toujours en attente',
      body: 'Le paiement est en cours de confirmation par FedaPay. Réessaie de te connecter dans une minute — l’activation se fera automatiquement.',
    },
    error: {
      icon: <XCircle className="text-red-500" size={40} />,
      title: 'Référence introuvable',
      body: 'Impossible de retrouver cette transaction. Contacte le support si le paiement a bien été débité.',
    },
  };
  const c = content[status];

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="glass rounded-3xl p-8 w-full max-w-md text-center">
        <div className="mx-auto w-20 h-20 rounded-full bg-live/20 flex items-center justify-center mb-5">
          {c.icon}
        </div>
        <h1 className="text-2xl font-black mb-2">{c.title}</h1>
        <p className="text-gray-400 text-sm mb-2">{c.body}</p>
        {tx && <p className="text-[11px] text-gray-600 mb-6">Réf. transaction : {tx}</p>}
        <div className="space-y-2">
          <Link href="/login" className="block w-full gold-gradient text-black rounded-xl font-black tap-target leading-[48px]">
            Me connecter à mon espace
          </Link>
          <Link href="/" className="block w-full glass rounded-xl font-bold tap-target leading-[48px] hover:bg-white/10">
            Retour à l’accueil
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function PaiementRetourPage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center text-gray-500">Chargement…</main>}>
      <RetourInner />
    </Suspense>
  );
}
