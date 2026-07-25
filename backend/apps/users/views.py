from django.db.models import Q
from rest_framework import permissions
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from api.permissions import IsParent
from apps.users.models import Guardianship, User
from apps.users.serializers import ChangePasswordSerializer, GuardianshipSerializer, UserSerializer


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
        if self.action == "list" and user.role == User.PARENT and user.is_staff:
            # Administrative parents can see every account on the ledger,
            # not just themselves + their own guarded children.
            return User.objects.all()
        if user.role == User.PARENT:
            child_ids = Guardianship.objects.filter(parent=user).values_list("child_id", flat=True)
            return User.objects.filter(Q(id=user.id) | Q(id__in=child_ids))
        return User.objects.filter(id=user.id)

    @action(detail=False, methods=["post"], url_path="change-password")
    def change_password(self, request):
        """Self-service password change for any authenticated user (parent
        or child) -- always acts on the caller, never a target id, so this
        can't be used to reset someone else's password."""
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "password updated"})

    def perform_create(self, serializer):
        role = serializer.validated_data.get("role")
        requester = self.request.user
        if role == User.CHILD:
            if not (requester.is_authenticated and requester.role == User.PARENT):
                raise PermissionDenied("only an authenticated parent can create a child account")
            child = serializer.save()
            Guardianship.objects.create(parent=requester, child=child)
            return
        if requester.is_authenticated:
            # Anonymous requests fall straight through to open self-registration
            # (see get_permissions); an already-authenticated session minting
            # *another* parent account is only allowed for administrators.
            if not (requester.role == User.PARENT and requester.is_staff):
                raise PermissionDenied(
                    "only a parent with administrative rights can create another parent account"
                )
        serializer.save()


class GuardianshipViewSet(ModelViewSet):
    """Links a parent to an existing child as an additional guardian (e.g.
    the other parent in a divorced-parents scenario), so both parents'
    contributions to that child can be reconciled.

    POST accepts `child` plus an optional `username`: with no `username` the
    requester links themselves (self-service, requires no prior
    relationship to the child - matches how a second parent claims a child
    they already know the id of); with `username`, the requester must
    already be a guardian of that child and is linking a *different*,
    already-registered parent as a co-guardian on the child's behalf.

    GET accepts an optional `?child=<id>` filter: if the requester is
    themselves a guardian of that child, this returns *every* guardian of
    that child (not just the requester's own link), so the UI can show who
    else shares responsibility for a child. Without the filter, only the
    requester's own guardianship links are returned."""

    serializer_class = GuardianshipSerializer
    permission_classes = [permissions.IsAuthenticated, IsParent]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        own = Guardianship.objects.filter(parent=self.request.user)
        child_id = self.request.query_params.get("child")
        if child_id is not None and own.filter(child_id=child_id).exists():
            return Guardianship.objects.filter(child_id=child_id)
        return own

    def perform_create(self, serializer):
        requester = self.request.user
        target_parent = serializer.validated_data.pop("username", None) or requester
        child = serializer.validated_data["child"]

        if target_parent != requester and not Guardianship.objects.filter(parent=requester, child=child).exists():
            raise PermissionDenied("you must already be a guardian of this child to link another guardian for them")

        if Guardianship.objects.filter(parent=target_parent, child=child).exists():
            raise ValidationError({"detail": f"{target_parent.username} is already a guardian of this child"})

        serializer.save(parent=target_parent)
