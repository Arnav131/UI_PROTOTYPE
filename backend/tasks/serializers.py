"""
Task serializers with validation.

Handles duration conversion (minutes ↔ timedelta),
auto-calculates scheduled_end from start + duration,
and enforces business rules.
"""

from datetime import timedelta
from django.utils import timezone
from rest_framework import serializers
from .models import Task


class TaskSerializer(serializers.ModelSerializer):
    """Full task serializer for list/detail views."""

    estimated_duration_minutes = serializers.IntegerField(
        required=False, allow_null=True, write_only=True,
        help_text='Duration in minutes (converted to timedelta internally)'
    )
    duration_minutes = serializers.SerializerMethodField(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Task
        fields = (
            'id', 'title', 'description', 'notes',
            'status', 'priority',
            'deadline', 'scheduled_start', 'scheduled_end',
            'estimated_duration', 'estimated_duration_minutes', 'duration_minutes',
            'preferred_time',
            'is_locked', 'is_flexible',
            'goal',
            'created_at', 'updated_at', 'completed_at',
            'last_reminded_at',
            'is_overdue',
        )
        read_only_fields = ('id', 'created_at', 'updated_at', 'completed_at', 'last_reminded_at', 'is_overdue')
        extra_kwargs = {
            'estimated_duration': {'read_only': True},
        }

    def get_duration_minutes(self, obj):
        if obj.estimated_duration:
            return int(obj.estimated_duration.total_seconds() / 60)
        return None

    def validate(self, attrs):
        # Convert duration_minutes to timedelta
        duration_mins = attrs.pop('estimated_duration_minutes', None)
        if duration_mins is not None:
            if duration_mins <= 0:
                raise serializers.ValidationError({
                    'estimated_duration_minutes': 'Duration must be positive.'
                })
            attrs['estimated_duration'] = timedelta(minutes=duration_mins)

        # Auto-calculate scheduled_end if start and duration are provided
        start = attrs.get('scheduled_start') or (self.instance and self.instance.scheduled_start)
        duration = attrs.get('estimated_duration') or (self.instance and self.instance.estimated_duration)

        if start and duration and 'scheduled_end' not in attrs:
            attrs['scheduled_end'] = start + duration

        # Validate: locked tasks cannot be flexible
        is_locked = attrs.get('is_locked', self.instance.is_locked if self.instance else False)
        is_flexible = attrs.get('is_flexible', self.instance.is_flexible if self.instance else True)
        if is_locked and is_flexible:
            attrs['is_flexible'] = False  # Locked implies not flexible

        # Validate: scheduled_end must be after scheduled_start
        end = attrs.get('scheduled_end')
        if start and end and end <= start:
            raise serializers.ValidationError({
                'scheduled_end': 'End time must be after start time.'
            })

        return attrs

    def create(self, validated_data):
        # User is injected by the view, never from request data
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class TaskCompactSerializer(serializers.ModelSerializer):
    """Minimal task serializer for schedule/list views."""
    duration_minutes = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = (
            'id', 'title', 'status', 'priority',
            'scheduled_start', 'scheduled_end',
            'duration_minutes',
            'is_locked', 'is_flexible',
            'deadline',
        )

    def get_duration_minutes(self, obj):
        if obj.estimated_duration:
            return int(obj.estimated_duration.total_seconds() / 60)
        return None
