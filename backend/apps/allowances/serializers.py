from rest_framework import serializers

from apps.users.models import Guardianship

from .models import AllowanceRule, InterestRule


class GuardianFundedRuleSerializer(serializers.ModelSerializer):
    """Shared validation: the funding_parent must actually be a guardian of
    the child the rule is configured for."""

    def validate(self, attrs):
        child = attrs.get("child", getattr(self.instance, "child", None))
        funding_parent = attrs.get("funding_parent", getattr(self.instance, "funding_parent", None))
        if child and funding_parent and not Guardianship.objects.filter(parent=funding_parent, child=child).exists():
            raise serializers.ValidationError("funding_parent must be a guardian of child")
        return attrs


class AllowanceRuleSerializer(GuardianFundedRuleSerializer):
    class Meta:
        model = AllowanceRule
        fields = [
            "id", "child", "funding_parent", "amount", "weekday", "hour",
            "enabled", "next_run_at", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "next_run_at", "created_at", "updated_at"]


class InterestRuleSerializer(GuardianFundedRuleSerializer):
    class Meta:
        model = InterestRule
        fields = [
            "id", "child", "funding_parent", "rate", "schedule",
            "weekday", "day_of_month", "hour", "enabled", "next_run_at",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "next_run_at", "created_at", "updated_at"]
