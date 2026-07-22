import { ReceiverNetwork } from '@prisma/client';

/**
 * Puces relais réceptrices. Plusieurs numéros par réseau = répartition de charge :
 * on étale les paiements sur plusieurs SIM pour qu'aucune ne sature (et si une puce
 * est gelée/pénalisée par l'opérateur, il suffit de passer `active: false` ici — les
 * clients cessent immédiatement de l'utiliser, sans redéploiement de logique).
 */
export interface ReceiverAccount {
  id: string;
  network: ReceiverNetwork;
  phone: string; // 8 chiffres, format local Togo
  label: string; // affiché au client
  active: boolean;
}

export const RECEIVER_ACCOUNTS: ReceiverAccount[] = [
  { id: 'moov-1', network: 'MOOV', phone: '96530302', label: '+228 96 53 03 02', active: true },
  // 2e puce Moov : à réactiver (active: true) le jour où cette SIM est en place ET qu'une
  // règle Listener existe pour `?receiver=86436058`. Sinon un client y serait envoyé sans
  // que le paiement soit capté.
  { id: 'moov-2', network: 'MOOV', phone: '86436058', label: '+228 86 43 60 58', active: false },
  { id: 'tmoney-1', network: 'TOGOCEL', phone: '71480354', label: '+228 71 48 03 54', active: true },
];

export const activeReceivers = () => RECEIVER_ACCOUNTS.filter((r) => r.active);

export const isKnownActiveReceiver = (network: ReceiverNetwork, phone: string) =>
  activeReceivers().some((r) => r.network === network && r.phone === normalizePhone(phone));

/**
 * Normalise un numéro pour comparaison robuste : ne garde que les chiffres, retire
 * l'indicatif Togo (228) et compare sur les 8 derniers chiffres. Ainsi
 * "+228 96 53 03 02", "22896530302" et "96530302" sont considérés identiques.
 */
export function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  const noCc = digits.startsWith('228') ? digits.slice(3) : digits;
  return noCc.slice(-8);
}
