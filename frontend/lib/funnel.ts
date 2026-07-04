'use client';

export type FunnelTunnel = 'flash' | 'gold' | 'investor';

/** Ouvre la modale du tunnel d'affiliation depuis n'importe quel bouton. */
export function openFunnel(tunnel: FunnelTunnel = 'flash') {
  window.dispatchEvent(new CustomEvent('jovkey:open-funnel', { detail: { tunnel } }));
}
