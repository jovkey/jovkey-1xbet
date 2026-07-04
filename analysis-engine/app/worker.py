"""Configuration Celery : worker + beat (planification nocturne)."""
import os
from celery import Celery
from celery.schedules import crontab

from .tasks import run_nightly_analysis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery("jovkey_analysis", broker=REDIS_URL, backend=REDIS_URL)
celery_app.conf.timezone = "UTC"


@celery_app.task(name="nightly_analysis")
def nightly_analysis_task():
    return run_nightly_analysis()


# Exécution chaque nuit à 02:00 UTC.
celery_app.conf.beat_schedule = {
    "nightly-analysis": {
        "task": "nightly_analysis",
        "schedule": crontab(hour=2, minute=0),
    },
}
