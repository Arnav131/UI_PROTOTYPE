from datetime import datetime, timedelta, time as dt_time
from django.test import SimpleTestCase
from django.utils import timezone

from scheduler.engine import (
    TaskRequest, ScheduleBlock, ProposalBuilder, ProposalStatus, ProposalReason
)


class ProposalBuilderTests(SimpleTestCase):
    def setUp(self):
        self.base = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        self.work_start = self.base + timedelta(hours=9)
        self.work_end = self.base + timedelta(hours=17)

    def test_valid_slot_found(self):
        task = TaskRequest('1', 'New', timedelta(minutes=60), 'HIGH')
        proposal = ProposalBuilder.create_proposal(task, [], self.work_start, self.work_end)
        
        self.assertEqual(proposal.status, ProposalStatus.PROPOSED)
        self.assertEqual(proposal.proposed_start, self.work_start)
        self.assertEqual(proposal.reason, ProposalReason.EARLIEST_AVAILABLE_SLOT)
        self.assertEqual(len(proposal.reschedules), 0)

    def test_no_valid_slot_due_to_working_hours(self):
        # Requires 9 hours, only 8 hours available
        task = TaskRequest('1', 'New', timedelta(hours=9), 'HIGH')
        proposal = ProposalBuilder.create_proposal(task, [], self.work_start, self.work_end)
        
        self.assertEqual(proposal.status, ProposalStatus.NO_VALID_SLOT)
        self.assertEqual(proposal.reason, ProposalReason.ALL_SLOTS_OCCUPIED)

    def test_deadline_impossible(self):
        deadline = self.base + timedelta(hours=10) # 10:00
        # Takes 2 hours, but deadline is 1 hour after work_start
        task = TaskRequest('1', 'New', timedelta(hours=2), 'HIGH', deadline=deadline)
        proposal = ProposalBuilder.create_proposal(task, [], self.work_start, self.work_end)
        
        self.assertEqual(proposal.status, ProposalStatus.NO_VALID_SLOT)
        self.assertEqual(proposal.reason, ProposalReason.DEADLINE_IMPOSSIBLE)

    def test_reschedule_flexible_task(self):
        # Existing schedule: 9-10 is taken by LOW priority flexible task.
        blocks = [
            ScheduleBlock('2', 'Low', self.work_start, self.work_start + timedelta(hours=1), 'LOW', False, True)
        ]
        
        # New task: HIGH priority, deadline 10:00, needs 1 hour. MUST take 9-10 slot.
        task = TaskRequest('1', 'High', timedelta(hours=1), 'HIGH', deadline=self.work_start + timedelta(hours=1))
        
        proposal = ProposalBuilder.create_proposal(task, blocks, self.work_start, self.work_end)
        
        self.assertEqual(proposal.status, ProposalStatus.PROPOSED)
        self.assertEqual(proposal.proposed_start, self.work_start)
        self.assertEqual(proposal.reason, ProposalReason.MOVED_FLEXIBLE_TASK)
        
        # Check that task 2 was rescheduled
        self.assertEqual(len(proposal.reschedules), 1)
        self.assertEqual(proposal.reschedules[0].task_id, '2')
        self.assertEqual(proposal.reschedules[0].proposed_start, self.work_start + timedelta(hours=1))

    def test_locked_conflict(self):
        # Existing schedule: 9-10 is taken by LOCKED task.
        blocks = [
            ScheduleBlock('2', 'Locked', self.work_start, self.work_start + timedelta(hours=1), 'LOW', True, False)
        ]
        
        # New task: HIGH priority, deadline 10:00, needs 1 hour.
        # It wants 9-10, but it's locked.
        task = TaskRequest('1', 'High', timedelta(hours=1), 'HIGH', deadline=self.work_start + timedelta(hours=1))
        
        proposal = ProposalBuilder.create_proposal(task, blocks, self.work_start, self.work_end)
        
        # Should fail, locked cannot be moved.
        self.assertEqual(proposal.status, ProposalStatus.NO_VALID_SLOT)

    def test_optimal_start_with_preferred_time(self):
        # Free from 9-17
        # Preferred time 14:00
        task = TaskRequest('1', 'New', timedelta(hours=1), 'MEDIUM', preferred_time=dt_time(14, 0))
        proposal = ProposalBuilder.create_proposal(task, [], self.work_start, self.work_end)
        
        self.assertEqual(proposal.status, ProposalStatus.PROPOSED)
        self.assertEqual(proposal.proposed_start, self.base + timedelta(hours=14))
        self.assertEqual(proposal.reason, ProposalReason.PREFERRED_TIME_MATCH)
