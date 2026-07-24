from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from apps.users.models import User

from .scheduling import next_monthly_occurrence, next_weekly_occurrence


class AllowanceRule(models.Model):
    """Configures a child's recurring weekly allowance.

    `next_run_at` is the scheduling cursor: the Celery task advances it one
    occurrence at a time each time it posts, which is what makes catch-up
    after downtime and idempotent reprocessing work (see apps.allowances.tasks).
    """

    child = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="allowance_rule",
        limit_choices_to={"role": User.CHILD},
    )

    funding_parent = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="funded_allowance_rules",
        limit_choices_to={"role": User.PARENT},
        help_text="Parent whose account is debited each time this allowance is paid.",
    )

    amount = models.DecimalField(max_digits=8, decimal_places=2)

    weekday = models.IntegerField(
        default=6,
        validators=[MinValueValidator(0), MaxValueValidator(6)],
        help_text="0=Monday .. 6=Sunday",
    )

    hour = models.IntegerField(
        default=9,
        validators=[MinValueValidator(0), MaxValueValidator(23)],
    )

    enabled = models.BooleanField(default=True)

    next_run_at = models.DateTimeField(
        help_text="Next time this rule is due; advanced by the scheduler after each posting.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if self._state.adding and not self.next_run_at:
            self.next_run_at = next_weekly_occurrence(timezone.now(), self.weekday, self.hour)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Allowance for {self.child} ({self.amount}/week)"


class InterestRule(models.Model):
    """Configures a child's recurring interest accrual.

    Rate and calculation schedule (weekly or monthly) are independent of the
    allowance schedule and of each other.
    """

    WEEKLY = "weekly"
    MONTHLY = "monthly"
    SCHEDULE_CHOICES = [
        (WEEKLY, "Weekly"),
        (MONTHLY, "Monthly"),
    ]
    PERIODS_PER_YEAR = {WEEKLY: 52, MONTHLY: 12}

    child = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="interest_rule",
        limit_choices_to={"role": User.CHILD},
    )

    funding_parent = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="funded_interest_rules",
        limit_choices_to={"role": User.PARENT},
        help_text="Parent whose account is debited each time interest is paid.",
    )

    annual_rate = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        help_text="Nominal annual rate, e.g. 0.0500 = 5%/year.",
    )

    schedule = models.CharField(max_length=10, choices=SCHEDULE_CHOICES, default=WEEKLY)

    weekday = models.IntegerField(
        default=6,
        validators=[MinValueValidator(0), MaxValueValidator(6)],
        help_text="Used when schedule=weekly. 0=Monday .. 6=Sunday",
    )

    day_of_month = models.IntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(31)],
        help_text="Used when schedule=monthly. Clamped to the last day of short months.",
    )

    hour = models.IntegerField(
        default=9,
        validators=[MinValueValidator(0), MaxValueValidator(23)],
    )

    enabled = models.BooleanField(default=True)

    next_run_at = models.DateTimeField(
        help_text="Next time this rule is due; advanced by the scheduler after each posting.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def period_rate(self):
        return self.annual_rate / self.PERIODS_PER_YEAR[self.schedule]

    def save(self, *args, **kwargs):
        if self._state.adding and not self.next_run_at:
            if self.schedule == self.MONTHLY:
                self.next_run_at = next_monthly_occurrence(timezone.now(), self.day_of_month, self.hour)
            else:
                self.next_run_at = next_weekly_occurrence(timezone.now(), self.weekday, self.hour)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Interest for {self.child} ({self.annual_rate}/yr, {self.schedule})"
