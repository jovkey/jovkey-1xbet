'use client';
import { useEffect, useState } from 'react';
import { CreditCard, AlertTriangle, Smartphone } from 'lucide-react';
import { api } from '@/lib/api';
import { GOLD_PRICE_XOF } from '@/lib/config';
import MobileMoneyCheckout from '@/components/checkout/MobileMoneyCheckout';

/**
 * Écran affiché à un Gold dont le premier paiement n'a jamais abouti (annulé, échoué,
 * ou webhook manqué). Avant ce composant, ces comptes étaient bloqués sans AUCUN moyen
 * de réessayer (connexion refusée + email déjà pris pour se réinscrire) — impasse totale.
 *
 * Deux voies : (1) relancer le paiement en ligne (FedaPay), (2) payer par Mobile Money
 * Moov / T-Money — validé automatiquement par le téléphone Listener (activable par l'admin).
 */
export default function PendingGoldPayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mmEnabled, setMmEnabled] = useState(false);
  const [price, setPrice] = useState(GOLD_PRICE_XOF);
  const [showMm, setShowMm] = useState(false);

  useEffect(() => {
    api('/cms/public').then((c: any) => {
      const mm = c.settings?.gold_mobile_money_enabled;
      setMmEnabled(mm ? !!mm.enabled : false);
      const amount = Number(c.settings?.gold_price?.amount);
      if (amount > 0) setPrice(amount);
    }).catch(() => {});
  }, []);

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
    <div className="max-w-md mx-auto space-y-5">
      <div className="glass rounded-3xl p-8 text-center border-2 border-gold/40">
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
          <CreditCard size={18} /> {loading ? 'Redirection…' : 'Relancer le paiement en ligne'}
        </button>

        {/* Voie Mobile Money (Moov / T-Money) — activable/désactivable par l'admin. */}
        {mmEnabled && !showMm && (
          <>
            <div className="flex items-center gap-3 my-4">
              <span className="h-px bg-white/10 flex-1" />
              <span className="text-[10px] uppercase tracking-widest text-gray-500">ou</span>
              <span className="h-px bg-white/10 flex-1" />
            </div>
            <button
              onClick={() => setShowMm(true)}
              className="w-full glass border border-gold/30 text-gold rounded-xl font-black tap-target flex items-center justify-center gap-2 hover:bg-white/5 transition"
            >
              <Smartphone size={18} /> Payer par Mobile Money (Moov / T-Money)
            </button>
          </>
        )}
      </div>

      {mmEnabled && showMm && (
        <MobileMoneyCheckout purpose="gold_subscription" amount={price} />
      )}
    </div>
  );
}
