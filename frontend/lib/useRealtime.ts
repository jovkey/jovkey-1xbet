'use client';
import { useEffect } from 'react';
import { API_URL } from './config';

/** Abonnement SSE : rappelle `onEvent(type, data)` à chaque message poussé par l'API. */
export function useRealtime(onEvent: (type: string, data: any) => void) {
  useEffect(() => {
    const es = new EventSource(`${API_URL}/api/realtime/stream`);
    const handler = (e: MessageEvent) => {
      try {
        onEvent((e as any).type || 'message', JSON.parse(e.data));
      } catch {
        /* ignore */
      }
    };
    // Les événements nommés (prediction.new, cms.updated, ...) + le canal par défaut.
    [
      'prediction.new', 'cms.updated', 'review.published', 'flash.lead.new',
      'notification.new', 'payment.new', 'payment.validated', 'payment.rejected',
      'withdrawal.new', 'withdrawal.paid', 'withdrawal.rejected', 'balance.released',
    ].forEach((t) => es.addEventListener(t, handler as EventListener));
    es.onmessage = handler;
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
