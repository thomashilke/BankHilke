from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.users.models import User

from .models import Account


@receiver(post_save, sender=User)
def create_account_for_new_user(sender, instance, created, **kwargs):
    """Every user (parent or child) gets exactly one Account the moment
    they're created -- this is how "creating a new parent/child account"
    works via the API: register the User, the Account follows automatically.
    """
    if created:
        Account.objects.get_or_create(owner=instance)
