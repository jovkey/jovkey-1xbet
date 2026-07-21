'use client';
import { useEffect, useState } from 'react';
import {
  BarChart3, Megaphone, Images, Film, MessageSquareWarning, Inbox, Users, RefreshCw,
  CreditCard, ArrowDownToLine, ShieldCheck, LogOut, Menu, Brain, FileText, Upload, HandCoins,
} from 'lucide-react';
import { api, apiUpload } from '@/lib/api';
import { AuthUser } from '@/lib/types';
import { mediaUrl } from '@/lib/config';
import { showToast } from '@/lib/clipboard';

type Tab =
  | 'stats' | 'leads' | 'payments' | 'withdrawals' | 'predictions'
  | 'marquee' | 'carousel' | 'video' | 'media' | 'texts' | 'reviews' | 'users' | 'investors';

const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

const NAV: { group: string; items: { id: Tab; label: string; icon: any }[] }[] = [
  { group: 'Validation', items: [
    { id: 'leads', label: 'Demandes Flash', icon: Inbox },
    { id: 'payments', label: 'Paiements', icon: CreditCard },
    { id: 'withdrawals', label: 'Retraits', icon: ArrowDownToLine },
    { id: 'investors', label: 'Investisseurs', icon: HandCoins },
  ]},
  { group: 'IA & Pronostics', items: [
    { id: 'predictions', label: 'Prédictions IA', icon: Brain },
  ]},
  { group: 'Contenu', items: [
    { id: 'marquee', label: 'Marquee', icon: Megaphone },
    { id: 'carousel', label: 'Carrousel', icon: Images },
    { id: 'video', label: 'Vidéo tuto', icon: Film },
    { id: 'media', label: 'Médias', icon: Upload },
    { id: 'texts', label: 'Textes & Tarifs', icon: FileText },
  ]},
  { group: 'Communauté', items: [
    { id: 'reviews', label: 'Avis', icon: MessageSquareWarning },
    { id: 'users', label: 'Membres', icon: Users },
  ]},
  { group: 'Analytics', items: [
    { id: 'stats', label: 'Trafic', icon: BarChart3 },
  ]},
];

