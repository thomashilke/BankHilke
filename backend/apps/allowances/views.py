from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied
from rest_framework.viewsets import ModelViewSet

from api.permissions import IsParent
from apps.users.models import Guardianship, User

from .models import AllowanceRule, InterestRule
from .serializers import AllowanceRuleSerializer, InterestRuleSerializer


class GuardianRuleViewSet(ModelViewSet):
    """Base for AllowanceRule/InterestRule viewsets: a rule is only visible
    to (and writable by) the child it belongs to (read-only) or a parent who
    is a guardian of that child (read-write)."""

    queryset = None  # set on subclass

    def get_queryset(self):
        user = self.request.user
        if user.role == User.PARENT:
            child_ids = Guardianship.objects.filter(parent=user).values_list("child_id", flat=True)
            return self.queryset.filter(child_id__in=child_ids)
        return self.queryset.filter(child=user)

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsParent()]

    def perform_create(self, serializer):
        child = serializer.validated_data["child"]
        if not Guardianship.objects.filter(parent=self.request.user, child=child).exists():
            raise PermissionDenied("not a guardian of this child")
        serializer.save()

    def perform_update(self, serializer):
        child = serializer.instance.child
        if not Guardianship.objects.filter(parent=self.request.user, child=child).exists():
            raise PermissionDenied("not a guardian of this child")
        serializer.save()


class AllowanceRuleViewSet(GuardianRuleViewSet):
    queryset = AllowanceRule.objects.all()
    serializer_class = AllowanceRuleSerializer


class InterestRuleViewSet(GuardianRuleViewSet):
    queryset = InterestRule.objects.all()
    serializer_class = InterestRuleSerializer
