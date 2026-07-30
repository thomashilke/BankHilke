import re

from django.conf import settings
from django.db import IntegrityError
from django.db import transaction as db_transaction
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from .models import User


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
