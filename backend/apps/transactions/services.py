from decimal import Decimal
from uuid import uuid4

from django.db import IntegrityError
from django.db import transaction as db_transaction

from apps.accounts.models import Account

from .models import LedgerEntry, Transaction


class InsufficientFundsError(Exception):
    """Raised when a withdrawal would take a child's balance negative."""


class LedgerService:
    """Posts double-entry transactions.

    Every posting method funnels through `_post`, which always creates
    exactly one debit leg and one credit leg of equal amount -- the books
    always balance by construction. `idempotency_key` uniqueness (enforced
    at the DB level) makes every posting safe to retry: replaying the same
    event (same key) is a no-op that returns the already-posted Transaction
    instead of raising.
    """

    @staticmethod
    def _post(*, transaction_type, child_account, parent_account, amount,
              description, idempotency_key, debit_account, credit_account,
              initiated_by=None):
        amount = Decimal(amount)
        if amount <= 0:
            raise ValueError("amount must be positive")

        try:
            with db_transaction.atomic():
                txn = Transaction.objects.create(
                    transaction_type=transaction_type,
                    child_account=child_account,
                    parent_account=parent_account,
                    amount=amount,
                    description=description,
                    initiated_by=initiated_by,
                    idempotency_key=idempotency_key,
                )
                LedgerEntry.objects.create(
                    transaction=txn,
                    account=debit_account,
                    direction=LedgerEntry.DEBIT,
                    amount=amount,
                )
                LedgerEntry.objects.create(
                    transaction=txn,
                    account=credit_account,
                    direction=LedgerEntry.CREDIT,
                    amount=amount,
                )
            return txn
        except IntegrityError:
            # idempotency_key collision: this exact event was already posted.
            return Transaction.objects.get(idempotency_key=idempotency_key)

    @staticmethod
    def allowance(*, child_account, parent_account, amount, description, idempotency_key):
        """Debits the funding parent, credits the child."""
        return LedgerService._post(
            transaction_type=Transaction.ALLOWANCE,
            child_account=child_account,
            parent_account=parent_account,
            amount=amount,
            description=description,
            idempotency_key=idempotency_key,
            debit_account=parent_account,
            credit_account=child_account,
        )

    @staticmethod
    def interest(*, child_account, parent_account, amount, description, idempotency_key):
        """Debits the funding parent, credits the child."""
        return LedgerService._post(
            transaction_type=Transaction.INTEREST,
            child_account=child_account,
            parent_account=parent_account,
            amount=amount,
            description=description,
            idempotency_key=idempotency_key,
            debit_account=parent_account,
            credit_account=child_account,
        )

    @staticmethod
    def deposit(*, child_account, parent_account, amount, description, initiated_by, idempotency_key=None):
        """Manual deposit: debits the depositing parent, credits the child."""
        idempotency_key = idempotency_key or f"deposit:{uuid4()}"
        return LedgerService._post(
            transaction_type=Transaction.DEPOSIT,
            child_account=child_account,
            parent_account=parent_account,
            amount=amount,
            description=description,
            idempotency_key=idempotency_key,
            initiated_by=initiated_by,
            debit_account=parent_account,
            credit_account=child_account,
        )

    @staticmethod
    def withdrawal(*, child_account, parent_account, amount, description, initiated_by, idempotency_key=None):
        """Parent-advanced withdrawal: debits the child, credits the advancing parent.

        Locks the child account row for the duration of the balance check +
        posting so concurrent withdrawals can't both pass an insufficient-funds
        check against a stale balance.
        """
        amount = Decimal(amount)
        if amount <= 0:
            raise ValueError("amount must be positive")
        idempotency_key = idempotency_key or f"withdrawal:{uuid4()}"

        try:
            with db_transaction.atomic():
                locked_child = Account.objects.select_for_update().get(pk=child_account.pk)
                if amount > locked_child.balance:
                    raise InsufficientFundsError("withdrawal exceeds child account balance")

                txn = Transaction.objects.create(
                    transaction_type=Transaction.WITHDRAWAL,
                    child_account=locked_child,
                    parent_account=parent_account,
                    amount=amount,
                    description=description,
                    initiated_by=initiated_by,
                    idempotency_key=idempotency_key,
                )
                LedgerEntry.objects.create(
                    transaction=txn,
                    account=locked_child,
                    direction=LedgerEntry.DEBIT,
                    amount=amount,
                )
                LedgerEntry.objects.create(
                    transaction=txn,
                    account=parent_account,
                    direction=LedgerEntry.CREDIT,
                    amount=amount,
                )
            return txn
        except IntegrityError:
            return Transaction.objects.get(idempotency_key=idempotency_key)

    @staticmethod
    def reverse(*, transaction, initiated_by):
        """Posts a reversal transaction that exactly undoes `transaction`'s
        ledger effect: same amount, debit/credit legs swapped. The original
        and its reversal are then excluded from every listing and
        aggregate (see Transaction.objects.visible()) -- reversing a
        movement is meant to make it as if it never happened.

        Idempotent: replaying against an already-reversed transaction
        returns the existing reversal instead of creating a second one
        (also enforced at the DB level by the unique `reverses` column and
        the deterministic idempotency key, for concurrent callers).
        """
        if transaction.reverses_id is not None:
            raise ValueError("cannot reverse a reversal transaction")
        if hasattr(transaction, "reversal"):
            return transaction.reversal

        debit_entry = transaction.entries.get(direction=LedgerEntry.DEBIT)
        credit_entry = transaction.entries.get(direction=LedgerEntry.CREDIT)
        # Swap the legs: whatever was credited is now debited, and vice versa.
        new_debit_account_id = credit_entry.account_id
        new_credit_account_id = debit_entry.account_id
        idempotency_key = f"reversal:{transaction.id}"

        try:
            with db_transaction.atomic():
                new_debit_account = Account.objects.select_for_update().get(pk=new_debit_account_id)
                if new_debit_account_id == transaction.child_account_id and transaction.amount > new_debit_account.balance:
                    raise InsufficientFundsError("reversal would take the child account balance negative")

                reversal = Transaction.objects.create(
                    transaction_type=transaction.transaction_type,
                    child_account=transaction.child_account,
                    parent_account=transaction.parent_account,
                    amount=transaction.amount,
                    description=f"Reversal of #{transaction.id}",
                    initiated_by=initiated_by,
                    idempotency_key=idempotency_key,
                    reverses=transaction,
                )
                LedgerEntry.objects.create(
                    transaction=reversal,
                    account_id=new_debit_account_id,
                    direction=LedgerEntry.DEBIT,
                    amount=transaction.amount,
                )
                LedgerEntry.objects.create(
                    transaction=reversal,
                    account_id=new_credit_account_id,
                    direction=LedgerEntry.CREDIT,
                    amount=transaction.amount,
                )
            return reversal
        except IntegrityError:
            transaction.refresh_from_db()
            return transaction.reversal
