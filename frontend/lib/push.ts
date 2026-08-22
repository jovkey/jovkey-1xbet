import { api } from './api';

/** Convertit la clé publique VAPID (base64url) au format attendu par pushManager.subscribe. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Abonne cet appareil aux notifications push et enregistre l'abonnement côté serveur.
 * À appeler quand la permission est déjà accordée (ou juste après l'avoir accordée).
 * Renvoie true si l'appareil est bien abonné.
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { publicKey, enabled } = await api<{ publicKey: string; enabled: boolean }>('/push/public-key');
      if (!enabled || !publicKey) return false;
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }
    await api('/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } });
    return true;
  } catch {
    return false;
  }
}

/** Demande l'autorisation (geste utilisateur requis) puis abonne. */
export async function enablePush(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!pushSupported()) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  await subscribeToPush();
  return 'granted';
}
