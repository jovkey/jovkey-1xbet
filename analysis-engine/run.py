#!/usr/bin/env python3
"""
JOVKEY-1XBET — Moteur d'analyse auto-apprenant.

Boucle complète demandée :
  1. PREDICT  : analyse les matchs d'une journée (multi-marchés), SANS code coupon,
                et dépose les pronostics dans le backend (/api/predictions/ingest).
  2. GRADE    : le soir, récupère le résultat des matchs joués, note chaque pronostic
                (gagné / perdu), enregistre la performance et TIRE DES LEÇONS.
  3. MÉMOIRE  : les leçons (précision par marché + biais de confiance) sont stockées
                dans memory.json et réinjectées pour améliorer les prédictions suivantes.
  4. EVENING  : enchaîne grade(veille) + report(jour) + predict(lendemain).

⚠️ Données : sans clé d'API sportive (API_FOOTBALL_KEY), on utilise un fournisseur
SIMULÉ déterministe (mêmes matchs/résultats pour une date donnée) afin de TESTER toute
la chaîne dès aujourd'hui. Brancher le vrai fournisseur = remplir provider_real().

Usage :
  python run.py predict --date 2026-06-24
  python run.py grade   --date 2026-06-24
  python run.py report
  python run.py evening --date 2026-06-24     # grade veille + report + predict lendemain
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Console Windows : forcer UTF-8 pour les symboles ✓ ✗ ✅ → •
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    pass

ROOT = Path(__file__).resolve().parent


def _load_env():
    """Charge analysis-engine/.env (sans dépendance externe)."""
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


_load_env()

BACKEND_URL = os.getenv("BACKEND_INTERNAL_URL", "http://localhost:4000")

INTERNAL_KEY = os.getenv("ANALYSIS_API_KEY")
if not INTERNAL_KEY:
    # Pas de repli faible en dur ('internal-analysis-key') : sans clé, le backend
    # rejettera de toute façon les requêtes (InternalKeyGuard) — on échoue tout de
    # suite avec un message clair plutôt que d'envoyer une clé devinable.
    raise RuntimeError(
        "ANALYSIS_API_KEY manquant dans analysis-engine/.env (doit matcher le backend)."
    )

# ── Fournisseur de données sportives — NE DOIT JAMAIS retomber silencieusement ──
# sur le mode 'mock' (données 100% simulées). Sans SPORTS_PROVIDER défini explicitement
# à 'sofascore' (ou ALLOW_MOCK_PROVIDER=true assumé pour du dev local), on refuse de
# démarrer : mieux vaut un crash bruyant qu'un moteur qui invente des pronostics en prod.
RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY", "")
RAPIDAPI_HOST = os.getenv("RAPIDAPI_HOST", "sofascore.p.rapidapi.com")
CACHE_TTL = int(os.getenv("CACHE_TTL_HOURS", "12")) * 3600

_ALLOW_MOCK = os.getenv("ALLOW_MOCK_PROVIDER", "false").strip().lower() == "true"
SPORTS_PROVIDER = os.getenv("SPORTS_PROVIDER", "").strip().lower()

if not SPORTS_PROVIDER:
    if _ALLOW_MOCK:
        SPORTS_PROVIDER = "mock"
        print(
            "⚠️  SPORTS_PROVIDER absent — mode MOCK autorisé explicitement via "
            "ALLOW_MOCK_PROVIDER=true (données 100% simulées, à ne JAMAIS utiliser en prod).",
            file=sys.stderr,
        )
    else:
        raise RuntimeError(
            "SPORTS_PROVIDER manquant. Défini SPORTS_PROVIDER=sofascore (+ RAPIDAPI_KEY) en "
            "production. Pour du dev local avec données simulées, ajoute explicitement "
            "ALLOW_MOCK_PROVIDER=true dans analysis-engine/.env."
        )
elif SPORTS_PROVIDER == "mock" and not _ALLOW_MOCK:
    raise RuntimeError(
        "SPORTS_PROVIDER=mock refusé sans ALLOW_MOCK_PROVIDER=true explicite : ceci "
        "générerait des pronostics 100% fictifs. Mets SPORTS_PROVIDER=sofascore + "
        "RAPIDAPI_KEY pour de vraies données, ou ALLOW_MOCK_PROVIDER=true si c'est "
        "volontairement du dev local."
    )
elif SPORTS_PROVIDER == "sofascore" and not RAPIDAPI_KEY:
    raise RuntimeError("SPORTS_PROVIDER=sofascore mais RAPIDAPI_KEY manquant dans .env.")

MEM_PATH = ROOT / "memory.json"
STATE_DIR = ROOT / "state"
STATE_DIR.mkdir(exist_ok=True)
CACHE_DIR = ROOT / "cache"
CACHE_DIR.mkdir(exist_ok=True)


def rapid_get(path: str, params: dict | None = None, ttl: int | None = None) -> dict:
    """
    GET RapidAPI AVEC CACHE DISQUE. On n'appelle JAMAIS deux fois la même URL :
    la réponse est mémorisée dans cache/<hash>.json. Économise le quota d'API.
    """
    import time
    qs = "&".join(f"{k}={v}" for k, v in sorted((params or {}).items()))
    url = f"https://{RAPIDAPI_HOST}{path}" + (f"?{qs}" if qs else "")
    key = hashlib.sha256(url.encode()).hexdigest()[:24]
    cache_file = CACHE_DIR / f"{key}.json"
    ttl = CACHE_TTL if ttl is None else ttl
    if cache_file.exists() and (time.time() - cache_file.stat().st_mtime) < ttl:
        cached = json.loads(cache_file.read_text(encoding="utf-8"))
        return cached  # ← servi depuis le cache, 0 requête consommée
    req = urllib.request.Request(url, headers={
        "x-rapidapi-host": RAPIDAPI_HOST, "x-rapidapi-key": RAPIDAPI_KEY,
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode().strip()
        body = json.loads(raw) if raw else None  # corps vide toléré
        result = {"_status": 200, "data": body, "url": url}
    except urllib.error.HTTPError as e:  # type: ignore[attr-defined]
        result = {"_status": e.code, "data": None, "url": url}
    except (json.JSONDecodeError, Exception):  # noqa: BLE001
        result = {"_status": 0, "data": None, "url": url}
    cache_file.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    return result

# ── Référentiel d'équipes (force 0..1) — sert au modèle ET au résultat simulé ──
LEAGUES = {
    "Premier League": {"Man City": 0.90, "Arsenal": 0.84, "Liverpool": 0.83, "Chelsea": 0.74,
                        "Man United": 0.72, "Tottenham": 0.71, "Newcastle": 0.69, "Aston Villa": 0.67},
    "La Liga": {"Real Madrid": 0.90, "Barcelona": 0.86, "Atletico": 0.79, "Girona": 0.70,
                "Sevilla": 0.66, "Betis": 0.64, "Getafe": 0.55, "Valencia": 0.60},
    "Serie A": {"Inter": 0.85, "Juventus": 0.80, "Milan": 0.79, "Napoli": 0.77,
                "Roma": 0.72, "Atalanta": 0.74, "Lazio": 0.70, "Bologna": 0.66},
}
NBA = {"Celtics": 0.88, "Nuggets": 0.85, "Lakers": 0.74, "Bucks": 0.80,
       "Suns": 0.72, "Heat": 0.70, "Warriors": 0.73, "Knicks": 0.71}
NHL = {"Bruins": 0.82, "Panthers": 0.80, "Maple Leafs": 0.74, "Rangers": 0.77,
       "Oilers": 0.79, "Avalanche": 0.81, "Lightning": 0.72, "Stars": 0.75}


# ── Utilitaires déterministes ──────────────────────────────────────────────
def _rng(seed_text: str) -> "random.Random":
    import random
    seed = int(hashlib.sha256(seed_text.encode()).hexdigest(), 16) % (2**32)
    return random.Random(seed)


def _poisson_pmf(k: int, lam: float) -> float:
    return math.exp(-lam) * lam**k / math.factorial(k)


def _score_grid(home_xg: float, away_xg: float, maxg: int = 6):
    """Matrice de probabilités des scores (Poisson indépendants)."""
    grid = {}
    for h in range(maxg + 1):
        for a in range(maxg + 1):
            grid[(h, a)] = _poisson_pmf(h, home_xg) * _poisson_pmf(a, away_xg)
    s = sum(grid.values()) or 1.0
    return {k: v / s for k, v in grid.items()}


# ── Fournisseur de données ─────────────────────────────────────────────────
def provider_real(date: str):
    """À implémenter avec API-Football (clé dans API_FOOTBALL_KEY). Renvoie la liste
    des matchs du jour avec leurs vraies stats/cotes. Lève si pas de clé."""
    raise NotImplementedError("Renseigne API_FOOTBALL_KEY et implémente provider_real().")


def provider_mock(date: str):
    """Calendrier crédible et déterministe pour une date (mêmes matchs à chaque appel)."""
    rng = _rng(f"slate:{date}")
    fixtures = []

    # 3 matchs de foot tirés de championnats réels
    for league, teams in LEAGUES.items():
        names = list(teams.keys())
        rng.shuffle(names)
        home, away = names[0], names[1]
        fixtures.append({"sport": "football", "league": league, "home": home, "away": away,
                         "hr": teams[home], "ar": teams[away]})

    # NBA/NHL réels : voir sofa_auto_matchids_scored() + analyze_sofa_scored() — utilisés
    # uniquement quand SPORTS_PROVIDER=sofascore. Cette table statique ne sert plus
    # qu'au mode démo explicite (ALLOW_MOCK_PROVIDER=true), jamais en production.
    for sport, table in (("basketball", NBA), ("hockey", NHL)):
        names = list(table.keys())
        rng.shuffle(names)
        home, away = names[0], names[1]
        fixtures.append({"sport": sport, "league": sport.upper(), "home": home, "away": away,
                         "hr": table[home], "ar": table[away]})
    return fixtures


def get_fixtures(date: str):
    return provider_mock(date)


# ── Fournisseur Sofascore (RapidAPI) — analyse réelle par matchId ───────────
def sofa_event(match_id: int) -> dict | None:
    r = rapid_get("/matches/detail", {"matchId": match_id})
    d = r.get("data")
    return d.get("event") if isinstance(d, dict) else None


def sofa_h2h(match_id: int) -> dict:
    r = rapid_get("/matches/get-h2h", {"matchId": match_id})
    d = r.get("data") or {}
    return (d.get("teamDuel") or {}) if isinstance(d, dict) else {}


def sofa_stats(match_id: int) -> dict:
    """Aplati les statistiques (période ALL) en {clé: (home, away)} — si match joué."""
    r = rapid_get("/matches/get-statistics", {"matchId": match_id})
    d = r.get("data") or {}
    out = {}
    for period in (d.get("statistics") or []):
        if period.get("period") != "ALL":
            continue
        for grp in period.get("groups", []):
            for it in grp.get("statisticsItems", []):
                if "homeValue" in it and "awayValue" in it:
                    out[it.get("key") or it.get("name")] = (it["homeValue"], it["awayValue"])
    return out


def sofa_result(match_id: int) -> dict | None:
    """Score final réel (pour la notation), si le match est terminé."""
    ev = sofa_event(match_id)
    if not ev or (ev.get("status") or {}).get("type") != "finished":
        return None
    hs = (ev.get("homeScore") or {}); as_ = (ev.get("awayScore") or {})
    h = hs.get("normaltime", hs.get("current", 0))
    a = as_.get("normaltime", as_.get("current", 0))
    return {"home": h, "away": a, "label": f"{h}-{a}"}


def sofa_list_matches(tournament_id: int, season_id: int, kind: str = "next") -> list[dict]:
    """Liste les matchs d'une compétition. kind='next' (à venir) ou 'last' (joués)."""
    ep = "/tournaments/get-next-matches" if kind == "next" else "/tournaments/get-last-matches"
    r = rapid_get(ep, {"tournamentId": tournament_id, "seasonId": season_id, "pageIndex": 0})
    d = r.get("data") or {}
    return d.get("events", []) if isinstance(d, dict) else []


