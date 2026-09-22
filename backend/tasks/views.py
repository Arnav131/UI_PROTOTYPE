"""
Task API views.

All queries are scoped to the authenticated user via get_queryset().
This is the primary security boundary — a user can never see or modify
another user's tasks.
"""

from django.utils import timezone
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Task
from .serializers import TaskSerializer
from .reminder_engine import ReminderEngine


class TaskViewSet(viewsets.ModelViewSet):
    """
    Full CRUD for tasks, plus complete/reopen actions.

    GET    /api/tasks/              — list tasks (filterable)
    POST   /api/tasks/              — create task
    GET    /api/tasks/{id}/         — task detail
    PUT    /api/tasks/{id}/         — full update
    PATCH  /api/tasks/{id}/         — partial update
    DELETE /api/tasks/{id}/         — delete task
    POST   /api/tasks/{id}/complete/ — mark completed
    POST   /api/tasks/{id}/reopen/   — reopen task
    GET    /api/tasks/reminders/due/ — check for due reminders
    """

    serializer_class = TaskSerializer
    lookup_field = 'id'
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['priority', 'deadline', 'scheduled_start', 'created_at']

    def get_queryset(self):
        """CRITICAL: Always scope to authenticated user."""
        qs = Task.objects.filter(user=self.request.user)

        # Optional filters via query params
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        priority_filter = self.request.query_params.get('priority')
        if priority_filter:
            qs = qs.filter(priority=priority_filter)

        date_filter = self.request.query_params.get('date')
        if date_filter:
            qs = qs.filter(scheduled_start__date=date_filter)

        return qs

    @action(detail=True, methods=['post'])
    def complete(self, request, id=None):
        """Mark a task as completed."""
        task = self.get_object()
        if task.status == Task.Status.COMPLETED:
            return Response(
                {'detail': 'Task is already completed.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        task.status = Task.Status.COMPLETED
        task.completed_at = timezone.now()
        task.save(update_fields=['status', 'completed_at', 'updated_at'])
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=['post'])
    def reopen(self, request, id=None):
        """Reopen a completed or cancelled task."""
        task = self.get_object()
        if task.status not in (Task.Status.COMPLETED, Task.Status.CANCELLED):
            return Response(
                {'detail': 'Task is not completed or cancelled.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        task.status = Task.Status.TODO
        task.completed_at = None
        task.save(update_fields=['status', 'completed_at', 'updated_at'])
        return Response(TaskSerializer(task).data)

    @action(detail=False, methods=['get'], url_path='reminders/due')
    def reminders_due(self, request):
        """
        Check for tasks that are due for a reminder right now.

        The backend is authoritative — this endpoint determines
        reminder eligibility using the ReminderEngine. The frontend
        should NOT decide "19:30 has arrived, therefore reminder is due."

        Idempotent: repeated calls will not produce duplicate reminders
        for the same task occurrence.

        Returns:
            {"reminders": [ReminderEvent, ...]}
        """
        engine = ReminderEngine()
        reminders = engine.check_due_reminders(request.user)
        return Response({'reminders': reminders})
