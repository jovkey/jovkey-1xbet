#!/usr/bin/env python3
"""
Point d'entrée pour un hébergement type Render "Web Service" (ou tout hébergeur qui
n'accepte qu'un seul type de service "toujours actif", sans vrai Cron Job).

run.py est un script ONE-SHOT (predict/grade/evening) : il s'exécute puis s'arrête.
Un "Web Service" exige au contraire un process qui écoute en continu sur $PORT (sinon
l'hébergeur le considère mort et le relance en boucle). Ce fichier fait les deux :
  - un mini serveur HTTP (stdlib, pas de dépendance) qui répond au health check,
  - une boucle de planification interne qui appelle directement les fonctions de
    run.py aux heures prévues (00:00 UTC : notation de la veille + prédictions du
    jour ; 06:00 UTC : re-vérification, cf. DEPLOY.md).

Si ton hébergeur propose un vrai Cron Job (Render Cron Job payant, Railway Cron,
GitHub Actions planifié…), préfère-le : lance directement `python run.py evening`
sur ce cron, c'est plus simple et plus fiable que ce wrapper toujours-actif.
"""
import os
import threading
import time
import traceback
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

import run as engine  # même process : réutilise directement les fonctions de run.py

# (heure, minute) UTC — minuit : passage principal ; 06h : re-vérification légère.
SCHEDULE_UTC = [(0, 0), (6, 0)]


def _today_key(hh: int, mm: int) -> str:
    now = datetime.now(timezone.utc)
    return f"{now.strftime('%Y-%m-%d')}-{hh:02d}{mm:02d}"


def _run_evening():
    date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    print(f"[scheduler] {datetime.now(timezone.utc).isoformat()} — evening {date}", flush=True)
    try:
        engine.cmd_evening(date)
    except Exception:  # noqa: BLE001
        traceback.print_exc()


def _run_morning_recheck():
    date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    print(f"[scheduler] {datetime.now(timezone.utc).isoformat()} — re-vérification predict {date}", flush=True)
    try:
        engine.cmd_predict(date, source="next")
    except Exception:  # noqa: BLE001
        traceback.print_exc()


def scheduler_loop():
    ran_keys: set[str] = set()
    print(f"[scheduler] démarré — passages prévus (UTC) : {SCHEDULE_UTC}", flush=True)
    while True:
        now = datetime.now(timezone.utc)
        for hh, mm in SCHEDULE_UTC:
            if now.hour == hh and now.minute == mm:
                key = _today_key(hh, mm)
                if key not in ran_keys:
                    ran_keys.add(key)
                    _run_evening() if (hh, mm) == (0, 0) else _run_morning_recheck()
        time.sleep(30)


class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(b"JOVKEY analysis-engine OK\n")

    def log_message(self, format, *args):  # noqa: A002 — silence le log HTTP par défaut (bruit)
        pass


def main():
    port = int(os.getenv("PORT", "8000"))
    threading.Thread(target=scheduler_loop, daemon=True).start()
    print(f"[server] health check sur :{port}", flush=True)
    HTTPServer(("0.0.0.0", port), HealthHandler).serve_forever()


if __name__ == "__main__":
    main()
