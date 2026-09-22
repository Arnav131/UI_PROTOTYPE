"""
Reminder engine — the core detection logic for Phase 2A.

Determines which tasks are due for a reminder RIGHT NOW.

Architecture:
    DATABASE → TASK DATA → TIME PROVIDER → REMINDER ENGINE → REMINDER EVENT

This module is ONLY responsible for detection, not presentation.
It must NOT know about React UI, browser notifications, speech,
Gemini, TTS, or any UI component.

Idempotency:
    Each task is reminded at most once per scheduled occurrence.
    Tracked via Task.last_reminded_at >= Task.scheduled_start.

Missed Task Policy:
    - Task <= 15 minutes past scheduled_start → TASK_STARTING_NOW
    - Task > 15 minutes past scheduled_start → TASK_MISSED
    Both generate a single reminder event. No automatic rescheduling.

User Isolation:
    The engine receives the authenticated user object from the view layer
    and ALWAYS filters by user. Never trusts frontend-provided user IDs.
"""

import logging
from datetime import timedelta

from .models import Task
from .time_provider import TimeProvider, RealTimeProvider

logger = logging.getLogger('reminders')

# Tasks more than this many minutes past their scheduled_start
# are classified as MISSED rather than STARTING_NOW.
MISSED_WINDOW_MINUTES = 15


class ReminderEvent:
    """
    Structured reminder event returned by the engine.

    Attributes:
        event_type: 'TASK_STARTING_NOW' or 'TASK_MISSED'
        task_id: UUID of the task
        task_title: Human-readable task title
        scheduled_time: The task's scheduled_start as ISO string
    """

    EVENT_STARTING_NOW = 'TASK_STARTING_NOW'
    EVENT_MISSED = 'TASK_MISSED'

    def __init__(self, event_type, task_id, task_title, scheduled_time):
        self.event_type = event_type
        self.task_id = task_id
        self.task_title = task_title
        self.scheduled_time = scheduled_time

    def to_dict(self):
        """Serialize to a plain dict for API responses."""
        return {
            'event_type': self.event_type,
            'task_id': str(self.task_id),
            'task_title': self.task_title,
            'scheduled_time': self.scheduled_time.isoformat() if hasattr(self.scheduled_time, 'isoformat') else str(self.scheduled_time),
        }


class ReminderEngine:
    """
    Core reminder detection engine.

    Determines which of a user's tasks are due for a reminder at the
    current time, emits ReminderEvent objects, and marks tasks as
    reminded to ensure idempotency.

    Usage:
        engine = ReminderEngine()  # uses RealTimeProvider
        events = engine.check_due_reminders(user)
    """

    # Only tasks in these statuses are eligible for reminders
    ELIGIBLE_STATUSES = [Task.Status.TODO, Task.Status.IN_PROGRESS]

    def __init__(self, time_provider=None):
        """
        Args:
            time_provider: A TimeProvider instance. Defaults to RealTimeProvider.
        """
        self.time_provider = time_provider or RealTimeProvider()

    def check_due_reminders(self, user):
        """
        Check for tasks that need a reminder right now.

        Args:
            user: The authenticated Django User object.

        Returns:
            list[dict]: A list of ReminderEvent dicts for newly-due tasks.
                        Empty list if nothing is due.
        """
        now = self.time_provider.now()
        logger.info('[ReminderEngine] Checking due tasks for user=%s at %s', user.username, now.isoformat())

        try:
            due_tasks = self._query_eligible_tasks(user, now)
        except Exception:
            logger.exception('[ReminderEngine] Error querying eligible tasks')
            return []

        events = []
        for task in due_tasks:
            try:
                event = self._process_task(task, now)
                if event:
                    events.append(event)
            except Exception:
                logger.exception('[ReminderEngine] Error processing task %s', task.id)
                # Continue processing other tasks — one failure must not block others

        if not events:
            logger.info('[ReminderEngine] No due tasks')
        else:
            logger.info('[ReminderEngine] Found %d due task(s)', len(events))

        return [e.to_dict() for e in events]

    def _query_eligible_tasks(self, user, now):
        """
        Query tasks that are candidates for reminders.

        Uses database-level filtering for performance:
        - Owned by this user
        - Status is TODO or IN_PROGRESS
        - Has a scheduled_start
        - scheduled_start is <= now (i.e., time has arrived or passed)
        - NOT already reminded for this occurrence
        """
        return Task.objects.filter(
            user=user,
            status__in=self.ELIGIBLE_STATUSES,
            scheduled_start__isnull=False,
            scheduled_start__lte=now,
        ).exclude(
            # Exclude tasks that have already been reminded for this scheduled occurrence.
            # A task's last_reminded_at >= its scheduled_start means a reminder was
            # already emitted for this particular schedule.
            last_reminded_at__gte=models.F('scheduled_start'),
        ).select_related()  # Avoid N+1 if we ever add relations

    def _process_task(self, task, now):
        """
        Process a single eligible task and determine its reminder event type.

        Args:
            task: A Task instance that passed the eligibility query.
            now: Current timezone-aware datetime.

        Returns:
            ReminderEvent or None if the task should be skipped.
        """
        elapsed = now - task.scheduled_start
        missed_threshold = timedelta(minutes=MISSED_WINDOW_MINUTES)

        if elapsed > missed_threshold:
            event_type = ReminderEvent.EVENT_MISSED
            logger.info('[ReminderEngine] Task %s ("%s") is MISSED (elapsed=%s)', task.id, task.title, elapsed)
        else:
            event_type = ReminderEvent.EVENT_STARTING_NOW
            logger.info('[ReminderEngine] Task %s ("%s") is STARTING_NOW', task.id, task.title)

        # Mark as reminded — this is the idempotency mechanism
        task.last_reminded_at = now
        task.save(update_fields=['last_reminded_at', 'updated_at'])

        return ReminderEvent(
            event_type=event_type,
            task_id=task.id,
            task_title=task.title,
            scheduled_time=task.scheduled_start,
        )


# Import models.F for the exclude query
from django.db import models