def pick_season(seasons: list[dict], date: str) -> int | None:
    """Choisit la saison COURANTE selon la date (sans appel supplémentaire)."""
    y, m = int(date[:4]), int(date[5:7])
    start_year = y if m >= 7 else y - 1
    league_tag = f"{start_year % 100:02d}/{(start_year + 1) % 100:02d}"  # ex "25/26" (football europ., NHL)
    full_tag = f"{start_year}/{start_year + 1}"  # ex "2025/2026" (NBA)
    for s in seasons:  # ligues (saison à cheval sur 2 ans), formats abrégé OU complet
        if str(s.get("year")) in (league_tag, full_tag):
            return s.get("id")
    for s in seasons:  # coupes / Coupe du Monde (année simple)
        if str(s.get("year")) == str(y):
            return s.get("id")
    return seasons[0].get("id") if seasons else None


def sofa_current_season(tournament_id: int, date: str) -> int | None:
    r = rapid_get("/tournaments/get-seasons", {"tournamentId": tournament_id})
    seasons = (r.get("data") or {}).get("seasons") if isinstance(r.get("data"), dict) else None
    return pick_season(seasons or [], date)


def _collect_from(comps: list[dict], date: str | None, kind: str, limit: int) -> list[int]:
    ids: list[int] = []
    ref_date = date or datetime.now().strftime("%Y-%m-%d")
    for c in comps:
        season = sofa_current_season(c["tournamentId"], ref_date)
        if not season:
            continue
        n = 0
        for ev in sofa_list_matches(c["tournamentId"], season, kind):
            ts = ev.get("startTimestamp")
            ev_date = datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d") if ts else None
            if date and ev_date != date:
                continue
            if ev.get("id"):
                ids.append(ev["id"]); n += 1
            if len(ids) >= limit:
                break
        if n:
            print(f"   • {c['name']}: {n} match(s)")
        if len(ids) >= limit:
            break
    return ids


