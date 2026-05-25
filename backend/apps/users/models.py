from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    ROLE_CHOICES = [
        ("parent", "Parent"),
        ("child", "Child")
    ]

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES
    )

    pin = models.CharField(
        max_length=128,
        blank=True
    )

