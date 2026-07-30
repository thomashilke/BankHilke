from django.db import models

from apps.accounts.models import Account
from apps.users.models import User


class TransactionQuerySet(models.QuerySet):
    def visible(self):
        """Excludes reversal transactions and transactions that have been
        reversed. Reversing a movement is meant to make it as if it never
        happened, so both legs of a reversal disappear from every listing
        and aggregate built on this queryset."""
        return self.filter(reverses__isnull=True, reversal__isnull=True)


class Transaction(models.Model):
    """A single business event (allowance, interest, deposit, withdrawal).

    Always posts exactly two LedgerEntry rows (one debit, one credit, equal
    amount) -- see apps.transactions.services.LedgerService. child_account /
    parent_account record *which* accounts were on each side so history and
    parent-to-parent reconciliation queries don't need to inspect entries.
    """

    ALLOWANCE = "allowance"
    INTEREST = "interest"
    WITHDRAWAL = "withdrawal"
    DEPOSIT = "deposit"
    TYPE_CHOICES = [
        (ALLOWANCE, "Allowance"),
        (INTEREST, "Interest"),
        (WITHDRAWAL, "Withdrawal"),
        (DEPOSIT, "Deposit"),
    ]

    objects = TransactionQuerySet.as_manager()

    transaction_type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
    )

    child_account = models.ForeignKey(
        Account,
        related_name="child_transactions",
        on_delete=models.CASCADE,
    )

    parent_account = models.ForeignKey(
        Account,
        related_name="parent_transactions",
        on_delete=models.CASCADE,
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )

    description = models.CharField(
        max_length=200,
        blank=True,
    )

    initiated_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        related_name="initiated_transactions",
        on_delete=models.SET_NULL,
        help_text="Parent who triggered a manual deposit/withdrawal; null for scheduled events.",
    )

    idempotency_key = models.CharField(
        max_length=255,
        unique=True,
        help_text="Deterministic for scheduled events (rule id + due timestamp) so replays/catch-up never double-post.",
    )

    reverses = models.OneToOneField(
        "self",
        null=True,
        blank=True,
        related_name="reversal",
        on_delete=models.CASCADE,
        help_text="Set on a reversal transaction; points at the original transaction it cancels out. "
        "Once a transaction has a reversal, `objects.visible()` excludes both from listings/aggregates.",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.transaction_type} {self.amount} ({self.child_account} / {self.parent_account})"


class LedgerEntry(models.Model):
    DEBIT = "debit"
    CREDIT = "credit"
    DIRECTION_CHOICES = [
        (DEBIT, "Debit"),
        (CREDIT, "Credit"),
    ]

    transaction = models.ForeignKey(
        Transaction,
        related_name="entries",
        on_delete=models.CASCADE,
    )

    account = models.ForeignKey(
        Account,
        related_name="ledger_entries",
        on_delete=models.CASCADE,
    )

    direction = models.CharField(
        max_length=10,
        choices=DIRECTION_CHOICES,
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "ledger entries"

    def __str__(self):
        return f"{self.direction} {self.amount} -> {self.account}"
