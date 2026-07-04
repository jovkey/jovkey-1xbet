"""Tâches Celery : balayage nocturne des événements du jour."""
from __future__ import annotations

import random
import uuid

from .analyzer import MatchSignals, evaluate, assign_tier, SPORTS
from .backend_client import push_prediction


def _fetch_today_events() -> list[MatchSignals]:
    """
    Point d'intégration : ici on brancherait un fournisseur de données réel
    (API sportive + cotes 1xBet). Pour la démo, on génère des évènements plausibles.
    """
    events: list[MatchSignals] = []
    samples = {
        "football": ("Arsenal vs Chelsea", "Arsenal & +1.5 buts", "Double chance + buts"),
        "basketball": ("Celtics vs Heat", "Total > 211.5", "Total points"),
        "hockey": ("Rangers vs Flyers", "Rangers ML", "Vainqueur"),
        "tennis_table": ("Lin Y. vs Wang C.", "Lin Y. 3-1", "Score exact"),
    }
    for sport in SPORTS:
        match, selection, market = samples[sport]
        events.append(
            MatchSignals(
                sport=sport, match=match, selection=selection, market=market,
                bookmaker_odds=round(random.uniform(1.8, 9.0), 2),
                form=random.random(), stake_importance=random.random(),
                shots_ratio=random.random(), shots_on_target_ratio=random.random(),
                offside_pressure=random.random(), cards_discipline=random.random(),
                referee_bias=random.random(), public_hype=random.random(),
            )
        )
    return events


def run_nightly_analysis() -> dict:
    """Évalue les évènements, écarte les pièges, pousse les opportunités validées."""
    pushed, skipped = 0, 0
    for ev in _fetch_today_events():
        verdict = evaluate(ev)
        if not verdict.keep:
            skipped += 1
            continue
        payload = {
            "sport": ev.sport,
            "match": ev.match,
            "market": ev.market,
            "selection": ev.selection,
            "odds": ev.bookmaker_odds,
            "reliability": verdict.reliability,
            "couponCode": f"JOV-AI-{uuid.uuid4().hex[:6].upper()}",
            "valueScore": verdict.value_edge,
            "tier": assign_tier(ev.bookmaker_odds),
        }
        try:
            push_prediction(payload)
            pushed += 1
        except Exception as exc:  # noqa: BLE001 — on log et on continue
            print(f"[analysis] push échoué pour {ev.match}: {exc}")
            skipped += 1
    return {"pushed": pushed, "skipped": skipped}
