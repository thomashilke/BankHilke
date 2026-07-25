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

    `rate` is applied directly at each accrual -- it is the rate for one
    occurrence of `schedule` (one week or one month), not an annualized
    figure divided down. This keeps the amount a parent configures directly
    tied to the amount actually transferred each period, so it's easy to
    reason about (and large enough to be meaningful to a child) instead of
    an annual rate diluted to a barely-visible weekly/monthly fraction.
    """

    WEEKLY = "weekly"
    MONTHLY = "monthly"
    SCHEDULE_CHOICES = [
        (WEEKLY, "Weekly"),
        (MONTHLY, "Monthly"),
    ]

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

    rate = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        help_text="Rate applied at each accrual (relative to `schedule`, not annualized), e.g. 0.0200 = 2% of the balance every period.",
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

    def save(self, *args, **kwargs):
        if self._state.adding and not self.next_run_at:
            if self.schedule == self.MONTHLY:
                self.next_run_at = next_monthly_occurrence(timezone.now(), self.day_of_month, self.hour)
            else:
                self.next_run_at = next_weekly_occurrence(timezone.now(), self.weekday, self.hour)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Interest for {self.child} ({self.rate}/{self.schedule})"
