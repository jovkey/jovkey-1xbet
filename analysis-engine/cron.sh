#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# Tâche planifiée serveur (hébergement en ligne) pour le moteur JOVKEY-1XBET.
# À lancer 2x/jour via cron. Lit la config dans .env (BACKEND_INTERNAL_URL,
# RAPIDAPI_KEY, ANALYSIS_API_KEY). Toutes les dates sont en UTC.
#
#   ./cron.sh morning   → prédit les matchs du jour (à pousser depuis le panel)
#   ./cron.sh evening   → note les résultats de la veille + prédit le lendemain
# ───────────────────────────────────────────────────────────────────────────
set -e
cd "$(dirname "$0")"

MODE="${1:-evening}"
PY="$(command -v python3 || command -v python)"
TODAY="$(date -u +%F)"

case "$MODE" in
  morning)
    "$PY" run.py predict --date "$TODAY" --source next
    ;;
  evening)
    TOMORROW="$(date -u -d 'tomorrow' +%F 2>/dev/null || date -u -v+1d +%F)"
    "$PY" run.py grade   --date "$TODAY"              # résultats des matchs joués aujourd'hui
    "$PY" run.py predict --date "$TOMORROW" --source next  # prédictions de demain
    "$PY" run.py report
    ;;
  *)
    echo "Usage: ./cron.sh [morning|evening]"; exit 1;;
esac
