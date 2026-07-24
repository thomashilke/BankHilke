from django.contrib import admin

from apps.transactions.models import LedgerEntry, Transaction

admin.site.register(Transaction)
admin.site.register(LedgerEntry)
