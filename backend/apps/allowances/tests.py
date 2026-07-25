from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.transactions.models import Transaction
from apps.transactions.services import LedgerService
from apps.users.models import Guardianship, User

from .models import AllowanceRule, InterestRule
from .scheduling import next_monthly_occurrence, next_weekly_occurrence
from .tasks import process_due_accruals


class SchedulingHelperTests(TestCase):
    def test_next_weekly_occurrence_moves_to_target_weekday(self):
        # Wednesday 2026-01-07 10:00, target weekday=Friday(4) hour=9
        after = timezone.make_aware(timezone.datetime(2026, 1, 7, 10, 0))
        result = next_weekly_occurrence(after, weekday=4, hour=9)
        self.assertEqual(result.weekday(), 4)
        self.assertEqual(result.hour, 9)
        self.assertGreater(result, after)
        self.assertEqual((result.date() - after.date()).days, 2)

    def test_next_weekly_occurrence_wraps_to_next_week_when_same_day_passed(self):
        after = timezone.make_aware(timezone.datetime(2026, 1, 9, 10, 0))  # Friday 10:00
        result = next_weekly_occurrence(after, weekday=4, hour=9)  # Friday 09:00 already passed
        self.assertEqual((result.date() - after.date()).days, 7)

    def test_next_monthly_occurrence_clamps_short_months(self):
        # day 31 already passed this month -> rolls into February, which has
        # only 28 days in 2026 -> clamped.
        after = timezone.make_aware(timezone.datetime(2026, 1, 31, 10, 0))
        result = next_monthly_occurrence(after, day_of_month=31, hour=9)
        self.assertEqual(result.month, 2)
        self.assertEqual(result.day, 28)


class ProcessDueAccrualsTests(TestCase):
    def setUp(self):
        self.parent = User.objects.create_user(username="parent", password="hunter22", role=User.PARENT)
        self.child = User.objects.create_user(username="child", password="hunter22", role=User.CHILD)
        Guardianship.objects.create(parent=self.parent, child=self.child)

    def test_due_allowance_is_posted_and_cursor_advances(self):
        past_due = timezone.now() - timedelta(minutes=1)
        rule = AllowanceRule.objects.create(
            child=self.child, funding_parent=self.parent, amount=Decimal("5.00"),
            weekday=timezone.now().weekday(), hour=0, next_run_at=past_due,
        )
        process_due_accruals()
        self.child.account.refresh_from_db()
        self.assertEqual(self.child.account.balance, Decimal("5.00"))
        rule.refresh_from_db()
        self.assertGreater(rule.next_run_at, timezone.now())

    def test_rerunning_task_does_not_double_post(self):
        past_due = timezone.now() - timedelta(minutes=1)
        AllowanceRule.objects.create(
            child=self.child, funding_parent=self.parent, amount=Decimal("5.00"),
            weekday=timezone.now().weekday(), hour=0, next_run_at=past_due,
        )
        process_due_accruals()
        process_due_accruals()
        process_due_accruals()
        self.assertEqual(
            Transaction.objects.filter(transaction_type=Transaction.ALLOWANCE).count(), 1
        )
        self.assertEqual(self.child.account.balance, Decimal("5.00"))

    def test_downtime_catchup_processes_every_missed_period_exactly_once(self):
        # Rule was due weekly, but "went unprocessed" for 3 full periods.
        long_overdue = timezone.now() - timedelta(weeks=3, minutes=5)
        AllowanceRule.objects.create(
            child=self.child, funding_parent=self.parent, amount=Decimal("2.00"),
            weekday=timezone.now().weekday(), hour=0, next_run_at=long_overdue,
        )
        process_due_accruals()
        self.assertEqual(
            Transaction.objects.filter(transaction_type=Transaction.ALLOWANCE).count(), 4
        )
        self.child.account.refresh_from_db()
        self.assertEqual(self.child.account.balance, Decimal("8.00"))

        # A second run (simulating the very next scheduled tick) must be a no-op.
        process_due_accruals()
        self.assertEqual(
            Transaction.objects.filter(transaction_type=Transaction.ALLOWANCE).count(), 4
        )

    def test_interest_accrues_on_current_balance_and_skips_zero_amount(self):
        past_due = timezone.now() - timedelta(minutes=1)
        LedgerService.deposit(
            child_account=self.child.account, parent_account=self.parent.account,
            amount=Decimal("100.00"), description="seed", initiated_by=self.parent,
        )
        InterestRule.objects.create(
            child=self.child, funding_parent=self.parent, rate=Decimal("0.0010"),
            schedule=InterestRule.WEEKLY, weekday=timezone.now().weekday(), hour=0,
            next_run_at=past_due,
        )
        process_due_accruals()
        self.child.account.refresh_from_db()
        # 100 * 0.0010 = 0.10 (rate is applied directly for the weekly period)
        self.assertEqual(
            Transaction.objects.filter(transaction_type=Transaction.INTEREST).count(), 1
        )
        interest_txn = Transaction.objects.get(transaction_type=Transaction.INTEREST)
        self.assertEqual(interest_txn.amount, Decimal("0.10"))


