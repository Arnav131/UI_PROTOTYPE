import logging
from datetime import datetime, timedelta, date, time
from django.utils import timezone

from tasks.models import Task
from users.models import UserPreferences
from .engine import (
    ScheduleBlock, TimeSlot, TaskRequest, ConflictReport,
    ScheduleProposal, SlotFinder, ConflictDetector, ProposalBuilder
)

logger = logging.getLogger('scheduler')


class SchedulerService:
    """
    Service layer bridging Django ORM with the pure SchedulingEngine.

    Responsibilities:
    - Enforce user isolation (always filter by user)
    - Map Django ORM models (Task, UserPreferences) to pure dataclasses
    - Invoke engine logic
    - Handle timezone bounds
    """

    @staticmethod
    def get_working_hours(user, target_date: date) -> tuple[datetime, datetime]:
        """Get the user's working hours as timezone-aware datetimes for a specific date."""
        prefs, _ = UserPreferences.objects.get_or_create(user=user)
        
        # User preferences time objects
        start_time = prefs.preferred_work_start
        end_time = prefs.preferred_work_end
        
        # Combine date and time
        dt_start = datetime.combine(target_date, start_time)
        dt_end = datetime.combine(target_date, end_time)
        
        # Make timezone-aware based on Django's timezone (USE_TZ=True means UTC internally,
        # but timezone.make_aware uses the current activated timezone)
        work_start = timezone.make_aware(dt_start)
        work_end = timezone.make_aware(dt_end)
        
        return work_start, work_end

    @staticmethod
    def _fetch_schedule_blocks(user, start_bound: datetime, end_bound: datetime) -> list[ScheduleBlock]:
        """Fetch tasks within bounds and map to ScheduleBlocks."""
        # Find tasks that overlap the bounds
        tasks = Task.objects.filter(
            user=user,
            status__in=[Task.Status.TODO, Task.Status.IN_PROGRESS],
            scheduled_start__isnull=False,
            scheduled_start__lt=end_bound
        ).exclude(
            scheduled_end__lte=start_bound
        )

        blocks = []
        for t in tasks:
            if not t.scheduled_end:
                # Fallback if scheduled_end is missing (though serializers enforce it)
                end = t.scheduled_start + (t.estimated_duration or timedelta(minutes=60))
            else:
                end = t.scheduled_end
                
            blocks.append(ScheduleBlock(
                task_id=str(t.id),
                title=t.title,
                start=t.scheduled_start,
                end=end,
                priority=t.priority,
                is_locked=t.is_locked,
                is_flexible=t.is_flexible,
            ))
        return blocks

    @staticmethod
    def get_free_slots(user, target_date: date) -> list[TimeSlot]:
        """Find free time slots for a given date."""
        work_start, work_end = SchedulerService.get_working_hours(user, target_date)
        
        # Expand bounds slightly to catch overlapping tasks
        start_bound = work_start - timedelta(hours=12)
        end_bound = work_end + timedelta(hours=12)
        
        blocks = SchedulerService._fetch_schedule_blocks(user, start_bound, end_bound)
        
        slots = SlotFinder.find_free_slots(blocks, work_start, work_end)
        return slots

    @staticmethod
    def check_conflicts_for_date(user, target_date: date) -> ConflictReport:
        """Detect any schedule conflicts on a specific date."""
        work_start, work_end = SchedulerService.get_working_hours(user, target_date)
        
        # Use full 24-hour day for conflict check
        day_start = work_start.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        blocks = SchedulerService._fetch_schedule_blocks(user, day_start, day_end)
        
        return ConflictDetector.detect_conflicts(blocks)

    @staticmethod
    def propose_schedule_for_task(user, task: Task) -> ScheduleProposal:
        """
        Generate a scheduling proposal for an existing un-scheduled task.
        """
        now = timezone.now()
        local_now = timezone.localtime(now)
        target_date = local_now.date()
        
        if task.deadline and timezone.localtime(task.deadline).date() >= target_date:
            target_date = timezone.localtime(task.deadline).date()
            
        work_start, work_end = SchedulerService.get_working_hours(user, target_date)
        
        # If it's today and time has passed, clamp work_start to NOW
        if target_date == local_now.date() and now > work_start:
            # Round up to next 15 mins for neatness
            mins = 15 * ((local_now.minute // 15) + 1)
            delta = timedelta(minutes=mins - local_now.minute, seconds=-local_now.second, microseconds=-local_now.microsecond)
            work_start = min(now + delta, work_end)

        # Get existing blocks
        start_bound = work_start - timedelta(hours=12)
        end_bound = work_end + timedelta(hours=12)
        blocks = SchedulerService._fetch_schedule_blocks(user, start_bound, end_bound)
        
        # Don't include the task itself in existing blocks if it already has a time
        blocks = [b for b in blocks if b.task_id != str(task.id)]

        prefs, _ = UserPreferences.objects.get_or_create(user=user)
        duration = task.estimated_duration or timedelta(minutes=prefs.default_task_duration)

        request = TaskRequest(
            task_id=str(task.id),
            title=task.title,
            duration=duration,
            priority=task.priority,
            deadline=task.deadline,
            preferred_time=task.preferred_time,
            is_flexible=task.is_flexible,
        )
        
        slots = SlotFinder.find_free_slots(blocks, work_start, work_end)

        return ProposalBuilder.create_proposal(request, blocks, work_start, work_end)

    @staticmethod
    def propose_schedule_for_new_task(user, task_data: dict) -> ScheduleProposal:
        """
        Generate a scheduling proposal for a hypothetical new task.
        Useful for "previewing" a schedule before creating the task.
        """
        now = timezone.now()
        local_now = timezone.localtime(now)
        deadline = task_data.get('deadline')
        
        target_date = local_now.date()
        if deadline:
            target_date = timezone.localtime(deadline).date()
            
        work_start, work_end = SchedulerService.get_working_hours(user, target_date)
        
        if target_date == local_now.date() and now > work_start:
            mins = 15 * ((local_now.minute // 15) + 1)
            delta = timedelta(minutes=mins - local_now.minute, seconds=-local_now.second, microseconds=-local_now.microsecond)
            work_start = min(now + delta, work_end)

        start_bound = work_start - timedelta(hours=12)
        end_bound = work_end + timedelta(hours=12)
        blocks = SchedulerService._fetch_schedule_blocks(user, start_bound, end_bound)
        
        prefs, _ = UserPreferences.objects.get_or_create(user=user)
        duration = task_data.get('estimated_duration')
        if not duration:
            duration = timedelta(minutes=prefs.default_task_duration)
            
        request = TaskRequest(
            task_id='preview_task',
            title=task_data.get('title', 'New Task'),
            duration=duration,
            priority=task_data.get('priority', 'MEDIUM'),
            deadline=deadline,
            preferred_time=task_data.get('preferred_time'),
            is_flexible=task_data.get('is_flexible', True),
        )

        return ProposalBuilder.create_proposal(request, blocks, work_start, work_end)