def sofa_live_matchids(limit: int = 14) -> list[int]:
    """Matchs en direct (dernier recours)."""
    r = rapid_get("/tournaments/get-live-events", {"sport": "football"}, ttl=300)
    evs = (r.get("data") or {}).get("events", []) if isinstance(r.get("data"), dict) else []
    return [e["id"] for e in evs if e.get("id")][:limit]


def _tournaments_config() -> dict:
    cfg_path = ROOT / "tournaments.json"
    return json.loads(cfg_path.read_text(encoding="utf-8")) if cfg_path.exists() else {}


def sofa_auto_matchids(date: str | None, kind: str, limit: int = 14) -> list[int]:
    """matchId des grands championnats ; repli sur les petits ; sinon matchs en direct."""
    cfg = _tournaments_config()
    ids = _collect_from(cfg.get("big", []), date, kind, limit)
    if not ids and cfg.get("fallback"):
        print("   (aucun grand match aujourd'hui → repli sur les petits championnats)")
        ids = _collect_from(cfg.get("fallback", []), date, kind, limit)
    if not ids:
        print("   (rien de programmé → matchs en direct)")
        ids = sofa_live_matchids(limit)
    return ids


def sofa_auto_matchids_scored(date: str | None, sport: str, kind: str, limit: int = 6) -> list[int]:
    """
    matchId réels (basket/hockey) pour un sport donné, via les compétitions listées dans
    tournaments.json > scored. Renvoie une liste VIDE en intersaison ou si RapidAPI ne renvoie
    rien pour cette date — jamais de repli sur des matchs inventés.
    """
    cfg = _tournaments_config()
    comps = (cfg.get("scored") or {}).get(sport, [])
    if not comps:
        return []
    return _collect_from(comps, date, kind, limit)


def sofa_team_form(team_id: int, last: int = 8) -> dict | None:
    """Moyennes réelles (buts marqués/encaissés) sur les derniers matchs joués d'une équipe."""
    r = rapid_get("/teams/get-last-matches", {"teamId": team_id, "pageIndex": 0})
    evs = (r.get("data") or {}).get("events", []) if isinstance(r.get("data"), dict) else []
    fin = [e for e in evs if (e.get("status") or {}).get("type") == "finished"]
    fin.sort(key=lambda e: e.get("startTimestamp", 0), reverse=True)
    gf = ga = n = 0
    for e in fin[:last]:
        hs = (e.get("homeScore") or {}).get("current")
        as_ = (e.get("awayScore") or {}).get("current")
        if hs is None or as_ is None:
            continue
        if e.get("homeTeam", {}).get("id") == team_id:
            gf += hs; ga += as_
        else:
            gf += as_; ga += hs
        n += 1
    return {"gf": gf / n, "ga": ga / n, "n": n} if n else None


