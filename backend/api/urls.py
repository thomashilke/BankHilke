"""
URL configuration for api project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
"""
from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

from apps.accounts.views import AccountViewSet
from apps.allowances.views import AllowanceRuleViewSet, InterestRuleViewSet
from apps.transactions.views import TransactionViewSet
from apps.users.views import GoogleLoginView, GuardianshipViewSet, UserViewSet

router = DefaultRouter()

router.register("transactions", TransactionViewSet, basename="transactions")
router.register("accounts", AccountViewSet, basename="accounts")
router.register("users", UserViewSet, basename="users")
router.register("guardianships", GuardianshipViewSet, basename="guardianships")
router.register("allowance-rules", AllowanceRuleViewSet, basename="allowance-rules")
router.register("interest-rules", InterestRuleViewSet, basename="interest-rules")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
    path("api/auth/login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/verify/", TokenVerifyView.as_view(), name="token_verify"),
    path("api/auth/google/", GoogleLoginView.as_view(), name="google_login"),
]