export default function AdminPanel({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('leads');
  const [counts, setCounts] = useState<{ leads: number; payments: number; withdrawals: number }>({ leads: 0, payments: 0, withdrawals: 0 });
  const [navOpen, setNavOpen] = useState(false);

  const loadCounts = () => {
    Promise.all([
      api<any[]>('/flash/leads', { auth: true }).catch(() => []),
      api<any[]>('/payments', { auth: true }).catch(() => []),
      api<any[]>('/investments/withdrawals', { auth: true }).catch(() => []),
    ]).then(([l, p, w]) => setCounts({ leads: l.length, payments: p.length, withdrawals: w.length }));
  };

  useEffect(() => { loadCounts(); }, []);

  const badge = (id: Tab) =>
    id === 'leads' ? counts.leads : id === 'payments' ? counts.payments : id === 'withdrawals' ? counts.withdrawals : 0;

  return (
    <main className="min-h-screen md:flex">
      {/* Sidebar */}
      <aside className={`md:w-64 md:min-h-screen glass md:border-r border-white/10 p-4 md:sticky md:top-0 ${navOpen ? '' : 'hidden md:block'}`}>
        <div className="flex items-center gap-2 mb-1 px-2">
          <ShieldCheck className="text-gold" size={20} />
          <h1 className="text-lg font-black text-gold italic">Tour de contrôle</h1>
        </div>
        <p className="text-[10px] text-gray-500 uppercase tracking-widest px-2 mb-6">Espace {user.role}</p>

        {NAV.map((section) => (
          <div key={section.group} className="mb-5">
            <div className="text-[10px] uppercase tracking-widest text-gray-500 px-2 mb-2">{section.group}</div>
            <div className="space-y-1">
              {section.items.map((t) => {
                const Icon = t.icon; const b = badge(t.id);
                return (
                  <button key={t.id} onClick={() => { setTab(t.id); setNavOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition ${
                      tab === t.id ? 'gold-gradient text-black' : 'hover:bg-white/10'
                    }`}>
                    <Icon size={16} /> <span className="flex-1 text-left">{t.label}</span>
                    {b > 0 && <span className={`text-[10px] font-black rounded-full px-2 py-0.5 ${tab === t.id ? 'bg-black/20' : 'bg-gold text-black'}`}>{b}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <button onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-red-400 hover:bg-white/10">
          <LogOut size={16} /> Déconnexion
        </button>
      </aside>

      {/* Contenu */}
      <section className="flex-1 px-4 md:px-8 py-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setNavOpen((v) => !v)} className="md:hidden glass rounded-xl p-2"><Menu size={18} /></button>
          <h2 className="text-2xl font-black">{NAV.flatMap((s) => s.items).find((t) => t.id === tab)?.label}</h2>
          <button onClick={loadCounts} className="glass rounded-xl px-3 py-2 text-xs flex items-center gap-1 hover:bg-white/10"><RefreshCw size={14} /> Actualiser</button>
        </div>

        {tab === 'stats' && <StatsTab />}
        {tab === 'leads' && <LeadsTab onChange={loadCounts} />}
        {tab === 'payments' && <PaymentsTab onChange={loadCounts} />}
        {tab === 'withdrawals' && <WithdrawalsTab onChange={loadCounts} />}
        {tab === 'predictions' && <PredictionsTab />}
        {tab === 'marquee' && <MarqueeTab />}
        {tab === 'carousel' && <CarouselTab />}
        {tab === 'video' && <VideoTab />}
        {tab === 'media' && <MediaTab />}
        {tab === 'texts' && <TextsTab />}
        {tab === 'reviews' && <ReviewsTab />}
        {tab === 'users' && <UsersTab superadmin={user.role === 'superadmin'} />}
        {tab === 'investors' && <InvestorsTab />}
      </section>
    </main>
  );
}

/* ── Trafic ─────────────────────────────────────────────── */
function StatsTab() {
  const [s, setS] = useState<any>(null);
  useEffect(() => { api('/stats/overview', { auth: true }).then(setS).catch(() => {}); }, []);
  if (!s) return <p className="text-gray-500">Chargement…</p>;
  const cards = [
    ['Visiteurs uniques (24h)', s.uniqueVisitors24h],
    ['Pages vues', s.pageViews],
    ['Clics code promo', s.promoClicks],
    ['Copies de coupon', s.couponCopies],
    ['CTR code promo', `${s.promoClickThroughRatePct}%`],
  ];
  const sources: { source: string; count: number }[] = s.sources || [];
  const maxSrc = Math.max(1, ...sources.map((x) => x.count));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map(([label, val]) => (
          <div key={label as string} className="glass rounded-2xl p-5">
            <div className="text-gray-400 text-xs uppercase tracking-widest mb-2">{label}</div>
            <div className="text-2xl font-black text-gold">{val}</div>
          </div>
        ))}
      </div>
      <div className="glass rounded-2xl p-5">
        <div className="text-gray-400 text-xs uppercase tracking-widest mb-3">Sources de trafic</div>
        {sources.length ? (
          <div className="space-y-2">
            {sources.map((src) => (
              <div key={src.source} className="flex items-center gap-3">
                <span className="w-24 text-sm capitalize shrink-0">{src.source}</span>
                <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                  <div className="h-full gold-gradient" style={{ width: `${(src.count / maxSrc) * 100}%` }} />
                </div>
                <span className="text-sm text-gray-400 w-10 text-right">{src.count}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-gray-500 text-sm">Pas encore de données de provenance.</p>}
      </div>
    </div>
  );
}

/* ── Demandes Flash (validation via WhatsApp) ───────────── */
const DEFAULT_WA_MSG =
  'Bonjour 👋 Votre accès JOVKEY est validé ✅. Voici votre lien pour rejoindre la communauté : ' +
  '[COLLE TON LIEN ICI]. Pense à utiliser le code promo JOVKEY. Bienvenue !';

function LeadsTab({ onChange }: { onChange: () => void }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [msgs, setMsgs] = useState<Record<string, string>>({});
  const load = () => api<any[]>('/flash/leads', { auth: true }).then(setLeads).catch(() => {});
  useEffect(() => { load(); }, []);

  const setMsg = (id: string, v: string) => setMsgs((m) => ({ ...m, [id]: v }));

  /** Ouvre WhatsApp avec le message pré-rempli, puis marque la demande validée. */
  const validateAndWhatsapp = async (l: any) => {
    const phone = (l.whatsappNum || '').replace(/[^0-9]/g, '');
    const text = encodeURIComponent(msgs[l.id] ?? DEFAULT_WA_MSG);
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
    await api(`/flash/leads/${l.id}/validate`, { method: 'POST', auth: true });
    showToast('Demande validée — le client voit « compte validé »'); load(); onChange();
  };
  const reject = async (id: string) => {
    await api(`/flash/leads/${id}/reject`, { method: 'POST', auth: true }); load(); onChange();
  };

  return (
    <div className="space-y-3">
      <p className="text-gray-400 text-sm">
        Vérifie l’activation du code JOVKEY sur l’ID, écris le message, puis valide : WhatsApp s’ouvre
        avec ton message vers le numéro du client, et la demande passe en « validé ».
      </p>
      {leads.map((l) => (
        <div key={l.id} className="glass rounded-xl p-4">
          <div className="flex justify-between items-center gap-3 flex-wrap mb-2">
            <div>
              <div className="font-bold">{l.id1xbet} <span className="text-[10px] uppercase text-gray-500 ml-1">tunnel {l.sourceTunnel}</span></div>
              <div className="text-xs text-gray-400">📱 {l.whatsappNum}</div>
            </div>
            <button onClick={() => reject(l.id)} className="text-red-400 text-sm">Rejeter</button>
          </div>
          <textarea
            value={msgs[l.id] ?? DEFAULT_WA_MSG}
            onChange={(e) => setMsg(l.id, e.target.value)}
            rows={3}
            className="w-full glass rounded-xl px-3 py-2 text-sm outline-none focus:border-gold mb-2"
          />
          <button
            onClick={() => validateAndWhatsapp(l)}
            className="w-full rounded-xl font-black tap-target flex items-center justify-center gap-2 transition hover:scale-[1.01]"
            style={{ background: '#25D366', color: '#04210f' }}
          >
            Valider & envoyer sur WhatsApp
          </button>
        </div>
      ))}
      {!leads.length && <p className="text-gray-500 text-sm">Aucune demande en attente.</p>}
    </div>
  );
}

/* ── Paiements ──────────────────────────────────────────── */
function PaymentsTab({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const load = () => api('/payments', { auth: true }).then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);
  const act = async (id: string, action: 'validate' | 'reject') => {
    await api(`/payments/${id}/${action}`, { method: 'POST', auth: true });
    showToast(action === 'validate' ? 'Paiement validé' : 'Paiement rejeté'); load(); onChange();
  };
  return (
    <div className="space-y-3">
      <p className="text-gray-400 text-sm">Paiements déclarés en attente (Gold = activation du compte · Investisseur = mise en gelé).</p>
      {items.map((p) => (
        <div key={p.id} className="glass rounded-xl p-4 flex flex-wrap justify-between items-center gap-3">
          <div>
            <div className="font-bold">{p.user?.id1xbet} <span className="text-[10px] uppercase text-gray-500 ml-1">{p.purpose === 'gold_subscription' ? 'Gold' : 'Investisseur'}</span></div>
            <div className="text-xs text-gray-400">{fmt(Number(p.amount))} · {p.method} · réf {p.reference || '—'}</div>
            <div className="text-[11px] text-gray-500">{p.user?.whatsappNum} {p.user?.country ? `· ${p.user.country}` : ''}</div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => act(p.id, 'validate')} className="text-live text-sm font-bold">Valider</button>
            <button onClick={() => act(p.id, 'reject')} className="text-red-400 text-sm">Rejeter</button>
          </div>
        </div>
      ))}
      {!items.length && <p className="text-gray-500 text-sm">Aucun paiement en attente.</p>}
    </div>
  );
}

/* ── Retraits ───────────────────────────────────────────── */
/** Clôture du cycle : verse le capital gelé (+gain) des investisseurs actifs ce mois-ci. */
function CycleClosureSection({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [gains, setGains] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => api<any[]>('/investments/active-cycle', { auth: true }).then((d) => {
    setItems(d);
    setAmounts((prev) => ({ ...Object.fromEntries(d.map((u) => [u.userId, String(u.balanceFrozen)])), ...prev }));
  }).catch(() => {});
  useEffect(() => { load(); }, []);

  const pay = async (userId: string) => {
    const amount = Number(amounts[userId] || 0);
    const gain = Number(gains[userId] || 0);
    if (!amount) return showToast('Montant invalide');
    setBusy(userId);
    try {
      await api(`/investments/${userId}/release`, { method: 'POST', auth: true, body: { amount, gain } });
      showToast('Capital versé sur le solde retirable du client'); load(); onChange();
    } catch (e: any) {
      showToast(e.message || 'Échec du versement');
    } finally {
      setBusy(null);
    }
  };

  if (!items.length) return null;
  return (
    <div className="glass rounded-2xl p-5 mb-5">
      <h3 className="font-black mb-1">Clôture du cycle — versement du capital investi</h3>
      <p className="text-xs text-gray-400 mb-4">
        Investisseurs avec un capital actif ce mois-ci. Saisis le montant (capital, pré-rempli) et
        le gain éventuel, puis verse — l’argent part directement sur le solde retirable du client.
      </p>
      <div className="space-y-2">
        {items.map((u) => (
          <div key={u.userId} className="glass rounded-xl p-3 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[160px]">
              <div className="font-bold text-sm">{u.email || u.id1xbet || '—'}</div>
              <div className="text-[11px] text-gray-500">Gelé : {fmt(u.balanceFrozen)}</div>
            </div>
            <input value={amounts[u.userId] ?? ''} onChange={(e) => setAmounts({ ...amounts, [u.userId]: e.target.value })}
              inputMode="numeric" placeholder="Capital" className="glass rounded-lg px-3 py-2 text-sm outline-none focus:border-gold w-28" />
            <input value={gains[u.userId] ?? ''} onChange={(e) => setGains({ ...gains, [u.userId]: e.target.value })}
              inputMode="numeric" placeholder="Gain (0)" className="glass rounded-lg px-3 py-2 text-sm outline-none focus:border-gold w-24" />
            <button onClick={() => pay(u.userId)} disabled={busy === u.userId}
              className="gold-gradient text-black rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60">
              {busy === u.userId ? 'Versement…' : 'Verser'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function WithdrawalsTab({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const load = () => api('/investments/withdrawals', { auth: true }).then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);
  const act = async (id: string, action: 'validate' | 'reject') => {
    await api(`/investments/withdrawals/${id}/${action}`, { method: 'POST', auth: true });
    showToast(action === 'validate' ? 'Retrait versé' : 'Retrait rejeté (remboursé)'); load(); onChange();
  };
  return (
    <div className="space-y-3">
      <CycleClosureSection onChange={onChange} />
      <p className="text-gray-400 text-sm">Tout retrait est gelé jusqu’à votre validation.</p>
      {items.map((w) => (
        <div key={w.id} className="glass rounded-xl p-4 flex flex-wrap justify-between items-center gap-3">
          <div>
            <div className="font-bold">{w.user?.id1xbet}</div>
            <div className="text-xs text-gray-400">{fmt(Number(w.amount))} · {w.method} → {w.destination || '—'}</div>
            <div className="text-[11px] text-gray-500">{w.user?.whatsappNum}</div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => act(w.id, 'validate')} className="text-live text-sm font-bold">Valider le versement</button>
            <button onClick={() => act(w.id, 'reject')} className="text-red-400 text-sm">Rejeter</button>
          </div>
        </div>
      ))}
      {!items.length && <p className="text-gray-500 text-sm">Aucun retrait en attente.</p>}
    </div>
  );
}

/* ── Investisseurs : interrupteur du bouton contact + n° WhatsApp + prospects ── */
function InvestorsTab() {
  const [enabled, setEnabled] = useState(false);
  const [whatsapp, setWhatsapp] = useState('');
  const [leads, setLeads] = useState<any[]>([]);

  const load = () => {
    api('/cms/public').then((c: any) => {
      setEnabled(!!c.settings?.investor_contact_enabled?.enabled);
      setWhatsapp(c.settings?.investor_contact_whatsapp?.number || '');
    }).catch(() => {});
    api('/investments/leads', { auth: true }).then(setLeads).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const saveEnabled = async (val: boolean) => {
    setEnabled(val);
    await api('/cms/settings/investor_contact_enabled', { method: 'PUT', auth: true, body: { value: { enabled: val } } });
    showToast(val ? 'Bouton « Contacter » activé' : 'Bouton « Contacter » désactivé');
  };
  const saveWhatsapp = async () => {
    await api('/cms/settings/investor_contact_whatsapp', { method: 'PUT', auth: true, body: { value: { number: whatsapp.trim() } } });
    showToast('Numéro WhatsApp enregistré');
  };
  const setStatus = async (id: string, status: string) => {
    await api(`/investments/leads/${id}/status`, { method: 'POST', auth: true, body: { status } });
    load();
  };

  const statusColor: Record<string, string> = {
    new: 'text-gold border-gold/40', contacted: 'text-electric border-electric/40', done: 'text-live border-live/40',
  };

  return (
    <div className="space-y-5">
      {/* Réglages du canal « Contacter l'administration » */}
      <div className="glass rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-black">Bouton « Contacter l’administration »</div>
            <p className="text-xs text-gray-400">Affiché aux investisseurs quand le Mobile Money ne suffit pas (autres pays).</p>
          </div>
          <button onClick={() => saveEnabled(!enabled)}
            className={`w-14 h-8 rounded-full transition relative ${enabled ? 'bg-live' : 'bg-white/15'}`}>
            <span className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${enabled ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="Numéro WhatsApp (ex. 22890000000)"
            className="flex-1 glass rounded-xl px-4 py-3 tap-target outline-none focus:border-gold" />
          <button onClick={saveWhatsapp} className="gold-gradient text-black rounded-xl font-black tap-target px-6">Enregistrer</button>
        </div>
      </div>

      {/* Prospects investisseurs enregistrés */}
      <div>
        <h3 className="font-black mb-3">Prospects investisseurs ({leads.length})</h3>
        <div className="space-y-2">
          {leads.map((l) => (
            <div key={l.id} className="glass rounded-xl p-4 flex flex-wrap justify-between items-center gap-3">
              <div>
                <div className="font-bold">{l.user?.id1xbet || l.user?.email || '—'}</div>
                <div className="text-xs text-gray-400">
                  {l.user?.whatsappNum || l.contact || '—'} {l.user?.country ? `· ${l.user.country}` : ''}
                </div>
                <div className="text-[11px] text-gray-500">{new Date(l.createdAt).toLocaleString('fr-FR')}{l.note ? ` · ${l.note}` : ''}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] uppercase border rounded-full px-2 py-0.5 ${statusColor[l.status] || ''}`}>{l.status}</span>
                {l.status !== 'contacted' && <button onClick={() => setStatus(l.id, 'contacted')} className="text-electric text-xs font-bold">Contacté</button>}
                {l.status !== 'done' && <button onClick={() => setStatus(l.id, 'done')} className="text-live text-xs font-bold">Terminé</button>}
              </div>
            </div>
          ))}
          {!leads.length && <p className="text-gray-500 text-sm">Aucun prospect pour l’instant.</p>}
        </div>
      </div>
    </div>
  );
}

/* ── Marquee ────────────────────────────────────────────── */
function MarqueeTab() {
  const [items, setItems] = useState<any[]>([]);
  const [text, setText] = useState('');
  const load = () => api('/cms/public').then((c: any) => setItems(c.marquee)).catch(() => {});
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (text.trim().length < 3) return;
    await api('/cms/marquee', { method: 'POST', auth: true, body: { text } });
    setText(''); showToast('Message ajouté'); load();
  };
  const del = async (id: string) => { await api(`/cms/marquee/${id}`, { method: 'DELETE', auth: true }); load(); };
  return (
    <div>
      <div className="flex gap-2 mb-5">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Nouveau message défilant" className="flex-1 glass rounded-xl px-4 tap-target outline-none focus:border-gold" />
        <button onClick={add} className="gold-gradient text-black px-6 rounded-xl font-black tap-target">Ajouter</button>
      </div>
      <div className="space-y-2">
        {items.map((m) => (
          <div key={m.id} className="glass rounded-xl p-3 flex justify-between items-center">
            <span className="text-sm">{m.text}</span>
            <button onClick={() => del(m.id)} className="text-red-400 text-sm">Supprimer</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Carrousel ──────────────────────────────────────────── */
const TUNNEL_LABEL: Record<string, string> = { flash: 'Flash', gold: 'Gold', investor: 'Investisseur' };

function CarouselTab() {
  const [slides, setSlides] = useState<any[]>([]);
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [tunnel, setTunnel] = useState('flash');
  const [filter, setFilter] = useState<'all' | 'flash' | 'gold' | 'investor'>('all');
  const [uploading, setUploading] = useState(false);
  const load = () => api('/cms/public').then((c: any) => setSlides(c.slides)).catch(() => {});
  useEffect(() => { load(); }, []);
  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { const a = await apiUpload<any>('/media/upload', file); setUrl(a.url); showToast('Image uploadée — clique « Ajouter »'); }
    catch (err: any) { showToast(err.message || 'Upload impossible'); }
    finally { setUploading(false); e.target.value = ''; }
  };
  const add = async () => {
    if (!url) return showToast('Choisis une image (upload) ou colle une URL');
    await api('/cms/carousel', { method: 'POST', auth: true, body: { imageUrl: url, caption, linkTunnel: tunnel } });
    setUrl(''); setCaption(''); showToast('Image ajoutée'); load();
  };
  const del = async (id: string) => { await api(`/cms/carousel/${id}`, { method: 'DELETE', auth: true }); load(); };
  const visible = filter === 'all' ? slides : slides.filter((s) => s.linkTunnel === filter);
  const move = async (idx: number, dir: -1 | 1) => {
    const next = [...visible];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    await api('/cms/carousel/reorder', { method: 'PUT', auth: true, body: { orderedIds: next.map((s) => s.id) } });
    load();
  };
  return (
    <div>
      <div className="glass rounded-2xl p-4 mb-5 grid gap-2 md:grid-cols-4">
        <label className={`glass rounded-xl px-3 tap-target flex items-center justify-center gap-2 cursor-pointer hover:bg-white/10 md:col-span-2 ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
          <Upload size={16} /> {uploading ? 'Upload…' : (url ? 'Image prête ✓ (re-choisir)' : 'Uploader une image (PC/téléphone)')}
          <input type="file" accept="image/*" onChange={onUpload} className="hidden" />
        </label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="…ou coller une URL" className="glass rounded-xl px-3 tap-target outline-none md:col-span-2" />
        <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Légende (affichée sous l'image)" className="glass rounded-xl px-3 tap-target outline-none md:col-span-2" />
        <select value={tunnel} onChange={(e) => setTunnel(e.target.value)} className="glass rounded-xl px-3 tap-target outline-none bg-night md:col-span-2">
          <option value="flash">Flash</option>
          <option value="gold">Gold</option>
          <option value="investor">Investisseur</option>
        </select>
        <button onClick={add} className="gold-gradient text-black rounded-xl font-black tap-target md:col-span-4">Ajouter au carrousel</button>
      </div>

      <div className="flex gap-2 mb-4">
        {(['all', 'flash', 'gold', 'investor'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-bold ${filter === f ? 'gold-gradient text-black' : 'glass hover:bg-white/10'}`}>
            {f === 'all' ? `Tous (${slides.length})` : `${TUNNEL_LABEL[f]} (${slides.filter((s) => s.linkTunnel === f).length})`}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map((s, i) => (
          <div key={s.id} className="glass rounded-xl p-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl(s.imageUrl)} alt="" className="w-20 h-12 object-cover rounded-lg" />
            <div className="flex-1">
              <div className="text-sm font-bold">{s.caption || '—'}</div>
              <div className="text-[10px] uppercase text-gray-500">Tunnel : {TUNNEL_LABEL[s.linkTunnel] || s.linkTunnel}</div>
            </div>
            <button onClick={() => move(i, -1)} className="glass rounded-lg px-3 py-1">↑</button>
            <button onClick={() => move(i, 1)} className="glass rounded-lg px-3 py-1">↓</button>
            <button onClick={() => del(s.id)} className="text-red-400 text-sm">Suppr.</button>
          </div>
        ))}
        {!visible.length && <p className="text-gray-500 text-sm">Aucune image pour ce tunnel — ajoute-en une ci-dessus.</p>}
      </div>
    </div>
  );
}

/* ── Vidéo tuto (YouTube OU upload direct Cloudinary) ─────── */
function VideoTab() {
  const [mode, setMode] = useState<'youtube' | 'cloudinary'>('youtube');
  const [embedId, setEmbedId] = useState('');
  const [current, setCurrent] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    api('/cms/public').then((c: any) => {
      const v = c.settings?.tutorial_video;
      setCurrent(v);
      if (v?.provider === 'cloudinary' || v?.provider === 'upload') setMode('cloudinary');
      setEmbedId(v?.embedId || '');
    }).catch(() => {});
  }, []);

  const saveYoutube = async () => {
    await api('/cms/settings/tutorial_video', { method: 'PUT', auth: true, body: { value: { provider: 'youtube', embedId } } });
    setCurrent({ provider: 'youtube', embedId });
    showToast('Vidéo YouTube mise à jour (instantané)');
  };

  /**
   * Upload direct navigateur → Cloudinary : le backend ne fait que signer la requête
   * (GET /media/cloudinary/signature), le fichier ne transite jamais par notre serveur.
   */
  const uploadToCloudinary = async (file: File) => {
    setUploading(true);
    setUploadError('');
    try {
      const sig = await api<{ signature: string; timestamp: number; apiKey: string; cloudName: string; folder: string }>(
        '/media/cloudinary/signature',
        { auth: true },
      );
      const form = new FormData();
      form.append('file', file);
      form.append('api_key', sig.apiKey);
      form.append('timestamp', String(sig.timestamp));
      form.append('signature', sig.signature);
      form.append('folder', sig.folder);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/video/upload`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data.secure_url) {
        throw new Error(data?.error?.message || 'Échec de l’upload Cloudinary.');
      }

      await api('/cms/settings/tutorial_video', {
        method: 'PUT',
        auth: true,
        body: { value: { provider: 'cloudinary', url: data.secure_url } },
      });
      setCurrent({ provider: 'cloudinary', url: data.secure_url });
      showToast('Vidéo envoyée sur Cloudinary et définie comme tutoriel');
    } catch (e: any) {
      setUploadError(e.message || 'Upload impossible.');
    } finally {
      setUploading(false);
    }
  };

  const activeLabel = current?.provider === 'cloudinary' || current?.provider === 'upload'
    ? 'Vidéo Cloudinary'
    : (current?.embedId ? 'Lien YouTube' : 'aucune');

  return (
    <div className="max-w-lg space-y-4">
      <div className="glass rounded-xl px-4 py-3 text-sm flex items-center justify-between">
        <span className="text-gray-400">Source active du tutoriel :</span>
        <span className="font-black text-gold">{activeLabel}</span>
      </div>
      <p className="text-[11px] text-gray-500">⚠️ Définir une source <b>remplace</b> l’autre : YouTube et vidéo Cloudinary ne peuvent pas être actives en même temps.</p>
      <div className="glass rounded-xl p-1 flex gap-1">
        {(['youtube', 'cloudinary'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`flex-1 rounded-lg py-2 text-sm font-bold capitalize transition ${mode === m ? 'gold-gradient text-black' : 'hover:bg-white/10'}`}>
            {m === 'youtube' ? 'Lien YouTube' : 'Uploader une vidéo'}
          </button>
        ))}
      </div>

      {mode === 'youtube' ? (
        <div className="glass rounded-2xl p-6">
          <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">Lien ou ID YouTube</label>
          <input value={embedId} onChange={(e) => setEmbedId(e.target.value.replace(/.*[?&]v=|.*youtu\.be\//, '').split('&')[0])}
            placeholder="dQw4w9WgXcQ ou lien complet" className="w-full glass rounded-xl px-4 mb-4 tap-target outline-none focus:border-gold" />
          <button onClick={saveYoutube} className="gold-gradient text-black rounded-xl font-black tap-target px-6">Mettre à jour</button>
        </div>
      ) : (
        <div className="glass rounded-2xl p-6">
          <p className="text-sm text-gray-400 mb-3">
            Choisis un fichier vidéo depuis ton appareil — il part directement sur Cloudinary
            (aucune limite de notre côté, dépend de ton plan Cloudinary).
          </p>
          <input
            type="file"
            accept="video/*"
            disabled={uploading}
            onChange={(e) => e.target.files?.[0] && uploadToCloudinary(e.target.files[0])}
            className="w-full glass rounded-xl px-4 py-3 tap-target outline-none focus:border-gold disabled:opacity-60"
          />
          {uploading && <p className="text-gold text-sm mt-3">Envoi en cours…</p>}
          {uploadError && <p className="text-red-400 text-sm mt-3">{uploadError}</p>}
          {current?.provider === 'cloudinary' && current?.url && (
            <video src={current.url} controls className="w-full rounded-xl mt-4 max-h-56" />
          )}
        </div>
      )}
    </div>
  );
}

/* ── Avis (modération + suppression) ──────────────────────── */
function ReviewsTab() {
  const [pending, setPending] = useState<any[]>([]);
  const [all, setAll] = useState<any[]>([]);
  const load = () => {
    api('/reviews/moderation', { auth: true }).then(setPending).catch(() => {});
    api<any[]>('/reviews/admin', { auth: true }).then(setAll).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  const act = async (id: string, action: 'publish' | 'reject') => {
    await api(`/reviews/${id}/${action}`, { method: 'POST', auth: true }); load();
  };
  const remove = async (r: any) => {
    if (!confirm(`Supprimer définitivement l'avis de ${r.authorName} ?`)) return;
    await api(`/reviews/${r.id}`, { method: 'DELETE', auth: true });
    showToast('Avis supprimé'); load();
  };
  const seed = async () => {
    const res = await api<{ seeded: number }>('/reviews/seed', { method: 'POST', auth: true });
    showToast(`${res.seeded} avis de démo injectés`); load();
  };
  const statusLabel: Record<string, string> = { published: 'publié', pending: 'en attente', rejected: 'rejeté' };
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <p className="text-gray-400 text-sm flex-1">Les avis 4-5★ sont publiés automatiquement. Voici la file &lt; 4★ à trier (rien n&apos;est supprimé en silence).</p>
          <button onClick={seed} className="glass rounded-xl px-4 py-2 text-sm hover:bg-white/10 shrink-0">Injecter des avis de démo</button>
        </div>
        <div className="space-y-3">
          {pending.map((r) => (
            <div key={r.id} className="glass rounded-xl p-4">
              <div className="flex justify-between mb-1">
                <span className="font-bold">{r.authorName} · {r.rating}★</span>
                <div className="flex gap-2">
                  <button onClick={() => act(r.id, 'publish')} className="text-live text-sm">Publier</button>
                  <button onClick={() => act(r.id, 'reject')} className="text-red-400 text-sm">Rejeter</button>
                </div>
              </div>
              <p className="text-gray-400 text-sm">{r.body}</p>
            </div>
          ))}
          {!pending.length && <p className="text-gray-500 text-sm">Aucun avis en attente.</p>}
        </div>
      </div>

      <div>
        <h3 className="font-black mb-1">Tous les avis</h3>
        <p className="text-gray-400 text-sm mb-3">Publiés, rejetés, en attente — supprime un avis (spam, erreur…) à tout moment.</p>
        <div className="space-y-2">
          {all.map((r) => (
            <div key={r.id} className="glass rounded-xl p-3 flex items-start justify-between gap-3">
              <div>
                <span className="font-bold text-sm">{r.authorName} · {r.rating}★</span>
                <span className="text-[10px] uppercase text-gray-500 ml-2">{statusLabel[r.status] || r.status}</span>
                <p className="text-gray-400 text-sm mt-1">{r.body}</p>
              </div>
              <button onClick={() => remove(r)} className="text-red-400 hover:text-red-300 text-xs border border-red-400/30 rounded-lg px-2 py-1 shrink-0">
                Supprimer
              </button>
            </div>
          ))}
          {!all.length && <p className="text-gray-500 text-sm">Aucun avis.</p>}
        </div>
      </div>
    </div>
  );
}

/* ── Membres + élasticité + libération de capital ───────── */
function UsersTab({ superadmin }: { superadmin: boolean }) {
  const [users, setUsers] = useState<any[]>([]);
  const load = () => api('/users', { auth: true }).then(setUsers).catch(() => {});
  useEffect(() => { load(); }, []);
  const runElasticity = async () => {
    const res = await api<any>('/investments/elasticity/run', { method: 'POST', auth: true });
    showToast(res.message); load();
  };
  const setRole = async (id: string, role: string) => {
    await api(`/users/${id}/role`, { method: 'PATCH', auth: true, body: { role } }); load();
  };
  const removeUser = async (u: any) => {
    if (!confirm(`Supprimer définitivement ${u.email || u.id1xbet} ? Cette action est irréversible.`)) return;
    try {
      await api(`/users/${u.id}`, { method: 'DELETE', auth: true });
      showToast('Membre supprimé'); load();
    } catch (e: any) { showToast(e.message || 'Échec de la suppression'); }
  };
  const release = async (u: any) => {
    const amount = Number(prompt(`Montant gelé à libérer (max ${Math.round(Number(u.balanceFrozen))}) :`) || '0');
    if (!amount) return;
    const gain = Number(prompt('Gain à ajouter (0 si aucun) :') || '0');
    try {
      await api(`/investments/${u.id}/release`, { method: 'POST', auth: true, body: { amount, gain } });
      showToast('Capital libéré vers le solde retirable'); load();
    } catch (e: any) { showToast(e.message || 'Échec'); }
  };
  return (
    <div>
      <button onClick={runElasticity} className="gold-gradient text-black rounded-xl font-black tap-target px-5 mb-5 flex items-center gap-2">
        <RefreshCw size={16} /> Lancer l&apos;algorithme d&apos;élasticité
      </button>
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="glass rounded-xl p-3 text-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <span className="font-bold">{u.email || u.id1xbet || '—'}</span>
                {u.whatsappNum && <span className="text-gray-500 ml-2">{u.whatsappNum}</span>}
                {u.country && <span className="text-gray-600 ml-1">· {u.country}</span>}
                {u.accountStatus === 'pending_payment' && <span className="ml-2 text-[10px] uppercase text-gold border border-gold/40 rounded-full px-2">paiement en attente</span>}
                {u.eligibleForReinvest && <span className="ml-2 text-[10px] uppercase text-gold">repêchage</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-400">{u.reviewsWritten} avis</span>
                {superadmin ? (
                  <>
                    <select value={u.role} onChange={(e) => setRole(u.id, e.target.value)} className="glass rounded-lg px-2 py-1 bg-night">
                      {['gold', 'investor', 'admin', 'superadmin'].map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button onClick={() => removeUser(u)} className="text-red-400 hover:text-red-300 text-xs border border-red-400/30 rounded-lg px-2 py-1">
                      Supprimer
                    </button>
                  </>
                ) : (
                  <span className="uppercase text-xs text-gold">{u.role}</span>
                )}
              </div>
            </div>
            {u.role === 'investor' && (
              <div className="mt-2 flex items-center justify-between gap-3 flex-wrap text-xs">
                <span className="text-gray-400">
                  Retirable <b className="text-live">{fmt(Number(u.balanceWithdrawable))}</b> ·
                  Analyse <b className="text-gold">{fmt(Number(u.balanceUnderAnalysis))}</b> ·
                  Gelé <b className="text-electric">{fmt(Number(u.balanceFrozen))}</b>
                </span>
                <button onClick={() => release(u)} className="glass rounded-lg px-3 py-1 hover:bg-white/10">Libérer le gelé</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Rendu lisible des statistiques brutes envoyées par l'IA (structure libre). */
function AnalysisView({ analysis }: { analysis: any }) {
  const fmtVal = (v: any): string => {
    if (Array.isArray(v)) return v.join(', ');
    if (v && typeof v === 'object') return Object.entries(v).map(([k, val]) => `${k}: ${val}`).join(' · ');
    return String(v);
  };
  const entries = analysis && typeof analysis === 'object' ? Object.entries(analysis) : [];
  if (!entries.length) return null;
  return (
    <div className="mt-3 bg-black/20 rounded-xl p-3 space-y-1">
      <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Analyse IA (statistiques)</div>
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-2 text-xs">
          <span className="text-gray-500 capitalize shrink-0 min-w-[110px]">{k.replace(/_/g, ' ')}</span>
          <span className="text-gray-300">{fmtVal(v)}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Coupon créé à la main par l'admin (indépendant du moteur IA) ─ */
function ManualCouponForm({ onCreated }: { onCreated: () => void }) {
  const [sport, setSport] = useState('football');
  const [match, setMatch] = useState('');
  const [selection, setSelection] = useState('');
  const [odds, setOdds] = useState('5');
  const [couponCode, setCouponCode] = useState('');
  const [tier, setTier] = useState<'free' | 'gold' | 'investor'>('gold');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!match.trim() || !selection.trim() || !couponCode.trim()) {
      return showToast('Match, sélection et code coupon sont obligatoires');
    }
    setBusy(true);
    try {
      await api('/predictions/manual', {
        method: 'POST',
        auth: true,
        body: {
          sport, match: match.trim(), market: `Coupon`, selection: selection.trim(),
          odds: Number(odds), couponCode: couponCode.trim(), tier,
        },
      });
      showToast('Coupon publié');
      setMatch(''); setSelection(''); setCouponCode('');
      onCreated();
    } catch (e: any) {
      showToast(e.message || 'Échec de la création');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="font-black mb-1">Créer un coupon manuellement</h3>
      <p className="text-xs text-gray-400 mb-4">
        Contenu promotionnel que tu contrôles toi-même (indépendant du moteur IA) — publié
        immédiatement dans le tier choisi. Sert à animer le flux entre deux passages du moteur.
      </p>
      <div className="grid md:grid-cols-2 gap-3">
        <select value={sport} onChange={(e) => setSport(e.target.value)} className="glass rounded-xl px-3 tap-target outline-none bg-night">
          {['football', 'basketball', 'hockey', 'tennis_table'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={tier} onChange={(e) => setTier(e.target.value as any)} className="glass rounded-xl px-3 tap-target outline-none bg-night">
          <option value="gold">Gold</option>
          <option value="investor">Investisseur</option>
          <option value="free">Ticket gratuit</option>
        </select>
        <input value={match} onChange={(e) => setMatch(e.target.value)} placeholder="Ex : Combiné du jour"
          className="glass rounded-xl px-3 tap-target outline-none focus:border-gold md:col-span-2" />
        <input value={selection} onChange={(e) => setSelection(e.target.value)} placeholder="Sélection (ex : Combiné 3 matchs)"
          className="glass rounded-xl px-3 tap-target outline-none focus:border-gold md:col-span-2" />
        <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Code coupon 1xBet"
          className="glass rounded-xl px-3 tap-target outline-none focus:border-gold md:col-span-2" />
        <div className="md:col-span-2">
          <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Cote</label>
          <div className="flex gap-2 flex-wrap">
            {[5, 10, 15, 50].map((v) => (
              <button key={v} type="button" onClick={() => setOdds(String(v))}
                className={`px-4 py-2 rounded-xl text-sm font-black tap-target ${odds === String(v) ? 'gold-gradient text-black' : 'glass hover:bg-white/10'}`}>
                Cote {v}
              </button>
            ))}
            <input value={odds} onChange={(e) => setOdds(e.target.value)} inputMode="decimal" placeholder="Autre"
              className="glass rounded-xl px-3 py-2 text-sm outline-none focus:border-gold w-24" />
          </div>
        </div>
      </div>
      <button onClick={create} disabled={busy} className="gold-gradient text-black rounded-xl font-black tap-target px-6 mt-4 disabled:opacity-60">
        {busy ? 'Publication…' : 'Publier le coupon'}
      </button>
    </div>
  );
}

/* ── Prédictions IA (réception moteur + push) ───────────── */
function PredictionsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [perf, setPerf] = useState<any>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const load = () => {
    api<any[]>('/predictions/admin', { auth: true }).then((d) => {
      setItems(d);
      setCodes(Object.fromEntries(d.map((p) => [p.id, p.couponCode || ''])));
    }).catch(() => {});
    api('/predictions/performance', { auth: true }).then(setPerf).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const publish = async (id: string, tier: 'free' | 'gold') => {
    await api(`/predictions/${id}/publish`, { method: 'POST', auth: true, body: { tier, couponCode: codes[id] } });
    showToast(tier === 'free' ? 'Poussé en ticket gratuit' : 'Poussé dans le flux Gold'); load();
  };

  const resultChip: Record<string, string> = {
    won: 'text-live border-live/40', lost: 'text-red-400 border-red-400/40', pending: 'text-gray-400 border-white/15',
  };

  return (
    <div className="space-y-3">
      <ManualCouponForm onCreated={load} />

      {/* Performance auto-apprenante */}
      {perf && (
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-black flex items-center gap-2"><Brain size={18} className="text-gold" /> Performance de l’IA</h3>
            <span className="text-2xl font-black text-gold">{perf.overall.rate}%</span>
          </div>
          <p className="text-xs text-gray-400 mb-3">{perf.overall.won}/{perf.overall.total} pronostics gagnés · {perf.overall.pending} en attente de résultat</p>
          <div className="grid md:grid-cols-2 gap-x-6 gap-y-1">
            {(perf.byMarket || []).map((m: any) => (
              <div key={m.key} className="flex items-center gap-2 text-xs">
                <span className="w-36 shrink-0 truncate text-gray-400">{m.key}</span>
                <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                  <div className={m.rate >= 50 ? 'h-full bg-live' : 'h-full bg-red-400'} style={{ width: `${m.rate}%` }} />
                </div>
                <span className="w-14 text-right text-gray-400">{m.won}/{m.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-gray-400 text-sm">
        Statistiques poussées par le moteur IA (chaque 00h00 via <code>/api/predictions/ingest</code>) — <b>sans code</b>.
        Le badge <b className="text-live">anti-piège</b> compare la probabilité IA à la cote.
      </p>

      {(() => {
        const card = (p: any, showActions: boolean) => {
          const trap = p.valueScore <= 0;
          return (
            <div key={p.id} className="glass rounded-xl p-4">
              <div className="flex justify-between items-start gap-3 flex-wrap">
                <div>
                  <div className="font-bold">{p.match} <span className="text-[10px] uppercase text-gray-500 ml-1">{p.sport}</span></div>
                  <div className="text-xs text-gray-400">{p.market} · {p.selection} · cote <b className="text-gold">{p.odds}</b> · fiabilité {p.reliability}%</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase font-black border rounded-full px-2 py-0.5 ${trap ? 'text-red-400 border-red-400/40' : 'text-live border-live/40'}`}>
                    {trap ? 'Cote piège' : `Value +${p.valueScore}`}
                  </span>
                  {showActions && (
                    <span className={`text-[10px] uppercase border rounded-full px-2 py-0.5 ${p.isValidated ? 'text-live border-live/40' : 'text-gold border-gold/40'}`}>
                      {p.isValidated ? `live · ${p.tier}` : 'en attente'}
                    </span>
                  )}
                  {p.result && p.result !== 'pending' && (
                    <span className={`text-[10px] uppercase font-black border rounded-full px-2 py-0.5 ${resultChip[p.result]}`}>
                      {p.result === 'won' ? 'gagné' : 'perdu'}{p.resultNote ? ` ${p.resultNote}` : ''}
                    </span>
                  )}
                </div>
              </div>
              {p.analysis && <AnalysisView analysis={p.analysis} />}
              {showActions && (
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <input value={codes[p.id] ?? ''} onChange={(e) => setCodes({ ...codes, [p.id]: e.target.value })}
                    placeholder="Code coupon 1xBet" className="glass rounded-lg px-3 py-2 text-sm outline-none focus:border-gold flex-1 min-w-[160px]" />
                  <button onClick={() => publish(p.id, 'free')} className="glass rounded-lg px-3 py-2 text-sm hover:bg-white/10">Ticket gratuit (cote 2)</button>
                  <button onClick={() => publish(p.id, 'gold')} className="gold-gradient text-black rounded-lg px-3 py-2 text-sm font-bold">Pousser dans Gold</button>
                </div>
              )}
            </div>
          );
        };
        // Regroupement PAR DATE (du plus récent au plus ancien).
        const byDate = (list: any[], showActions: boolean) => {
          const groups: Record<string, any[]> = {};
          for (const p of list) (groups[p.eventDate || 'Date inconnue'] ||= []).push(p);
          const dates = Object.keys(groups).sort().reverse();
          return dates.map((d) => (
            <div key={d} className="mb-4">
              <div className="text-[11px] font-black text-gold uppercase tracking-widest mb-2">📆 {d} <span className="text-gray-500">({groups[d].length})</span></div>
              <div className="space-y-3">{groups[d].map((p) => card(p, showActions))}</div>
            </div>
          ));
        };
        const current = items.filter((p) => !p.result || p.result === 'pending');
        const past = items.filter((p) => p.result && p.result !== 'pending');
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-black flex items-center gap-2">📅 Matchs du jour / à venir <span className="text-xs text-gray-500">({current.length})</span></h3>
              <p className="text-[11px] text-gray-500 mb-3">Donnés automatiquement après l’analyse de 00h00 — à pousser en Gratuit/Gold. Listés par date.</p>
              {current.length ? byDate(current, true) : <p className="text-gray-500 text-sm">Aucun match du jour pour l’instant.</p>}
            </div>
            <div>
              <h3 className="font-black flex items-center gap-2">🏁 Matchs passés analysés <span className="text-xs text-gray-500">({past.length})</span></h3>
              <p className="text-[11px] text-gray-500 mb-3">Conservés sur le site, listés par date, avec leur statut (gagné / perdu).</p>
              {past.length ? byDate(past, false) : <p className="text-gray-500 text-sm">Aucun match noté pour l’instant.</p>}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ── Bibliothèque média (upload / suppr / téléchargement) ── */
function MediaTab() {
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const load = () => api<any[]>('/media', { auth: true }).then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try { await apiUpload('/media/upload', file); showToast('Fichier uploadé'); load(); }
    catch (err: any) { showToast(err.message || 'Upload impossible'); }
    finally { setBusy(false); e.target.value = ''; }
  };
  const del = async (id: string) => { await api(`/media/${id}`, { method: 'DELETE', auth: true }); load(); };

  return (
    <div className="space-y-4">
      <label className={`glass rounded-2xl p-6 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-white/15 cursor-pointer hover:bg-white/5 transition ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
        <Upload size={28} className="text-gold" />
        <span className="font-bold">{busy ? 'Envoi en cours…' : 'Uploader une image ou une vidéo'}</span>
        <span className="text-[11px] text-gray-500">Depuis ton PC ou ton téléphone · max 200 Mo</span>
        <input type="file" accept="image/*,video/*" onChange={onUpload} className="hidden" />
      </label>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((m) => (
          <div key={m.id} className="glass rounded-xl overflow-hidden">
            <div className="aspect-video bg-black flex items-center justify-center">
              {m.kind === 'image'
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={mediaUrl(m.url)} alt={m.originalName} className="w-full h-full object-cover" />
                : <video src={mediaUrl(m.url)} className="w-full h-full object-cover" muted />}
            </div>
            <div className="p-2">
              <div className="text-xs font-bold truncate">{m.originalName}</div>
              <div className="text-[10px] text-gray-500 uppercase">{m.kind} · {Math.round(m.size / 1024)} Ko</div>
              <div className="flex gap-2 mt-2">
                <a href={mediaUrl(m.url)} download className="text-electric text-xs">Télécharger</a>
                <button onClick={() => del(m.id)} className="text-red-400 text-xs ml-auto">Supprimer</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {!items.length && <p className="text-gray-500 text-sm">Bibliothèque vide.</p>}
    </div>
  );
}

/* ── Textes globaux & tarification ──────────────────────── */
function TextsTab() {
  const [price, setPrice] = useState('');
  const [priceLabel, setPriceLabel] = useState('');
  const [legal, setLegal] = useState('');
  const [pitch, setPitch] = useState('');
  const [fcTitle, setFcTitle] = useState('');
  const [fcCta, setFcCta] = useState('');
  const [fcMsg, setFcMsg] = useState('');
  const [goldAnnounce, setGoldAnnounce] = useState('');
  const [investorAnnounce, setInvestorAnnounce] = useState('');
  const [chariowLink, setChariowLink] = useState('');
  useEffect(() => {
    api('/cms/public').then((c: any) => {
      setChariowLink(c.settings?.chariow_gold_link?.url ?? '');
      setPrice(String(c.settings?.gold_price?.amount ?? 5600));
      setPriceLabel(c.settings?.gold_price_label?.text ?? '');
      setLegal(c.settings?.legal_investor?.text ?? '');
      setPitch(c.settings?.investor_pitch?.text ?? '');
      setFcTitle(c.settings?.free_coupon_title?.text ?? '');
      setFcCta(c.settings?.free_coupon_cta?.text ?? '');
      setFcMsg(c.settings?.free_coupon_message?.text ?? '');
      setGoldAnnounce(c.settings?.gold_announcement?.text ?? '');
      setInvestorAnnounce(c.settings?.investor_announcement?.text ?? '');
    }).catch(() => {});
  }, []);
  const saveSetting = async (key: string, value: unknown, label: string) => {
    await api(`/cms/settings/${key}`, { method: 'PUT', auth: true, body: { value } });
    showToast(`${label} mis à jour`);
  };
  return (
    <div className="space-y-5 max-w-2xl">
      {/* Lien de paiement rapide Chariow — colle ici le lien du produit Gold de ta boutique.
          Tant qu'il est vide, le bouton « Paiement rapide » n'apparaît pas côté client. */}
      <div className="glass rounded-2xl p-6 border border-gold/30">
        <h3 className="font-black mb-1">Lien « Paiement rapide » (Chariow)</h3>
        <p className="text-gray-400 text-sm mb-3">
          Colle le lien du produit Gold de ta boutique Chariow. Le client paiera par carte ou
          Mobile Money et son accès sera <b>débloqué automatiquement</b>. Laisse vide pour
          masquer le bouton.
        </p>
        <input value={chariowLink} onChange={(e) => setChariowLink(e.target.value)}
          placeholder="https://xaxjtdyw.mychariow.shop/prd_xxxxxxx"
          className="w-full glass rounded-xl px-4 mb-3 tap-target outline-none focus:border-gold" />
        <button onClick={() => saveSetting('chariow_gold_link', { url: chariowLink.trim() }, 'Lien de paiement rapide')}
          className="gold-gradient text-black rounded-xl font-black tap-target px-6">Enregistrer le lien</button>
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="font-black mb-1">Tarif de l&apos;abonnement Gold</h3>
        <p className="text-gray-400 text-sm mb-3">Le <b>montant</b> sert au paiement ; le <b>texte affiché</b> est libre (carte VIP + inscription). Change les deux quand tu changes le prix.</p>

        <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Montant (FCFA, utilisé pour le paiement)</label>
        <div className="flex gap-2 mb-4">
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric"
            className="glass rounded-xl px-4 tap-target outline-none focus:border-gold w-40" />
          <span className="self-center text-gray-400">FCFA / mois</span>
        </div>

        <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Texte affiché du prix (carte VIP)</label>
        <input value={priceLabel} onChange={(e) => setPriceLabel(e.target.value)} placeholder="ex : 10$ / 5600 FCFA par mois"
          className="w-full glass rounded-xl px-4 mb-1 tap-target outline-none focus:border-gold" />
        <p className="text-[11px] text-gray-500 mb-3">Laisse vide pour afficher automatiquement « {Number(price || 0).toLocaleString('fr-FR')} FCFA / mois ».</p>

        <button onClick={async () => {
          await saveSetting('gold_price', { amount: Number(price) }, 'Montant Gold');
          await saveSetting('gold_price_label', { text: priceLabel }, 'Texte du prix');
        }} className="gold-gradient text-black rounded-xl font-black tap-target px-5">Enregistrer le tarif</button>
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="font-black mb-1">Annonce dans l&apos;espace Gold</h3>
        <p className="text-gray-400 text-sm mb-3">
          Bandeau affiché en haut du tableau de bord Gold — motive les membres, annonce une
          info ponctuelle. Laisse vide pour ne rien afficher.
        </p>
        <textarea value={goldAnnounce} onChange={(e) => setGoldAnnounce(e.target.value)} rows={2}
          placeholder="Ex : Nouveaux coupons ajoutés chaque jour à 9h — reste connecté !"
          className="w-full glass rounded-xl px-4 py-3 mb-3 outline-none focus:border-gold" />
        <button onClick={() => saveSetting('gold_announcement', { text: goldAnnounce }, 'Annonce Gold')}
          className="gold-gradient text-black rounded-xl font-black tap-target px-5">Enregistrer</button>
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="font-black mb-1">Annonce dans l&apos;espace Investisseur</h3>
        <p className="text-gray-400 text-sm mb-3">
          Bandeau affiché en haut du tableau de bord Investisseur — ex. besoin de capital ce
          mois-ci, quota bientôt atteint… Laisse vide pour ne rien afficher.
        </p>
        <textarea value={investorAnnounce} onChange={(e) => setInvestorAnnounce(e.target.value)} rows={2}
          placeholder="Ex : Il reste 4 places pour le cycle de ce mois — recharge avant le 15 !"
          className="w-full glass rounded-xl px-4 py-3 mb-3 outline-none focus:border-gold" />
        <button onClick={() => saveSetting('investor_announcement', { text: investorAnnounce }, 'Annonce Investisseur')}
          className="gold-gradient text-black rounded-xl font-black tap-target px-5">Enregistrer</button>
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="font-black mb-1">Coupon gratuit (cote du jour)</h3>
        <p className="text-gray-400 text-sm mb-3">Textes affichés sur la cote gratuite. La copie reste <b>libre</b> (sans compte) ; le message + la vidéo s’affichent après la copie.</p>
        <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Titre</label>
        <input value={fcTitle} onChange={(e) => setFcTitle(e.target.value)} placeholder="Cote du jour — Gratuite"
          className="w-full glass rounded-xl px-4 mb-3 tap-target outline-none focus:border-gold" />
        <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Bouton</label>
        <input value={fcCta} onChange={(e) => setFcCta(e.target.value)} placeholder="Copier le coupon gratuit"
          className="w-full glass rounded-xl px-4 mb-3 tap-target outline-none focus:border-gold" />
        <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Message après copie</label>
        <textarea value={fcMsg} onChange={(e) => setFcMsg(e.target.value)} rows={3}
          placeholder="Coupon copié ✅ Regarde la vidéo, crée ton compte…"
          className="w-full glass rounded-xl px-4 py-3 mb-3 outline-none focus:border-gold" />
        <button onClick={async () => {
          await saveSetting('free_coupon_title', { text: fcTitle }, 'Titre coupon');
          await saveSetting('free_coupon_cta', { text: fcCta }, 'Bouton coupon');
          await saveSetting('free_coupon_message', { text: fcMsg }, 'Message coupon');
        }} className="gold-gradient text-black rounded-xl font-black tap-target px-5">Enregistrer le coupon</button>
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="font-black mb-1">Argumentaire Pack Investisseur</h3>
        <textarea value={pitch} onChange={(e) => setPitch(e.target.value)} rows={3}
          placeholder="Texte d'accroche affiché sur le bloc investisseur…"
          className="w-full glass rounded-xl px-4 py-3 my-3 outline-none focus:border-gold" />
        <button onClick={() => saveSetting('investor_pitch', { text: pitch }, 'Argumentaire')}
          className="gold-gradient text-black rounded-xl font-black tap-target px-5">Enregistrer</button>
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="font-black mb-1">Mentions légales — Pack Investisseur</h3>
        <p className="text-gray-400 text-sm mb-3">Texte juridique (« le risque zéro n&apos;existe pas »…), modifiable à la volée.</p>
        <textarea value={legal} onChange={(e) => setLegal(e.target.value)} rows={6}
          className="w-full glass rounded-xl px-4 py-3 mb-3 outline-none focus:border-gold" />
        <button onClick={() => saveSetting('legal_investor', { text: legal }, 'Mentions légales')}
          className="gold-gradient text-black rounded-xl font-black tap-target px-5">Enregistrer</button>
      </div>
    </div>
  );
}
