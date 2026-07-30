from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    PARENT = "parent"
    CHILD = "child"
    ROLE_CHOICES = [
        (PARENT, "Parent"),
        (CHILD, "Child"),
    ]

    class Language(models.TextChoices):
        EN = "en", "English"
        FR = "fr", "Français"
        DE = "de", "Deutsch"

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES
    )

    language = models.CharField(
        max_length=2,
        choices=Language.choices,
        default=Language.EN,
        help_text="Preferred UI language -- purely a display preference for the frontend.",
    )

    pin = models.CharField(
        max_length=128,
        blank=True
    )

    google_sub = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True,
        help_text="Google 'sub' claim -- set once this account signs in via "
                   "Sign in with Google, and used to look it back up on "
                   "every subsequent Google sign-in (see "
                   "apps.users.services.GoogleAuthService).",
    )


class Guardianship(models.Model):
    """Links a parent to a child they are financially responsible for.

    A child may have more than one guardian (e.g. divorced parents), which is
    what lets each parent's ledger be reconciled against the others for a
    shared child.
    """

    parent = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="guardianships_as_parent",
        limit_choices_to={"role": User.PARENT},
    )

    child = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="guardianships_as_child",
        limit_choices_to={"role": User.CHILD},
    )

    is_creator = models.BooleanField(
        default=False,
        help_text="Whether this guardian is the parent who registered the "
                   "child's account (set once, at creation -- see "
                   "UserViewSet.perform_create). Only the creator may delete "
                   "the child's account outright; every other guardian can "
                   "only remove themselves from the guardianship (see "
                   "apps.users.views.CanDeleteAccount).",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("parent", "child")

    def __str__(self):
        return f"{self.parent} guardian of {self.child}"
