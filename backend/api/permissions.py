from rest_framework.permissions import BasePermission


class IsParent(BasePermission):
    """Grants access only to authenticated users with role='parent'."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == user.PARENT)


class IsChild(BasePermission):
    """Grants access only to authenticated users with role='child'."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == user.CHILD)
