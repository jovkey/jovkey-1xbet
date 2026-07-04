FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# Le vrai moteur de production est run.py (cf. cron.sh / DEPLOY.md) : il utilise de vraies
# données Sofascore/RapidAPI et pousse les pronostics au backend. Le module app/ (FastAPI)
# n'était qu'une démo — tous ses signaux sont générés par random.*, jamais de vraies
# données — et ne doit plus jamais être ce que ce conteneur exécute en production.
#
# Ce conteneur n'est PAS un serveur persistant : c'est un job invoqué périodiquement
# (cron externe ou scheduler PaaS) avec la sous-commande voulue, ex. :
#   docker run jovkey-analysis-engine predict --date 2026-07-03
#   docker run jovkey-analysis-engine evening  --date 2026-07-03
# Sans argument, la commande par défaut est "evening" (grade veille + report + predict
# du lendemain), qui correspond au job du soir documenté dans DEPLOY.md/cron.sh.
ENTRYPOINT ["python", "run.py"]
CMD ["evening"]
