"""
Scheduling Engine — Phase 3 core logic.

Pure, deterministic scheduling functions that operate on structured data.
No database queries, no side effects, no randomness, no AI.

Architecture:
    SchedulerService (services.py)
        → fetches data via ORM
        → converts to engine data structures
        → calls engine functions
        → returns structured results

    SchedulingEngine (this file)
        → pure functions on dataclasses
        → same input → same output
        → fully unit testable

Given the same input, always produces the same output.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, time as dt_time
from typing import List, Optional, Tuple

logger = logging.getLogger('scheduler')

# Priority weights for deterministic ranking (higher = more important)
PRIORITY_WEIGHTS = {
    'LOW': 1,
    'MEDIUM': 2,
    'HIGH': 3,
    'CRITICAL': 4,
}


# ============================================================
# Data Structures (Phase 3A)
# ============================================================

@dataclass(frozen=True)
class ScheduleBlock:
    """
    An existing event/task on the user's schedule.

    Represents a time-occupying block that the scheduler must respect.
    All datetime fields must be timezone-aware.
    """
    task_id: str
    title: str
    start: datetime
    end: datetime
    priority: str       # LOW, MEDIUM, HIGH, CRITICAL
    is_locked: bool
    is_flexible: bool


@dataclass(frozen=True)
class TimeSlot:
    """
    A free time slot on the schedule.

    Represents an available window where a task could be placed.
    """
    start: datetime
    end: datetime

    @property
    def duration(self) -> timedelta:
        return self.end - self.start

    @property
    def duration_minutes(self) -> int:
        return int(self.duration.total_seconds() / 60)


@dataclass(frozen=True)
class TaskRequest:
    """
    A task that needs to be scheduled.

    This is the input to the scheduling engine — a description of
    what needs to be placed on the schedule.
    """
    task_id: str
    title: str
    duration: timedelta
    priority: str       # LOW, MEDIUM, HIGH, CRITICAL
    deadline: Optional[datetime] = None
    preferred_time: Optional[dt_time] = None
    is_flexible: bool = True


@dataclass(frozen=True)
class Conflict:
    """A detected conflict between two schedule blocks."""
    task_a_id: str
    task_a_title: str
    task_b_id: str
    task_b_title: str
    overlap_start: datetime
    overlap_end: datetime

    @property
    def overlap_minutes(self) -> int:
        return int((self.overlap_end - self.overlap_start).total_seconds() / 60)


@dataclass(frozen=True)
class ConflictReport:
    """Result of conflict detection."""
    has_conflict: bool
    conflicts: Tuple[Conflict, ...] = ()


class ProposalStatus:
    """Status values for ScheduleProposal."""
    PROPOSED = 'PROPOSED'
    NO_VALID_SLOT = 'NO_VALID_SLOT'


class ProposalReason:
    """
    Machine-readable reasons for scheduling decisions.

    These are deterministic, structured reasons — NOT LLM-generated text.
    Later phases may use Gemini to convert these to natural language.
    """
    EARLIEST_AVAILABLE_SLOT = 'EARLIEST_AVAILABLE_SLOT'
    BEFORE_DEADLINE = 'BEFORE_DEADLINE'
    PREFERRED_TIME_MATCH = 'PREFERRED_TIME_MATCH'
    MOVED_FLEXIBLE_TASK = 'MOVED_FLEXIBLE_TASK'
    NO_VALID_SLOT = 'NO_VALID_SLOT'
    BLOCKED_BY_LOCKED_EVENT = 'BLOCKED_BY_LOCKED_EVENT'
    DEADLINE_IMPOSSIBLE = 'DEADLINE_IMPOSSIBLE'
    ALL_SLOTS_OCCUPIED = 'ALL_SLOTS_OCCUPIED'


@dataclass(frozen=True)
class RescheduleItem:
    """A flexible task that needs to move to accommodate a new task."""
    task_id: str
    title: str
    current_start: datetime
    current_end: datetime
    proposed_start: datetime
    proposed_end: datetime


@dataclass
class ScheduleProposal:
    """
    The output of the scheduling engine.

    Contains the scheduling decision, proposed times, and any
    reschedule items if flexible tasks need to move.
    """
    status: str                                     # ProposalStatus value
    task_id: str
    proposed_start: Optional[datetime] = None
    proposed_end: Optional[datetime] = None
    reason: str = ''                                # ProposalReason value
    reschedules: List[RescheduleItem] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Serialize to a plain dict for API responses."""
        return {
            'status': self.status,
            'task_id': self.task_id,
            'proposed_start': (
                self.proposed_start.isoformat() if self.proposed_start else None
            ),
            'proposed_end': (
                self.proposed_end.isoformat() if self.proposed_end else None
            ),
            'reason': self.reason,
            'reschedules': [
                {
                    'task_id': r.task_id,
                    'title': r.title,
                    'current_start': r.current_start.isoformat(),
                    'current_end': r.current_end.isoformat(),
                    'proposed_start': r.proposed_start.isoformat(),
                    'proposed_end': r.proposed_end.isoformat(),
                }
                for r in self.reschedules
            ],
        }


