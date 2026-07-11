'use client';
import { useState } from 'react';
import { CreditCard, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * Écran affiché à un Gold dont le premier paiement n'a jamais abouti (annulé, échoué,
 * ou webhook manqué). Avant ce composant, ces comptes étaient bloqués sans AUCUN moyen
 * de réessayer (connexion refusée + email déjà pris pour se réinscrire) — impasse totale.
 */
export default function PendingGoldPayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const retry = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api<{ paymentUrl?: string }>('/payments/fedapay/renew-gold', { method: 'POST', auth: true });
      if (res.paymentUrl) window.location.href = res.paymentUrl;
      else setError('Paiement indisponible pour le moment.');
    } catch (err: any) {
      setError(err.message || 'Échec de la relance du paiement.');
      setLoading(false);
    }
  };

  return (
    <div className="glass rounded-3xl p-8 max-w-md mx-auto text-center border-2 border-gold/40">
      <AlertTriangle className="text-gold mx-auto mb-4" size={36} />
      <h2 className="text-xl font-black mb-2">Finalise ton paiement</h2>
      <p className="text-gray-400 text-sm mb-6">
        Ton premier paiement n&apos;a pas encore été confirmé (annulé, échoué, ou en cours de
        traitement). Ton accès Gold s&apos;active automatiquement dès que le paiement passe —
        aucune validation manuelle n&apos;est nécessaire.
      </p>
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      <button
        onClick={retry}
        disabled={loading}
        className="w-full gold-gradient text-black rounded-xl font-black tap-target flex items-center justify-center gap-2 disabled:opacity-60"
      >
        <CreditCard size={18} /> {loading ? 'Redirection…' : 'Relancer le paiement'}
      </button>
    </div>
  );
}
