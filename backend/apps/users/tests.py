from decimal import Decimal
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Account
from apps.allowances.models import AllowanceRule
from apps.transactions.models import Transaction
from apps.transactions.services import LedgerService

from .models import Guardianship, User


class RegistrationTests(APITestCase):
    def test_anyone_can_self_register_as_parent(self):
        url = reverse("users-list")
        resp = self.client.post(url, {
            "username": "alice", "email": "alice@example.com",
            "password": "correct-horse-1", "role": User.PARENT,
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        user = User.objects.get(username="alice")
        self.assertTrue(user.check_password("correct-horse-1"))
        self.assertTrue(Account.objects.filter(owner=user).exists())

    def test_registered_parent_can_log_in_and_get_jwt(self):
        self.client.post(reverse("users-list"), {
            "username": "bob", "password": "correct-horse-1", "role": User.PARENT,
        })
        resp = self.client.post(reverse("token_obtain_pair"), {
            "username": "bob", "password": "correct-horse-1",
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.assertIn("access", resp.data)

    def test_anonymous_cannot_create_child_account(self):
        resp = self.client.post(reverse("users-list"), {
            "username": "kid", "password": "correct-horse-1", "role": User.CHILD,
        })
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_authenticated_parent_creating_child_becomes_guardian(self):
        parent = User.objects.create_user(username="parent", password="pw12345678", role=User.PARENT)
        self.client.force_authenticate(user=parent)
        resp = self.client.post(reverse("users-list"), {
            "username": "kid", "password": "pw12345678", "role": User.CHILD,
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        child = User.objects.get(username="kid")
        self.assertTrue(Guardianship.objects.filter(parent=parent, child=child).exists())
        self.assertTrue(Account.objects.filter(owner=child).exists())

    def test_child_account_currency_defaults_to_usd(self):
        parent = User.objects.create_user(username="parent", password="pw12345678", role=User.PARENT)
        self.client.force_authenticate(user=parent)
        resp = self.client.post(reverse("users-list"), {
            "username": "kid", "password": "pw12345678", "role": User.CHILD,
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        child = User.objects.get(username="kid")
        self.assertEqual(child.account.currency, Account.Currency.USD)

    def test_parent_can_choose_currency_for_new_child_account(self):
        parent = User.objects.create_user(username="parent", password="pw12345678", role=User.PARENT)
        self.client.force_authenticate(user=parent)
        resp = self.client.post(reverse("users-list"), {
            "username": "kid", "password": "pw12345678", "role": User.CHILD, "currency": "CHF",
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        child = User.objects.get(username="kid")
        self.assertEqual(child.account.currency, Account.Currency.CHF)

    def test_invalid_currency_is_rejected(self):
        parent = User.objects.create_user(username="parent", password="pw12345678", role=User.PARENT)
        self.client.force_authenticate(user=parent)
        resp = self.client.post(reverse("users-list"), {
            "username": "kid", "password": "pw12345678", "role": User.CHILD, "currency": "XXX",
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_new_user_language_defaults_to_english(self):
        parent = User.objects.create_user(username="parent", password="pw12345678", role=User.PARENT)
        self.client.force_authenticate(user=parent)
        resp = self.client.post(reverse("users-list"), {
            "username": "kid", "password": "pw12345678", "role": User.CHILD,
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertEqual(resp.data["language"], User.Language.EN)

    def test_parent_can_choose_language_for_new_child_account(self):
        parent = User.objects.create_user(username="parent", password="pw12345678", role=User.PARENT)
        self.client.force_authenticate(user=parent)
        resp = self.client.post(reverse("users-list"), {
            "username": "kid", "password": "pw12345678", "role": User.CHILD, "language": "fr",
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertEqual(User.objects.get(username="kid").language, User.Language.FR)

    def test_invalid_language_is_rejected(self):
        parent = User.objects.create_user(username="parent", password="pw12345678", role=User.PARENT)
        self.client.force_authenticate(user=parent)
        resp = self.client.post(reverse("users-list"), {
            "username": "kid", "password": "pw12345678", "role": User.CHILD, "language": "xx",
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_can_update_their_own_language(self):
        child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        self.client.force_authenticate(user=child)
        resp = self.client.patch(reverse("users-detail", args=[child.id]), {"language": "de"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        child.refresh_from_db()
        self.assertEqual(child.language, User.Language.DE)

    def test_child_cannot_create_another_child_account(self):
        parent = User.objects.create_user(username="parent", password="pw12345678", role=User.PARENT)
        child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        Guardianship.objects.create(parent=parent, child=child)
        self.client.force_authenticate(user=child)
        resp = self.client.post(reverse("users-list"), {
            "username": "kid2", "password": "pw12345678", "role": User.CHILD,
        })
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class GuardianshipAPITests(APITestCase):
    def test_second_parent_can_link_as_guardian_for_reconciliation(self):
        mom = User.objects.create_user(username="mom", password="pw12345678", role=User.PARENT)
        dad = User.objects.create_user(username="dad", password="pw12345678", role=User.PARENT)
        child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        Guardianship.objects.create(parent=mom, child=child)

        self.client.force_authenticate(user=dad)
        resp = self.client.post(reverse("guardianships-list"), {"child": child.id})
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertTrue(Guardianship.objects.filter(parent=dad, child=child).exists())

    def test_child_cannot_create_guardianship(self):
        child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        self.client.force_authenticate(user=child)
        resp = self.client.post(reverse("guardianships-list"), {"child": child.id})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_existing_guardian_can_link_a_named_parent_as_co_guardian(self):
        mom = User.objects.create_user(username="mom", password="pw12345678", role=User.PARENT)
        dad = User.objects.create_user(username="dad", password="pw12345678", role=User.PARENT)
        child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        Guardianship.objects.create(parent=mom, child=child)

        self.client.force_authenticate(user=mom)
        resp = self.client.post(reverse("guardianships-list"), {"child": child.id, "username": "dad"})
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertTrue(Guardianship.objects.filter(parent=dad, child=child).exists())

    def test_non_guardian_cannot_link_someone_else_as_guardian(self):
        mom = User.objects.create_user(username="mom", password="pw12345678", role=User.PARENT)
        stranger = User.objects.create_user(username="stranger", password="pw12345678", role=User.PARENT)
        dad = User.objects.create_user(username="dad", password="pw12345678", role=User.PARENT)
        child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        Guardianship.objects.create(parent=mom, child=child)

        self.client.force_authenticate(user=stranger)
        resp = self.client.post(reverse("guardianships-list"), {"child": child.id, "username": "dad"})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Guardianship.objects.filter(parent=dad, child=child).exists())

    def test_link_guardian_rejects_unknown_username(self):
        mom = User.objects.create_user(username="mom", password="pw12345678", role=User.PARENT)
        child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        Guardianship.objects.create(parent=mom, child=child)

        self.client.force_authenticate(user=mom)
        resp = self.client.post(reverse("guardianships-list"), {"child": child.id, "username": "ghost"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_link_guardian_rejects_non_parent_username(self):
        mom = User.objects.create_user(username="mom", password="pw12345678", role=User.PARENT)
        child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        Guardianship.objects.create(parent=mom, child=child)

        self.client.force_authenticate(user=mom)
        resp = self.client.post(reverse("guardianships-list"), {"child": child.id, "username": "kid"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_link_guardian_rejects_duplicate(self):
        mom = User.objects.create_user(username="mom", password="pw12345678", role=User.PARENT)
        dad = User.objects.create_user(username="dad", password="pw12345678", role=User.PARENT)
        child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        Guardianship.objects.create(parent=mom, child=child)
        Guardianship.objects.create(parent=dad, child=child)

        self.client.force_authenticate(user=mom)
        resp = self.client.post(reverse("guardianships-list"), {"child": child.id, "username": "dad"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_guardian_can_list_co_guardians_via_child_filter(self):
        mom = User.objects.create_user(username="mom", password="pw12345678", role=User.PARENT)
        dad = User.objects.create_user(username="dad", password="pw12345678", role=User.PARENT)
        child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        Guardianship.objects.create(parent=mom, child=child)
        Guardianship.objects.create(parent=dad, child=child)

        self.client.force_authenticate(user=mom)
        resp = self.client.get(reverse("guardianships-list"), {"child": child.id})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        parents = {row["parent_username"] for row in resp.data}
        self.assertEqual(parents, {"mom", "dad"})

    def test_non_guardian_cannot_list_co_guardians_via_child_filter(self):
        mom = User.objects.create_user(username="mom", password="pw12345678", role=User.PARENT)
        stranger = User.objects.create_user(username="stranger", password="pw12345678", role=User.PARENT)
        child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        Guardianship.objects.create(parent=mom, child=child)

        self.client.force_authenticate(user=stranger)
        resp = self.client.get(reverse("guardianships-list"), {"child": child.id})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(list(resp.data), [])


class AdminParentCreationTests(APITestCase):
    def test_staff_parent_can_create_another_parent(self):
        admin = User.objects.create_user(
            username="admin", password="pw12345678", role=User.PARENT, is_staff=True,
        )
        self.client.force_authenticate(user=admin)
        resp = self.client.post(reverse("users-list"), {
            "username": "newparent", "password": "pw12345678", "role": User.PARENT,
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        new_parent = User.objects.get(username="newparent")
        self.assertEqual(new_parent.role, User.PARENT)
        self.assertTrue(Account.objects.filter(owner=new_parent).exists())
        # Administrative rights are never inferred client-side, and the API
        # never lets a request grant them to the account it creates.
        self.assertFalse(new_parent.is_staff)

    def test_non_staff_parent_cannot_create_another_parent(self):
        parent = User.objects.create_user(username="parent", password="pw12345678", role=User.PARENT)
        self.client.force_authenticate(user=parent)
        resp = self.client.post(reverse("users-list"), {
            "username": "newparent", "password": "pw12345678", "role": User.PARENT,
        })
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(User.objects.filter(username="newparent").exists())

    def test_authenticated_child_cannot_create_a_parent(self):
        child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        self.client.force_authenticate(user=child)
        resp = self.client.post(reverse("users-list"), {
            "username": "newparent", "password": "pw12345678", "role": User.PARENT,
        })
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_is_staff_cannot_be_set_via_the_api(self):
        admin = User.objects.create_user(
            username="admin", password="pw12345678", role=User.PARENT, is_staff=True,
        )
        self.client.force_authenticate(user=admin)
        resp = self.client.post(reverse("users-list"), {
            "username": "newparent", "password": "pw12345678", "role": User.PARENT, "is_staff": True,
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertFalse(User.objects.get(username="newparent").is_staff)


class ChangePasswordTests(APITestCase):
    """Self-service password change: both a parent and a child can change
    their own password given their current one; nobody can change another
    user's password through this endpoint."""

    def test_child_can_change_their_own_password(self):
        child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        self.client.force_authenticate(user=child)
        resp = self.client.post(reverse("users-change-password"), {
            "current_password": "pw12345678", "new_password": "new-password-2",
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        child.refresh_from_db()
        self.assertTrue(child.check_password("new-password-2"))

    def test_parent_can_change_their_own_password(self):
        parent = User.objects.create_user(username="parent", password="pw12345678", role=User.PARENT)
        self.client.force_authenticate(user=parent)
        resp = self.client.post(reverse("users-change-password"), {
            "current_password": "pw12345678", "new_password": "new-password-2",
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        parent.refresh_from_db()
        self.assertTrue(parent.check_password("new-password-2"))

    def test_wrong_current_password_is_rejected(self):
        parent = User.objects.create_user(username="parent", password="pw12345678", role=User.PARENT)
        self.client.force_authenticate(user=parent)
        resp = self.client.post(reverse("users-change-password"), {
            "current_password": "wrong-password", "new_password": "new-password-2",
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        parent.refresh_from_db()
        self.assertTrue(parent.check_password("pw12345678"))

    def test_new_password_too_short_is_rejected(self):
        parent = User.objects.create_user(username="parent", password="pw12345678", role=User.PARENT)
        self.client.force_authenticate(user=parent)
        resp = self.client.post(reverse("users-change-password"), {
            "current_password": "pw12345678", "new_password": "short",
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        parent.refresh_from_db()
        self.assertTrue(parent.check_password("pw12345678"))

    def test_anonymous_cannot_change_a_password(self):
        User.objects.create_user(username="parent", password="pw12345678", role=User.PARENT)
        resp = self.client.post(reverse("users-change-password"), {
            "current_password": "pw12345678", "new_password": "new-password-2",
        })
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_password_account_exposes_has_usable_password_true(self):
        parent = User.objects.create_user(username="parent", password="pw12345678", role=User.PARENT)
        self.client.force_authenticate(user=parent)
        resp = self.client.get(reverse("users-detail", args=[parent.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["has_usable_password"])

    @patch("apps.users.services.google_id_token.verify_oauth2_token")
    def test_google_only_account_exposes_has_usable_password_false(self, verify):
        verify.return_value = {
            "sub": "google-sub-1", "email": "newparent@example.com", "email_verified": True,
            "given_name": "Nina",
        }
        self.client.post(reverse("google_login"), {"credential": "whatever"})
        google_parent = User.objects.get(google_sub="google-sub-1")
        self.client.force_authenticate(user=google_parent)
        resp = self.client.get(reverse("users-detail", args=[google_parent.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data["has_usable_password"])

    @patch("apps.users.services.google_id_token.verify_oauth2_token")
    def test_google_only_account_cannot_change_password(self, verify):
        verify.return_value = {
            "sub": "google-sub-1", "email": "newparent@example.com", "email_verified": True,
            "given_name": "Nina",
        }
        self.client.post(reverse("google_login"), {"credential": "whatever"})
        google_parent = User.objects.get(google_sub="google-sub-1")
        self.client.force_authenticate(user=google_parent)
        resp = self.client.post(reverse("users-change-password"), {
            "current_password": "", "new_password": "new-password-2",
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_changed_password_can_be_used_to_log_in(self):
        User.objects.create_user(username="parent", password="pw12345678", role=User.PARENT)
        parent = User.objects.get(username="parent")
        self.client.force_authenticate(user=parent)
        self.client.post(reverse("users-change-password"), {
            "current_password": "pw12345678", "new_password": "new-password-2",
        })
        self.client.force_authenticate(user=None)
        resp = self.client.post(reverse("token_obtain_pair"), {
            "username": "parent", "password": "new-password-2",
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)


class AdminAllUsersEndpointTests(APITestCase):
    """`GET /users/all/` is a dedicated administrative endpoint: only a
    parent with `is_staff` can reach it, and it returns every account on the
    platform. The regular `GET /users/` list stays scoped to self (+ guarded
    children for a parent) regardless of `is_staff`, so a staff parent's own
    dashboard never mixes in unrelated accounts."""

    def test_staff_parent_sees_every_user_via_admin_endpoint(self):
        admin = User.objects.create_user(
            username="admin", password="pw12345678", role=User.PARENT, is_staff=True,
        )
        other_parent = User.objects.create_user(username="parent2", password="pw12345678", role=User.PARENT)
        unrelated_child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        self.client.force_authenticate(user=admin)
        resp = self.client.get(reverse("users-all"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        usernames = {row["username"] for row in resp.data}
        self.assertEqual(usernames, {"admin", "parent2", "kid"})
        self.assertIn(other_parent.username, usernames)
        self.assertIn(unrelated_child.username, usernames)

    def test_non_staff_parent_cannot_reach_admin_endpoint(self):
        parent = User.objects.create_user(username="parent", password="pw12345678", role=User.PARENT)
        self.client.force_authenticate(user=parent)
        resp = self.client.get(reverse("users-all"))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_child_cannot_reach_admin_endpoint(self):
        child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        self.client.force_authenticate(user=child)
        resp = self.client.get(reverse("users-all"))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_cannot_reach_admin_endpoint(self):
        resp = self.client.get(reverse("users-all"))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_staff_parents_own_dashboard_list_stays_guardian_scoped(self):
        """Regression guard: administrative rights must not leak into the
        regular list endpoint, or a staff parent's own dashboard would show
        every child in the system instead of just the ones they guard."""
        admin = User.objects.create_user(
            username="admin", password="pw12345678", role=User.PARENT, is_staff=True,
        )
        guarded_child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        Guardianship.objects.create(parent=admin, child=guarded_child)
        User.objects.create_user(username="unrelated_kid", password="pw12345678", role=User.CHILD)
        User.objects.create_user(username="unrelated_parent", password="pw12345678", role=User.PARENT)
        self.client.force_authenticate(user=admin)
        resp = self.client.get(reverse("users-list"))
        usernames = {row["username"] for row in resp.data}
        self.assertEqual(usernames, {"admin", "kid"})

    def test_non_staff_parent_only_sees_self_and_guarded_children(self):
        parent = User.objects.create_user(username="parent", password="pw12345678", role=User.PARENT)
        User.objects.create_user(username="other_parent", password="pw12345678", role=User.PARENT)
        child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        Guardianship.objects.create(parent=parent, child=child)
        self.client.force_authenticate(user=parent)
        resp = self.client.get(reverse("users-list"))
        usernames = {row["username"] for row in resp.data}
        self.assertEqual(usernames, {"parent", "kid"})

    def test_child_only_sees_self(self):
        child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        User.objects.create_user(username="parent", password="pw12345678", role=User.PARENT)
        self.client.force_authenticate(user=child)
        resp = self.client.get(reverse("users-list"))
        usernames = {row["username"] for row in resp.data}
        self.assertEqual(usernames, {"kid"})


class CreateParentCommandTests(TestCase):
    def test_creates_parent_with_usable_password(self):
        call_command("create_parent", "--username", "root", "--password", "correct-horse-1", "--no-input")
        user = User.objects.get(username="root")
        self.assertEqual(user.role, User.PARENT)
        self.assertTrue(user.check_password("correct-horse-1"))
        self.assertFalse(user.is_staff)
        self.assertTrue(Account.objects.filter(owner=user).exists())

    def test_superuser_flag_grants_admin_access(self):
        call_command(
            "create_parent", "--username", "root", "--password", "correct-horse-1",
            "--superuser", "--no-input",
        )
        user = User.objects.get(username="root")
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)

    def test_rerun_is_idempotent_and_updates_password(self):
        call_command("create_parent", "--username", "root", "--password", "correct-horse-1", "--no-input")
        call_command("create_parent", "--username", "root", "--password", "new-password-2", "--no-input")
        self.assertEqual(User.objects.filter(username="root").count(), 1)
        user = User.objects.get(username="root")
        self.assertTrue(user.check_password("new-password-2"))

    def test_refuses_to_change_role_of_existing_non_parent(self):
        User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        with self.assertRaises(CommandError):
            call_command("create_parent", "--username", "kid", "--password", "correct-horse-1", "--no-input")

    def test_no_input_requires_username_and_password(self):
        with self.assertRaises(CommandError):
            call_command("create_parent", "--no-input")
        with self.assertRaises(CommandError):
            call_command("create_parent", "--username", "root", "--no-input")

    def test_rejects_short_password(self):
        with self.assertRaises(CommandError):
            call_command("create_parent", "--username", "root", "--password", "short", "--no-input")


@override_settings(GOOGLE_OAUTH_CLIENT_ID="test-client-id.apps.googleusercontent.com")
class GoogleLoginTests(APITestCase):
    """GoogleLoginView: the front-page "Sign in with Google" entrypoint.
    Real credential *verification* (google.oauth2.id_token.verify_oauth2_token)
    is mocked -- it's Google's own signature/audience check, not our logic
    -- so these tests cover what GoogleAuthService does with the verified
    claims."""

    def _claims(self, **overrides):
        return {
            "sub": "google-sub-1",
            "email": "newparent@example.com",
            "email_verified": True,
            "given_name": "Nina",
            "family_name": "Newparent",
            **overrides,
        }

    def test_client_id_empty_when_not_configured(self):
        with override_settings(GOOGLE_OAUTH_CLIENT_ID=""):
            resp = self.client.get(reverse("google_login"))
        self.assertEqual(resp.data["client_id"], "")

    def test_client_id_returned_when_configured(self):
        resp = self.client.get(reverse("google_login"))
        self.assertEqual(resp.data["client_id"], "test-client-id.apps.googleusercontent.com")

    def test_post_without_credential_is_rejected(self):
        resp = self.client.post(reverse("google_login"), {})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_post_unconfigured_is_rejected(self):
        with override_settings(GOOGLE_OAUTH_CLIENT_ID=""):
            resp = self.client.post(reverse("google_login"), {"credential": "whatever"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("apps.users.services.google_id_token.verify_oauth2_token")
    def test_invalid_credential_is_rejected(self, verify):
        verify.side_effect = ValueError("bad signature")
        resp = self.client.post(reverse("google_login"), {"credential": "bogus"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("apps.users.services.google_id_token.verify_oauth2_token")
    def test_new_google_identity_creates_parent_account(self, verify):
        verify.return_value = self._claims()
        resp = self.client.post(reverse("google_login"), {"credential": "tok"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)

        user = User.objects.get(google_sub="google-sub-1")
        self.assertEqual(user.role, User.PARENT)
        self.assertEqual(user.email, "newparent@example.com")
        self.assertEqual(user.first_name, "Nina")
        self.assertEqual(user.last_name, "Newparent")
        self.assertFalse(user.has_usable_password())
        self.assertTrue(Account.objects.filter(owner=user).exists())

    @patch("apps.users.services.google_id_token.verify_oauth2_token")
    def test_new_parent_can_then_add_a_child(self, verify):
        """Confirms Google sign-up produces an ordinary parent account: the
        existing child-creation flow works immediately, no special-casing
        needed downstream of GoogleAuthService."""
        verify.return_value = self._claims()
        resp = self.client.post(reverse("google_login"), {"credential": "tok"})
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
        child_resp = self.client.post(reverse("users-list"), {
            "username": "kid", "password": "pw12345678", "role": User.CHILD,
        })
        self.assertEqual(child_resp.status_code, status.HTTP_201_CREATED, child_resp.data)
        parent = User.objects.get(google_sub="google-sub-1")
        self.assertTrue(Guardianship.objects.filter(parent=parent, child__username="kid").exists())

    @patch("apps.users.services.google_id_token.verify_oauth2_token")
    def test_repeat_sign_in_reuses_the_same_account(self, verify):
        verify.return_value = self._claims()
        first = self.client.post(reverse("google_login"), {"credential": "tok1"})
        second = self.client.post(reverse("google_login"), {"credential": "tok2"})
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(User.objects.filter(google_sub="google-sub-1").count(), 1)

    @patch("apps.users.services.google_id_token.verify_oauth2_token")
    def test_verified_email_links_existing_password_account_instead_of_duplicating(self, verify):
        existing = User.objects.create_user(
            username="already", password="pw12345678", role=User.PARENT, email="newparent@example.com",
        )
        verify.return_value = self._claims()
        resp = self.client.post(reverse("google_login"), {"credential": "tok"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        existing.refresh_from_db()
        self.assertEqual(existing.google_sub, "google-sub-1")
        self.assertEqual(User.objects.filter(email__iexact="newparent@example.com").count(), 1)
        # The linked account keeps its original password -- Google sign-in
        # augments it, it doesn't disable the existing login method.
        self.assertTrue(existing.check_password("pw12345678"))

    @patch("apps.users.services.google_id_token.verify_oauth2_token")
    def test_unverified_email_does_not_link_to_an_existing_account(self, verify):
        User.objects.create_user(
            username="already", password="pw12345678", role=User.PARENT, email="newparent@example.com",
        )
        verify.return_value = self._claims(email_verified=False)
        resp = self.client.post(reverse("google_login"), {"credential": "tok"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        new_user = User.objects.get(google_sub="google-sub-1")
        self.assertNotEqual(new_user.id, User.objects.get(username="already").id)

    @patch("apps.users.services.google_id_token.verify_oauth2_token")
    def test_username_collision_gets_a_unique_suffix(self, verify):
        User.objects.create_user(username="newparent", password="pw12345678", role=User.PARENT)
        verify.return_value = self._claims()
        resp = self.client.post(reverse("google_login"), {"credential": "tok"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        new_user = User.objects.get(google_sub="google-sub-1")
        self.assertNotEqual(new_user.username, "newparent")
        self.assertTrue(new_user.username.startswith("newparent"))


class AccountDeletionTests(APITestCase):
    """`DELETE /users/{id}/` -- the only destructive operation this API
    exposes (see AccountDeletionService / CanDeleteAccount). A parent may
    delete their own account (cascading onto any child left with no
    remaining guardian), or a child account they created; a child can
    never delete any account, and a non-creating guardian can only unlink
    themselves via GuardianshipViewSet."""

    def test_child_cannot_delete_own_account(self):
        child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        self.client.force_authenticate(user=child)
        resp = self.client.delete(reverse("users-detail", args=[child.id]))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(User.objects.filter(id=child.id).exists())

    def test_child_cannot_delete_another_childs_account(self):
        child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        other = User.objects.create_user(username="other-kid", password="pw12345678", role=User.CHILD)
        self.client.force_authenticate(user=child)
        resp = self.client.delete(reverse("users-detail", args=[other.id]))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(User.objects.filter(id=other.id).exists())

    def test_parent_can_delete_own_account(self):
        parent = User.objects.create_user(username="parent", password="pw12345678", role=User.PARENT)
        self.client.force_authenticate(user=parent)
        resp = self.client.delete(reverse("users-detail", args=[parent.id]))
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(id=parent.id).exists())

    def test_deleting_sole_guardian_deletes_the_child_too(self):
        parent = User.objects.create_user(username="parent", password="pw12345678", role=User.PARENT)
        child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        Guardianship.objects.create(parent=parent, child=child, is_creator=True)
        AllowanceRule.objects.create(
            child=child, funding_parent=parent, amount=Decimal("5.00"), weekday=0, hour=9,
        )
        LedgerService.allowance(
            child_account=child.account, parent_account=parent.account,
            amount=Decimal("10.00"), description="allowance", idempotency_key="a:1",
        )

        self.client.force_authenticate(user=parent)
        resp = self.client.delete(reverse("users-detail", args=[parent.id]))
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)

        self.assertFalse(User.objects.filter(id=parent.id).exists())
        self.assertFalse(User.objects.filter(id=child.id).exists())
        self.assertFalse(Account.objects.filter(owner_id=child.id).exists())
        self.assertFalse(Guardianship.objects.filter(child_id=child.id).exists())
        self.assertFalse(AllowanceRule.objects.filter(child_id=child.id).exists())
        self.assertFalse(Transaction.objects.filter(idempotency_key="a:1").exists())

    def test_deleting_one_of_two_guardians_keeps_the_child(self):
        mom = User.objects.create_user(username="mom", password="pw12345678", role=User.PARENT)
        dad = User.objects.create_user(username="dad", password="pw12345678", role=User.PARENT)
        child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        Guardianship.objects.create(parent=mom, child=child, is_creator=True)
        Guardianship.objects.create(parent=dad, child=child)
        LedgerService.allowance(
            child_account=child.account, parent_account=dad.account,
            amount=Decimal("10.00"), description="allowance", idempotency_key="a:1",
        )

        self.client.force_authenticate(user=mom)
        resp = self.client.delete(reverse("users-detail", args=[mom.id]))
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)

        self.assertFalse(User.objects.filter(id=mom.id).exists())
        self.assertTrue(User.objects.filter(id=child.id).exists())
        self.assertEqual(list(Guardianship.objects.filter(child_id=child.id).values_list("parent_id", flat=True)), [dad.id])
        # dad's contribution is untouched -- only mom's link/account vanished.
        self.assertTrue(Transaction.objects.filter(idempotency_key="a:1").exists())
        child.account.refresh_from_db()
        self.assertEqual(child.account.balance, Decimal("10.00"))

    def test_parent_cannot_delete_another_unrelated_users_account(self):
        """An unrelated parent isn't just denied -- their account is
        entirely outside this parent's get_queryset scope, same as any
        other unrelated-user lookup on this endpoint."""
        parent = User.objects.create_user(username="parent", password="pw12345678", role=User.PARENT)
        other = User.objects.create_user(username="other", password="pw12345678", role=User.PARENT)
        self.client.force_authenticate(user=parent)
        resp = self.client.delete(reverse("users-detail", args=[other.id]))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(User.objects.filter(id=other.id).exists())

    def test_creator_parent_can_delete_childs_account_directly(self):
        parent = User.objects.create_user(username="parent", password="pw12345678", role=User.PARENT)
        child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        Guardianship.objects.create(parent=parent, child=child, is_creator=True)
        AllowanceRule.objects.create(
            child=child, funding_parent=parent, amount=Decimal("5.00"), weekday=0, hour=9,
        )
        LedgerService.allowance(
            child_account=child.account, parent_account=parent.account,
            amount=Decimal("10.00"), description="allowance", idempotency_key="a:1",
        )

        self.client.force_authenticate(user=parent)
        resp = self.client.delete(reverse("users-detail", args=[child.id]))
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)

        self.assertTrue(User.objects.filter(id=parent.id).exists())
        self.assertFalse(User.objects.filter(id=child.id).exists())
        self.assertFalse(Account.objects.filter(owner_id=child.id).exists())
        self.assertFalse(AllowanceRule.objects.filter(child_id=child.id).exists())
        self.assertFalse(Transaction.objects.filter(idempotency_key="a:1").exists())

    def test_non_creator_guardian_cannot_delete_childs_account_directly(self):
        """Only the parent who created the child's account can delete it
        outright -- a co-guardian who merely linked themselves later can
        only remove their own guardianship link, never delete the child
        (see test_non_creator_guardian_can_remove_own_guardianship below)."""
        creator = User.objects.create_user(username="creator", password="pw12345678", role=User.PARENT)
        co_guardian = User.objects.create_user(username="co-guardian", password="pw12345678", role=User.PARENT)
        child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        Guardianship.objects.create(parent=creator, child=child, is_creator=True)
        Guardianship.objects.create(parent=co_guardian, child=child)
        self.client.force_authenticate(user=co_guardian)
        resp = self.client.delete(reverse("users-detail", args=[child.id]))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(User.objects.filter(id=child.id).exists())

    def test_non_creator_guardian_can_remove_own_guardianship(self):
        creator = User.objects.create_user(username="creator", password="pw12345678", role=User.PARENT)
        co_guardian = User.objects.create_user(username="co-guardian", password="pw12345678", role=User.PARENT)
        child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        Guardianship.objects.create(parent=creator, child=child, is_creator=True)
        link = Guardianship.objects.create(parent=co_guardian, child=child)
        self.client.force_authenticate(user=co_guardian)
        resp = self.client.delete(reverse("guardianships-detail", args=[link.id]))
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Guardianship.objects.filter(id=link.id).exists())
        # The child and the creator's own link are untouched.
        self.assertTrue(User.objects.filter(id=child.id).exists())
        self.assertTrue(Guardianship.objects.filter(parent=creator, child=child).exists())

    def test_anonymous_cannot_delete_an_account(self):
        parent = User.objects.create_user(username="parent", password="pw12345678", role=User.PARENT)
        resp = self.client.delete(reverse("users-detail", args=[parent.id]))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(User.objects.filter(id=parent.id).exists())
