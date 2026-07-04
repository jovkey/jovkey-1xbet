'use client';
import { useEffect, useRef, useState } from 'react';
import { X, PlayCircle, ArrowRight, Clock, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { PROMO_CODE, mediaUrl } from '@/lib/config';
import { FunnelTunnel } from '@/lib/funnel';

type Step = 'closed' | 'video' | 'form' | 'holding';

interface VideoSetting {
  provider?: string;
  embedId?: string;
  url?: string;
}

export default function FlashFunnelModal({ video }: { video?: VideoSetting }) {
  const [step, setStep] = useState<Step>('closed');
  const [tunnel, setTunnel] = useState<FunnelTunnel>('flash');
  const [showVideo, setShowVideo] = useState(true);
  const [whatsapp, setWhatsapp] = useState('');
  const [id1xbet, setId1xbet] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [leadStatus, setLeadStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setTunnel(detail.tunnel || 'flash');
      setShowVideo(true);
      setError('');
      setStep('video');
    };
    window.addEventListener('jovkey:open-funnel', handler);
    return () => window.removeEventListener('jovkey:open-funnel', handler);
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const close = () => {
    setStep('closed');
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const submit = async () => {
    setError('');
    if (!/^[+0-9 ]{8,20}$/.test(whatsapp)) return setError('Numéro WhatsApp invalide.');
    if (id1xbet.trim().length < 3) return setError('ID 1xBet invalide.');
    setSubmitting(true);
    try {
      const res = await api<{ leadId: string }>('/flash/leads', {
        method: 'POST',
        body: { whatsappNum: whatsapp, id1xbet, sourceTunnel: tunnel },
      });
      setStep('holding');
      // §1 — sondage du statut pendant l'écran de temporisation 24h.
      pollRef.current = setInterval(async () => {
        try {
          const s = await api<{ status: typeof leadStatus }>(`/flash/leads/${res.leadId}/status`);
          setLeadStatus(s.status);
          if (s.status !== 'pending' && pollRef.current) clearInterval(pollRef.current);
        } catch { /* ignore */ }
      }, 8000);
    } catch (e: any) {
      setError(e.message || 'Erreur, réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'closed') return null;

  const embedId = video?.embedId || 'dQw4w9WgXcQ';

  return (
    <div className="fixed inset-0 bg-black/85 z-[100] flex items-end md:items-center justify-center">
      {/* Modale verticale optimisée smartphone */}
      <div className="glass w-full max-w-md rounded-t-3xl md:rounded-3xl p-6 relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={close}
          aria-label="Fermer"
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X />
        </button>

        {step === 'video' && (
          <div>
            <h3 className="text-2xl font-black mb-2">
              Active ton bonus <span className="text-gold">+200%</span>
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Regarde comment créer ton compte 1xBet avec le code <b className="text-gold">{PROMO_CODE}</b>.
            </p>

            {showVideo && (
              <div className="aspect-[9/16] max-h-[45vh] w-full rounded-2xl overflow-hidden mb-4 bg-black">
                {video?.provider === 'cloudinary' && video?.url ? (
                  <video className="w-full h-full" src={video.url} controls playsInline />
                ) : video?.provider === 'upload' && video?.url ? (
                  <video className="w-full h-full" src={mediaUrl(video.url)} controls playsInline />
                ) : (
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${embedId}`}
                    title="Tutoriel inscription 1xBet"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
                    allowFullScreen
                  />
                )}
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => setShowVideo(true)}
                className="w-full glass hover:bg-white/10 rounded-xl font-bold tap-target flex items-center justify-center gap-2 transition"
              >
                <PlayCircle size={18} /> Regarder le tutoriel
              </button>
              <button
                onClick={() => setStep('form')}
                className="w-full gold-gradient text-black rounded-xl font-black tap-target flex items-center justify-center gap-2 hover:scale-[1.02] transition"
              >
                Continuer l&apos;inscription <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {step === 'form' && (
          <div>
            <h3 className="text-2xl font-black mb-1">Formulaire Flash</h3>
            <p className="text-gray-400 text-sm mb-5">
              Saisis ton numéro WhatsApp et ton <b>nouvel ID de compte 1xBet</b>.
            </p>
            <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">
              Numéro WhatsApp
            </label>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              inputMode="tel"
              placeholder="+228 90 00 00 00"
              className="w-full glass rounded-xl px-4 mb-4 tap-target outline-none focus:border-gold"
            />
            <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">
              Nouvel ID de compte 1xBet
            </label>
            <input
              value={id1xbet}
              onChange={(e) => setId1xbet(e.target.value)}
              placeholder="1XB-XXXXXX"
              className="w-full glass rounded-xl px-4 mb-4 tap-target outline-none focus:border-gold"
            />
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <button
              disabled={submitting}
              onClick={submit}
              className="w-full gold-gradient text-black rounded-xl font-black tap-target disabled:opacity-60 hover:scale-[1.02] transition"
            >
              {submitting ? 'Envoi…' : 'Soumettre ma demande'}
            </button>
          </div>
        )}

        {step === 'holding' && (
          <div className="text-center py-4">
            {leadStatus === 'pending' && (
              <>
                <div className="mx-auto w-20 h-20 rounded-full gold-gradient flex items-center justify-center mb-5 animate-pulseGold">
                  <Clock className="text-black" size={36} />
                </div>
                <h3 className="text-xl font-black mb-1">Analyse du compte en cours</h3>
                <div className="inline-block text-xs font-black uppercase tracking-widest text-gold border border-gold/40 rounded-full px-4 py-1 mb-4">
                  Traitement sous 24h
                </div>
                <p className="text-gray-400 text-sm">
                  Votre demande a été transmise à notre équipe de modération. Nous vérifions
                  l&apos;activation du code <b className="text-gold">{PROMO_CODE}</b> sur votre ID
                  sous 24 heures. Vous recevrez votre lien d&apos;accès exclusif directement par
                  WhatsApp.
                </p>
              </>
            )}
            {leadStatus === 'approved' && (
              <>
                <div className="mx-auto w-20 h-20 rounded-full bg-live/20 flex items-center justify-center mb-5">
                  <ShieldCheck className="text-live" size={36} />
                </div>
                <h3 className="text-xl font-black mb-2">Compte validé ✅</h3>
                <p className="text-gray-400 text-sm">
                  Votre accès est confirmé. Le lien communautaire vous a été envoyé sur WhatsApp.
                </p>
              </>
            )}
            {leadStatus === 'rejected' && (
              <p className="text-red-400 text-sm py-8">
                Votre demande n&apos;a pas pu être validée. Contactez le support.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
