import re

from django.conf import settings
from django.db import IntegrityError
from django.db import transaction as db_transaction
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from .models import Guardianship, User


class InvalidGoogleTokenError(Exception):
    """Raised when a Google credential fails verification, or Google
    sign-in isn't configured on this server."""


class GoogleAuthService:
    """Resolves a Google Identity Services credential (an ID token) to a
    User, creating a new parent account the first time a given Google
    identity is seen -- this is what lets "sign in with Google" double as
    the front-page account-creation flow: there's no separate signup step.

    Accounts are keyed by the token's `sub` claim (Google's stable,
    non-reassignable subject id) rather than email, since a Google account's
    email can change. A first-time `sub` whose Google-verified email
    matches an existing (non-Google) account links that account instead of
    creating a duplicate.
    """

    @staticmethod
    def authenticate(credential):
        """Verifies `credential` and returns the User it resolves to,
        creating one if this is the first time this Google identity has
        signed in. Raises InvalidGoogleTokenError if the credential doesn't
        verify or Google sign-in isn't configured."""
        if not settings.GOOGLE_OAUTH_CLIENT_ID:
            raise InvalidGoogleTokenError("Google sign-in is not configured on this server.")

        try:
            claims = google_id_token.verify_oauth2_token(
                credential, google_requests.Request(), settings.GOOGLE_OAUTH_CLIENT_ID,
            )
        except ValueError as exc:
            raise InvalidGoogleTokenError("Could not verify Google credential.") from exc

        sub = claims["sub"]

        try:
            return User.objects.get(google_sub=sub)
        except User.DoesNotExist:
            pass

        email = claims.get("email", "")
        if email and claims.get("email_verified"):
            existing = User.objects.filter(email__iexact=email, google_sub__isnull=True).first()
            if existing is not None:
                existing.google_sub = sub
                existing.save(update_fields=["google_sub"])
                return existing

        return GoogleAuthService._create_parent(sub=sub, email=email, claims=claims)

    @staticmethod
    def _create_parent(*, sub, email, claims):
        user = User(
            username=GoogleAuthService._unique_username(email or sub),
            email=email,
            first_name=claims.get("given_name", "")[:150],
            last_name=claims.get("family_name", "")[:150],
            role=User.PARENT,
            google_sub=sub,
        )
        # Google-only accounts never set a password; set_unusable_password
        # ensures check_password always fails rather than leaving the
        # column blank (which Django would otherwise treat as "no password
        # set" ambiguously across auth backends).
        user.set_unusable_password()
        try:
            with db_transaction.atomic():
                user.save()
        except IntegrityError:
            # Lost a race against a concurrent sign-in for the same Google
            # identity (unique `google_sub`) -- the winner's row is what we
            # want anyway.
            return User.objects.get(google_sub=sub)
        return user

    @staticmethod
    def _unique_username(seed):
        base = re.sub(r"[^\w.@+-]", "", seed.split("@")[0])[:140] or "user"
        username = base
        suffix = 1
        while User.objects.filter(username=username).exists():
            username = f"{base}{suffix}"[:150]
            suffix += 1
        return username


class AccountDeletionService:
    """Deletes a user account -- the only destructive operation this API
    exposes (see UserViewSet.perform_destroy / CanDeleteAccount). Called
    either for self-service (a parent deleting their own account -- never a
    child, who can't delete any account) or for a parent deleting a child
    account they created, straight from the Settings page danger zone. A
    guardian who didn't create the child can only unlink themselves (see
    GuardianshipViewSet), never call this on the child directly.

    Deleting a User cascades (via each model's `on_delete=models.CASCADE`)
    onto everything that belongs to *that* account: its Account, ledger
    history on either side of any transaction it participated in, and its
    own allowance/interest rules and guardianship links. What the ORM's
    cascade can't express is the business rule that a child with no
    guardian left is nobody's responsibility: when the deleted user is a
    parent, any child whose *only* guardian was this parent is deleted
    too, in the same atomic transaction.
    """

    @staticmethod
    def delete_user(user):
        with db_transaction.atomic():
            orphaned_child_ids = []
            if user.role == User.PARENT:
                guarded_child_ids = Guardianship.objects.filter(parent=user).values_list("child_id", flat=True)
                orphaned_child_ids = [
                    child_id
                    for child_id in guarded_child_ids
                    if not Guardianship.objects.filter(child_id=child_id).exclude(parent=user).exists()
                ]
            user.delete()
            if orphaned_child_ids:
                User.objects.filter(id__in=orphaned_child_ids).delete()
