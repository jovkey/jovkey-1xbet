"""
Moteur d'analyse anti-piège — "Value Betting Inversé".

Principe (§4 du PDF) : pour chaque événement, on estime une probabilité "vraie"
à partir de signaux de niche (forme, enjeu, tirs, tirs cadrés, hors-jeu, cartons,
profil de l'arbitre...). On la compare à la probabilité implicite de la cote 1xBet.

- Si 1xBet SURÉVALUE une sélection portée par la hype du public (notre proba << proba
  implicite), c'est un PIÈGE → on écarte.
- Si la cote offre une valeur mathématique réelle supérieure à la variance
  (notre proba > proba implicite + marge de sécurité), c'est une OPPORTUNITÉ → on pousse.

NB : ceci est un cadre algorithmique de référence. Les coefficients sont illustratifs ;
en production on branche des données réelles et un modèle calibré (et backtesté).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

SPORTS = ("football", "basketball", "hockey", "tennis_table")

# Marge de sécurité exigée au-delà de la variance pour valider une opportunité.
VALUE_THRESHOLD = 0.06
# En dessous, on considère que le marché est un piège (cote gonflée par la hype).
TRAP_THRESHOLD = -0.05


@dataclass
class MatchSignals:
    sport: str
    match: str
    selection: str
    market: str
    bookmaker_odds: float
    # Signaux de niche (normalisés 0..1 sauf mention contraire)
    form: float = 0.5            # forme récente de l'équipe/joueur visé
    stake_importance: float = 0.5  # enjeu du match (finale, maintien...)
    shots_ratio: float = 0.5     # tirs / tirs adverses
    shots_on_target_ratio: float = 0.5
    offside_pressure: float = 0.5
    cards_discipline: float = 0.5  # 1 = très discipliné (peu de cartons)
    referee_bias: float = 0.5    # profil arbitre favorable à la sélection
    public_hype: float = 0.5     # part du volume public sur cette sélection (proxy de piège)
    weights: dict = field(default_factory=dict)


def implied_probability(odds: float) -> float:
    """Probabilité implicite brute de la cote (avant retrait de la marge bookmaker)."""
    return 1.0 / odds if odds > 0 else 0.0


def estimate_true_probability(s: MatchSignals) -> float:
    """Combine les signaux de niche en une probabilité 'vraie' estimée [0..1]."""
    w = {
        "form": 0.22,
        "stake_importance": 0.10,
        "shots_ratio": 0.16,
        "shots_on_target_ratio": 0.18,
        "offside_pressure": 0.06,
        "cards_discipline": 0.08,
        "referee_bias": 0.10,
        # La hype publique TIRE la proba vers le bas (signal de piège).
        "public_hype": -0.10,
        **s.weights,
    }
    raw = (
        w["form"] * s.form
        + w["stake_importance"] * s.stake_importance
        + w["shots_ratio"] * s.shots_ratio
        + w["shots_on_target_ratio"] * s.shots_on_target_ratio
        + w["offside_pressure"] * s.offside_pressure
        + w["cards_discipline"] * s.cards_discipline
        + w["referee_bias"] * s.referee_bias
        + w["public_hype"] * s.public_hype
    )
    # `raw` ~ somme pondérée des signaux positifs (la hype tire vers le bas).
    # Recadrage doux dans [0.02, 0.98].
    return max(0.02, min(0.98, raw))


@dataclass
class Verdict:
    keep: bool
    is_trap: bool
    value_edge: float          # proba_vraie - proba_implicite
    true_probability: float
    reliability: int           # 0..100
    reason: str


def evaluate(s: MatchSignals) -> Verdict:
    if s.sport not in SPORTS:
        return Verdict(False, False, 0.0, 0.0, 0, f"Sport non supporté: {s.sport}")

    p_true = estimate_true_probability(s)
    p_implied = implied_probability(s.bookmaker_odds)
    edge = round(p_true - p_implied, 4)

    if edge <= TRAP_THRESHOLD:
        return Verdict(False, True, edge, p_true, 0,
                       "Piège: cote surévaluée par la hype publique, écartée.")
    if edge >= VALUE_THRESHOLD:
        reliability = int(min(95, max(50, p_true * 100)))
        return Verdict(True, False, edge, p_true, reliability,
                       "Opportunité: valeur mathématique supérieure à la variance.")
    return Verdict(False, False, edge, p_true, int(p_true * 100),
                   "Neutre: pas assez de valeur au-delà de la variance.")


def assign_tier(odds: float) -> str:
    """Une cote ~2 alimente la vitrine gratuite ; les cotes agressives le flux privé."""
    if odds <= 2.2:
        return "free"
    if odds <= 6:
        return "gold"
    return "investor"
