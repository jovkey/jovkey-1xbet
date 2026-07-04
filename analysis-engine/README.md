# Moteur d'analyse nocturne — JOVKEY-1XBET

FastAPI (API de contrôle) + Celery (planification nocturne) + algorithme **anti-piège**
(« Value Betting Inversé ») sur 4 sports : football, basketball, hockey, tennis de table.

## Lancer
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000          # API → http://localhost:8000/docs
celery -A app.worker.celery_app worker --beat -l info   # worker + planif 02:00 UTC
```

## Endpoints
- `GET  /health` — sonde.
- `POST /evaluate` — évalue un évènement (debug/outil admin).
- `POST /run-now` — déclenche le balayage immédiatement.

## Logique (`app/analyzer.py`)
On estime une probabilité « vraie » via des signaux de niche (forme, enjeu, tirs,
tirs cadrés, hors-jeu, cartons, profil de l'arbitre, hype publique) puis on la compare
à la probabilité implicite de la cote 1xBet :

- `edge ≤ -0.05` → **piège** (cote gonflée par la hype) → écartée.
- `edge ≥ +0.06` → **opportunité** → poussée vers l'API (`POST /api/predictions/ingest`).

> Les coefficients sont illustratifs : branchez un fournisseur de données réel et
> calibrez/backtestez le modèle avant toute mise en production.
