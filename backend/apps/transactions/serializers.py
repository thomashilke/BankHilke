from rest_framework import serializers
from .models import Transaction

class TransactionSerializer(
        serializers.ModelSerializer
):
    class Meta:
        model = Transaction

        fields = [
            "id",
            "description",
            "amount",
            "transaction_type",
            "created_at"
        ]

        
