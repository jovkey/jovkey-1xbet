FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000

# Le vrai moteur de production est run.py (cf. cron.sh / DEPLOY.md) : il utilise de vraies
# données Sofascore/RapidAPI et pousse les pronostics au backend. Le module app/ (FastAPI)
# n'était qu'une démo — tous ses signaux sont générés par random.*, jamais de vraies
# données — et ne doit plus jamais être ce que ce conteneur exécute en production.
#
# Par défaut, l'image lance server.py : un mini serveur HTTP (health check) + une
# planification interne qui appelle run.py à 00:00 et 06:00 UTC. C'est fait pour les
# hébergeurs qui n'acceptent qu'un service "toujours actif" (ex. Render Web Service —
# run.py seul y serait vu comme planté puisqu'il s'arrête après son job).
#
# Si ton hébergeur a un vrai Cron Job (Render Cron Job payant, Railway Cron…), remplace
# la commande du service par `python run.py evening` directement — plus simple/fiable :
#   python run.py predict --date 2026-07-03
#   python run.py evening  --date 2026-07-03
CMD ["python", "server.py"]
