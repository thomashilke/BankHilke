from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Account

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
