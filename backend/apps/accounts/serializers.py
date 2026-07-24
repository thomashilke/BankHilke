from rest_framework import serializers

from .models import Account


class AccountSerializer(serializers.ModelSerializer):
    balance = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    role = serializers.CharField(source="owner.role", read_only=True)

    class Meta:
        model = Account

        fields = [
            "id",
            "owner",
            "owner_username",
            "role",
            "currency",
            "balance",
            "created_at",
        ]
        read_only_fields = fields
