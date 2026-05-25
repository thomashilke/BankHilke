from django.db import models
from apps.accounts.models import Account


class Transaction(models.Model):

    account = models.ForeignKey(
        Account,
        related_name="transactions",
        on_delete=models.CASCADE
    )

    description = models.CharField(
        max_length=200
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    TYPE_CHOICES = [
        ("credit", "Credit"),
        ("debit", "Debit"),
    ]

    transaction_type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES
    )

    @property
    def signed_amount(self):
        if self.transaction_type == "debit":
            return -self.amount
        
        return self.amount
    
    
    
    


# Create your models here.
