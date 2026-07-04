# Déploiement du moteur d'analyse (hébergement en ligne)

Le moteur est le **seul** composant qui appelle RapidAPI. Le site (backend + frontend)
lit **uniquement la base Neon**. Une requête API à minuit sert ensuite des milliers de visiteurs.

## 1. Variables d'environnement (`analysis-engine/.env`)
```
BACKEND_INTERNAL_URL=https://api.ton-domaine.com   # URL publique du backend déployé
ANALYSIS_API_KEY=<la même valeur que côté backend>
SPORTS_PROVIDER=sofascore
RAPIDAPI_KEY=<ta clé RapidAPI>
RAPIDAPI_HOST=sofascore.p.rapidapi.com
CACHE_TTL_HOURS=12
```
> Si le moteur tourne sur le **même serveur** que le backend, mets `BACKEND_INTERNAL_URL=http://localhost:4000`.

## 2. Tâches planifiées (cron Linux — recommandé pour un hébergement en ligne)
```cron
# 00:00 UTC (MINUIT) : notation des résultats de la veille + prédictions du LENDEMAIN.
# C'est le passage principal — l'IA doit connaître les matchs du jour à venir dès 0h.
0 0 * * *   /chemin/jovkey-1xbet/analysis-engine/cron.sh evening >> /var/log/jovkey-engine.log 2>&1

# 06:00 UTC : re-vérification du jour (matchs ajoutés/reprogrammés après minuit, rare
# mais possible) — ne fait que déposer d'éventuels matchs manqués, jamais de doublon
# (le backend ignore un extMatchId déjà présent).
0 6 * * *   /chemin/jovkey-1xbet/analysis-engine/cron.sh morning >> /var/log/jovkey-engine.log 2>&1
```
Rendre exécutable : `chmod +x cron.sh`.

## 3. Si pas d'accès cron (PaaS type Render/Railway/Vercel Cron)
Crée 2 **Scheduled Jobs** qui exécutent :
- **00:00 UTC** : `python run.py grade --date $(date -u -d yesterday +%F) && python run.py predict --date $(date -u +%F) --source next` (notation + prédictions du jour qui commence)
- **06:00 UTC** : `python run.py predict --source next` (re-vérification, optionnel)

## 4. Test manuel
```
python run.py predict --source next   # matchs du jour (grands championnats + CDM, repli petits)
python run.py grade --date AAAA-MM-JJ # notation au vrai score
python run.py report                  # performance + mémoire (leçons)
```
