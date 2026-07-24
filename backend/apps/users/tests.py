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
