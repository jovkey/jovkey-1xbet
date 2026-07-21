import { ReceiverNetwork } from '@prisma/client';

/**
 * Décodeur des SMS Mobile Money togolais (Moov Money ex-Flooz, et Mixx by Yas ex-T-Money).
 * Le téléphone « Listener » nous transmet le texte brut ; on en extrait le montant,
 * le numéro de l'expéditeur, la référence et le NOUVEAU SOLDE (clé de la sécurité :
 * la continuité du solde est ce qu'un faussaire ne peut pas deviner).
 *
 * Formats réels observés :
 *
 * Moov Money (ex-Flooz) — réception :
 *   Transfert recu.
 *   Montant: 7 280,00 FCFA
 *   Expéditeur: 22899043790
 *   Nouveau solde Moov Money: 7 280,69 FCFA.
 *   Txn ID: 040726008443
 *
 * Mixx by Yas (ex-T-Money) — réception :
 *   Montant reçu : 3 100 FCFA. De : KOKOU JOSEPH(72240231) , 17-07-26 16:35.
 *   Nouveau solde Mixx: 3 129 FCFA. Ref :18408728305.
 */

export interface ParsedSms {
  network: ReceiverNetwork | null; // déduit du texte quand possible ; la puce réelle vient du Listener
  isCredit: boolean;        // true = argent reçu (seul cas qui peut valider un paiement)
  amount: number | null;    // montant reçu
  senderPhone: string | null; // normalisé sur 8 chiffres
  senderName: string | null;
  reference: string | null; // Txn ID / Ref — anti-rejeu
  newBalance: number | null; // « Nouveau solde » — continuité anti-falsification
}

/** "7 280,00" / "3 100" / "7 280,69" → 7280.00 / 3100 / 7280.69 */
function parseAmount(raw?: string | null): number | null {
  if (!raw) return null;
  // retire espaces normaux, insécables et fines insécables utilisés comme séparateur de milliers
  const cleaned = raw.replace(/[\s  ]/g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Ne garde que les chiffres, retire l'indicatif Togo (228), compare sur 8 chiffres. */
function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  const noCc = digits.startsWith('228') ? digits.slice(3) : digits;
  return noCc.length >= 8 ? noCc.slice(-8) : null;
}

export function parseSms(text: string): ParsedSms | null {
  if (!text) return null;
  const t = text.replace(/\r/g, ' ');
  const lower = t.toLowerCase();

  // Réseau déduit du texte quand il est mentionné. Facultatif : certains SMS (retraits)
  // ne nomment pas l'opérateur — la puce réelle est de toute façon fournie par le Listener.
  const isMoov = /moov\s*money|flooz/i.test(t);
  const isMixx = /mixx|t-?money|\byas\b/i.test(t);
  const network: ReceiverNetwork | null = isMoov ? 'MOOV' : isMixx ? 'TOGOCEL' : null;

  // Crédit = « Transfert recu/reçu » (Moov) ou « Montant reçu/recu » (Mixx).
  // On rejette explicitement les retraits / débits (« vous avez retiré », « débité »).
  const isDebit = /vous\s+avez\s+retir|d[ée]bit/i.test(lower);
  const isCredit = !isDebit && /(transfert\s+re[cç]u|montant\s+re[cç]u)/i.test(lower);

  // Montant : « Montant: 7 280,00 FCFA » ou « Montant reçu : 3 100 FCFA »
  const amount = parseAmount(
    t.match(/montant\s*(?:re[cç]u)?\s*:?\s*([\d\s  .,]+?)\s*(?:f\s*cfa|fcfa|xof)/i)?.[1],
  );

  // Expéditeur : « Expéditeur: 22899043790 » (Moov) ou « De : NOM(72240231) » (Mixx)
  const senderPhone =
    normalizePhone(t.match(/exp[ée]diteur\s*:?\s*(\+?\d[\d\s]*)/i)?.[1]) ??
    normalizePhone(t.match(/\bde\s*:?\s*[^()]*\((\+?\d[\d\s]*)\)/i)?.[1]);

  const senderName = t.match(/\bde\s*:?\s*([^()\d]+?)\s*\(/i)?.[1]?.trim() || null;

  // Référence : « Txn ID: 040726008443 » (Moov) ou « Ref :18408728305 » (Mixx)
  const reference =
    t.match(/txn\s*id\s*:?\s*([A-Za-z0-9-]+)/i)?.[1] ??
    t.match(/\bref\s*:?\s*([A-Za-z0-9-]+)/i)?.[1] ??
    null;

  // Nouveau solde (toutes natures de SMS) — sert à garder la chaîne du solde synchronisée.
  const newBalance = parseAmount(
    t.match(/nouveau\s+solde[^:]*:\s*([\d\s  .,]+?)\s*(?:f\s*cfa|fcfa|xof)/i)?.[1],
  );

  return { network, isCredit, amount, senderPhone, senderName, reference, newBalance };
}

/**
 * Expéditeurs SMS légitimes (identifiant alphanumérique de l'opérateur). Un message
 * provenant d'un numéro ordinaire est rejeté : c'est la 1re barrière anti-falsification.
 */
export function isTrustedSmsSender(from?: string | null): boolean {
  if (!from) return false;
  return /moov\s*money|flooz|mixx|t-?money|yas/i.test(from);
}