# ============================================================
# Phase 3B: Slot Finder
# ============================================================

class SlotFinder:
    """Finds available time slots in a user's schedule."""

    @staticmethod
    def find_free_slots(
        blocks: List[ScheduleBlock],
        work_start: datetime,
        work_end: datetime,
    ) -> List[TimeSlot]:
        """
        Find free time slots between work_start and work_end,
        excluding time occupied by existing blocks.

        Handles overlapping blocks by merging occupied intervals.
        Returns slots sorted by start time.

        Args:
            blocks: Existing schedule blocks (may overlap).
            work_start: Start of working hours (timezone-aware).
            work_end: End of working hours (timezone-aware).

        Returns:
            List of free TimeSlots, sorted by start time.
        """
        if work_end <= work_start:
            return []

        # Collect occupied intervals, clamped to working hours
        occupied = []
        for b in blocks:
            if b.end > work_start and b.start < work_end:
                occupied.append((
                    max(b.start, work_start),
                    min(b.end, work_end),
                ))

        # Sort by start time
        occupied.sort()

        # Merge overlapping/adjacent intervals
        merged = []
        for start, end in occupied:
            if merged and start <= merged[-1][1]:
                merged[-1] = (merged[-1][0], max(merged[-1][1], end))
            else:
                merged.append((start, end))

        # Find gaps between merged intervals
        slots = []
        current = work_start
        for occ_start, occ_end in merged:
            if current < occ_start:
                slots.append(TimeSlot(start=current, end=occ_start))
            current = max(current, occ_end)

        if current < work_end:
            slots.append(TimeSlot(start=current, end=work_end))

        logger.debug(
            'SlotFinder: found %d free slots between %s and %s',
            len(slots), work_start.isoformat(), work_end.isoformat(),
        )
        return slots

    @staticmethod
    def find_fitting_slots(
        free_slots: List[TimeSlot],
        duration: timedelta,
        deadline: Optional[datetime] = None,
    ) -> List[TimeSlot]:
        """
        Filter free slots that can fit the given task duration.

        If deadline is specified, only returns slots where the task
        can start and finish before the deadline.

        Args:
            free_slots: Available time slots.
            duration: Required task duration.
            deadline: Optional deadline (task must finish by this time).

        Returns:
            List of slots where the task can fit.
        """
        result = []
        for slot in free_slots:
            effective_end = slot.end
            if deadline:
                effective_end = min(slot.end, deadline)

            available = effective_end - slot.start
            if available >= duration:
                result.append(TimeSlot(start=slot.start, end=effective_end))

        return result


# ============================================================
# Phase 3C: Conflict Detector
# ============================================================

