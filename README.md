# JOVKEY-1XBET — Plateforme SaaS de pronostics & gestion de capital

Monorepo full-stack premium (thème **Dark & Gold / Cyber-Sport**) conforme au document
`specifications_techniques_jovkey_1xbet.pdf`.

```
jovkey-1xbet/
├─ frontend/          Next.js 14 (App Router) + Tailwind + Lucide — PWA mobile-first
├─ backend/           NestJS + Prisma + PostgreSQL — Auth/Rôles, CMS, SSE temps réel
├─ analysis-engine/   FastAPI + Celery (Python) — Moteur d'analyse nocturne anti-piège
├─ docker-compose.yml Postgres + Redis + les 3 services
└─ .env.example
```

## ⚠️ Notes d'intégrité (à lire)

Ce template **n'implémente pas** deux comportements demandés qui sont trompeurs et
illégaux dans de nombreuses juridictions (FTC, droit conso UE/OHADA) :

1. La **fabrication de faux avis** présentés comme de vrais clients. À la place : un
   système de **modération** (l'admin approuve/rejette de vrais avis) + un jeu d'avis
   de démonstration explicitement marqués `is_seed = true` (contenu d'exemple de template).
2. La **suppression automatique des avis négatifs** pour tromper le public. À la place :
   les avis < 4★ partent en file de modération admin — l'admin décide, rien n'est
   masqué silencieusement au public sous couvert d'authenticité.

Le wording « Garantie de profit » de la maquette d'origine a été remplacé par la décharge
juridique officielle du PDF (le risque de perte de capital est explicite).

## 🚀 Démarrage rapide (Docker, recommandé)

```bash
cp .env.example .env
docker compose up --build
```

- Frontend : http://localhost:3000
- API (Swagger) : http://localhost:4000/docs
- Moteur d'analyse : http://localhost:8000/docs
- Route admin fantôme : http://localhost:3000/jov-secure-control-888
  (`/admin` renvoie un 404 volontaire via le middleware Next.js)

### Comptes de démonstration (créés par le seed)

| Rôle        | Identifiant 1xBet | Mot de passe |
|-------------|-------------------|--------------|
| superadmin  | `SUPERADMIN`      | `jovkey-super-888` |
| gold        | `GOLD001`         | `gold1234`   |
| investor    | `INV001`          | `invest1234` |

## 🧱 Démarrage manuel (sans Docker)

Prérequis : Node 20+, Python 3.11+, PostgreSQL 15+, Redis.

```bash
# Backend
cd backend && npm install
npx prisma db push && npm run seed
npm run start:dev          # http://localhost:4000

# Frontend
cd frontend && npm install && npm run dev   # http://localhost:3000

# Moteur d'analyse
cd analysis-engine && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
celery -A app.worker.celery_app worker --beat --loglevel=info
```

Voir le `README.md` de chaque sous-dossier pour les détails.
