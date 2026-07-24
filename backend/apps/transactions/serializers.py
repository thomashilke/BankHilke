from decimal import Decimal

from rest_framework import serializers

from apps.accounts.models import Account

from .models import LedgerEntry, Transaction


class LedgerEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = LedgerEntry
        fields = ["id", "account", "direction", "amount"]


class TransactionSerializer(serializers.ModelSerializer):
    entries = LedgerEntrySerializer(many=True, read_only=True)

    class Meta:
        model = Transaction

        fields = [
            "id",
            "transaction_type",
            "child_account",
            "parent_account",
            "amount",
            "description",
            "initiated_by",
            "created_at",
            "entries",
        ]
        read_only_fields = fields


class ManualTransactionSerializer(serializers.Serializer):
    """Input for the deposit/withdraw actions on TransactionViewSet."""

    child_account = serializers.PrimaryKeyRelatedField(queryset=Account.objects.all())
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))
    description = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
