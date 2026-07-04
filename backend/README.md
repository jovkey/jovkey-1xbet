# Backend — JOVKEY-1XBET (NestJS + Prisma + PostgreSQL)

API REST + flux SSE temps réel. Auth JWT, RBAC (gold / investor / admin / superadmin).

## Lancer
```bash
npm install
npx prisma db push       # crée le schéma en base
npm run seed             # comptes + CMS + pronostics + avis de démo
npm run start:dev        # http://localhost:4000/api  (Swagger: /docs)
```

## Modules
| Module | Rôle |
|--------|------|
| `auth` | Login restreint aux comptes validés, JWT, `/auth/me`. |
| `flash` | Tunnel d'affiliation : soumission lead (public), écran 24h, validation admin. |
| `predictions` | Cote gratuite du jour, flux privé Gold/Investor, ingestion moteur Python (clé interne). |
| `reviews` | ≥4★ publié, <4★ → modération admin (jamais supprimé en douce), gate 5 avis. |
| `cms` | Carrousel (reorder), marquee, vidéo tuto — poussés en SSE. |
| `investments` | Dashboard capital + courbe, retrait gaté 5 avis, **algorithme d'élasticité**. |
| `stats` | Tracking trafic + dashboard (visiteurs uniques, vues, CTR promo). |
| `users` | Liste (admin), élévation de rôle (superadmin). |
| `realtime` | `GET /api/realtime/stream` — Server-Sent Events. |

## Schéma de données
Voir `prisma/schema.prisma` (§3 du PDF) : `id_1xbet` unique, `status_flash`,
`last_investment_date`, `reviews_written`, rôles enum, CMS, trafic.

## Sécurité de la route admin
Le backend ne sert pas de panel ; la route fantôme vit côté Next.js. Les endpoints
d'écriture exigent le rôle `admin`/`superadmin` via `JwtAuthGuard` + `RolesGuard`.
L'ingestion des pronostics par le moteur Python est protégée par `InternalKeyGuard`
(`x-internal-key`).
