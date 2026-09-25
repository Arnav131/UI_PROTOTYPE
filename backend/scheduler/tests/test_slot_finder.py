from datetime import datetime, timedelta
from django.test import SimpleTestCase
from django.utils import timezone

from scheduler.engine import ScheduleBlock, TimeSlot, SlotFinder


class SlotFinderTests(SimpleTestCase):
    def setUp(self):
        # Use a fixed date for deterministic tests
        self.base = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        self.work_start = self.base + timedelta(hours=9)   # 09:00
        self.work_end = self.base + timedelta(hours=17)    # 17:00

    def test_empty_schedule(self):
        """No events -> entire working day is one free slot."""
        slots = SlotFinder.find_free_slots([], self.work_start, self.work_end)
        self.assertEqual(len(slots), 1)
        self.assertEqual(slots[0].start, self.work_start)
        self.assertEqual(slots[0].end, self.work_end)

    def test_one_event_in_middle(self):
        """Event from 12:00 to 13:00 -> two free slots: 9-12 and 13-17."""
        block = ScheduleBlock(
            task_id='1', title='Lunch',
            start=self.base + timedelta(hours=12),
            end=self.base + timedelta(hours=13),
            priority='MEDIUM', is_locked=True, is_flexible=False
        )
        slots = SlotFinder.find_free_slots([block], self.work_start, self.work_end)
        self.assertEqual(len(slots), 2)
        
        self.assertEqual(slots[0].start, self.work_start)
        self.assertEqual(slots[0].end, self.base + timedelta(hours=12))
        
        self.assertEqual(slots[1].start, self.base + timedelta(hours=13))
        self.assertEqual(slots[1].end, self.work_end)

    def test_multiple_events(self):
        """Multiple non-overlapping events."""
        blocks = [
            ScheduleBlock('1', 'A', self.base + timedelta(hours=10), self.base + timedelta(hours=11), 'LOW', False, True),
            ScheduleBlock('2', 'B', self.base + timedelta(hours=14), self.base + timedelta(hours=15), 'LOW', False, True),
        ]
        slots = SlotFinder.find_free_slots(blocks, self.work_start, self.work_end)
        
        self.assertEqual(len(slots), 3)
        self.assertEqual(slots[0].duration_minutes, 60)   # 9-10
        self.assertEqual(slots[1].duration_minutes, 180)  # 11-14
        self.assertEqual(slots[2].duration_minutes, 120)  # 15-17

    def test_adjacent_events(self):
        """Events touching each other should not leave gaps between them."""
        blocks = [
            ScheduleBlock('1', 'A', self.base + timedelta(hours=10), self.base + timedelta(hours=11), 'LOW', False, True),
            ScheduleBlock('2', 'B', self.base + timedelta(hours=11), self.base + timedelta(hours=12), 'LOW', False, True),
        ]
        slots = SlotFinder.find_free_slots(blocks, self.work_start, self.work_end)
        
        self.assertEqual(len(slots), 2)
        self.assertEqual(slots[0].duration_minutes, 60)   # 9-10
        self.assertEqual(slots[1].duration_minutes, 300)  # 12-17

    def test_overlapping_events(self):
        """Events that overlap should be merged into one occupied block."""
        blocks = [
            ScheduleBlock('1', 'A', self.base + timedelta(hours=10), self.base + timedelta(hours=12), 'LOW', False, True),
            ScheduleBlock('2', 'B', self.base + timedelta(hours=11), self.base + timedelta(hours=13), 'LOW', False, True),
        ]
        slots = SlotFinder.find_free_slots(blocks, self.work_start, self.work_end)
        
        self.assertEqual(len(slots), 2)
        self.assertEqual(slots[0].end, self.base + timedelta(hours=10))
        self.assertEqual(slots[1].start, self.base + timedelta(hours=13))

    def test_events_outside_working_hours(self):
        """Events before work_start or after work_end should be ignored or clamped."""
        blocks = [
            ScheduleBlock('1', 'Early', self.base + timedelta(hours=7), self.base + timedelta(hours=8), 'LOW', False, True),
            ScheduleBlock('2', 'Late', self.base + timedelta(hours=18), self.base + timedelta(hours=19), 'LOW', False, True),
        ]
        slots = SlotFinder.find_free_slots(blocks, self.work_start, self.work_end)
        self.assertEqual(len(slots), 1)
        self.assertEqual(slots[0].duration_minutes, 8 * 60) # 9-17 = 8 hours

    def test_events_overlapping_boundary(self):
        """Events that cross the work boundary are clamped."""
        blocks = [
            ScheduleBlock('1', 'Morning', self.base + timedelta(hours=8), self.base + timedelta(hours=10), 'LOW', False, True),
        ]
        slots = SlotFinder.find_free_slots(blocks, self.work_start, self.work_end)
        self.assertEqual(len(slots), 1)
        self.assertEqual(slots[0].start, self.base + timedelta(hours=10))
        self.assertEqual(slots[0].end, self.work_end)

    def test_fitting_slots_duration(self):
        """Only slots long enough are returned."""
        slots = [
            TimeSlot(self.base, self.base + timedelta(minutes=30)),
            TimeSlot(self.base + timedelta(hours=1), self.base + timedelta(hours=2)),
        ]
        fitting = SlotFinder.find_fitting_slots(slots, timedelta(minutes=45))
        self.assertEqual(len(fitting), 1)
        self.assertEqual(fitting[0].duration_minutes, 60)

    def test_fitting_slots_deadline(self):
        """Slots are clamped by deadline."""
        slots = [
            TimeSlot(self.base, self.base + timedelta(hours=2)),
        ]
        deadline = self.base + timedelta(hours=1, minutes=30)
        fitting = SlotFinder.find_fitting_slots(slots, timedelta(minutes=60), deadline=deadline)
        
        self.assertEqual(len(fitting), 1)
        self.assertEqual(fitting[0].end, deadline)
        self.assertEqual(fitting[0].duration_minutes, 90)

    def test_fitting_slots_deadline_too_tight(self):
        """If deadline makes slot too short, it's rejected."""
        slots = [
            TimeSlot(self.base, self.base + timedelta(hours=2)),
        ]
        deadline = self.base + timedelta(minutes=30)
        fitting = SlotFinder.find_fitting_slots(slots, timedelta(minutes=60), deadline=deadline)
        
        self.assertEqual(len(fitting), 0)
