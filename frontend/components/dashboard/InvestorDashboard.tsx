'use client';
import { useEffect, useState } from 'react';
import {
  TrendingUp, Wallet, Star, Lock, Snowflake, Hourglass, Plus, ArrowDownToLine, X, Bell, Megaphone, MessageCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { showToast } from '@/lib/clipboard';
import { PayMethodId, mediaUrl } from '@/lib/config';
import PaymentMethodPicker from '@/components/PaymentMethodPicker';
import MobileMoneyCheckout from '@/components/checkout/MobileMoneyCheckout';
import { InvestorDashboardData } from '@/lib/types';
import { useRealtime } from '@/lib/useRealtime';

const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

interface AppNotification {
  id: string;
  type: 'info' | 'success' | 'warning';
  message: string;
  read: boolean;
  createdAt: string;
}

const notifStyle: Record<AppNotification['type'], string> = {
  success: 'border-live/40 bg-live/5',
  warning: 'border-gold/40 bg-gold/5',
  info: 'border-electric/40 bg-electric/5',
};

function NotificationsPanel() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const load = () => api<AppNotification[]>('/notifications', { auth: true }).then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);
  useRealtime((type) => { if (type === 'notification.new') load(); });

  const dismiss = (id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    api(`/notifications/${id}/read`, { method: 'POST', auth: true }).catch(() => {});
  };

  const unread = items.filter((n) => !n.read);
  if (!unread.length) return null;

  return (
    <div className="space-y-2">
      {unread.map((n) => (
        <div key={n.id} className={`glass rounded-xl p-4 border flex items-start justify-between gap-3 ${notifStyle[n.type]}`}>
          <div className="flex items-start gap-2 text-sm">
            <Bell size={16} className="mt-0.5 shrink-0" />
            <span>{n.message}</span>
          </div>
          <button onClick={() => dismiss(n.id)} className="text-gray-500 hover:text-white shrink-0" aria-label="Fermer">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

function PerformanceChart({ points }: { points: { value: number }[] }) {
  if (points.length < 2) return <div className="text-gray-500 text-sm">Pas encore de données.</div>;
  const w = 600, h = 160, pad = 8;
  const values = points.map((p) => p.value);
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = h - pad - ((p.value - min) / range) * (h - pad * 2);
    return [x, y];
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${path} L${coords[coords.length - 1][0].toFixed(1)},${h} L${coords[0][0].toFixed(1)},${h} Z`;
  const positive = values[values.length - 1] >= values[0];
  const stroke = positive ? '#22c55e' : '#ef4444';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-40">
      <defs>
        <linearGradient id="perf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#perf)" />
      <path d={path} fill="none" stroke={stroke} strokeWidth="2.5" />
    </svg>
  );
}

const statusChip: Record<string, string> = {
  pending: 'text-gold border-gold/40',
  validated: 'text-live border-live/40',
  paid: 'text-live border-live/40',
  rejected: 'text-red-400 border-red-400/40',
};

export default function InvestorDashboard() {
  const [data, setData] = useState<InvestorDashboardData | null>(null);
  const [modal, setModal] = useState<null | 'recharge' | 'withdraw'>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PayMethodId>('mtn');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Dépôt : une fois le montant confirmé, on passe à l'écran Mobile Money (envoi + déclaration).
  const [depositAmount, setDepositAmount] = useState(0);

  const [announcement, setAnnouncement] = useState('');
  const [slides, setSlides] = useState<{ id: string; imageUrl: string; caption?: string }[]>([]);
  // « Contacter l'administration » : activable/désactivable depuis le panel admin (CMS).
  const [contactEnabled, setContactEnabled] = useState(false);
  const [contactWhatsapp, setContactWhatsapp] = useState('');

  const load = () =>
    api<InvestorDashboardData>('/investments/dashboard', { auth: true }).then(setData).catch(() => {});
  useEffect(() => { load(); }, []);
  useEffect(() => {
    api<{ slides: any[]; settings: Record<string, any> }>('/cms/public')
      .then((c) => {
        setAnnouncement(c.settings?.investor_announcement?.text || '');
        setSlides((c.slides || []).filter((s) => s.linkTunnel === 'investor'));
        setContactEnabled(!!c.settings?.investor_contact_enabled?.enabled);
        setContactWhatsapp(c.settings?.investor_contact_whatsapp?.number || '');
      })
      .catch(() => {});
  }, []);

  // Enregistre le prospect (rien n'est perdu côté admin) puis ouvre WhatsApp pré-rempli.
  const contactAdmin = async () => {
    try { await api('/investments/contact', { method: 'POST', auth: true, body: {} }); } catch { /* on ouvre WhatsApp quand même */ }
    const num = contactWhatsapp.replace(/\D/g, '');
    const msg = encodeURIComponent('Bonjour, je souhaite investir chez JOVKEY. Pouvez-vous me guider ?');
    if (num) window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
    else showToast('Contact enregistré — l’administration te recontactera.');
  };
  useRealtime((type) => {
    if (['payment.validated', 'payment.rejected', 'withdrawal.paid', 'withdrawal.rejected', 'balance.released'].includes(type)) {
      load();
    }
  });

  const openModal = (m: 'recharge' | 'withdraw') => {
    setErr(''); setAmount(''); setReference(''); setMethod('mtn'); setDepositAmount(0); setModal(m);
  };

  // Dépôt : on valide le montant puis on bascule sur l'écran Mobile Money.
  const confirmDeposit = () => {
    setErr('');
    const amt = Number(amount);
    if (!amt || amt <= 0) return setErr('Montant invalide.');
    setDepositAmount(amt);
  };

  // Retrait : demande envoyée à l'admin (validée puis versée manuellement par Mobile Money).
  const submitWithdraw = async () => {
    setErr('');
    const amt = Number(amount);
    if (!amt || amt <= 0) return setErr('Montant invalide.');
    if (reference.trim().length < 3) return setErr('Renseignez le numéro de réception.');
    setBusy(true);
    try {
      const res = await api<{ message: string }>('/investments/request-withdrawal', {
        method: 'POST', auth: true, body: { amount: amt, method, destination: reference },
      });
      showToast(res.message);
      setModal(null); load();
    } catch (e: any) {
      setErr(e.message || 'Opération impossible.');
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <p className="text-gray-500">Chargement du capital…</p>;
  const gate = data.reviewsGate;
  const b = data.balances;

  return (
    <div className="space-y-6">
      <NotificationsPanel />

      {announcement && (
        <div className="glass rounded-2xl p-4 flex items-center gap-3 border-l-4 border-gold">
          <Megaphone className="text-gold shrink-0" size={20} />
          <p className="text-sm text-gray-200">{announcement}</p>
        </div>
      )}

      {slides.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {slides.map((s) => (
            <div key={s.id} className="shrink-0 w-64 rounded-2xl overflow-hidden glass">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(s.imageUrl)} alt={s.caption || ''} className="w-full h-32 object-cover" />
              {s.caption && <p className="text-xs text-gray-300 p-2">{s.caption}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Trois soldes étanches */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-5 border-l-4 border-live">
          <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-widest mb-2">
            <Wallet size={14} /> Retirable
          </div>
          <div className="text-2xl font-black text-live">{fmt(b.withdrawable)}</div>
          <p className="text-[11px] text-gray-500 mt-1">Disponible (après validation admin).</p>
        </div>
        <div className="glass rounded-2xl p-5 border-l-4 border-gold">
          <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-widest mb-2">
            <Hourglass size={14} /> Sous analyse
          </div>
          <div className="text-2xl font-black text-gold">{fmt(b.underAnalysis)}</div>
          <p className="text-[11px] text-gray-500 mt-1">Paiement en cours de vérification.</p>
        </div>
        <div className="glass rounded-2xl p-5 border-l-4 border-electric">
          <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-widest mb-2">
            <Snowflake size={14} /> Gelé (investi)
          </div>
          <div className="text-2xl font-black text-electric">{fmt(b.frozen)}</div>
          <p className="text-[11px] text-gray-500 mt-1">Placé pour le cycle en cours.</p>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => openModal('recharge')}
          className="gold-gradient text-black rounded-2xl font-black tap-target flex items-center justify-center gap-2 hover:scale-[1.01] transition py-4">
          <Plus size={18} /> Recharger / Investir
        </button>
        <button onClick={() => openModal('withdraw')} disabled={!gate.unlocked || b.withdrawable <= 0}
          className={`rounded-2xl font-black tap-target flex items-center justify-center gap-2 py-4 transition ${
            gate.unlocked && b.withdrawable > 0
              ? 'glass hover:bg-white/10' : 'bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed'
          }`}>
          {(!gate.unlocked || b.withdrawable <= 0) && <Lock size={16} />}
          <ArrowDownToLine size={18} /> Demander un retrait
        </button>
      </div>

      {/* Contacter l'administration (activable/désactivable depuis l'admin) — pour les
          pays où le Mobile Money vers nos puces n'est pas possible : accueil au cas par cas. */}
      {contactEnabled && (
        <button onClick={contactAdmin}
          className="w-full glass rounded-2xl font-black tap-target flex items-center justify-center gap-2 py-4 border border-live/40 text-live hover:bg-live/5 transition">
          <MessageCircle size={18} /> Contacter l’administration pour investir
        </button>
      )}

      {/* Performance + P&L */}
      <div className="glass rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black">Performance du book ({data.cycleMonth})</h3>
          <span className={`text-sm font-black flex items-center gap-1 ${data.pnl >= 0 ? 'text-live' : 'text-red-400'}`}>
            <TrendingUp size={14} /> {data.pnl >= 0 ? '+' : ''}{fmt(data.pnl)} · ROI {data.roiPct}%
          </span>
        </div>
        <PerformanceChart points={data.performance} />
      </div>

      {/* Gate 5 avis */}
      <div className="glass rounded-3xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <Star className="text-gold" size={18} />
          <h3 className="font-black">Vérification des 5 avis</h3>
        </div>
        <p className="text-gray-400 text-sm mb-3">
          Les retraits exigent au moins 5 avis constructifs (maintient le compte actif).
        </p>
        <div className="w-full bg-white/5 rounded-full h-3 mb-2 overflow-hidden">
          <div className="h-full gold-gradient transition-all"
            style={{ width: `${Math.min(100, (gate.written / gate.required) * 100)}%` }} />
        </div>
        <div className="text-sm text-gray-400">{gate.written}/{gate.required} avis</div>
      </div>

      {/* Historique */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass rounded-3xl p-6">
          <h3 className="font-black mb-3">Recharges récentes</h3>
          <div className="space-y-2">
            {data.payments.filter((p) => p.purpose === 'investor_deposit').map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span>{fmt(Number(p.amount))} · {p.method}</span>
                <span className={`text-[10px] uppercase border rounded-full px-2 py-0.5 ${statusChip[p.status]}`}>{p.status}</span>
              </div>
            ))}
            {!data.payments.some((p) => p.purpose === 'investor_deposit') && (
              <p className="text-gray-500 text-sm">Aucune recharge.</p>
            )}
          </div>
        </div>
        <div className="glass rounded-3xl p-6">
          <h3 className="font-black mb-3">Retraits récents</h3>
          <div className="space-y-2">
            {data.withdrawals.map((w) => (
              <div key={w.id} className="flex items-center justify-between text-sm">
                <span>{fmt(Number(w.amount))} · {w.method}</span>
                <span className={`text-[10px] uppercase border rounded-full px-2 py-0.5 ${statusChip[w.status]}`}>{w.status}</span>
              </div>
            ))}
            {!data.withdrawals.length && <p className="text-gray-500 text-sm">Aucun retrait.</p>}
          </div>
        </div>
      </div>

      {/* Modale recharge / retrait */}
      {modal && (
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-end md:items-center justify-center overflow-y-auto py-6">
          <div className="glass w-full max-w-md rounded-t-3xl md:rounded-3xl p-6 relative">
            <button onClick={() => setModal(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X /></button>
            <h3 className="text-2xl font-black mb-1">
              {modal === 'recharge' ? 'Recharger mon capital' : 'Demander un retrait'}
            </h3>

            {/* ── Dépôt : étape 1 (montant) → étape 2 (Mobile Money) ── */}
            {modal === 'recharge' ? (
              depositAmount > 0 ? (
                <>
                  <p className="text-gray-400 text-sm mb-4">
                    Envoie <b className="text-gold">{fmt(depositAmount)}</b> via Mobile Money, puis déclare
                    ton envoi. Ton capital sera placé « sous analyse » dès réception, avant validation.
                  </p>
                  <MobileMoneyCheckout purpose="investor_deposit" amount={depositAmount} />
                  <button onClick={() => setDepositAmount(0)} className="w-full text-gray-400 text-sm mt-4">← Changer le montant</button>
                </>
              ) : (
                <>
                  <p className="text-gray-400 text-sm mb-5">
                    Choisis le montant à investir. Tu l’enverras ensuite par Mobile Money.
                  </p>
                  <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Montant (FCFA)</label>
                  <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="50000"
                    className="w-full glass rounded-xl px-4 mb-4 tap-target outline-none focus:border-gold" />
                  {err && <p className="text-red-400 text-sm mt-1 mb-2">{err}</p>}
                  <button onClick={confirmDeposit}
                    className="w-full gold-gradient text-black rounded-xl font-black tap-target mt-2 hover:scale-[1.02] transition">
                    Continuer
                  </button>
                </>
              )
            ) : (
              <>
                <p className="text-gray-400 text-sm mb-5">
                  Le retrait est validé par l’administration, puis versé manuellement par Mobile Money.
                </p>
                <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Montant (FCFA)</label>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="50000"
                  className="w-full glass rounded-xl px-4 mb-4 tap-target outline-none focus:border-gold" />
                <PaymentMethodPicker method={method} reference={reference} onMethod={setMethod} onReference={setReference} />
                {err && <p className="text-red-400 text-sm mt-3">{err}</p>}
                <button disabled={busy} onClick={submitWithdraw}
                  className="w-full gold-gradient text-black rounded-xl font-black tap-target mt-4 disabled:opacity-60 hover:scale-[1.02] transition">
                  {busy ? 'Envoi…' : 'Envoyer la demande'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
