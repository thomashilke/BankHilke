from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.transactions.services import LedgerService
from apps.users.models import Guardianship, User


class AccountAPITests(APITestCase):
    def setUp(self):
        self.mom = User.objects.create_user(username="mom", password="pw12345678", role=User.PARENT)
        self.dad = User.objects.create_user(username="dad", password="pw12345678", role=User.PARENT)
        self.child = User.objects.create_user(username="kid", password="pw12345678", role=User.CHILD)
        Guardianship.objects.create(parent=self.mom, child=self.child)
        Guardianship.objects.create(parent=self.dad, child=self.child)

    def test_child_sees_only_own_account(self):
        self.client.force_authenticate(user=self.child)
        resp = self.client.get(reverse("accounts-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["owner"], self.child.id)

    def test_guardian_parent_sees_own_and_childs_account(self):
        self.client.force_authenticate(user=self.mom)
        resp = self.client.get(reverse("accounts-list"))
        owner_ids = {row["owner"] for row in resp.data}
        self.assertEqual(owner_ids, {self.mom.id, self.child.id})

    def test_unrelated_parent_cannot_see_childs_account(self):
        stranger = User.objects.create_user(username="stranger", password="pw12345678", role=User.PARENT)
        self.client.force_authenticate(user=stranger)
        resp = self.client.get(reverse("accounts-list"))
        owner_ids = {row["owner"] for row in resp.data}
        self.assertEqual(owner_ids, {stranger.id})

    def test_balance_and_history_reflect_transactions(self):
        LedgerService.allowance(
            child_account=self.child.account, parent_account=self.mom.account,
            amount=Decimal("10.00"), description="allowance", idempotency_key="a:1",
        )
        LedgerService.withdrawal(
            child_account=self.child.account, parent_account=self.dad.account,
            amount=Decimal("3.00"), description="toy", initiated_by=self.dad,
        )
        self.client.force_authenticate(user=self.child)
        detail = self.client.get(reverse("accounts-detail", args=[self.child.account.id]))
        self.assertEqual(Decimal(detail.data["balance"]), Decimal("7.00"))

        history = self.client.get(reverse("accounts-history", args=[self.child.account.id]))
        self.assertEqual(history.status_code, status.HTTP_200_OK)
        self.assertEqual(len(history.data), 2)

    def test_reconciliation_breaks_down_contributions_per_parent(self):
        LedgerService.allowance(
            child_account=self.child.account, parent_account=self.mom.account,
            amount=Decimal("10.00"), description="allowance", idempotency_key="a:1",
        )
        LedgerService.deposit(
            child_account=self.child.account, parent_account=self.dad.account,
            amount=Decimal("5.00"), description="gift", initiated_by=self.dad,
        )
        LedgerService.withdrawal(
            child_account=self.child.account, parent_account=self.dad.account,
            amount=Decimal("2.00"), description="toy", initiated_by=self.dad,
        )
        self.client.force_authenticate(user=self.mom)
        resp = self.client.get(reverse("accounts-reconciliation", args=[self.child.account.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        by_parent = {row["parent_username"]: row for row in resp.data}
        self.assertEqual(Decimal(by_parent["mom"]["total_given"]), Decimal("10.00"))
        self.assertEqual(Decimal(by_parent["dad"]["total_given"]), Decimal("5.00"))
        self.assertEqual(Decimal(by_parent["dad"]["total_taken"]), Decimal("2.00"))
        self.assertEqual(Decimal(by_parent["dad"]["net_contribution"]), Decimal("3.00"))

    def test_currency_defaults_to_usd_and_is_exposed_on_account(self):
        self.client.force_authenticate(user=self.child)
        resp = self.client.get(reverse("accounts-detail", args=[self.child.account.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["currency"], "USD")

    def test_child_can_change_own_account_currency(self):
        self.client.force_authenticate(user=self.child)
        resp = self.client.patch(reverse("accounts-currency", args=[self.child.account.id]), {"currency": "CHF"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["currency"], "CHF")
        self.child.account.refresh_from_db()
        self.assertEqual(self.child.account.currency, "CHF")

    def test_guardian_parent_can_change_childs_account_currency(self):
        self.client.force_authenticate(user=self.mom)
        resp = self.client.patch(reverse("accounts-currency", args=[self.child.account.id]), {"currency": "JPY"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.child.account.refresh_from_db()
        self.assertEqual(self.child.account.currency, "JPY")

    def test_unrelated_parent_cannot_change_childs_account_currency(self):
        stranger = User.objects.create_user(username="stranger2", password="pw12345678", role=User.PARENT)
        self.client.force_authenticate(user=stranger)
        resp = self.client.patch(reverse("accounts-currency", args=[self.child.account.id]), {"currency": "EUR"})
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
        self.child.account.refresh_from_db()
        self.assertEqual(self.child.account.currency, "USD")

    def test_invalid_currency_value_is_rejected(self):
        self.client.force_authenticate(user=self.child)
        resp = self.client.patch(reverse("accounts-currency", args=[self.child.account.id]), {"currency": "XXX"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.child.account.refresh_from_db()
        self.assertEqual(self.child.account.currency, "USD")
