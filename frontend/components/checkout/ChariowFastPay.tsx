'use client';
import { useEffect, useState } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * Bouton « Paiement rapide » (Pack Gold) : envoie le client vers le lien de produit
 * Chariow (carte + Mobile Money local). Le lien est configuré par l'admin dans le CMS
 * (clé `chariow_gold_link`). On y ajoute l'email du compte pour que Chariow le pré-remplisse
 * (l'email est notre ancre côté serveur : le compte activé est celui de l'acheteur).
 *
 * La confirmation du paiement est automatique côté serveur (webhook Chariow → déblocage),
 * ce composant se contente d'envoyer le client payer.
 */
export default function ChariowFastPay({ email }: { email?: string | null }) {
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ settings: Record<string, any> }>('/cms/public')
      .then((c) => setLink(c.settings?.chariow_gold_link?.url || c.settings?.chariow_gold_link?.text || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!link) return null; // pas encore configuré par l'admin → on n'affiche rien

  const href = email
    ? `${link}${link.includes('?') ? '&' : '?'}email=${encodeURIComponent(email)}`
    : link;

  return (
    <a
      href={href}
      className="w-full gold-gradient text-black rounded-xl py-4 font-black tap-target flex items-center justify-center gap-2 hover:scale-[1.02] transition"
    >
      <Zap size={18} /> Paiement rapide (recommandé)
    </a>
  );
}