class RuleConfigAPITests(APITestCase):
    def setUp(self):
        self.parent = User.objects.create_user(username="parent", password="pw12345678", role=User.PARENT)
        self.child = User.objects.create_user(username="child", password="pw12345678", role=User.CHILD)
        Guardianship.objects.create(parent=self.parent, child=self.child)

    def test_guardian_parent_can_configure_allowance_rule(self):
        self.client.force_authenticate(user=self.parent)
        resp = self.client.post(reverse("allowance-rules-list"), {
            "child": self.child.id, "funding_parent": self.parent.id,
            "amount": "7.50", "weekday": 5, "hour": 8,
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertTrue(AllowanceRule.objects.filter(child=self.child).exists())

    def test_stranger_supplying_own_unrelated_funding_parent_gets_validation_error(self):
        stranger = User.objects.create_user(username="stranger", password="pw12345678", role=User.PARENT)
        self.client.force_authenticate(user=stranger)
        resp = self.client.post(reverse("allowance-rules-list"), {
            "child": self.child.id, "funding_parent": stranger.id,
            "amount": "7.50", "weekday": 5, "hour": 8,
        })
        # stranger isn't a guardian of the child, so funding_parent=stranger
        # fails the "must be a guardian" data validation before any
        # write-permission check runs.
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_stranger_cannot_write_rule_even_with_a_valid_funding_parent(self):
        stranger = User.objects.create_user(username="stranger", password="pw12345678", role=User.PARENT)
        self.client.force_authenticate(user=stranger)
        resp = self.client.post(reverse("allowance-rules-list"), {
            "child": self.child.id, "funding_parent": self.parent.id,
            "amount": "7.50", "weekday": 5, "hour": 8,
        })
        # funding_parent=self.parent passes data validation (a real guardian),
        # but the requester (stranger) still isn't a guardian of this child.
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_child_cannot_create_rules_but_can_view_their_own(self):
        AllowanceRule.objects.create(
            child=self.child, funding_parent=self.parent, amount=Decimal("5.00"),
            weekday=6, hour=9, next_run_at=timezone.now(),
        )
        self.client.force_authenticate(user=self.child)
        create_resp = self.client.post(reverse("allowance-rules-list"), {
            "child": self.child.id, "funding_parent": self.parent.id,
            "amount": "999.00", "weekday": 0, "hour": 0,
        })
        self.assertEqual(create_resp.status_code, status.HTTP_403_FORBIDDEN)
        list_resp = self.client.get(reverse("allowance-rules-list"))
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_resp.data), 1)

    def test_funding_parent_must_be_a_guardian_of_child(self):
        non_guardian = User.objects.create_user(username="notaguardian", password="pw12345678", role=User.PARENT)
        self.client.force_authenticate(user=self.parent)
        resp = self.client.post(reverse("interest-rules-list"), {
            "child": self.child.id, "funding_parent": non_guardian.id,
            "rate": "0.05", "schedule": InterestRule.MONTHLY, "day_of_month": 1, "hour": 9,
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
