from .models import Transaction


class TransactionService:

    @staticmethod
    def credit(
            account,
            amount,
            description
    ):
        return Transaction.objects.create(
            account=account,
            amount=amount,
            description=description,
            transaction_type="credit"
        )

    @staticmethod
    def debit(
            account,
            amount,
            dsecription
    ):
        return Transaction.objects.create(
            account=account,
            amount=amount,
            description=description,
            transacton_type="debit"
        )
    
