from rest_framework import serializers

from apps.accounts.models import Account
from apps.users.models import Guardianship, User


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    currency = serializers.ChoiceField(
        choices=Account.Currency.choices,
        write_only=True,
        required=False,
        default=Account.Currency.USD,
        help_text="Display currency for this user's account -- for presentation only, no conversion is ever performed.",
    )

    class Meta:
        model = User

        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "password",
            "currency",
            "is_staff",
            "language",
        ]
        read_only_fields = ["id", "is_staff"]

    def create(self, validated_data):
        currency = validated_data.pop("currency", Account.Currency.USD)
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        user.account.currency = currency
        user.account.save(update_fields=["currency"])
        return user

    def update(self, instance, validated_data):
        currency = validated_data.pop("currency", None)
        password = validated_data.pop("password", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()
        if currency:
            instance.account.currency = currency
            instance.account.save(update_fields=["currency"])
        return instance


class GuardianshipSerializer(serializers.ModelSerializer):
    parent_username = serializers.CharField(source="parent.username", read_only=True)
    child_username = serializers.CharField(source="child.username", read_only=True)
    username = serializers.CharField(
        write_only=True,
        required=False,
        help_text="Username of an existing parent to link as an additional guardian; defaults to the requester (self-link).",
    )

    class Meta:
        model = Guardianship
        fields = ["id", "parent", "parent_username", "child", "child_username", "username", "created_at"]
        read_only_fields = ["id", "parent", "created_at"]

    def validate_child(self, value):
        if value.role != User.CHILD:
            raise serializers.ValidationError("child must reference a user with role=child")
        return value

    def validate_username(self, value):
        try:
            return User.objects.get(username=value, role=User.PARENT)
        except User.DoesNotExist:
            raise serializers.ValidationError("no parent account with that username exists")