class ConflictDetector:
    """Detects scheduling conflicts between events."""

    @staticmethod
    def detect_conflicts(blocks: List[ScheduleBlock]) -> ConflictReport:
        """
        Detect all pairwise conflicts among schedule blocks.

        Rules:
        - Exact overlap → CONFLICT
        - Partial overlap → CONFLICT
        - Containment → CONFLICT
        - Adjacent (A ends at 19:00, B starts at 19:00) → NOT a conflict

        Overlap requires overlap_end > overlap_start (strict inequality).

        Returns:
            ConflictReport with all detected conflicts.
        """
        if len(blocks) < 2:
            return ConflictReport(has_conflict=False, conflicts=())

        sorted_blocks = sorted(blocks, key=lambda b: b.start)
        conflicts = []

        for i in range(len(sorted_blocks)):
            for j in range(i + 1, len(sorted_blocks)):
                a = sorted_blocks[i]
                b = sorted_blocks[j]

                # Since sorted by start, if b starts at or after a ends,
                # no overlap with a (and all subsequent blocks)
                if b.start >= a.end:
                    break

                overlap_start = max(a.start, b.start)
                overlap_end = min(a.end, b.end)

                if overlap_end > overlap_start:
                    conflicts.append(Conflict(
                        task_a_id=a.task_id,
                        task_a_title=a.title,
                        task_b_id=b.task_id,
                        task_b_title=b.title,
                        overlap_start=overlap_start,
                        overlap_end=overlap_end,
                    ))

        return ConflictReport(
            has_conflict=len(conflicts) > 0,
            conflicts=tuple(conflicts),
        )

    @staticmethod
    def check_task_conflicts(
        new_start: datetime,
        new_end: datetime,
        task_id: str,
        task_title: str,
        existing_blocks: List[ScheduleBlock],
    ) -> ConflictReport:
        """
        Check if placing a task at the given time conflicts with existing blocks.

        Args:
            new_start: Proposed start time.
            new_end: Proposed end time.
            task_id: ID of the new task.
            task_title: Title of the new task.
            existing_blocks: Current schedule blocks.

        Returns:
            ConflictReport for the new task against existing blocks.
        """
        conflicts = []
        for block in existing_blocks:
            overlap_start = max(new_start, block.start)
            overlap_end = min(new_end, block.end)

            if overlap_end > overlap_start:
                conflicts.append(Conflict(
                    task_a_id=task_id,
                    task_a_title=task_title,
                    task_b_id=block.task_id,
                    task_b_title=block.title,
                    overlap_start=overlap_start,
                    overlap_end=overlap_end,
                ))

        return ConflictReport(
            has_conflict=len(conflicts) > 0,
            conflicts=tuple(conflicts),
        )


# ============================================================
# Phase 3D: Constraint Evaluator
# ============================================================

class ConstraintEvaluator:
    """
    Evaluates hard and soft constraints for scheduling decisions.

    Hard constraints (NEVER violated):
    - Slot must be large enough for task duration
    - Task must finish by deadline
    - Task must not overlap with locked events

    Soft constraints (influence ranking):
    - Preferred time (sort by proximity)
    - Earlier slot preference (default)
    """

    @staticmethod
    def check_hard_constraints(
        task: TaskRequest,
        slot: TimeSlot,
        existing_blocks: List[ScheduleBlock],
    ) -> Tuple[bool, str]:
        """
        Check if placing task at slot.start violates any hard constraint.

        The task is assumed to start at slot.start and end at
        slot.start + task.duration.

        Returns:
            (passes, reason_if_failed)
        """
        task_end = slot.start + task.duration

        # 1. Duration must fit in slot
        if slot.duration < task.duration:
            return False, 'SLOT_TOO_SHORT'

        # 2. Deadline must be respected
        if task.deadline and task_end > task.deadline:
            return False, 'EXCEEDS_DEADLINE'

        # 3. No overlap with locked events
        for block in existing_blocks:
            if block.is_locked:
                overlap_start = max(slot.start, block.start)
                overlap_end = min(task_end, block.end)
                if overlap_end > overlap_start:
                    return False, 'CONFLICTS_WITH_LOCKED_EVENT'

        return True, 'OK'

    @staticmethod
    def rank_slots(
        task: TaskRequest,
        slots: List[TimeSlot],
        existing_blocks: List[ScheduleBlock],
    ) -> List[Tuple[TimeSlot, str]]:
        """
        Rank valid slots deterministically, best first.

        Ranking strategy:
        1. Filter out slots that violate hard constraints
        2. If preferred_time set: sort by proximity to preferred time
        3. Otherwise: sort by earliest start time
        4. Assign machine-readable reason to each slot

        Same input → same output. No randomness.

        Returns:
            List of (slot, reason) tuples, best first.
        """
        # Filter by hard constraints
        valid = []
        for slot in slots:
            passes, _ = ConstraintEvaluator.check_hard_constraints(
                task, slot, existing_blocks,
            )
            if passes:
                valid.append(slot)

        if not valid:
            return []

        # Sort deterministically
        if task.preferred_time:
            def sort_key(s):
                pref_dt = s.start.replace(
                    hour=task.preferred_time.hour,
                    minute=task.preferred_time.minute,
                    second=0,
                    microsecond=0
                )
                
                # Find best start time within this slot for the preferred time
                if pref_dt >= s.start and pref_dt + task.duration <= s.end:
                    optimal = pref_dt
                elif pref_dt < s.start:
                    optimal = s.start
                else:
                    optimal = s.end - task.duration
                    
                dist = abs((optimal - pref_dt).total_seconds())
                return (dist, s.start)

            valid.sort(key=sort_key)
        else:
            # Default: earliest slot first
            valid.sort(key=lambda s: s.start)

        # Assign machine-readable reasons
        result = []
        for i, slot in enumerate(valid):
            reason = ConstraintEvaluator._determine_reason(
                task, slot, is_top=(i == 0),
            )
            result.append((slot, reason))

        return result

    @staticmethod
    def _determine_reason(
        task: TaskRequest,
        slot: TimeSlot,
        is_top: bool,
    ) -> str:
        """Determine the machine-readable reason for selecting this slot."""
        if task.preferred_time and is_top:
            pref_dt = slot.start.replace(
                hour=task.preferred_time.hour,
                minute=task.preferred_time.minute,
                second=0,
                microsecond=0
            )
            if pref_dt >= slot.start and pref_dt + task.duration <= slot.end:
                optimal = pref_dt
            elif pref_dt < slot.start:
                optimal = slot.start
            else:
                optimal = slot.end - task.duration
                
            dist = abs((optimal - pref_dt).total_seconds())
            if dist <= 3600:
                return ProposalReason.PREFERRED_TIME_MATCH

        if task.deadline:
            return ProposalReason.BEFORE_DEADLINE

        return ProposalReason.EARLIEST_AVAILABLE_SLOT


