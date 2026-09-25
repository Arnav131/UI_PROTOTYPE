from datetime import datetime, timedelta
from django.test import SimpleTestCase
from django.utils import timezone

from scheduler.engine import ScheduleBlock, ConflictDetector


class ConflictDetectorTests(SimpleTestCase):
    def setUp(self):
        self.base = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

    def _block(self, id, start_hr, end_hr):
        return ScheduleBlock(
            task_id=id, title=f'Task {id}',
            start=self.base + timedelta(hours=start_hr),
            end=self.base + timedelta(hours=end_hr),
            priority='LOW', is_locked=False, is_flexible=True
        )

    def test_no_conflicts_empty(self):
        report = ConflictDetector.detect_conflicts([])
        self.assertFalse(report.has_conflict)

    def test_no_conflicts_single(self):
        blocks = [self._block('1', 9, 10)]
        report = ConflictDetector.detect_conflicts(blocks)
        self.assertFalse(report.has_conflict)

    def test_exact_overlap(self):
        blocks = [self._block('1', 9, 10), self._block('2', 9, 10)]
        report = ConflictDetector.detect_conflicts(blocks)
        self.assertTrue(report.has_conflict)
        self.assertEqual(len(report.conflicts), 1)
        self.assertEqual(report.conflicts[0].overlap_minutes, 60)

    def test_partial_overlap(self):
        blocks = [self._block('1', 9, 10), self._block('2', 9.5, 10.5)]
        report = ConflictDetector.detect_conflicts(blocks)
        self.assertTrue(report.has_conflict)
        self.assertEqual(len(report.conflicts), 1)
        self.assertEqual(report.conflicts[0].overlap_minutes, 30)

    def test_containment(self):
        blocks = [self._block('1', 9, 11), self._block('2', 9.5, 10.5)]
        report = ConflictDetector.detect_conflicts(blocks)
        self.assertTrue(report.has_conflict)
        self.assertEqual(len(report.conflicts), 1)
        self.assertEqual(report.conflicts[0].overlap_minutes, 60)

    def test_adjacent_events(self):
        blocks = [self._block('1', 9, 10), self._block('2', 10, 11)]
        report = ConflictDetector.detect_conflicts(blocks)
        self.assertFalse(report.has_conflict)

    def test_multiple_conflicts(self):
        blocks = [
            self._block('1', 9, 11),
            self._block('2', 10, 12),
            self._block('3', 10.5, 11.5)
        ]
        report = ConflictDetector.detect_conflicts(blocks)
        self.assertTrue(report.has_conflict)
        # 1 overlaps 2 (1hr), 1 overlaps 3 (0.5hr), 2 overlaps 3 (1hr)
        self.assertEqual(len(report.conflicts), 3)

    def test_check_task_conflicts(self):
        blocks = [self._block('1', 10, 12)]
        
        # Non-overlapping
        r1 = ConflictDetector.check_task_conflicts(
            self.base + timedelta(hours=8), self.base + timedelta(hours=9),
            'new', 'New', blocks
        )
        self.assertFalse(r1.has_conflict)
        
        # Overlapping
        r2 = ConflictDetector.check_task_conflicts(
            self.base + timedelta(hours=11), self.base + timedelta(hours=13),
            'new', 'New', blocks
        )
        self.assertTrue(r2.has_conflict)
        self.assertEqual(r2.conflicts[0].overlap_minutes, 60)
