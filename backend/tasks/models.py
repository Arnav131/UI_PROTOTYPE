"""
Task model — the core data structure for the productivity system.

Supports priorities, deadlines, scheduling, duration estimation,
locked/flexible distinction, and goal association.
"""

import uuid
from django.db import models
from django.conf import settings


class Task(models.Model):
    """A user's task with scheduling and priority metadata."""

    class Priority(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'
        CRITICAL = 'CRITICAL', 'Critical'

    class Status(models.TextChoices):
        TODO = 'TODO', 'To Do'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Ownership — every query MUST filter by this
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='tasks'
    )

    # Core fields
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    notes = models.TextField(blank=True, default='')

    # Status and priority
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.TODO
    )
    priority = models.CharField(
        max_length=10,
        choices=Priority.choices,
        default=Priority.MEDIUM
    )

    # Time constraints
    deadline = models.DateTimeField(null=True, blank=True)
    scheduled_start = models.DateTimeField(null=True, blank=True)
    scheduled_end = models.DateTimeField(null=True, blank=True)
    estimated_duration = models.DurationField(
        null=True, blank=True,
        help_text='Estimated duration as a timedelta'
    )
    preferred_time = models.TimeField(
        null=True, blank=True,
        help_text='Preferred time of day for this task'
    )

    # Scheduling behavior
    is_locked = models.BooleanField(
        default=False,
        help_text='Locked tasks cannot be automatically moved by the scheduler'
    )
    is_flexible = models.BooleanField(
        default=True,
        help_text='Flexible tasks can be moved to resolve conflicts'
    )

    # Goal association (optional)
    goal = models.ForeignKey(
        'goals.Goal',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='tasks'
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-priority', 'scheduled_start', '-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['user', 'scheduled_start']),
            models.Index(fields=['user', 'deadline']),
        ]

    def __str__(self):
        return f'{self.title} ({self.status})'

    @property
    def is_overdue(self):
        """Check if task is past deadline and not completed."""
        from django.utils import timezone
        if self.deadline and self.status not in (self.Status.COMPLETED, self.Status.CANCELLED):
            return timezone.now() > self.deadline
        return False
