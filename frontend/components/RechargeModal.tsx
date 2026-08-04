'use client';
import { useEffect, useState } from 'react';
import { X, Wallet, Hash, Coins, Send, ArrowDownToLine } from 'lucide-react';
import { DEPOSIT_WHATSAPP, SITE_NAME, CURRENCY } from '@/lib/config';
import { RECHARGE_EVENT, RechargeMode } from '@/lib/recharge';

/**
 * Formulaire « Recharger mon compte 1xBet » / « Faire un retrait » — caché sous un bouton,
 * ouvert par l'évènement global RECHARGE_EVENT (voir lib/recharge.ts). Deux champs : ID
 * 1xBet + montant. Au clic, on ouvre WhatsApp (MÊME numéro d'agent pour dépôt ET retrait)
 * avec un message DÉJÀ RÉDIGÉ. Le client n'a plus qu'à appuyer sur « Envoyer ».
 *
 * NB technique : un lien wa.me ne peut préremplir qu'UN seul message et ne peut pas
 * l'envoyer tout seul (sécurité WhatsApp). On met donc l'ID bien en évidence sur sa
 * propre ligne pour que l'agent le repère/copie en un clin d'œil.
 */
export default function RechargeModal() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<RechargeMode>('deposit');
  const [id1xbet, setId1xbet] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const onOpen = (e: Event) => {
      setMode((e as CustomEvent<RechargeMode>).detail === 'withdraw' ? 'withdraw' : 'deposit');
      // Formulaire vierge à chaque ouverture (sinon les valeurs de la session précédente restent).
      setId1xbet('');
      setAmount('');
      setError('');
      setOpen(true);
    };
    window.addEventListener(RECHARGE_EVENT, onOpen);
    return () => window.removeEventListener(RECHARGE_EVENT, onOpen);
  }, []);

  // Fermeture au clavier (Échap) quand le modal est ouvert.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => setOpen(false);
  const isWithdraw = mode === 'withdraw';

  const t = isWithdraw
    ? {
        title: 'Faire un retrait',
        Icon: ArrowDownToLine,
        amountLabel: `Montant du retrait (${CURRENCY})`,
        cta: 'Demander le retrait via WhatsApp',
        action: 'je veux faire un retrait de mon compte 1xBet',
        amountLine: 'Montant du retrait',
      }
    : {
        title: 'Recharger mon compte 1xBet',
        Icon: Wallet,
        amountLabel: `Montant du dépôt (${CURRENCY})`,
        cta: 'Recharger via WhatsApp',
        action: 'je veux recharger mon compte 1xBet',
        amountLine: 'Montant du dépôt',
      };

  const submit = () => {
    const id = id1xbet.trim();
    const montant = amount.replace(/\D/g, ''); // chiffres seulement
    if (!id) return setError('Entre ton ID 1xBet.');
    if (!montant || Number(montant) <= 0) return setError('Entre un montant valide.');

    const montantFmt = Number(montant).toLocaleString('fr-FR');
    const message =
      `Bonjour 👋\n` +
      `Je viens du site ${SITE_NAME}, ${t.action}.\n` +
      `Voici mon ID et le montant :\n\n` +
      `🆔 ID 1xBet : ${id}\n` +
      `💰 ${t.amountLine} : ${montantFmt} ${CURRENCY}`;

    const url = `https://wa.me/${DEPOSIT_WHATSAPP}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    close();
  };

  if (!open) return null;

  const HeaderIcon = t.Icon;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
    >
      <div
        className="glass w-full max-w-md rounded-3xl p-6 border border-gold/30 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          aria-label="Fermer"
          className="absolute top-4 right-4 glass rounded-xl p-2 tap-target hover:bg-white/10 transition"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 text-gold font-black text-xl mb-1">
          <HeaderIcon size={22} /> {t.title}
        </div>
        <p className="text-gray-400 text-sm mb-5">
          Renseigne ton ID 1xBet et le montant. On ouvre WhatsApp avec ta demande déjà
          rédigée — tu n&apos;as plus qu&apos;à appuyer sur <span className="text-white font-semibold">Envoyer</span>.
        </p>

        <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">ID 1xBet</label>
        <div className="flex items-center gap-2 glass rounded-xl px-3 mb-4 border border-white/10 focus-within:border-gold/50 transition">
          <Hash size={16} className="text-gold shrink-0" />
          <input
            value={id1xbet}
            onChange={(e) => setId1xbet(e.target.value)}
            placeholder="Ex : 123456789"
            inputMode="numeric"
            className="bg-transparent flex-1 py-3 outline-none text-white placeholder:text-gray-600"
          />
        </div>

        <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">
          {t.amountLabel}
        </label>
        <div className="flex items-center gap-2 glass rounded-xl px-3 mb-2 border border-white/10 focus-within:border-gold/50 transition">
          <Coins size={16} className="text-gold shrink-0" />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
            placeholder="Ex : 5000"
            inputMode="numeric"
            className="bg-transparent flex-1 py-3 outline-none text-white placeholder:text-gray-600"
          />
        </div>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        <button
          onClick={submit}
          className="w-full gold-gradient text-black py-4 rounded-xl font-black tap-target flex items-center justify-center gap-2 hover:scale-[1.02] transition mt-2"
        >
          <Send size={18} /> {t.cta}
        </button>
      </div>
    </div>
  );
}
