from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import Guardianship, User

from .models import LedgerEntry, Transaction
from .services import InsufficientFundsError, LedgerService


class LedgerServiceTests(TestCase):
    def setUp(self):
        self.parent = User.objects.create_user(
            username="parent1", password="hunter22", role=User.PARENT
        )
        self.child = User.objects.create_user(
            username="child1", password="hunter22", role=User.CHILD
        )
        Guardianship.objects.create(parent=self.parent, child=self.child)
        # Account rows are auto-created by the post_save signal.
        self.parent_account = self.parent.account
        self.child_account = self.child.account

    def test_allowance_posts_offsetting_entries(self):
        txn = LedgerService.allowance(
            child_account=self.child_account,
            parent_account=self.parent_account,
            amount=Decimal("10.00"),
            description="test allowance",
            idempotency_key="allowance:1:2026-01-01",
        )
        self.assertEqual(txn.entries.count(), 2)
        debit = txn.entries.get(direction=LedgerEntry.DEBIT)
        credit = txn.entries.get(direction=LedgerEntry.CREDIT)
        self.assertEqual(debit.account_id, self.parent_account.id)
        self.assertEqual(credit.account_id, self.child_account.id)
        self.assertEqual(debit.amount, credit.amount)

        self.child_account.refresh_from_db()
        self.assertEqual(self.child_account.balance, Decimal("10.00"))
        self.assertEqual(self.parent_account.balance, Decimal("-10.00"))

    def test_child_balance_is_allowances_plus_interest_minus_withdrawals(self):
        LedgerService.allowance(
            child_account=self.child_account, parent_account=self.parent_account,
            amount=Decimal("10.00"), description="allowance",
            idempotency_key="allowance:1:1",
        )
        LedgerService.interest(
            child_account=self.child_account, parent_account=self.parent_account,
            amount=Decimal("1.00"), description="interest",
            idempotency_key="interest:1:1",
        )
        LedgerService.withdrawal(
            child_account=self.child_account, parent_account=self.parent_account,
            amount=Decimal("4.00"), description="candy", initiated_by=self.parent,
        )
        self.assertEqual(self.child_account.balance, Decimal("7.00"))

    def test_withdrawal_debits_child_credits_advancing_parent(self):
        LedgerService.deposit(
            child_account=self.child_account, parent_account=self.parent_account,
            amount=Decimal("20.00"), description="seed", initiated_by=self.parent,
        )
        txn = LedgerService.withdrawal(
            child_account=self.child_account, parent_account=self.parent_account,
            amount=Decimal("5.00"), description="toy", initiated_by=self.parent,
        )
        debit = txn.entries.get(direction=LedgerEntry.DEBIT)
        credit = txn.entries.get(direction=LedgerEntry.CREDIT)
        self.assertEqual(debit.account_id, self.child_account.id)
        self.assertEqual(credit.account_id, self.parent_account.id)
        self.assertEqual(self.child_account.balance, Decimal("15.00"))

    def test_withdrawal_rejected_when_insufficient_funds(self):
        with self.assertRaises(InsufficientFundsError):
            LedgerService.withdrawal(
                child_account=self.child_account, parent_account=self.parent_account,
                amount=Decimal("1.00"), description="overdraft", initiated_by=self.parent,
            )
        self.assertEqual(Transaction.objects.count(), 0)

    def test_reprocessing_same_idempotency_key_has_no_additional_effect(self):
        key = "allowance:1:2026-01-01"
        first = LedgerService.allowance(
            child_account=self.child_account, parent_account=self.parent_account,
            amount=Decimal("10.00"), description="allowance", idempotency_key=key,
        )
        second = LedgerService.allowance(
            child_account=self.child_account, parent_account=self.parent_account,
            amount=Decimal("10.00"), description="allowance", idempotency_key=key,
        )
        self.assertEqual(first.id, second.id)
        self.assertEqual(Transaction.objects.filter(idempotency_key=key).count(), 1)
        self.assertEqual(self.child_account.balance, Decimal("10.00"))

    def test_reverse_deposit_nets_child_balance_back_to_zero(self):
        txn = LedgerService.deposit(
            child_account=self.child_account, parent_account=self.parent_account,
            amount=Decimal("10.00"), description="oops", initiated_by=self.parent,
        )
        reversal = LedgerService.reverse(transaction=txn, initiated_by=self.parent)
        self.assertEqual(reversal.reverses_id, txn.id)
        self.assertEqual(reversal.amount, Decimal("10.00"))
        self.assertEqual(self.child_account.balance, Decimal("0.00"))
        self.assertEqual(self.parent_account.balance, Decimal("0.00"))

    def test_reverse_withdrawal_nets_balances_back_to_zero(self):
        LedgerService.deposit(
            child_account=self.child_account, parent_account=self.parent_account,
            amount=Decimal("20.00"), description="seed", initiated_by=self.parent,
        )
        withdrawal = LedgerService.withdrawal(
            child_account=self.child_account, parent_account=self.parent_account,
            amount=Decimal("6.00"), description="snacks", initiated_by=self.parent,
        )
        LedgerService.reverse(transaction=withdrawal, initiated_by=self.parent)
        self.assertEqual(self.child_account.balance, Decimal("20.00"))
        self.assertEqual(self.parent_account.balance, Decimal("-20.00"))

    def test_reverse_is_idempotent(self):
        txn = LedgerService.deposit(
            child_account=self.child_account, parent_account=self.parent_account,
            amount=Decimal("10.00"), description="oops", initiated_by=self.parent,
        )
        first = LedgerService.reverse(transaction=txn, initiated_by=self.parent)
        second = LedgerService.reverse(transaction=txn, initiated_by=self.parent)
        self.assertEqual(first.id, second.id)
        self.assertEqual(Transaction.objects.filter(reverses=txn).count(), 1)

    def test_cannot_reverse_a_reversal(self):
        txn = LedgerService.deposit(
            child_account=self.child_account, parent_account=self.parent_account,
            amount=Decimal("10.00"), description="oops", initiated_by=self.parent,
        )
        reversal = LedgerService.reverse(transaction=txn, initiated_by=self.parent)
        with self.assertRaises(ValueError):
            LedgerService.reverse(transaction=reversal, initiated_by=self.parent)

    def test_reverse_rejected_when_it_would_take_child_negative(self):
        deposit = LedgerService.deposit(
            child_account=self.child_account, parent_account=self.parent_account,
            amount=Decimal("10.00"), description="seed", initiated_by=self.parent,
        )
        LedgerService.withdrawal(
            child_account=self.child_account, parent_account=self.parent_account,
            amount=Decimal("8.00"), description="spent it", initiated_by=self.parent,
        )
        with self.assertRaises(InsufficientFundsError):
            LedgerService.reverse(transaction=deposit, initiated_by=self.parent)
        self.assertFalse(hasattr(deposit, "reversal"))

    def test_reversed_transaction_and_its_reversal_are_excluded_from_visible(self):
        txn = LedgerService.allowance(
            child_account=self.child_account, parent_account=self.parent_account,
            amount=Decimal("10.00"), description="allowance", idempotency_key="a:1",
        )
        LedgerService.deposit(
            child_account=self.child_account, parent_account=self.parent_account,
            amount=Decimal("5.00"), description="bonus", initiated_by=self.parent,
        )
        reversal = LedgerService.reverse(transaction=txn, initiated_by=self.parent)
        visible_ids = set(Transaction.objects.visible().values_list("id", flat=True))
        self.assertNotIn(txn.id, visible_ids)
        self.assertNotIn(reversal.id, visible_ids)
        self.assertEqual(Transaction.objects.count(), 3)
        self.assertEqual(Transaction.objects.visible().count(), 1)


