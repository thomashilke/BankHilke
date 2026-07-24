from django.db.models import Q
from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied
from rest_framework.viewsets import ModelViewSet

from api.permissions import IsParent
from apps.users.models import Guardianship, User
from apps.users.serializers import GuardianshipSerializer, UserSerializer


class IsSelfOrGuardianParent(permissions.BasePermission):
    """Users may see/edit themselves; a parent may also see/edit the
    children they're a guardian of."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        if obj == user:
            return True
        return user.role == User.PARENT and Guardianship.objects.filter(parent=user, child=obj).exists()


class UserViewSet(ModelViewSet):

    serializer_class = UserSerializer

    def get_permissions(self):
        if self.action == "create":
            # Anyone may self-register as a parent; registering a child is
            # further gated inside perform_create (must be an authenticated
            # parent, who becomes the child's first guardian).
            return [permissions.AllowAny()]
        if self.action in ("retrieve", "update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsSelfOrGuardianParent()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return User.objects.none()
        if user.role == User.PARENT:
            child_ids = Guardianship.objects.filter(parent=user).values_list("child_id", flat=True)
            return User.objects.filter(Q(id=user.id) | Q(id__in=child_ids))
        return User.objects.filter(id=user.id)

    def perform_create(self, serializer):
        role = serializer.validated_data.get("role")
        requester = self.request.user
        if role == User.CHILD:
            if not (requester.is_authenticated and requester.role == User.PARENT):
                raise PermissionDenied("only an authenticated parent can create a child account")
            child = serializer.save()
            Guardianship.objects.create(parent=requester, child=child)
        else:
            serializer.save()


class GuardianshipViewSet(ModelViewSet):
    """Lets a parent link themselves as an additional guardian of an existing
    child (e.g. the other parent in a divorced-parents scenario), so both
    parents' contributions to that child can be reconciled."""

    serializer_class = GuardianshipSerializer
    permission_classes = [permissions.IsAuthenticated, IsParent]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        return Guardianship.objects.filter(parent=self.request.user)

    def perform_create(self, serializer):
        serializer.save(parent=self.request.user)
