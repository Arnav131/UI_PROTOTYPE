"""
User-related models.

Uses Django's built-in User model. Extends with UserPreferences for
productivity-specific settings like working hours, timezone, and
assistant preferences.
"""

from datetime import time
from django.db import models
from django.conf import settings


class UserPreferences(models.Model):
    """Structured user preferences stored in PostgreSQL — no vector DB needed."""

    TONE_CHOICES = [
        ('friendly', 'Friendly'),
        ('formal', 'Formal'),
        ('casual', 'Casual'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='preferences'
    )
    timezone = models.CharField(max_length=50, default='Asia/Kolkata')

    # Working hours
    preferred_work_start = models.TimeField(default=time(9, 0))
    preferred_work_end = models.TimeField(default=time(22, 0))

    # Sleep schedule
    sleep_start = models.TimeField(default=time(23, 0))
    sleep_end = models.TimeField(default=time(7, 0))

    # Task defaults
    default_task_duration = models.IntegerField(
        default=60,
        help_text='Default task duration in minutes'
    )

    # Scheduling
    auto_reschedule = models.BooleanField(
        default=False,
        help_text='Allow AI to auto-reschedule flexible tasks without confirmation'
    )

    # Assistant personality
    assistant_tone = models.CharField(
        max_length=20,
        choices=TONE_CHOICES,
        default='friendly'
    )

    class Meta:
        verbose_name_plural = 'User preferences'

    def __str__(self):
        return f'Preferences for {self.user.username}'
