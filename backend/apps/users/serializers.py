from rest_framework import serializers

from apps.users.models import Guardianship, User


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

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
        ]
        read_only_fields = ["id"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class GuardianshipSerializer(serializers.ModelSerializer):
    parent_username = serializers.CharField(source="parent.username", read_only=True)
    child_username = serializers.CharField(source="child.username", read_only=True)

    class Meta:
        model = Guardianship
        fields = ["id", "parent", "parent_username", "child", "child_username", "created_at"]
        read_only_fields = ["id", "parent", "created_at"]

    def validate_child(self, value):
        if value.role != User.CHILD:
            raise serializers.ValidationError("child must reference a user with role=child")
        return value