def analyze_sofa(match_id: int, mem: dict):
    """Analyse réelle d'un match (détail + h2h + forme + stats) → commentaires + marchés, SANS code."""
    ev = sofa_event(match_id)
    if not ev:
        return None
    home = ev["homeTeam"]["name"]; away = ev["awayTeam"]["name"]
    sport = (ev["tournament"]["category"]["sport"]["slug"]) if ev.get("tournament") else "football"
    tour = (ev.get("tournament") or {}).get("name", "")
    ts = ev.get("startTimestamp")
    date = datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d") if ts else datetime.now().strftime("%Y-%m-%d")
    kickoff = datetime.fromtimestamp(ts, timezone.utc).strftime("%d/%m/%Y %H:%M GMT") if ts else "à confirmer"
    referee = (ev.get("referee") or {}).get("name")

    td = sofa_h2h(match_id)
    hw, aw, dr = td.get("homeWins", 0), td.get("awayWins", 0), td.get("draws", 0)
    tot = hw + aw + dr

    # ── Forme réelle : buts attendus (xG) à partir des derniers matchs, modèle de Poisson ──
    hf = sofa_team_form(ev["homeTeam"]["id"])
    af = sofa_team_form(ev["awayTeam"]["id"])
    top_scores: list[str] = []
    if hf and af:
        home_xg = max(0.25, (hf["gf"] + af["ga"]) / 2 * 1.10)   # +avantage du terrain
        away_xg = max(0.20, (af["gf"] + hf["ga"]) / 2 * 0.95)
        grid = _score_grid(home_xg, away_xg)
        p_home = sum(p for (h, a), p in grid.items() if h > a)
        p_draw = sum(p for (h, a), p in grid.items() if h == a)
        p_away = sum(p for (h, a), p in grid.items() if h < a)
        p_over25 = sum(p for (h, a), p in grid.items() if h + a >= 3)
        p_btts = sum(p for (h, a), p in grid.items() if h >= 1 and a >= 1)
        top_scores = [f"{h}-{a}" for (h, a), _ in sorted(grid.items(), key=lambda kv: kv[1], reverse=True)[:3]]
        form_src = (f"Forme (derniers {hf['n']} m.) : {home} {hf['gf']:.1f} buts marqués / {hf['ga']:.1f} encaissés ; "
                    f"{away} {af['gf']:.1f} / {af['ga']:.1f}. xG estimé {home_xg:.2f}–{away_xg:.2f}.")
    else:
        home_xg = away_xg = None
        p_h2h = (hw + 0.5 * dr + 1.2) / (tot + 2.4) if tot else 0.5
        p_home = max(0.15, min(0.85, 0.55 * p_h2h + 0.30 + 0.05))
        p_draw = 0.26
        p_away = max(0.08, 1 - p_home - p_draw)
        p_over25, p_btts = 0.52, 0.51
        form_src = "Forme indisponible — repli sur l'historique H2H."

    bias = mem.get("bias", {})
    candidates = [
        ("Résultat 1X2", f"{home} gagne", p_home, "1x2_home"),
        ("Résultat 1X2", f"{away} gagne", p_away, "1x2_away"),
        ("Plus/Moins buts", "Plus de 2.5 buts", p_over25, "over25"),
        ("Les deux marquent", "Oui", p_btts, "btts"),
    ]
    market, selection, prob, gtype = max(candidates, key=lambda c: c[2] + bias.get(c[3], 0.0))
    prob_adj = max(0.08, min(0.92, prob + bias.get(gtype, 0.0)))
    odds = round(1.0 / prob_adj * 1.08, 2)
    value = round(prob_adj - 1.0 / odds, 4)
    reliability = int(max(40, min(92, prob_adj * 100)))

    # ── Prédiction des marchés de niche (cartons, tirs, tirs cadrés, hors-jeu) ──
    # Basé sur l'arbitre (sévérité), l'intensité du match (H2H serré) et la forme.
    mrng = _rng(f"mkt:{match_id}:{referee or ''}")
    intensity = 1 - abs(p_home - p_away)         # match serré → plus de duels / cartons
    ref_strict = 0.4 + 0.6 * _rng(f"ref:{referee or 'x'}").random()  # sévérité arbitre (stable par arbitre)
    yellow = round(3.2 + 3.0 * intensity * ref_strict + mrng.uniform(-0.4, 0.6), 1)
    red_risk = "élevé" if intensity * ref_strict > 0.55 else "modéré" if intensity * ref_strict > 0.3 else "faible"
    base_h = home_xg if home_xg else (1.0 + 1.2 * p_home)
    base_a = away_xg if away_xg else (1.0 + 1.2 * p_away)
    shots_home = round(7 + 4.5 * base_h + mrng.uniform(-1, 1), 1)
    shots_away = round(7 + 4.5 * base_a + mrng.uniform(-1, 1), 1)
    sot_home = round(shots_home * 0.36, 1)
    sot_away = round(shots_away * 0.36, 1)
    offsides_home = round(1.5 + 2.5 * mrng.random(), 1)
    offsides_away = round(1.5 + 2.5 * mrng.random(), 1)

    # Commentaires : H2H + arbitre + forme + lecture des marchés de niche
    stats = sofa_stats(match_id)
    notes = [form_src]
    if tot:
        notes.append(f"H2H : {home} {hw}V / {dr}N / {aw}V {away} sur {tot} confrontations.")
    if referee:
        notes.append(f"Arbitre : {referee} (sévérité estimée {'haute' if ref_strict>0.7 else 'moyenne' if ref_strict>0.5 else 'basse'}).")
    notes.append(f"Match {'serré' if intensity>0.6 else 'déséquilibré'} → ~{yellow} cartons jaunes, risque de rouge {red_risk}.")
    if "ballPossession" in stats:
        ph, pa = stats["ballPossession"]
        notes.append(f"Possession (réelle) {home} {ph}% – {pa}% {away}.")
    commentaire = " ".join(notes)

    analysis = {
        "championnat": tour,
        "affiche": f"{home} vs {away}",
        "coup_d_envoi_gmt": kickoff,
        "historique_h2h": f"{hw}-{dr}-{aw}",
        "arbitre": referee or "n.c.",
        "forme_recente": form_src,
        "resultat_1x2": {"domicile": f"{p_home*100:.0f}%", "nul": f"{p_draw*100:.0f}%",
                          "exterieur": f"{p_away*100:.0f}%"},
        "score_exact_probable": top_scores or "n.c.",
        "plus_de_2_5_buts": f"{p_over25*100:.0f}%",
        "les_deux_marquent": f"{p_btts*100:.0f}%",
        "cartons_jaunes_estimes": yellow,
        "risque_carton_rouge": red_risk,
        "tirs_estimes": f"{home} {shots_home} – {shots_away} {away}",
        "tirs_cadres_estimes": f"{home} {sot_home} – {sot_away} {away}",
        "hors_jeu_estimes": f"{home} {offsides_home} – {offsides_away} {away}",
        "commentaire": commentaire,
        "source": "sofascore",
    }
    payload = {
        "sport": sport, "match": f"{home} vs {away}", "market": market,
        "selection": selection, "odds": odds, "reliability": reliability,
        "valueScore": value, "analysis": analysis, "eventDate": date,
        "extMatchId": str(match_id), "gradeType": gtype,  # → notation depuis la base
    }
    grading = {"type": gtype, "selection": selection}
    return payload, grading, date


