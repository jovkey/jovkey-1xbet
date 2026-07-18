'use client';
import { useEffect, useMemo, useState } from 'react';
import { Copy, Flame, Trophy, Crown, Sparkles, ShieldCheck, Lock, Zap, Megaphone, History, ChevronDown, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { copyText } from '@/lib/clipboard';
import { mediaUrl } from '@/lib/config';
import { useRealtime } from '@/lib/useRealtime';
import { Prediction } from '@/lib/types';

const sportLabel: Record<string, string> = {
  football: 'Football',
  basketball: 'Basketball',
  hockey: 'Hockey',
  tennis_table: 'Tennis de table',
};

export default function GoldDashboard() {
  const [feed, setFeed] = useState<Prediction[]>([]);
  const [locked, setLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState('');
  const [renewing, setRenewing] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [slides, setSlides] = useState<{ id: string; imageUrl: string; caption?: string }[]>([]);
  // Deux sections repliables : « du jour » ouverte par défaut, « passés » fermée.
  const [showCurrent, setShowCurrent] = useState(true);
  const [showPast, setShowPast] = useState(false);

  const load = () =>
    api<{ locked: boolean; message?: string; items: Prediction[] }>('/predictions/feed', { auth: true })
      .then((res) => { setFeed(res.items); setLocked(res.locked); setLockMessage(res.message || ''); })
      .catch(() => {});
  useEffect(() => { load(); }, []);
  useEffect(() => {
    api<{ slides: any[]; settings: Record<string, any> }>('/cms/public')
      .then((c) => {
        setAnnouncement(c.settings?.gold_announcement?.text || '');
        setSlides((c.slides || []).filter((s) => s.linkTunnel === 'gold'));
      })
      .catch(() => {});
  }, []);
  useRealtime((type) => { if (type === 'prediction.new' || type === 'message') load(); });

  const renew = async () => {
    setRenewing(true);
    try {
      const res = await api<{ paymentUrl?: string }>('/payments/fedapay/renew-gold', { method: 'POST', auth: true });
      if (res.paymentUrl) window.location.href = res.paymentUrl;
    } catch {
      setRenewing(false);
    }
  };

  // Séparation : un pronostic noté (won/lost/void) est un match passé ; le reste est « du jour ».
  const { current, past, pastWon, pastGraded } = useMemo(() => {
    const cur: Prediction[] = [];
    const old: Prediction[] = [];
    for (const p of feed) (p.result && p.result !== 'pending' ? old : cur).push(p);
    const graded = old.filter((p) => p.result === 'won' || p.result === 'lost');
    return {
      current: cur,
      past: old,
      pastGraded: graded.length,
      pastWon: graded.filter((p) => p.result === 'won').length,
    };
  }, [feed]);

  return (
    <div className="space-y-6">
      {/* Bandeau abonnement — sans publicité */}
      <div className="vip-card rounded-3xl p-6 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-gold font-black mb-1">
            <Crown size={20} /> Pack Gold Elite {locked ? '— à renouveler' : '— actif'}
          </div>
          <p className="text-gray-400 text-sm flex items-center gap-2">
            <ShieldCheck size={14} className="text-live" /> Espace 100% sans publicité · pronostics générés par l’IA
          </p>
        </div>
        <Sparkles className="text-gold shrink-0 hidden md:block" size={36} />
      </div>

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

      {locked && (
        <div className="glass rounded-3xl p-6 border-2 border-gold/50 bg-gold/5 text-center">
          <Lock className="text-gold mx-auto mb-3" size={32} />
          <h3 className="text-xl font-black mb-2">Ton abonnement est arrivé à échéance</h3>
          <p className="text-gray-300 text-sm mb-5 max-w-md mx-auto">{lockMessage}</p>
          <button
            onClick={renew}
            disabled={renewing}
            className="gold-gradient text-black px-8 py-4 rounded-xl font-black tap-target inline-flex items-center gap-2 hover:scale-[1.03] transition disabled:opacity-60"
          >
            <Zap size={18} /> {renewing ? 'Redirection…' : 'Renouveler maintenant'}
          </button>
        </div>
      )}

      {/* ── Section 1 : matchs du jour (repliable, ouverte par défaut) ── */}
      <button
        onClick={() => setShowCurrent((v) => !v)}
        className="w-full glass rounded-2xl px-5 py-4 flex items-center justify-between tap-target"
      >
        <span className="flex items-center gap-2 text-xl font-black">
          <Flame className="text-gold" /> Matchs du jour
          <span className="text-xs font-bold text-black bg-gold rounded-full px-2 py-0.5">{current.length}</span>
        </span>
        <ChevronDown className={`text-gold transition-transform ${showCurrent ? 'rotate-180' : ''}`} />
      </button>

      {showCurrent && (
        <div className="grid md:grid-cols-2 gap-5">
          {current.map((p) => (
            <div key={p.id} className="glass rounded-2xl p-5 border-l-4 border-gold relative overflow-hidden">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] uppercase tracking-widest text-gray-400">
                  {sportLabel[p.sport] || p.sport} · {p.market}
                </span>
                <span className="text-xs font-black text-live flex items-center gap-1">
                  <Trophy size={12} /> {p.reliability}%
                </span>
              </div>
              <div className="font-bold text-lg">{p.match}</div>
              <div className="text-gray-400 text-sm mb-3">{p.selection}</div>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-gold">{p.odds.toFixed(2)}</span>
                {locked ? (
                  <button onClick={renew} className="glass px-5 rounded-xl font-black tap-target flex items-center gap-2 border border-gold/40 text-gold">
                    <Lock size={16} /> Renouveler pour voir
                  </button>
                ) : (
                  <button
                    onClick={() => copyText(p.couponCode, 'Code coupon 1xBet copié !')}
                    className="gold-gradient text-black px-5 rounded-xl font-black tap-target flex items-center gap-2 hover:scale-[1.03] transition"
                  >
                    <Copy size={16} /> Copier le code
                  </button>
                )}
              </div>
            </div>
          ))}
          {!current.length && (
            <p className="text-gray-500 text-sm col-span-2">
              Aucune opportunité active pour le moment. Le moteur d’analyse pousse les coups dès
              qu’une valeur est détectée.
            </p>
          )}
        </div>
      )}

      {/* ── Section 2 : matchs passés + résultats (repliable, fermée par défaut) ── */}
      <button
        onClick={() => setShowPast((v) => !v)}
        className="w-full glass rounded-2xl px-5 py-4 flex items-center justify-between tap-target"
      >
        <span className="flex items-center gap-2 text-xl font-black">
          <History className="text-electric" /> Matchs passés & résultats
          <span className="text-xs font-bold text-white bg-white/10 rounded-full px-2 py-0.5">{past.length}</span>
          {pastGraded > 0 && (
            <span className="text-xs font-bold text-live">
              {pastWon}/{pastGraded} gagnés ({Math.round((100 * pastWon) / pastGraded)}%)
            </span>
          )}
        </span>
        <ChevronDown className={`text-electric transition-transform ${showPast ? 'rotate-180' : ''}`} />
      </button>

      {showPast && (
        <div className="grid md:grid-cols-2 gap-5">
          {past.map((p) => (
            <div
              key={p.id}
              className={`glass rounded-2xl p-5 border-l-4 relative overflow-hidden opacity-90 ${
                p.result === 'won' ? 'border-live' : p.result === 'lost' ? 'border-red-500' : 'border-gray-500'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] uppercase tracking-widest text-gray-400">
                  {sportLabel[p.sport] || p.sport} · {p.market}
                  {p.eventDate ? ` · ${p.eventDate}` : ''}
                </span>
                {p.result === 'won' ? (
                  <span className="text-xs font-black text-live flex items-center gap-1"><CheckCircle2 size={14} /> Gagné</span>
                ) : p.result === 'lost' ? (
                  <span className="text-xs font-black text-red-400 flex items-center gap-1"><XCircle size={14} /> Perdu</span>
                ) : (
                  <span className="text-xs font-black text-gray-400">Annulé</span>
                )}
              </div>
              <div className="font-bold text-lg">{p.match}</div>
              <div className="text-gray-400 text-sm">{p.selection}</div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-2xl font-black text-gold/80">{p.odds.toFixed(2)}</span>
                {p.resultNote && <span className="text-sm text-gray-300 font-bold">{p.resultNote}</span>}
              </div>
            </div>
          ))}
          {!past.length && (
            <p className="text-gray-500 text-sm col-span-2">
              Aucun match passé pour l’instant — les résultats apparaissent ici automatiquement
              chaque nuit, une fois les matchs joués et notés par le moteur.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
