"""API FastAPI du moteur d'analyse : santé, déclenchement manuel, évaluation unitaire."""
from fastapi import FastAPI
from pydantic import BaseModel

from .analyzer import MatchSignals, evaluate, assign_tier
from .tasks import run_nightly_analysis

app = FastAPI(title="JOVKEY-1XBET — Moteur d'analyse anti-piège", version="1.0")


@app.get("/health")
def health():
    return {"status": "ok"}


class EvaluateRequest(BaseModel):
    sport: str
    match: str
    selection: str
    market: str
    bookmaker_odds: float
    form: float = 0.5
    stake_importance: float = 0.5
    shots_ratio: float = 0.5
    shots_on_target_ratio: float = 0.5
    offside_pressure: float = 0.5
    cards_discipline: float = 0.5
    referee_bias: float = 0.5
    public_hype: float = 0.5


@app.post("/evaluate")
def evaluate_endpoint(req: EvaluateRequest):
    """Évalue un évènement unique (utile pour debug / outil admin)."""
    verdict = evaluate(MatchSignals(**req.model_dump()))
    return {
        "keep": verdict.keep,
        "is_trap": verdict.is_trap,
        "value_edge": verdict.value_edge,
        "true_probability": round(verdict.true_probability, 4),
        "reliability": verdict.reliability,
        "tier": assign_tier(req.bookmaker_odds),
        "reason": verdict.reason,
    }


@app.post("/run-now")
def run_now():
    """Déclenche manuellement le balayage nocturne (sans attendre le beat)."""
    return run_nightly_analysis()
