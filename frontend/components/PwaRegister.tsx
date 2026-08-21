'use client';
import { useEffect } from 'react';

/**
 * Enregistre le Service Worker (/sw.js) au chargement. C'est lui qui permet à Chrome
 * Android d'installer une VRAIE application (icône sur l'écran d'accueil + plein écran),
 * pas un simple raccourci. Ne rend rien à l'écran.
 */
export default function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* enregistrement impossible (navigateur ancien / mode privé) → on ignore */
      });
    }
  }, []);
  return null;
}
