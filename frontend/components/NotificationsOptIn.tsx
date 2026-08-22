'use client';
import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { pushSupported, subscribeToPush, enablePush } from '@/lib/push';
import { showToast } from '@/lib/clipboard';

/**
 * Invite à activer les notifications push (« coupon gratuit disponible », messages admin).
 * - Permission déjà accordée → on (re)abonne l'appareil en silence (garde l'abonnement à jour).
 * - Permission jamais demandée → petit bouton 🔔 ; le clic demande l'autorisation puis abonne.
 * - Refusée / non supporté → on n'affiche rien.
 */
export default function NotificationsOptIn() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return;
    if (Notification.permission === 'granted') {
      subscribeToPush(); // ré-abonnement silencieux
    } else if (Notification.permission === 'default') {
      setVisible(true);
    }
  }, []);

  const activate = async () => {
    setBusy(true);
    const res = await enablePush();
    setBusy(false);
    setVisible(false);
    if (res === 'granted') showToast('🔔 Notifications activées !');
    else if (res === 'denied') showToast('Notifications refusées (modifiable dans les réglages).');
  };

  if (!visible) return null;

  return (
    <div className="fixed z-[250] bottom-4 right-4 flex items-center gap-1">
      <button
        onClick={activate}
        disabled={busy}
        className="glass border border-gold/40 text-gold px-4 py-2.5 rounded-full font-bold text-sm shadow-2xl flex items-center gap-2 tap-target hover:bg-white/5 transition disabled:opacity-60"
      >
        <Bell size={16} /> {busy ? 'Activation…' : 'Activer les alertes coupons'}
      </button>
      <button
        onClick={() => setVisible(false)}
        aria-label="Masquer"
        className="glass rounded-full p-1.5 shadow-lg text-gray-300 hover:text-white tap-target"
      >
        <X size={14} />
      </button>
    </div>
  );
}
