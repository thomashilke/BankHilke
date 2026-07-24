import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "api.settings"
)

app = Celery("hilkebank")

app.config_from_object(
    "django.conf:settings",
    namespace="CELERY"
)

app.autodiscover_tasks()

app.conf.beat_schedule = {
    "process-due-accruals": {
        "task": "apps.allowances.tasks.process_due_accruals",
        # Rules are configured to the hour; checking every 15 minutes keeps
        # postings prompt without hammering the DB. Missed runs (e.g. beat/
        # worker downtime) are caught up on the next tick via next_run_at.
        "schedule": crontab(minute="*/15"),
    }
}
