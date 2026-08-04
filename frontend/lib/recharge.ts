/**
 * Ouverture du formulaire « Recharger mon compte 1xBet » / « Faire un retrait ».
 *
 * Le modal est monté une seule fois (dans app/layout.tsx via <RechargeModal/>) et écoute
 * cet évènement. N'importe quel bouton (navbar, accueil, dashboard…) peut donc l'ouvrir
 * sans dupliquer le formulaire ni partager d'état React — il suffit d'appeler openRecharge().
 * Le `mode` transporté par l'évènement choisit le libellé et le message WhatsApp (dépôt vs retrait).
 */
export const RECHARGE_EVENT = 'jovkey:recharge';

export type RechargeMode = 'deposit' | 'withdraw';

export function openRecharge(mode: RechargeMode = 'deposit') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<RechargeMode>(RECHARGE_EVENT, { detail: mode }));
  }
}
