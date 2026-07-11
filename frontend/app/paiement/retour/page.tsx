'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { API_URL } from '@/lib/config';
import { pollPaymentStatus, PaymentPurpose } from '@/lib/fedapayCheckout';

type Status = 'checking' | 'validated' | 'rejected' | 'pending' | 'error';

/**
 * Interroge le statut réel du paiement (filet de sécurité si le webhook FedaPay
 * n'a pas encore été délivré) au lieu de se contenter d'un message statique.
 */
function useFedapayStatus(tx: string | null) {
  const [status, setStatus] = useState<Status>(tx ? 'checking' : 'error');
  const [purpose, setPurpose] = useState<PaymentPurpose | null>(null);

  useEffect(() => {
    if (!tx) return;
    let cancelled = false;
    pollPaymentStatus(API_URL, tx).then((result) => {
      if (!cancelled) { setStatus(result.status); setPurpose(result.purpose); }
    });
    return () => { cancelled = true; };
  }, [tx]);

  return { status, purpose };
}

function RetourInner() {
  const router = useRouter();
  const tx = useSearchParams().get('tx');
  const { status, purpose } = useFedapayStatus(tx);
  const [countdown, setCountdown] = useState(4);
  // Recharge investisseur : la session est déjà active (le paiement part du dashboard
  // connecté), donc on revient directement dessus — pas de déconnexion déguisée en
  // repassant par /login. Gold reste sur /login (peut venir d'une inscription sans
  // session encore ouverte ; cf. note sécurité plus bas, comportement volontaire).
  const isInvestorDeposit = purpose === 'investor_deposit';

  useEffect(() => {
    if (status !== 'validated') return;
    if (countdown <= 0) { router.push(isInvestorDeposit ? '/dashboard' : '/login'); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [status, countdown, router, isInvestorDeposit]);

  const content: Record<Status, { icon: JSX.Element; title: string; body: string }> = {
    checking: {
      icon: <Loader2 className="text-amber-500 animate-spin" size={40} />,
      title: 'Vérification du paiement…',
      body: 'On confirme ton paiement auprès de FedaPay, quelques secondes.',
    },
    validated: {
      icon: <CheckCircle2 className="text-live" size={40} />,
      title: 'Paiement confirmé !',
      body: isInvestorDeposit
        ? `Ton dépôt est enregistré et passe « sous analyse » pour ce cycle — retour à ton espace dans ${countdown}s…`
        : `Ton accès Gold est actif immédiatement, aucune validation supplémentaire n'est nécessaire. Redirection vers la connexion dans ${countdown}s…`,
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
          <Link href={isInvestorDeposit ? '/dashboard' : '/login'} className="block w-full gold-gradient text-black rounded-xl font-black tap-target leading-[48px]">
            {isInvestorDeposit ? 'Retourner à mon espace' : 'Me connecter à mon espace'}
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
