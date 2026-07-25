from decimal import Decimal

from celery import shared_task
from celery.utils.log import get_task_logger
from django.db import transaction as db_transaction
from django.utils import timezone

from apps.transactions.services import LedgerService

from .models import AllowanceRule, InterestRule
from .scheduling import next_monthly_occurrence, next_weekly_occurrence

logger = get_task_logger(__name__)

# Safety cap on how many missed periods a single task run will catch up in one
# go, so a rule left disabled/broken for years can't spin the task forever.
MAX_CATCHUP_PERIODS = 520  # ~10 years of weekly events


@shared_task
def process_due_accruals():
    """Runs periodically (see CELERY_BEAT_SCHEDULE in api/celery.py).

    For every enabled rule whose `next_run_at` has passed, posts the
    transaction and advances `next_run_at` to the following occurrence,
    looping until caught up to "now". Each posted event's idempotency_key is
    deterministic (rule id + exact due timestamp), and posting + advancing
    the cursor happen in one DB transaction, so:
      - running this task twice concurrently never double-posts (unique
        constraint on idempotency_key + the second writer's IntegrityError
        is swallowed as "already posted"), and
      - if the worker was down when a period was due, the next run walks
        forward through every missed period exactly once.
    """
    now = timezone.now()
    allowance_count = _process_allowances(now)
    interest_count = _process_interest(now)
    logger.info("processed %s allowance and %s interest accruals", allowance_count, interest_count)
    return {"allowances": allowance_count, "interest": interest_count}


def _process_allowances(now):
    processed = 0
    rules = AllowanceRule.objects.filter(enabled=True, next_run_at__lte=now).select_related("child", "funding_parent")
    for rule in rules:
        periods = 0
        while rule.next_run_at <= now and periods < MAX_CATCHUP_PERIODS:
            due_at = rule.next_run_at
            with db_transaction.atomic():
                LedgerService.allowance(
                    child_account=rule.child.account,
                    parent_account=rule.funding_parent.account,
                    amount=rule.amount,
                    description=f"Weekly allowance for {due_at.date().isoformat()}",
                    idempotency_key=f"allowance:{rule.id}:{due_at.isoformat()}",
                )
                rule.next_run_at = next_weekly_occurrence(due_at, rule.weekday, rule.hour)
                rule.save(update_fields=["next_run_at"])
            periods += 1
            processed += 1
    return processed


def _process_interest(now):
    processed = 0
    rules = InterestRule.objects.filter(enabled=True, next_run_at__lte=now).select_related("child", "funding_parent")
    for rule in rules:
        periods = 0
        while rule.next_run_at <= now and periods < MAX_CATCHUP_PERIODS:
            due_at = rule.next_run_at
            with db_transaction.atomic():
                principal = rule.child.account.balance
                amount = (principal * rule.rate).quantize(Decimal("0.01"))
                if amount > 0:
                    LedgerService.interest(
                        child_account=rule.child.account,
                        parent_account=rule.funding_parent.account,
                        amount=amount,
                        description=f"Interest accrual for {due_at.date().isoformat()}",
                        idempotency_key=f"interest:{rule.id}:{due_at.isoformat()}",
                    )
                if rule.schedule == InterestRule.MONTHLY:
                    rule.next_run_at = next_monthly_occurrence(due_at, rule.day_of_month, rule.hour)
                else:
                    rule.next_run_at = next_weekly_occurrence(due_at, rule.weekday, rule.hour)
                rule.save(update_fields=["next_run_at"])
            periods += 1
            processed += 1
    return processed
