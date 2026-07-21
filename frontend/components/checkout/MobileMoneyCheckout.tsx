'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Smartphone, Copy, Loader2, CheckCircle2, XCircle, Clock, Info, Phone } from 'lucide-react';
import { api } from '@/lib/api';
import { copyText } from '@/lib/clipboard';

type Network = 'MOOV' | 'TOGOCEL';
type Purpose = 'gold_subscription' | 'investor_deposit';
type UiState = 'idle' | 'verifying' | 'completed' | 'failed' | 'timeout';

interface Receiver { network: Network; phone: string; label: string }

/**
 * Canaux affichés. `network` relie au réseau serveur (MOOV/TOGOCEL).
 * - Togo : les deux réseaux, avec le code USSD à composer (connu, donc on l'ouvre
 *   directement dans le clavier du téléphone via un lien `tel:`).
 * - Étranger : **Moov Money uniquement** — T-Money/Mixx n'existe qu'au Togo, donc un
 *   client hors du pays ne peut envoyer que sur la puce Moov. On n'invente AUCUNE
 *   syntaxe USSD internationale (elle varie selon l'opérateur et le pays) : on affiche
 *   le numéro à copier + les infos à fournir, et le client utilise le menu de transfert
 *   international de son propre opérateur.
 */
const CHANNELS: {
  id: string; country: string; operator: string; network: Network; intl: boolean;
  ussd?: string; steps: string[];
}[] = [
  {
    id: 'tg-moov', country: 'Togo', operator: 'Moov Money', network: 'MOOV', intl: false,
    ussd: '*855#',
    steps: ['Ouvre le clavier avec le bouton ci-dessous (*855#)', 'Choisis « Transfert d’argent »', 'Numéro : celui affiché ci-dessus', 'Montant exact', 'Valide avec ton code PIN'],
  },
  {
    id: 'tg-tmoney', country: 'Togo', operator: 'Mixx by Yas (T-Money)', network: 'TOGOCEL', intl: false,
    ussd: '*145#',
    steps: ['Ouvre le clavier avec le bouton ci-dessous (*145#)', 'Choisis « Transfert d’argent »', 'Numéro : celui affiché ci-dessus', 'Montant exact', 'Valide avec ton code PIN'],
  },
  {
    id: 'intl-moov', country: 'Depuis l’étranger', operator: 'Moov Money', network: 'MOOV', intl: true,
    steps: [
      'Dans ton application/menu Mobile Money, choisis « Transfert international »',
      'Destinataire : le numéro Moov Togo affiché ci-dessus (+228…)',
      'Montant EXACT',
      'Renseigne ensuite ton nom/prénom et ton numéro d’envoi ci-dessous',
    ],
  },
];

