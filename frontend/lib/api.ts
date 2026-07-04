import { API_URL } from './config';

interface ApiOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

/**
 * Le JWT vit dans un cookie httpOnly posé par le backend (jamais en localStorage,
 * jamais lisible par du JS côté client — ça mitige le vol de session par XSS).
 * `credentials: 'include'` suffit à le faire suivre automatiquement sur chaque
 * requête vers l'API (même domaine/CORS avec credentials: true côté backend).
 */
export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.message || `Erreur ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

/** Déconnexion : demande au backend d'effacer le cookie de session. */
export function logout(): Promise<void> {
  return api('/auth/logout', { method: 'POST' }).then(() => undefined);
}

/** Détecte la provenance du visiteur (UTM, sinon referrer). */
function detectSource(): string {
  try {
    const utm = new URLSearchParams(window.location.search).get('utm_source');
    if (utm) return utm.toLowerCase();
    const ref = document.referrer;
    if (!ref) return 'direct';
    const h = new URL(ref).hostname.replace(/^www\./, '');
    if (h.includes('tiktok')) return 'tiktok';
    if (h.includes('whatsapp')) return 'whatsapp';
    if (h.includes('t.me') || h.includes('telegram')) return 'telegram';
    if (h.includes('facebook') || h.includes('fb.')) return 'facebook';
    if (h.includes('instagram')) return 'instagram';
    if (h.includes('google')) return 'google';
    return h || 'direct';
  } catch {
    return 'direct';
  }
}

/** Tracking trafic non bloquant (best-effort). */
export function track(type: string, path?: string) {
  if (typeof window === 'undefined') return;
  let visitorId = localStorage.getItem('jovkey_vid');
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem('jovkey_vid', visitorId);
  }
  api('/stats/track', { method: 'POST', body: { type, path, visitorId, source: detectSource() } }).catch(() => {});
}

/** Upload multipart (média) — cookie de session envoyé automatiquement. */
export async function apiUpload<T = any>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/api${path}`, { method: 'POST', credentials: 'include', body: form });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.message || `Erreur ${res.status}`);
  }
  return res.json();
}
