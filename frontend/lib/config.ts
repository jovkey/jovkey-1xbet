/**
 * .trim() + retrait du slash final : une variable d'environnement collée dans un
 * dashboard (Vercel, Render…) embarque parfois un espace ou un saut de ligne invisible
 * en fin de valeur. Comme NEXT_PUBLIC_* est figée dans le bundle au build, ce genre de
 * caractère invisible casse silencieusement l'URL réelle appelée par fetch() (DNS
 * introuvable) sans que rien ne le laisse voir dans les DevTools au premier coup d'œil.
 */
function cleanUrl(value: string | undefined, fallback: string): string {
  return (value || fallback).trim().replace(/\/+$/, '');
}

export const API_URL = cleanUrl(process.env.NEXT_PUBLIC_API_URL, 'http://localhost:4000');
export const PROMO_CODE = (process.env.NEXT_PUBLIC_PROMO_CODE || 'JOVKEY').trim();

/** Préfixe l'URL relative d'un média (/uploads/...) par l'hôte de l'API. */
export const mediaUrl = (url: string) => (url?.startsWith('/') ? `${API_URL}${url}` : url);

/** Abonnement Gold (figé côté serveur). */
export const GOLD_PRICE_XOF = 5600;
export const CURRENCY = 'FCFA';

export type PayMethodId = 'mtn' | 'moov' | 'orange' | 'wave' | 'card' | 'paypal' | 'other';

/** Moyens de paiement locaux (mobile money Afrique) + internationaux. */
export const PAYMENT_METHODS: {
  id: PayMethodId;
  label: string;
  emoji: string;
  /** Libellé du champ de référence selon le moyen. */
  refLabel: string;
  refPlaceholder: string;
}[] = [
  { id: 'mtn', label: 'MTN MoMo', emoji: '📱', refLabel: 'Numéro MTN', refPlaceholder: '+228 90 00 00 00' },
  { id: 'moov', label: 'Moov Money', emoji: '📱', refLabel: 'Numéro Moov', refPlaceholder: '+228 96 00 00 00' },
  { id: 'orange', label: 'Orange Money', emoji: '📱', refLabel: 'Numéro Orange', refPlaceholder: '+225 07 00 00 00' },
  { id: 'wave', label: 'Wave', emoji: '🌊', refLabel: 'Numéro Wave', refPlaceholder: '+221 70 000 00 00' },
  { id: 'card', label: 'Carte bancaire', emoji: '💳', refLabel: 'Réf. transaction', refPlaceholder: 'Visa / Mastercard' },
  { id: 'paypal', label: 'PayPal', emoji: '🅿️', refLabel: 'Email PayPal', refPlaceholder: 'vous@email.com' },
  { id: 'other', label: 'Autre', emoji: '➕', refLabel: 'Référence', refPlaceholder: 'Détail du paiement' },
];
