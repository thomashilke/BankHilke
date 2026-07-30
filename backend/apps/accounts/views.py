from decimal import Decimal

from django.db.models import Q, Sum
from rest_framework import permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ReadOnlyModelViewSet

from apps.transactions.models import Transaction
from apps.transactions.serializers import TransactionSerializer
from apps.users.models import User

from .models import Account
from .serializers import AccountSerializer


class AccountViewSet(ReadOnlyModelViewSet):
    """Accounts are created implicitly (see apps.accounts.signals) when a
    User registers, so this viewset is read-only: current balance, history,
    and cross-parent reconciliation for a child account."""

    serializer_class = AccountSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == User.PARENT:
            return Account.objects.filter(
                Q(owner=user) | Q(owner__guardianships_as_child__parent=user)
            ).distinct()
        return Account.objects.filter(owner=user)

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        """Past transactions this account was on either side of, newest first."""
        account = self.get_object()
        qs = Transaction.objects.visible().filter(
            Q(child_account=account) | Q(parent_account=account)
        ).select_related("child_account__owner", "parent_account__owner").order_by("-created_at")
        page = self.paginate_queryset(qs)
        serializer = TransactionSerializer(page if page is not None else qs, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    @action(detail=True, methods=["patch"])
    def currency(self, request, pk=None):
        """Change the account's display currency. Callable by the account
        owner or any parent guardian of the owner -- `get_queryset` already
        scopes `get_object` to that set. Purely cosmetic: the ledger never
        converts between currencies, so no balances are touched."""
        account = self.get_object()
        value = request.data.get("currency")
        if value not in Account.Currency.values:
            return Response({"currency": ["Not a valid choice."]}, status=400)
        account.currency = value
        account.save(update_fields=["currency"])
        return Response(self.get_serializer(account).data)

    @action(detail=True, methods=["get"])
    def reconciliation(self, request, pk=None):
        """For a child account: per-funding-parent totals given/taken, so
        guardians (e.g. divorced parents) can reconcile who contributed what."""
        account = self.get_object()
        if account.owner.role != User.CHILD:
            return Response(
                {"detail": "reconciliation is only available for child accounts."},
                status=400,
            )
        rows = (
            Transaction.objects.visible().filter(child_account=account)
            .values("parent_account__owner_id", "parent_account__owner__username")
            .annotate(
                total_given=Sum(
                    "amount",
                    filter=Q(transaction_type__in=[
                        Transaction.ALLOWANCE, Transaction.INTEREST, Transaction.DEPOSIT,
                    ]),
                ),
                total_taken=Sum("amount", filter=Q(transaction_type=Transaction.WITHDRAWAL)),
            )
            .order_by("parent_account__owner__username")
        )
        zero = Decimal("0.00")
        results = [
            {
                "parent_id": row["parent_account__owner_id"],
                "parent_username": row["parent_account__owner__username"],
                "total_given": row["total_given"] or zero,
                "total_taken": row["total_taken"] or zero,
                "net_contribution": (row["total_given"] or zero) - (row["total_taken"] or zero),
            }
            for row in rows
        ]
        return Response(results)
