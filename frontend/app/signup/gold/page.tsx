'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Crown, ArrowLeft, CreditCard, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { GOLD_PRICE_XOF, CURRENCY } from '@/lib/config';
import Navbar from '@/components/Navbar';

export default function GoldSignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [price, setPrice] = useState(GOLD_PRICE_XOF);
  // Lien Chariow « Paiement rapide » configuré par l'admin (vide = bouton masqué).
  const [chariowLink, setChariowLink] = useState('');
  // FedaPay masqué par défaut ; réactivable par le super-admin depuis le panel.
  const [fedapayEnabled, setFedapayEnabled] = useState(false);

  useEffect(() => {
    api('/cms/public').then((c: any) => {
      const amount = Number(c.settings?.gold_price?.amount);
      if (amount > 0) setPrice(amount);
      setChariowLink(c.settings?.chariow_gold_link?.url || '');
      setFedapayEnabled(!!c.settings?.fedapay_enabled?.enabled);
    }).catch(() => {});
  }, []);

  // FedaPay ne s'affiche que s'il est explicitement activé, OU s'il n'y a pas encore de
  // lien Chariow (filet de sécurité : il faut toujours au moins un moyen de paiement).
  const showFedapay = fedapayEnabled || !chariowLink;

  /** Validation commune du formulaire avant toute création de compte. */
  const validate = () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setError('Email invalide.'); return false; }
    if (password.length < 6) { setError('Mot de passe : 6 caractères minimum.'); return false; }
    return true;
  };

  /**
   * Paiement rapide (Chariow) : on crée le compte, puis on envoie le client payer sur la
   * boutique avec SON email pré-rempli. C'est cet email qui relie le paiement au compte —
   * le webhook Chariow débloque le Gold automatiquement dès que la vente est confirmée.
   */
  const payFast = async () => {
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      await api('/auth/signup/gold', { method: 'POST', body: { email, password, country } });
    } catch (err: any) {
      // Compte déjà existant : ce n'est pas bloquant, il peut quand même payer.
      if (!/existe|already/i.test(err?.message || '')) {
        setError(err.message || 'Inscription impossible.');
        setLoading(false);
        return;
      }
    }
    const sep = chariowLink.includes('?') ? '&' : '?';
    window.location.href = `${chariowLink}${sep}email=${encodeURIComponent(email)}`;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // FedaPay masqué → l'envoi du formulaire (touche Entrée) part sur le paiement rapide.
    if (!showFedapay) return payFast();
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await api<{ paymentUrl?: string }>('/auth/signup/gold', {
        method: 'POST',
        body: { email, password, country },
      });
      if (res.paymentUrl) {
        // Redirection vers le paiement FedaPay (activation auto au retour).
        window.location.href = res.paymentUrl;
      } else {
        setError('Paiement indisponible. Réessayez plus tard.');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Inscription impossible.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh flex items-center justify-center px-6 pt-24 pb-10">
      <Navbar />
      <form onSubmit={submit} className="glass rounded-3xl p-8 w-full max-w-md">
        <Link href="/" className="text-xs text-gray-400 hover:text-gold flex items-center gap-1 mb-4">
          <ArrowLeft size={14} /> Retour
        </Link>
        <div className="flex items-center gap-2 mb-1">
          <Crown className="text-gold" size={22} />
          <h1 className="text-2xl font-black">Inscription Gold</h1>
        </div>
        <p className="text-gray-400 text-sm mb-6">
          Abonnement <b className="text-gold">{price.toLocaleString('fr-FR')} {CURRENCY}/mois</b>.
          Paiement sécurisé (MTN, Moov, Orange, Wave, carte bancaire…) — accès <b>immédiat</b> après paiement.
        </p>

        <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoCapitalize="none" placeholder="vous@email.com"
          className="w-full glass rounded-xl px-4 mb-4 tap-target outline-none focus:border-gold" />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
              className="w-full glass rounded-xl px-4 mb-4 tap-target outline-none focus:border-gold" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Pays</label>
            <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Togo"
              className="w-full glass rounded-xl px-4 mb-4 tap-target outline-none focus:border-gold" />
          </div>
        </div>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        {/* Paiement rapide (Chariow) — affiché en premier dès que l'admin a renseigné le lien. */}
        {chariowLink && (
          <>
            <button type="button" disabled={loading} onClick={payFast}
              className="w-full gold-gradient text-black rounded-xl font-black tap-target disabled:opacity-60 hover:scale-[1.02] transition flex items-center justify-center gap-2 mb-3">
              <Zap size={18} /> {loading ? 'Redirection…' : `Paiement rapide — ${price.toLocaleString('fr-FR')} ${CURRENCY}`}
            </button>
            <p className="text-[11px] text-gray-500 text-center mb-3">
              Carte bancaire & Mobile Money · accès débloqué automatiquement.
              <br />Paie bien avec <b className="text-gray-300">l’email saisi ci-dessus</b>.
            </p>
            {showFedapay && (
              <div className="flex items-center gap-3 mb-3">
                <span className="h-px bg-white/10 flex-1" />
                <span className="text-[10px] uppercase tracking-widest text-gray-500">ou</span>
                <span className="h-px bg-white/10 flex-1" />
              </div>
            )}
          </>
        )}

        {showFedapay && (
          <button disabled={loading}
            className={`w-full rounded-xl font-black tap-target disabled:opacity-60 hover:scale-[1.02] transition flex items-center justify-center gap-2 ${
              chariowLink ? 'glass border border-gold/30 text-gold' : 'gold-gradient text-black'
            }`}>
            <CreditCard size={18} /> {loading ? 'Redirection vers le paiement…' : `Payer ${price.toLocaleString('fr-FR')} ${CURRENCY}`}
          </button>
        )}
        <p className="text-[11px] text-gray-500 mt-4 text-center">
          Déjà membre ? <Link href="/login" className="text-gold underline">Connexion</Link>
        </p>
      </form>
    </main>
  );
}
