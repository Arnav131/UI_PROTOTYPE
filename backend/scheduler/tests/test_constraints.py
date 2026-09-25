from datetime import datetime, timedelta, time as dt_time
from django.test import SimpleTestCase
from django.utils import timezone

from scheduler.engine import (
    TaskRequest, TimeSlot, ScheduleBlock, ConstraintEvaluator, ProposalReason
)


class ConstraintEvaluatorTests(SimpleTestCase):
    def setUp(self):
        self.base = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

    def test_hard_constraint_duration(self):
        task = TaskRequest('1', 'A', timedelta(minutes=60), 'LOW')
        slot = TimeSlot(self.base, self.base + timedelta(minutes=45))
        passes, reason = ConstraintEvaluator.check_hard_constraints(task, slot, [])
        self.assertFalse(passes)
        self.assertEqual(reason, 'SLOT_TOO_SHORT')

    def test_hard_constraint_deadline(self):
        deadline = self.base + timedelta(hours=1)
        task = TaskRequest('1', 'A', timedelta(minutes=60), 'LOW', deadline=deadline)
        
        # Starts 30 mins before deadline, ends 30 mins after -> fails
        slot = TimeSlot(self.base + timedelta(minutes=30), self.base + timedelta(hours=2))
        passes, reason = ConstraintEvaluator.check_hard_constraints(task, slot, [])
        self.assertFalse(passes)
        self.assertEqual(reason, 'EXCEEDS_DEADLINE')
        
        # Starts on time -> passes
        slot2 = TimeSlot(self.base, self.base + timedelta(hours=2))
        passes2, _ = ConstraintEvaluator.check_hard_constraints(task, slot2, [])
        self.assertTrue(passes2)

    def test_hard_constraint_locked_conflict(self):
        task = TaskRequest('1', 'A', timedelta(minutes=60), 'LOW')
        slot = TimeSlot(self.base, self.base + timedelta(hours=2))
        
        locked_block = ScheduleBlock(
            '2', 'L', self.base + timedelta(minutes=30), self.base + timedelta(hours=1),
            'HIGH', is_locked=True, is_flexible=False
        )
        
        passes, reason = ConstraintEvaluator.check_hard_constraints(task, slot, [locked_block])
        self.assertFalse(passes)
        self.assertEqual(reason, 'CONFLICTS_WITH_LOCKED_EVENT')

    def test_rank_slots_earliest_first(self):
        task = TaskRequest('1', 'A', timedelta(minutes=60), 'LOW')
        slots = [
            TimeSlot(self.base + timedelta(hours=12), self.base + timedelta(hours=14)),
            TimeSlot(self.base + timedelta(hours=9), self.base + timedelta(hours=11)),
        ]
        
        ranked = ConstraintEvaluator.rank_slots(task, slots, [])
        self.assertEqual(len(ranked), 2)
        self.assertEqual(ranked[0][0].start, self.base + timedelta(hours=9))
        self.assertEqual(ranked[1][0].start, self.base + timedelta(hours=12))
        self.assertEqual(ranked[0][1], ProposalReason.EARLIEST_AVAILABLE_SLOT)

    def test_rank_slots_preferred_time(self):
        # Preferred 14:00
        task = TaskRequest('1', 'A', timedelta(minutes=60), 'LOW', preferred_time=dt_time(14, 0))
        slots = [
            TimeSlot(self.base + timedelta(hours=9), self.base + timedelta(hours=11)),
            TimeSlot(self.base + timedelta(hours=13, minutes=30), self.base + timedelta(hours=15)), # Closer
        ]
        
        ranked = ConstraintEvaluator.rank_slots(task, slots, [])
        self.assertEqual(ranked[0][0].start, self.base + timedelta(hours=13, minutes=30))
        self.assertEqual(ranked[0][1], ProposalReason.PREFERRED_TIME_MATCH)