export default function MobileMoneyCheckout({ purpose, amount }: { purpose: Purpose; amount?: number }) {
  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [channelId, setChannelId] = useState(CHANNELS[0].id);
  const [rotation, setRotation] = useState(0); // pour étaler sur les puces d'un même réseau
  const [senderPhone, setSenderPhone] = useState('');
  const [senderName, setSenderName] = useState('');
  const [txId, setTxId] = useState('');
  const [state, setState] = useState<UiState>('idle');
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const channel = CHANNELS.find((c) => c.id === channelId)!;

  useEffect(() => {
    api<Receiver[]>('/checkout/receivers').then(setReceivers).catch(() => {});
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Puces disponibles pour le réseau du canal choisi ; on en présente UNE (rotation),
  // ce qui répartit naturellement la charge entre les numéros Moov.
  const netReceivers = useMemo(
    () => receivers.filter((r) => r.network === channel.network),
    [receivers, channel.network],
  );
  const receiver = netReceivers.length ? netReceivers[rotation % netReceivers.length] : null;

  const submit = async () => {
    setError('');
    if (!receiver) { setError('Aucun numéro de réception disponible, réessaie plus tard.'); return; }
    if (normalize(senderPhone).length < 6 || (channel.intl && senderName.trim().length < 3)) {
      setError(channel.intl ? 'Renseigne ton nom/prénom et ton numéro d’expédition.' : 'Renseigne ton numéro d’expédition.');
      return;
    }
    setState('verifying');
    try {
      const { id } = await api<{ id: string; status: string }>('/checkout/init', {
        method: 'POST',
        auth: true,
        body: {
          receiverNetwork: channel.network,
          receiverPhone: receiver.phone,
          senderPhone,
          senderName: channel.intl ? senderName : undefined,
          txId: txId || undefined,
          purpose,
          amount,
        },
      });
      startPolling(id);
    } catch (e: any) {
      setState('failed');
      setError(e?.message || 'Échec de l’envoi. Réessaie.');
    }
  };

  // Polling agressif : toutes les 2 s, abandon après ~3 min (90 tentatives).
  const startPolling = (id: string) => {
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      try {
        const { status } = await api<{ status: string }>(`/checkout/status/${id}`, { auth: true });
        if (status === 'completed') { stopPoll(); setState('completed'); }
        else if (status === 'failed') { stopPoll(); setState('failed'); }
      } catch { /* on retente au tick suivant */ }
      if (attempts >= 90) { stopPoll(); setState('timeout'); }
    }, 2000);
  };
  const stopPoll = () => { if (pollRef.current) clearInterval(pollRef.current); pollRef.current = null; };

  if (state === 'completed') {
    return (
      <div className="glass rounded-3xl p-8 text-center border-2 border-live/50">
        <CheckCircle2 className="text-live mx-auto mb-3" size={48} />
        <h3 className="text-2xl font-black mb-2">Paiement confirmé ✅</h3>
        <p className="text-gray-300 text-sm">Ton accès a été débloqué instantanément.</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl p-6 space-y-5">
      <div className="flex items-center gap-2 text-gold font-black">
        <Smartphone size={20} /> Paiement Mobile Money
      </div>

      {/* Pays / opérateur */}
      <div className="grid grid-cols-2 gap-2">
        {CHANNELS.map((c) => (
          <button
            key={c.id}
            onClick={() => { setChannelId(c.id); setRotation((r) => r + 1); }}
            disabled={state === 'verifying'}
            className={`tap-target rounded-xl px-3 py-2 text-sm font-bold border transition ${
              c.id === channelId ? 'gold-gradient text-black border-transparent' : 'glass border-white/10 text-gray-200'
            }`}
          >
            {c.country} · {c.operator}
          </button>
        ))}
      </div>

      {/* Instructions + numéro de réception assigné */}
      <div className="rounded-2xl bg-black/20 p-4 border border-gold/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-widest text-gray-400">Numéro de réception</span>
          {receiver ? (
            <button
              onClick={() => copyText(receiver.phone, 'Numéro copié !')}
              className="text-gold text-sm font-bold flex items-center gap-1"
            >
              <Copy size={14} /> {channel.intl ? `+228 ${receiver.phone}` : receiver.label}
            </button>
          ) : (
            <span className="text-gray-500 text-sm">indisponible</span>
          )}
        </div>
        <ol className="list-decimal list-inside text-sm text-gray-300 space-y-1">
          {channel.steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
        {amount != null && (
          <p className="mt-2 text-sm font-black text-gold">Montant exact : {amount.toLocaleString('fr-FR')} FCFA</p>
        )}

        {/* Togo : on connaît le code → on ouvre le clavier du téléphone directement.
            (# doit être encodé en %23 pour que le composeur l'accepte.) */}
        {channel.ussd && (
          <a
            href={`tel:${channel.ussd.replace('#', '%23')}`}
            className="mt-3 w-full glass rounded-xl py-3 font-black tap-target flex items-center justify-center gap-2 border border-gold/40 text-gold"
          >
            <Phone size={16} /> Ouvrir le clavier ({channel.ussd})
          </a>
        )}

        {channel.intl && (
          <p className="mt-3 text-xs text-electric flex items-start gap-1">
            <Info size={14} className="shrink-0 mt-0.5" />
            Depuis l’étranger, seul <b>Moov Money</b> peut recevoir (Mixx/T-Money n’existe
            qu’au Togo). Indique impérativement ton <b>nom/prénom</b> et ton <b>numéro d’envoi</b> :
            c’est ce qui permet de retrouver ton paiement.
          </p>
        )}
      </div>

      {/* Formulaire de validation */}
      <div className="space-y-3">
        {channel.intl && (
          <input
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="Nom et prénom de l'expéditeur"
            disabled={state === 'verifying'}
            className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm outline-none focus:border-gold"
          />
        )}
        <input
          value={senderPhone}
          onChange={(e) => setSenderPhone(e.target.value)}
          placeholder="Ton numéro d'expédition"
          disabled={state === 'verifying'}
          className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm outline-none focus:border-gold"
        />
        <input
          value={txId}
          onChange={(e) => setTxId(e.target.value)}
          placeholder="ID de transaction (facultatif, figure sur le reçu)"
          disabled={state === 'verifying'}
          className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm outline-none focus:border-gold"
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {state === 'verifying' ? (
        <div className="rounded-xl bg-gold/10 border border-gold/30 px-4 py-3 flex items-center gap-3 text-gold font-bold">
          <Loader2 className="animate-spin" size={18} /> Vérification en cours…
        </div>
      ) : state === 'timeout' ? (
        <div className="rounded-xl bg-white/5 px-4 py-3 flex items-center gap-3 text-gray-300 text-sm">
          <Clock size={18} /> Confirmation non reçue pour l’instant. Vérifie ton reçu ou contacte le support.
          <button onClick={submit} className="ml-auto text-gold font-bold">Réessayer</button>
        </div>
      ) : (
        <button
          onClick={submit}
          className="w-full gold-gradient text-black rounded-xl py-4 font-black tap-target hover:scale-[1.02] transition"
        >
          Valider mon paiement
        </button>
      )}

      {state === 'failed' && (
        <p className="text-red-400 text-sm flex items-center gap-2">
          <XCircle size={16} /> {error || 'Une erreur est survenue.'}
        </p>
      )}
    </div>
  );
}

// Normalisation locale (miroir du backend) pour la validation de saisie.
function normalize(raw: string): string {
  const d = (raw || '').replace(/\D/g, '');
  const n = d.startsWith('228') ? d.slice(3) : d;
  return n.slice(-8);
}