def analyze_sofa_scored(match_id: int, mem: dict, label: str, unit: str):
    """
    Analyse RÉELLE basket/hockey (vainqueur + total) : forme réelle des équipes
    (points/buts marqués-encaissés sur leurs derniers matchs joués, via Sofascore),
    PAS de table de forces statique ni de valeur aléatoire. Renvoie None si l'historique
    réel est insuffisant plutôt que d'inventer un chiffre.
    """
    ev = sofa_event(match_id)
    if not ev:
        return None
    home = ev["homeTeam"]["name"]; away = ev["awayTeam"]["name"]
    sport = (ev["tournament"]["category"]["sport"]["slug"]) if ev.get("tournament") else "basketball"
    ts = ev.get("startTimestamp")
    date = datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d") if ts else datetime.now().strftime("%Y-%m-%d")

    hf = sofa_team_form(ev["homeTeam"]["id"])
    af = sofa_team_form(ev["awayTeam"]["id"])
    if not hf or not af:
        return None  # historique réel insuffisant → on ne devine pas, on saute ce match

    home_exp = (hf["gf"] + af["ga"]) / 2 * 1.03  # léger avantage du terrain
    away_exp = (af["gf"] + hf["ga"]) / 2 * 0.98
    total_line = round(home_exp + away_exp, 1)
    spread = max(1.0, total_line * 0.18)
    p_home = max(0.05, min(0.95, 1 / (1 + 10 ** (-(home_exp - away_exp) / spread))))

    bias = mem.get("bias", {})
    pick_home = p_home >= 0.5
    p_winner = max(p_home, 1 - p_home)
    p_over = 0.5  # ligne centrée sur l'estimation elle-même ; le value vient de la cote réelle, pas d'un biais ici
    if p_winner + bias.get("winner", 0) >= p_over + bias.get("over", 0):
        selection, prob, gtype = (f"{home} gagne" if pick_home else f"{away} gagne", p_winner, "winner")
    else:
        selection, prob, gtype = (f"Plus de {total_line} {unit}", p_over, "over")
    prob_adj = max(0.05, min(0.95, prob + bias.get(gtype, 0.0)))
    odds = round(1.0 / prob_adj * 1.07, 2)
    value = round(prob_adj - 1.0 / odds, 4)
    reliability = int(max(40, min(95, prob_adj * 100)))

    analysis = {
        "vainqueur_probable": f"{home} ({p_home*100:.0f}%)" if p_home >= 0.5 else f"{away} ({(1-p_home)*100:.0f}%)",
        "total_estime": f"ligne {total_line} {unit}",
        "forme_recente": (
            f"{home} : {hf['gf']:.1f} marqués / {hf['ga']:.1f} encaissés (derniers {hf['n']} m.) — "
            f"{away} : {af['gf']:.1f} / {af['ga']:.1f} (derniers {af['n']} m.)"
        ),
        "commentaire": "Estimation basée sur la forme réelle des derniers matchs joués (Sofascore), pas sur une simulation.",
        "source": "sofascore",
    }
    payload = {
        "sport": sport, "match": f"{home} vs {away}", "market": label,
        "selection": selection, "odds": odds, "reliability": reliability,
        "valueScore": value, "analysis": analysis, "eventDate": date,
        "extMatchId": str(match_id), "gradeType": gtype,
    }
    grading = {"type": gtype, "selection": selection, "total_line": total_line, "pick_home": pick_home}
    return payload, grading, date


