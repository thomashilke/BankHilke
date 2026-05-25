from django.db import models
from apps.users.models import User

# Create your models here.
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

        return sum(
            t.signed_amount
            for t in self.transactions.all()
        )