# ============================================================
# Phase 3E: Proposal Builder
# ============================================================

class ProposalBuilder:
    """
    Builds schedule proposals by combining all engine components.

    Pipeline:
    1. Find free slots in working hours (SlotFinder)
    2. Filter slots that fit the task (SlotFinder)
    3. Rank valid slots (ConstraintEvaluator)
    4. If no direct slot, try rescheduling flexible tasks
    5. Return proposal (PROPOSED or NO_VALID_SLOT)
    """

    @staticmethod
    def create_proposal(
        task: TaskRequest,
        existing_blocks: List[ScheduleBlock],
        work_start: datetime,
        work_end: datetime,
    ) -> ScheduleProposal:
        """
        Create a scheduling proposal for the given task.

        This is the main entry point for the scheduling engine.

        Args:
            task: The task to schedule.
            existing_blocks: Current schedule blocks.
            work_start: Start of working hours.
            work_end: End of working hours.

        Returns:
            ScheduleProposal with status, times, and reason.
        """
        logger.info(
            'Creating proposal: task=%s title="%s" duration=%s priority=%s',
            task.task_id, task.title, task.duration, task.priority,
        )

        # Step 1-2: Find and filter slots
        free_slots = SlotFinder.find_free_slots(
            existing_blocks, work_start, work_end,
        )
        fitting = SlotFinder.find_fitting_slots(
            free_slots, task.duration, task.deadline,
        )

        # Step 3: Rank valid slots
        ranked = ConstraintEvaluator.rank_slots(
            task, fitting, existing_blocks,
        )

        if ranked:
            best_slot, reason = ranked[0]
            start = ProposalBuilder._optimal_start(task, best_slot)

            logger.info(
                'Proposal PROPOSED: task=%s start=%s reason=%s',
                task.task_id, start.isoformat(), reason,
            )
            return ScheduleProposal(
                status=ProposalStatus.PROPOSED,
                task_id=task.task_id,
                proposed_start=start,
                proposed_end=start + task.duration,
                reason=reason,
            )

        # Step 4: Try rescheduling flexible tasks
        logger.info(
            'No direct slot for task=%s, attempting flexible reschedule',
            task.task_id,
        )
        proposal = ProposalBuilder._try_reschedule_flexible(
            task, existing_blocks, work_start, work_end,
        )
        if proposal:
            return proposal

        # Step 5: No valid slot found
        if task.deadline and task.deadline <= work_end:
            reason = ProposalReason.DEADLINE_IMPOSSIBLE
        else:
            reason = ProposalReason.ALL_SLOTS_OCCUPIED

        logger.info(
            'No valid slot for task=%s reason=%s', task.task_id, reason,
        )
        return ScheduleProposal(
            status=ProposalStatus.NO_VALID_SLOT,
            task_id=task.task_id,
            reason=reason,
        )

    @staticmethod
    def _optimal_start(task: TaskRequest, slot: TimeSlot) -> datetime:
        """
        Determine the optimal start time within a slot.

        If preferred_time is set and fits within the slot (including
        deadline), use it. Otherwise, use slot.start (earliest).
        """
        if task.preferred_time:
            preferred_dt = slot.start.replace(
                hour=task.preferred_time.hour,
                minute=task.preferred_time.minute,
                second=0,
                microsecond=0,
            )
            if (preferred_dt >= slot.start
                    and preferred_dt + task.duration <= slot.end):
                if (task.deadline is None
                        or preferred_dt + task.duration <= task.deadline):
                    return preferred_dt

        return slot.start

    @staticmethod
    def _try_reschedule_flexible(
        task: TaskRequest,
        existing_blocks: List[ScheduleBlock],
        work_start: datetime,
        work_end: datetime,
    ) -> Optional[ScheduleProposal]:
        """
        Try to free up space by moving a SINGLE flexible (non-locked) task.

        Rules:
        - Only move tasks with STRICTLY lower priority than the new task
        - Never move locked tasks
        - The moved task must also have a valid new slot
        - Sort candidates by priority ascending (move lowest priority first)

        Returns:
            ScheduleProposal if reschedule is possible, None otherwise.
        """
        flexible = [
            b for b in existing_blocks
            if b.is_flexible and not b.is_locked
        ]

        if not flexible:
            return None

        task_weight = PRIORITY_WEIGHTS.get(task.priority, 2)

        # Sort: lowest priority first (most movable), then by start time
        flexible.sort(
            key=lambda b: (PRIORITY_WEIGHTS.get(b.priority, 2), b.start),
        )

        for candidate in flexible:
            candidate_weight = PRIORITY_WEIGHTS.get(candidate.priority, 2)

            # Don't move equal or higher priority tasks
            if candidate_weight >= task_weight:
                continue

            # Simulate removing the candidate
            remaining = [
                b for b in existing_blocks
                if b.task_id != candidate.task_id
            ]

            # Can the new task fit now?
            free_slots = SlotFinder.find_free_slots(
                remaining, work_start, work_end,
            )
            fitting = SlotFinder.find_fitting_slots(
                free_slots, task.duration, task.deadline,
            )
            ranked = ConstraintEvaluator.rank_slots(
                task, fitting, remaining,
            )

            if not ranked:
                continue

            best_slot, _ = ranked[0]
            new_task_start = ProposalBuilder._optimal_start(task, best_slot)

            # Now find a new slot for the displaced candidate
            candidate_duration = candidate.end - candidate.start
            new_task_block = ScheduleBlock(
                task_id=task.task_id,
                title=task.title,
                start=new_task_start,
                end=new_task_start + task.duration,
                priority=task.priority,
                is_locked=False,
                is_flexible=task.is_flexible,
            )
            after_blocks = remaining + [new_task_block]

            after_free = SlotFinder.find_free_slots(
                after_blocks, work_start, work_end,
            )
            after_fitting = SlotFinder.find_fitting_slots(
                after_free, candidate_duration,
            )

            if not after_fitting:
                continue

            # Found valid slots for both tasks
            new_candidate_slot = after_fitting[0]

            logger.info(
                'Reschedule: moving "%s" (%s) from %s→%s to %s→%s '
                'to accommodate "%s" (%s)',
                candidate.title, candidate.task_id,
                candidate.start.isoformat(), candidate.end.isoformat(),
                new_candidate_slot.start.isoformat(),
                (new_candidate_slot.start + candidate_duration).isoformat(),
                task.title, task.task_id,
            )

            return ScheduleProposal(
                status=ProposalStatus.PROPOSED,
                task_id=task.task_id,
                proposed_start=new_task_start,
                proposed_end=new_task_start + task.duration,
                reason=ProposalReason.MOVED_FLEXIBLE_TASK,
                reschedules=[RescheduleItem(
                    task_id=candidate.task_id,
                    title=candidate.title,
                    current_start=candidate.start,
                    current_end=candidate.end,
                    proposed_start=new_candidate_slot.start,
                    proposed_end=new_candidate_slot.start + candidate_duration,
                )],
            )

        return None