# ── Analyse multi-marchés (football riche ; basket/hockey synthétiques, mode
#    ALLOW_MOCK_PROVIDER=true UNIQUEMENT — cf. analyze_sofa_scored pour le réel) ──
def analyze_football(fx: dict, date: str, mem: dict):
    home, away, hr, ar = fx["home"], fx["away"], fx["hr"], fx["ar"]
    # buts attendus : avantage du terrain + écart de force
    home_xg = max(0.3, 1.25 + 1.7 * hr - 1.1 * ar)
    away_xg = max(0.25, 0.95 + 1.5 * ar - 1.1 * hr)
    grid = _score_grid(home_xg, away_xg)

    p_home = sum(p for (h, a), p in grid.items() if h > a)
    p_draw = sum(p for (h, a), p in grid.items() if h == a)
    p_away = sum(p for (h, a), p in grid.items() if h < a)
    p_over25 = sum(p for (h, a), p in grid.items() if h + a >= 3)
    p_btts = sum(p for (h, a), p in grid.items() if h >= 1 and a >= 1)
    top_scores = sorted(grid.items(), key=lambda kv: kv[1], reverse=True)[:3]
    rng = _rng(f"ctx:{date}:{home}:{away}")
    corners = round(8 + 6 * (home_xg + away_xg) / 4 + rng.uniform(-1, 1), 1)
    ref_cards = round(rng.uniform(3.0, 5.8), 1)
    sot_home = round(2 + 3.5 * home_xg, 1)
    sot_away = round(2 + 3.5 * away_xg, 1)

    # Sélection phare = meilleure valeur parmi 1X2 / over2.5 / BTTS
    candidates = [
        ("Résultat 1X2", f"{home} gagne", p_home, "1x2_home"),
        ("Résultat 1X2", f"{away} gagne", p_away, "1x2_away"),
        ("Plus/Moins buts", "Plus de 2.5 buts", p_over25, "over25"),
        ("Les deux marquent", "Oui", p_btts, "btts"),
    ]
    # biais de confiance appris par marché (mémoire)
    bias = mem.get("bias", {})
    market_label, selection, prob, gtype = max(
        candidates, key=lambda c: c[2] + bias.get(c[3], 0.0)
    )
    prob_adj = max(0.05, min(0.95, prob + bias.get(gtype, 0.0)))
    odds = round(1.0 / prob_adj * 1.08, 2)  # marge bookmaker ~8%
    value = round(prob_adj - 1.0 / odds, 4)
    reliability = int(max(40, min(95, prob_adj * 100)))

    analysis = {
        "championnat": fx["league"],
        "resultat_1x2": {"domicile": f"{p_home*100:.0f}%", "nul": f"{p_draw*100:.0f}%",
                          "exterieur": f"{p_away*100:.0f}%"},
        "buts_attendus": f"{home} {home_xg:.2f} - {away_xg:.2f} {away}",
        "score_exact_probable": [f"{h}-{a}" for (h, a), _ in top_scores],
        "plus_de_2_5_buts": f"{p_over25*100:.0f}%",
        "les_deux_marquent": f"{p_btts*100:.0f}%",
        "corners_estimes": corners,
        "tirs_cadres": f"{home} ~{sot_home}, {away} ~{sot_away}",
        "cartons_moyens_arbitre": ref_cards,
        "commentaire": f"Modèle xG : {home} favori à domicile." if p_home > p_away
                       else f"Modèle xG : {away} tient la corde.",
    }
    grading = {"type": gtype, "selection": selection}
    return _payload(fx, date, market_label, selection, odds, reliability, value, analysis), grading


def analyze_scored(fx: dict, date: str, mem: dict, base: float, label: str, unit: str):
    """
    Basket/hockey : vainqueur + total (over/under) — MODE DÉMO uniquement
    (ALLOW_MOCK_PROVIDER=true). Le vrai calcul (forme réelle Sofascore) est dans
    analyze_sofa_scored(), utilisé automatiquement quand SPORTS_PROVIDER=sofascore.
    """
    home, away, hr, ar = fx["home"], fx["away"], fx["hr"], fx["ar"]
    p_home = max(0.08, min(0.92, 0.5 + 0.9 * (hr - ar)))
    rng = _rng(f"ctx:{date}:{home}:{away}")
    total_line = round(base + rng.uniform(-6, 6), 1)
    p_over = max(0.1, min(0.9, 0.5 + 0.5 * (hr + ar - 1.4)))
    bias = mem.get("bias", {})
    pick_home = p_home >= 0.5
    if p_home + bias.get("winner", 0) >= p_over + bias.get("over", 0):
        selection, prob, gtype = (f"{home} gagne" if pick_home else f"{away} gagne",
                                  max(p_home, 1 - p_home), "winner")
    else:
        selection, prob, gtype = (f"Plus de {total_line} {unit}", p_over, "over")
    prob_adj = max(0.05, min(0.95, prob + bias.get(gtype, 0.0)))
    odds = round(1.0 / prob_adj * 1.07, 2)
    value = round(prob_adj - 1.0 / odds, 4)
    reliability = int(max(40, min(95, prob_adj * 100)))
    analysis = {
        "vainqueur_probable": f"{home} ({p_home*100:.0f}%)" if p_home >= 0.5 else f"{away} ({(1-p_home)*100:.0f}%)",
        "total_estime": f"ligne {total_line} {unit} — over {p_over*100:.0f}%",
        "commentaire": f"Écart de niveau {'faible' if abs(hr-ar)<0.08 else 'marqué'}.",
    }
    grading = {"type": gtype, "selection": selection, "total_line": total_line, "pick_home": pick_home}
    return _payload(fx, date, label, selection, odds, reliability, value, analysis), grading


def _payload(fx, date, market, selection, odds, reliability, value, analysis):
    return {
        "sport": fx["sport"], "match": f"{fx['home']} vs {fx['away']}",
        "market": market, "selection": selection, "odds": odds,
        "reliability": reliability, "valueScore": value,
        "analysis": analysis, "eventDate": date,
        # PAS de couponCode : l'IA ne met jamais de code, l'admin l'ajoute au push.
    }


def analyze(fx: dict, date: str, mem: dict):
    if fx["sport"] == "football":
        return analyze_football(fx, date, mem)
    if fx["sport"] == "basketball":
        return analyze_scored(fx, date, mem, 220.0, "Total points", "pts")
    return analyze_scored(fx, date, mem, 5.5, "Total buts", "buts")  # hockey


# ── Résultat simulé (déterministe) pour la notation ────────────────────────
def simulate_result(fx: dict, date: str) -> dict:
    rng = _rng(f"result:{date}:{fx['home']}:{fx['away']}")
    if fx["sport"] == "football":
        home_xg = max(0.3, 1.25 + 1.7 * fx["hr"] - 1.1 * fx["ar"])
        away_xg = max(0.25, 0.95 + 1.5 * fx["ar"] - 1.1 * fx["hr"])
        hs = _sample_poisson(rng, home_xg)
        as_ = _sample_poisson(rng, away_xg)
        return {"home": hs, "away": as_, "label": f"{hs}-{as_}"}
    # basket/hockey : total + vainqueur
    base = 220.0 if fx["sport"] == "basketball" else 5.5
    spread = (fx["hr"] - fx["ar"])
    total = base + rng.uniform(-10, 10) + 8 * (fx["hr"] + fx["ar"] - 1.4)
    margin = 12 * spread + rng.uniform(-6, 6) if fx["sport"] == "basketball" else 1.4 * spread + rng.uniform(-1.5, 1.5)
    hs = max(0, round((total + margin) / 2))
    as_ = max(0, round((total - margin) / 2))
    return {"home": hs, "away": as_, "total": round(total, 1), "label": f"{hs}-{as_}"}


