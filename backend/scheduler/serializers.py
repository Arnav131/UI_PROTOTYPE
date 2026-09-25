from rest_framework import serializers
from tasks.serializers import TaskCompactSerializer

class SlotSerializer(serializers.Serializer):
    start = serializers.DateTimeField()
    end = serializers.DateTimeField()
    duration_minutes = serializers.IntegerField()

class RescheduleItemSerializer(serializers.Serializer):
    task_id = serializers.UUIDField()
    title = serializers.CharField()
    current_start = serializers.DateTimeField()
    current_end = serializers.DateTimeField()
    proposed_start = serializers.DateTimeField()
    proposed_end = serializers.DateTimeField()

class ScheduleProposalSerializer(serializers.Serializer):
    status = serializers.CharField()
    task_id = serializers.CharField()
    proposed_start = serializers.DateTimeField(allow_null=True)
    proposed_end = serializers.DateTimeField(allow_null=True)
    reason = serializers.CharField()
    reschedules = RescheduleItemSerializer(many=True)

class ConflictItemSerializer(serializers.Serializer):
    task_a_id = serializers.UUIDField()
    task_a_title = serializers.CharField()
    task_b_id = serializers.UUIDField()
    task_b_title = serializers.CharField()
    overlap_start = serializers.DateTimeField()
    overlap_end = serializers.DateTimeField()
    overlap_minutes = serializers.IntegerField()

class ConflictReportSerializer(serializers.Serializer):
    has_conflict = serializers.BooleanField()
    conflicts = ConflictItemSerializer(many=True)
