from django.shortcuts import render
from rest_framework.viewsets import ModelViewSet
from .models import Transaction
from .serializers import TransactionSerializer


class TransactionViewSet(
        ModelViewSet
):

    serializer_class = (
        TransactionSerializer
    )

    def get_queryset(self):
        return Transactions.objects.filter(
            account__owner=self.request.user
        )
