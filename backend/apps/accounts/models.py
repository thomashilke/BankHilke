from decimal import Decimal

from django.db import models
from django.db.models import Q, Sum

from apps.users.models import User


class Account(models.Model):

    owner = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="account",
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    @property
    def balance(self):
        """Sum of credit ledger entries minus debit ledger entries.

        Computed on read (never stored) so it can never drift from the
        transaction/ledger-entry history -- the source of truth.
        """
        agg = self.ledger_entries.aggregate(
            credits=Sum("amount", filter=Q(direction="credit")),
            debits=Sum("amount", filter=Q(direction="debit")),
        )
        return (agg["credits"] or Decimal("0.00")) - (agg["debits"] or Decimal("0.00"))

    def __str__(self):
        return f"{self.owner.username} ({self.owner.role})"
