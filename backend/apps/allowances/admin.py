from django.contrib import admin

from apps.allowances.models import AllowanceRule, InterestRule

admin.site.register(AllowanceRule)
admin.site.register(InterestRule)
