# Frontend — JOVKEY-1XBET (Next.js 14 + Tailwind + Lucide)

PWA mobile-first, thème **Dark & Gold / Cyber-Sport**, glassmorphism, animations de pulsation.

## Lancer
```bash
npm install
npm run dev      # http://localhost:3000
```
Nécessite l'API NestJS sur `NEXT_PUBLIC_API_URL` (défaut http://localhost:4000).

## Routes
| Route | Rôle |
|-------|------|
| `/` | Vitrine publique : hero, marquee CMS, carrousel CMS, cote gratuite, packs VIP, décharge investisseur, communauté, avis. |
| `/signup`, `/signup/gold`, `/signup/investor` | Inscription (Gold avec paiement, Investisseur sans paiement). |
| `/login` | Connexion membres (Gold / Investisseur / Admin / Superadmin). |
| `/dashboard` | **Routage par rôle** : Gold (flux privé), Investisseur (3 soldes + courbe + gate 5 avis), ou **panel admin** (Trafic, Flash, Paiements, Retraits, Contenu, Avis, Membres) pour admin/superadmin. Aucune URL secrète. |
| `/admin`, `/wp-admin`, … | **404 volontaire** (`middleware.ts`). |

## Design system (`tailwind.config.ts` + `app/globals.css`)
- Fond `night #0f172a`, accent `gold` (dégradé 135° `#f59e0b → #d97706`), `electric #3b82f6`, `live #22c55e`.
- Police **Inter** (400/700/900), graisses extrêmes + italique.
- `.glass` (blur 10px), `.vip-card`, `animate-pulseGold`, `animate-marquee`, cibles `.tap-target` ≥ 48px.

## Temps réel
`lib/useRealtime.ts` s'abonne au flux SSE `/api/realtime/stream` : les mises à jour CMS de
l'admin et les pronostics poussés par le moteur Python rafraîchissent l'UI instantanément.

## À fournir pour la PWA
Ajoutez `public/icon-192.png` et `public/icon-512.png` (référencés par `manifest.webmanifest`).