class TransactionAPITests(APITestCase):
    def setUp(self):
        self.parent = User.objects.create_user(username="parent", password="pw12345678", role=User.PARENT)
        self.child = User.objects.create_user(username="child", password="pw12345678", role=User.CHILD)
        Guardianship.objects.create(parent=self.parent, child=self.child)

    def test_parent_can_deposit_to_their_child(self):
        self.client.force_authenticate(user=self.parent)
        resp = self.client.post(reverse("transactions-deposit"), {
            "child_account": self.child.account.id, "amount": "12.50", "description": "birthday",
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.child.account.refresh_from_db()
        self.assertEqual(self.child.account.balance, Decimal("12.50"))

    def test_parent_can_withdraw_from_their_child(self):
        LedgerService.deposit(
            child_account=self.child.account, parent_account=self.parent.account,
            amount=Decimal("20.00"), description="seed", initiated_by=self.parent,
        )
        self.client.force_authenticate(user=self.parent)
        resp = self.client.post(reverse("transactions-withdraw"), {
            "child_account": self.child.account.id, "amount": "6.00", "description": "snacks",
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.child.account.refresh_from_db()
        self.assertEqual(self.child.account.balance, Decimal("14.00"))

    def test_child_cannot_deposit_or_withdraw(self):
        self.client.force_authenticate(user=self.child)
        deposit = self.client.post(reverse("transactions-deposit"), {
            "child_account": self.child.account.id, "amount": "5.00",
        })
        withdraw = self.client.post(reverse("transactions-withdraw"), {
            "child_account": self.child.account.id, "amount": "5.00",
        })
        self.assertEqual(deposit.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(withdraw.status_code, status.HTTP_403_FORBIDDEN)

    def test_non_guardian_parent_cannot_deposit_to_unrelated_child(self):
        stranger = User.objects.create_user(username="stranger", password="pw12345678", role=User.PARENT)
        self.client.force_authenticate(user=stranger)
        resp = self.client.post(reverse("transactions-deposit"), {
            "child_account": self.child.account.id, "amount": "5.00",
        })
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_child_can_view_own_transaction_history_but_not_others(self):
        LedgerService.allowance(
            child_account=self.child.account, parent_account=self.parent.account,
            amount=Decimal("10.00"), description="allowance", idempotency_key="a:1",
        )
        other_parent = User.objects.create_user(username="other", password="pw12345678", role=User.PARENT)
        other_child = User.objects.create_user(username="otherkid", password="pw12345678", role=User.CHILD)
        Guardianship.objects.create(parent=other_parent, child=other_child)
        LedgerService.allowance(
            child_account=other_child.account, parent_account=other_parent.account,
            amount=Decimal("99.00"), description="allowance", idempotency_key="a:2",
        )

        self.client.force_authenticate(user=self.child)
        resp = self.client.get(reverse("transactions-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(Decimal(resp.data[0]["amount"]), Decimal("10.00"))

    def test_guardian_parent_can_reverse_and_it_disappears_from_listings(self):
        self.client.force_authenticate(user=self.parent)
        deposit_resp = self.client.post(reverse("transactions-deposit"), {
            "child_account": self.child.account.id, "amount": "12.50", "description": "birthday",
        })
        txn_id = deposit_resp.data["id"]

        resp = self.client.post(reverse("transactions-reverse", args=[txn_id]))
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.child.account.refresh_from_db()
        self.assertEqual(self.child.account.balance, Decimal("0.00"))

        listing = self.client.get(reverse("transactions-list"))
        ids = {row["id"] for row in listing.data}
        self.assertNotIn(txn_id, ids)
        self.assertNotIn(resp.data["id"], ids)

    def test_reversing_already_reversed_transaction_404s(self):
        self.client.force_authenticate(user=self.parent)
        deposit_resp = self.client.post(reverse("transactions-deposit"), {
            "child_account": self.child.account.id, "amount": "5.00",
        })
        txn_id = deposit_resp.data["id"]
        first = self.client.post(reverse("transactions-reverse", args=[txn_id]))
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        second = self.client.post(reverse("transactions-reverse", args=[txn_id]))
        self.assertEqual(second.status_code, status.HTTP_404_NOT_FOUND)

    def test_child_cannot_reverse_a_transaction(self):
        LedgerService.deposit(
            child_account=self.child.account, parent_account=self.parent.account,
            amount=Decimal("5.00"), description="gift", initiated_by=self.parent,
        )
        txn_id = Transaction.objects.get().id
        self.client.force_authenticate(user=self.child)
        resp = self.client.post(reverse("transactions-reverse", args=[txn_id]))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_non_guardian_parent_cannot_reverse_unrelated_childs_transaction(self):
        LedgerService.deposit(
            child_account=self.child.account, parent_account=self.parent.account,
            amount=Decimal("5.00"), description="gift", initiated_by=self.parent,
        )
        txn_id = Transaction.objects.get().id
        stranger = User.objects.create_user(username="stranger2", password="pw12345678", role=User.PARENT)
        self.client.force_authenticate(user=stranger)
        resp = self.client.post(reverse("transactions-reverse", args=[txn_id]))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
