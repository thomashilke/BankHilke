from django.db.models import Q
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ReadOnlyModelViewSet

from api.permissions import IsParent
from apps.users.models import Guardianship, User

from .models import Transaction
from .serializers import ManualTransactionSerializer, TransactionSerializer
from .services import InsufficientFundsError, LedgerService


class TransactionViewSet(ReadOnlyModelViewSet):
    """Read-only transaction history, plus the two ways a parent can write to
    the ledger directly: manual deposit and parent-advanced withdrawal.
    Scheduled allowance/interest postings are created by
    apps.allowances.tasks.process_due_accruals, not through this API.
    """

    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == User.PARENT:
            child_ids = Guardianship.objects.filter(parent=user).values_list("child_id", flat=True)
            qs = Transaction.objects.filter(
                Q(parent_account__owner=user) | Q(child_account__owner_id__in=child_ids)
            ).distinct()
        else:
            qs = Transaction.objects.filter(child_account__owner=user)
        return qs.visible()

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, IsParent])
    def reverse(self, request, pk=None):
        """Reverses this transaction's ledger effect. `get_object` (scoped
        by `get_queryset`) already guarantees the caller is a guardian of
        the child on this transaction and that it hasn't been reversed
        already -- both are required for it to be visible/reachable here."""
        txn = self.get_object()
        try:
            reversal = LedgerService.reverse(transaction=txn, initiated_by=request.user)
        except InsufficientFundsError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(TransactionSerializer(reversal).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated, IsParent])
    def deposit(self, request):
        return self._post_manual(request, LedgerService.deposit)

    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated, IsParent])
    def withdraw(self, request):
        return self._post_manual(request, LedgerService.withdrawal)

    def _post_manual(self, request, service_fn):
        serializer = ManualTransactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        child_account = serializer.validated_data["child_account"]

        if child_account.owner.role != User.CHILD:
            return Response({"detail": "child_account must belong to a child."}, status=status.HTTP_400_BAD_REQUEST)
        if not Guardianship.objects.filter(parent=request.user, child=child_account.owner).exists():
            return Response({"detail": "you are not a guardian of this child."}, status=status.HTTP_403_FORBIDDEN)

        try:
            txn = service_fn(
                child_account=child_account,
                parent_account=request.user.account,
                amount=serializer.validated_data["amount"],
                description=serializer.validated_data.get("description", ""),
                initiated_by=request.user,
            )
        except InsufficientFundsError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(TransactionSerializer(txn).data, status=status.HTTP_201_CREATED)