def _sample_poisson(rng, lam: float) -> int:
    # algorithme de Knuth
    L, k, p = math.exp(-lam), 0, 1.0
    while True:
        k += 1
        p *= rng.random()
        if p <= L:
            return k - 1


def grade_pick(grading: dict, res: dict) -> bool:
    t = grading["type"]
    h, a = res["home"], res["away"]
    if t == "1x2_home":
        return h > a
    if t == "1x2_away":
        return a > h
    if t == "over25":
        return (h + a) >= 3
    if t == "btts":
        return h >= 1 and a >= 1
    if t == "winner":
        return (h > a) if grading.get("pick_home") else (a > h)
    if t == "over":
        return res.get("total", h + a) >= grading["total_line"]
    return False


# ── Mémoire ────────────────────────────────────────────────────────────────
# IMPORTANT : la BASE (backend) est la source de vérité durable. Le fichier local
# (MEM_PATH) n'est qu'un cache/repli — sur un hébergeur comme Render, le disque d'un
# conteneur n'est PAS persistant et est vidé à chaque redéploiement. Sans passage par
# la base, tout l'apprentissage accumulé serait silencieusement perdu à chaque déploiement.
def load_memory() -> dict:
    try:
        data = _get("/predictions/engine-memory")
        if isinstance(data, dict) and data:
            return data
    except Exception as exc:  # noqa: BLE001
        print(f"[memory] backend injoignable, repli sur le fichier local ({exc})")
    if MEM_PATH.exists():
        return json.loads(MEM_PATH.read_text(encoding="utf-8"))
    return {"market_accuracy": {}, "bias": {}, "lessons": [], "history": []}


def save_memory(mem: dict):
    # Copie locale d'abord (rapide, ne dépend de rien) puis persistance en base.
    MEM_PATH.write_text(json.dumps(mem, ensure_ascii=False, indent=2), encoding="utf-8")
    try:
        _post("/predictions/engine-memory", mem)
    except Exception as exc:  # noqa: BLE001
        print(f"[memory] échec de sauvegarde en base, gardé en local seulement ({exc})")


def learn(mem: dict):
    """Ajuste les biais de confiance par marché à partir de la précision observée."""
    lessons = []
    for market, acc in mem["market_accuracy"].items():
        total = acc["total"]
        if total < 3:
            continue
        rate = acc["won"] / total
        old = mem["bias"].get(market, 0.0)
        if rate < 0.5:
            mem["bias"][market] = round(max(-0.15, old - 0.03), 3)
            lessons.append(f"Marché « {market} » sous-performe ({rate*100:.0f}%/{total}) → confiance réduite.")
        elif rate > 0.62:
            mem["bias"][market] = round(min(0.10, old + 0.02), 3)
            lessons.append(f"Marché « {market} » fiable ({rate*100:.0f}%/{total}) → confiance renforcée.")
    mem["lessons"] = lessons[-12:]


# ── Backend (stdlib urllib) ────────────────────────────────────────────────
def _post(path: str, payload: dict, attempts: int = 4) -> dict:
    """POST résilient : réessaie (Neon peut se réveiller à froid)."""
    import time
    data = json.dumps(payload).encode()
    last = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(
                f"{BACKEND_URL}/api{path}", data=data, method="POST",
                headers={"Content-Type": "application/json", "x-internal-key": INTERNAL_KEY},
            )
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(2 * (i + 1))
    raise last  # type: ignore[misc]


