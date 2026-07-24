"""Bootstrap the very first parent account on a fresh database.

Self-registration already lets anyone POST /api/users/ to create a parent,
but that requires the API (and a frontend or curl) to already be reachable.
This command is the out-of-band path: run once against a fresh database (or
re-run any time) to get -- or reset -- a working login.

Usage (inside the backend container/venv):

    python manage.py create_parent --username admin --password ... [--email ...]
        [--first-name ...] [--last-name ...] [--superuser] [--no-input]

Values fall back to INITIAL_PARENT_USERNAME / INITIAL_PARENT_PASSWORD /
INITIAL_PARENT_EMAIL / INITIAL_PARENT_FIRST_NAME / INITIAL_PARENT_LAST_NAME /
INITIAL_PARENT_SUPERUSER env vars, then to an interactive prompt for
username/password (unless --no-input is given, in which case missing values
are a hard error -- use this in scripts/CI).

Idempotent: re-running with the same --username updates that user (password,
email, name, superuser flag) instead of failing. Refuses to touch an existing
user that isn't a parent, so this can never silently repurpose a child
account.
"""
import os
from getpass import getpass

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.users.models import User


def _env_flag(name):
    return os.getenv(name, "").strip().lower() in ("1", "true", "yes", "on")


class Command(BaseCommand):
    help = "Create (or update) the first parent account so there's a way to log in."

    def add_arguments(self, parser):
        parser.add_argument("--username", default=os.getenv("INITIAL_PARENT_USERNAME"))
        parser.add_argument("--password", default=os.getenv("INITIAL_PARENT_PASSWORD"))
        parser.add_argument("--email", default=os.getenv("INITIAL_PARENT_EMAIL", ""))
        parser.add_argument("--first-name", default=os.getenv("INITIAL_PARENT_FIRST_NAME", ""))
        parser.add_argument("--last-name", default=os.getenv("INITIAL_PARENT_LAST_NAME", ""))
        parser.add_argument(
            "--superuser",
            action="store_true",
            default=_env_flag("INITIAL_PARENT_SUPERUSER"),
            help="Also grant Django admin (is_staff/is_superuser) access.",
        )
        parser.add_argument(
            "--no-input",
            action="store_true",
            help="Never prompt; error out instead if --username/--password are missing.",
        )

    def handle(self, *args, **options):
        username = (options["username"] or "").strip()
        if not username:
            if options["no_input"]:
                raise CommandError("--username (or INITIAL_PARENT_USERNAME) is required")
            username = input("Parent username: ").strip()
        if not username:
            raise CommandError("username must not be empty")

        password = options["password"]
        if not password:
            if options["no_input"]:
                raise CommandError("--password (or INITIAL_PARENT_PASSWORD) is required")
            password = getpass("Password: ")
            if password != getpass("Password (again): "):
                raise CommandError("passwords did not match")
        if len(password) < 8:
            # Matches UserSerializer's min_length, so this account can log in
            # via the same rules the API enforces on everyone else.
            raise CommandError("password must be at least 8 characters")

        with transaction.atomic():
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "role": User.PARENT,
                    "email": options["email"],
                    "first_name": options["first_name"],
                    "last_name": options["last_name"],
                },
            )
            if not created:
                if user.role != User.PARENT:
                    raise CommandError(
                        f"user {username!r} already exists with role={user.role!r}; "
                        "refusing to change its role -- pick a different --username."
                    )
                user.email = options["email"] or user.email
                user.first_name = options["first_name"] or user.first_name
                user.last_name = options["last_name"] or user.last_name
            user.set_password(password)
            if options["superuser"]:
                user.is_staff = True
                user.is_superuser = True
            user.save()

        verb = "Created" if created else "Updated"
        self.stdout.write(self.style.SUCCESS(f"{verb} parent {username!r} (id={user.id})."))
