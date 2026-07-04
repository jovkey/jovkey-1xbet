"""Client HTTP vers l'API NestJS pour pousser les opportunités validées."""
import os
import httpx

BACKEND_URL = os.getenv("BACKEND_INTERNAL_URL", "http://localhost:4000")
INTERNAL_KEY = os.getenv("ANALYSIS_API_KEY", "internal-analysis-key")


def push_prediction(payload: dict) -> dict:
    """POST /api/predictions/ingest avec la clé interne."""
    with httpx.Client(timeout=10.0) as client:
        resp = client.post(
            f"{BACKEND_URL}/api/predictions/ingest",
            json=payload,
            headers={"x-internal-key": INTERNAL_KEY},
        )
        resp.raise_for_status()
        return resp.json()