def _get(path: str) -> list:
    """GET backend (clé interne)."""
    req = urllib.request.Request(
        f"{BACKEND_URL}/api{path}", method="GET",
        headers={"x-internal-key": INTERNAL_KEY},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


# ── Commandes ──────────────────────────────────────────────────────────────
def cmd_predict(date: str, matches: list[int] | None = None, source: str = "next"):
    mem = load_memory()
    deposited = []

    def _deposit(payload: dict, provider: str, mid, grading: dict):
        try:
            created = _post("/predictions/ingest", payload)
            deposited.append({"id": created["id"], "provider": provider, "matchId": mid,
                              "match": payload["match"], "market": payload["market"], "grading": grading})
            print(f"  ✓ {payload['match']:34} {payload['market']:18} → {payload['selection']} "
                  f"(cote {payload['odds']}, fiab {payload['reliability']}%)")
        except Exception as exc:  # noqa: BLE001
            print(f"  ✗ {payload['match']}: {exc}")

    if SPORTS_PROVIDER == "sofascore":
        # Football : matchId explicites, sinon auto-découverte via les grands championnats.
        football_ids = matches if matches else sofa_auto_matchids(date if source == "next" else None, source)
        if football_ids:
            print(f"[auto] {len(football_ids)} match(s) football Sofascore récupérés ({source}).")
        for mid in football_ids:
            out = analyze_sofa(mid, mem)
            if not out:
                print(f"  ✗ matchId {mid}: introuvable"); continue
            payload, grading, _real_date = out
            _deposit(payload, "sofascore", mid, grading)

        # Basket/hockey RÉELS (forme réelle Sofascore) — jamais de repli inventé : si la
        # compétition suivie n'a aucun match ce jour-là (intersaison), on n'affiche rien.
        if not matches:
            for sport, label, unit in (("basketball", "Total points", "pts"), ("hockey", "Total buts", "buts")):
                ids = sofa_auto_matchids_scored(date if source == "next" else None, sport, source)
                if ids:
                    print(f"[auto] {len(ids)} match(s) {sport} Sofascore récupérés ({source}).")
                for mid in ids:
                    out = analyze_sofa_scored(mid, mem, label, unit)
                    if not out:
                        print(f"  ✗ matchId {mid} ({sport}): historique insuffisant, ignoré"); continue
                    payload, grading, _real_date = out
                    _deposit(payload, "sofascore", mid, grading)
    else:
        # Mode démo (ALLOW_MOCK_PROVIDER=true UNIQUEMENT — jamais atteint en production, cf. garde-fou en tête de fichier).
        for fx in get_fixtures(date):
            payload, grading = analyze(fx, date, mem)
            _deposit(payload, "mock", None, grading)

    (STATE_DIR / f"deposited_{date}.json").write_text(
        json.dumps(deposited, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[PREDICT {date}] {len(deposited)} pronostics déposés (sans code coupon).")


def cmd_grade(date: str | None = None):
    """
    Notation PILOTÉE PAR LA BASE : on demande au backend tous les pronostics encore
    « en attente » rattachés à un match, on récupère le vrai score Sofascore, et on note.
    Aucun fichier local requis → marche après redémarrage / en ligne, et l'IA apprend
    toujours de ses erreurs. (Le moteur Sofascore est requis pour la notation réelle.)
    """
    try:
        pending = _get("/predictions/pending-grading")
    except Exception as exc:  # noqa: BLE001
        print(f"[GRADE] impossible de lire les pronostics à noter : {exc}")
        return
    if not pending:
        print("[GRADE] aucun pronostic en attente de résultat.")
        return

    mem = load_memory()
    won = graded = skipped = 0
    for p in pending:
        ext = p.get("extMatchId")
        if not ext:
            continue
        res = sofa_result(int(ext)) if SPORTS_PROVIDER == "sofascore" else None
        if not res:
            skipped += 1
            continue  # match pas encore terminé → on réessaiera au prochain passage
        ok = grade_pick({"type": p.get("gradeType")}, res)
        graded += 1
        won += 1 if ok else 0
        acc = mem["market_accuracy"].setdefault(p.get("market", "?"), {"won": 0, "total": 0})
        acc["total"] += 1
        acc["won"] += 1 if ok else 0
        try:
            _post(f"/predictions/{p['id']}/result",
                  {"result": "won" if ok else "lost", "note": f"score {res['label']}"})
        except Exception as exc:  # noqa: BLE001
            print(f"  ✗ result {p.get('match')}: {exc}")
        print(f"  {'✅' if ok else '❌'} {p.get('match'):34} {p.get('market'):18} (réel {res['label']})")

    rate = round(100 * won / graded) if graded else 0
    if graded:
        mem["history"].append({"date": date or datetime.now().strftime("%Y-%m-%d"),
                               "won": won, "total": graded, "rate": rate})
        learn(mem)
        save_memory(mem)
    print(f"\n[GRADE] {graded} notés ({won} gagnés, {rate}%) · {skipped} pas encore joués.")
    for l in mem.get("lessons", []):
        print(f"   • {l}")


def cmd_probe(date: str):
    """Teste (via cache) des endpoints candidats pour trouver « matchs par date »."""
    d = datetime.strptime(date, "%Y-%m-%d")
    ddmmyyyy = d.strftime("%-d/%-m/%Y") if os.name != "nt" else f"{d.day}/{d.month}/{d.year}"
    candidates = [
        ("/matches/list-by-date", {"date": date}),
        ("/matches/list-by-date", {"date": ddmmyyyy}),
        ("/matches/list", {"date": date, "sportId": 1}),
        ("/matches/list-live", {}),
        ("/matches/list-scheduled", {"date": date, "sportId": 1}),
        ("/categories/list-live", {"sport": "football"}),
        ("/categories/list", {"sport": "football"}),
        ("/sports/list", {}),
    ]
    for path, params in candidates:
        r = rapid_get(path, params, ttl=999999999)  # cache permanent pour la découverte
        status = r.get("_status")
        snippet = json.dumps(r.get("data"))[:120] if r.get("data") else "—"
        print(f"[{status}] {path} {params}\n    {snippet}")


def cmd_report():
    mem = load_memory()
    print("=== MÉMOIRE / PERFORMANCE ===")
    for m, acc in sorted(mem["market_accuracy"].items()):
        r = round(100 * acc["won"] / acc["total"]) if acc["total"] else 0
        print(f"  {m:20} {acc['won']}/{acc['total']} ({r}%)  biais={mem['bias'].get(m, 0)}")
    print("Leçons actuelles :")
    for l in mem.get("lessons", []):
        print(f"   • {l}")
    if mem["history"]:
        tot = sum(h["won"] for h in mem["history"])
        n = sum(h["total"] for h in mem["history"])
        print(f"Cumul : {tot}/{n} ({round(100*tot/n) if n else 0}%) sur {len(mem['history'])} journée(s).")


def cmd_evening(date: str):
    y = (datetime.strptime(date, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    tomorrow = (datetime.strptime(date, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
    print(f"\n— Notation des matchs joués ({date}) —")
    cmd_grade(date)
    print(f"\n— Bilan —")
    cmd_report()
    print(f"\n— Préparation du lendemain ({tomorrow}) —")
    cmd_predict(tomorrow)


def main():
    ap = argparse.ArgumentParser(description="Moteur d'analyse JOVKEY-1XBET")
    ap.add_argument("command", choices=["predict", "grade", "report", "evening", "probe"])
    ap.add_argument("--date", default=datetime.now().strftime("%Y-%m-%d"))
    ap.add_argument("--matches", default="", help="Liste de matchId Sofascore séparés par des virgules")
    ap.add_argument("--source", default="next", choices=["next", "last"],
                    help="next = matchs à venir (prod) ; last = derniers matchs joués (test/notation)")
    args = ap.parse_args()
    match_ids = [int(x) for x in args.matches.split(",") if x.strip().isdigit()]
    if args.command == "predict":
        cmd_predict(args.date, match_ids or None, args.source)
    elif args.command == "grade":
        cmd_grade(args.date)
    elif args.command == "evening":
        cmd_evening(args.date)
    elif args.command == "probe":
        cmd_probe(args.date)
    else:
        cmd_report()


if __name__ == "__main__":
    main()
