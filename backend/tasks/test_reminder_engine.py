"""
Tests for Phase 2A — Reminder Engine.

These tests verify the complete reminder detection flow:
TimeProvider → ReminderEngine → Idempotency → ReminderEvent

All tests use FakeTimeProvider for deterministic time control.
No external services, no mocking of unrelated systems.
"""

from datetime import timedelta

from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Task
from .time_provider import FakeTimeProvider, RealTimeProvider
from .reminder_engine import ReminderEngine, MISSED_WINDOW_MINUTES


class TimeProviderTest(TestCase):
    """Test the TimeProvider abstraction itself."""

    def test_real_time_provider_returns_aware_datetime(self):
        provider = RealTimeProvider()
        now = provider.now()
        self.assertIsNotNone(now.tzinfo)

    def test_fake_time_provider_returns_fixed_time(self):
        fixed = timezone.now()
        provider = FakeTimeProvider(fixed)
        self.assertEqual(provider.now(), fixed)

    def test_fake_time_provider_advance(self):
        fixed = timezone.now()
        provider = FakeTimeProvider(fixed)
        provider.advance(minutes=5)
        self.assertEqual(provider.now(), fixed + timedelta(minutes=5))

    def test_fake_time_provider_set_time(self):
        t1 = timezone.now()
        t2 = t1 + timedelta(hours=3)
        provider = FakeTimeProvider(t1)
        provider.set_time(t2)
        self.assertEqual(provider.now(), t2)


class ReminderEngineTestBase(TestCase):
    """Base class with common setup for reminder engine tests."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123',
            email='test@example.com',
        )
        # Base time: today at 19:30
        self.scheduled_time = timezone.now().replace(
            hour=14, minute=0, second=0, microsecond=0
        )  # 19:30 IST = 14:00 UTC (USE_TZ=True stores as UTC)

    def _create_task(self, title='Solve LeetCode', scheduled_start=None,
                     status=Task.Status.TODO, user=None):
        """Helper to create a task with sensible defaults."""
        return Task.objects.create(
            user=user or self.user,
            title=title,
            scheduled_start=scheduled_start or self.scheduled_time,
            status=status,
        )


class Test01_BeforeScheduledTime(ReminderEngineTestBase):
    """Test 1: Task at 19:30, current time 19:29 → NO REMINDER."""

    def test_no_reminder_before_scheduled_time(self):
        self._create_task()
        # 1 minute before scheduled time
        fake_now = self.scheduled_time - timedelta(minutes=1)
        engine = ReminderEngine(time_provider=FakeTimeProvider(fake_now))

        events = engine.check_due_reminders(self.user)

        self.assertEqual(events, [])


class Test02_ExactScheduledTime(ReminderEngineTestBase):
    """Test 2: Task at 19:30, current time 19:30 → ONE REMINDER."""

    def test_one_reminder_at_exact_time(self):
        task = self._create_task()
        engine = ReminderEngine(time_provider=FakeTimeProvider(self.scheduled_time))

        events = engine.check_due_reminders(self.user)

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]['event_type'], 'TASK_STARTING_NOW')
        self.assertEqual(events[0]['task_id'], str(task.id))
        self.assertEqual(events[0]['task_title'], 'Solve LeetCode')


class Test03_RepeatedCheck(ReminderEngineTestBase):
    """Test 3: Repeated checks → ONE REMINDER ONLY (idempotency)."""

    def test_no_duplicate_on_repeated_check(self):
        self._create_task()
        fake_time = FakeTimeProvider(self.scheduled_time)
        engine = ReminderEngine(time_provider=fake_time)

        # First check — should get a reminder
        events1 = engine.check_due_reminders(self.user)
        self.assertEqual(len(events1), 1)

        # Second check at same time — must NOT get another
        events2 = engine.check_due_reminders(self.user)
        self.assertEqual(events2, [])

        # Third check 10 seconds later — still no duplicate
        fake_time.advance(seconds=10)
        events3 = engine.check_due_reminders(self.user)
        self.assertEqual(events3, [])

        # Fourth check 30 seconds later — still no duplicate
        fake_time.advance(seconds=30)
        events4 = engine.check_due_reminders(self.user)
        self.assertEqual(events4, [])


class Test04_CompletedTask(ReminderEngineTestBase):
    """Test 4: Completed task at 19:30 → NO REMINDER."""

    def test_no_reminder_for_completed_task(self):
        self._create_task(status=Task.Status.COMPLETED)
        engine = ReminderEngine(time_provider=FakeTimeProvider(self.scheduled_time))

        events = engine.check_due_reminders(self.user)

        self.assertEqual(events, [])


class Test05_CancelledTask(ReminderEngineTestBase):
    """Test 5: Cancelled task at 19:30 → NO REMINDER."""

    def test_no_reminder_for_cancelled_task(self):
        self._create_task(status=Task.Status.CANCELLED)
        engine = ReminderEngine(time_provider=FakeTimeProvider(self.scheduled_time))

        events = engine.check_due_reminders(self.user)

        self.assertEqual(events, [])


class Test06_MultipleTasks(ReminderEngineTestBase):
    """Test 6: Multiple tasks — correct selective reminders."""

    def test_multiple_tasks_correct_reminders(self):
        task_a = self._create_task(title='Task A', scheduled_start=self.scheduled_time)
        task_b = self._create_task(title='Task B', scheduled_start=self.scheduled_time)
        task_c = self._create_task(
            title='Task C',
            scheduled_start=self.scheduled_time + timedelta(minutes=30)
        )

        engine = ReminderEngine(time_provider=FakeTimeProvider(self.scheduled_time))
        events = engine.check_due_reminders(self.user)

        # A and B should fire, C should not
        self.assertEqual(len(events), 2)
        event_ids = {e['task_id'] for e in events}
        self.assertIn(str(task_a.id), event_ids)
        self.assertIn(str(task_b.id), event_ids)
        self.assertNotIn(str(task_c.id), event_ids)


class Test07_DifferentUsers(ReminderEngineTestBase):
    """Test 7: User A's tasks must NEVER appear for User B."""

    def test_user_isolation(self):
        user_b = User.objects.create_user(
            username='otheruser',
            password='otherpass123',
            email='other@example.com',
        )

        # Task belongs to self.user (User A)
        self._create_task(title='User A Task')

        # User B's task
        self._create_task(title='User B Task', user=user_b)

        engine = ReminderEngine(time_provider=FakeTimeProvider(self.scheduled_time))

        # Check for User A
        events_a = engine.check_due_reminders(self.user)
        self.assertEqual(len(events_a), 1)
        self.assertEqual(events_a[0]['task_title'], 'User A Task')

        # Check for User B
        events_b = engine.check_due_reminders(user_b)
        self.assertEqual(len(events_b), 1)
        self.assertEqual(events_b[0]['task_title'], 'User B Task')


class Test08_Timezone(ReminderEngineTestBase):
    """Test 8: Verify timezone-aware comparisons."""

    def test_timezone_aware_comparison(self):
        # Django USE_TZ=True means all datetimes are stored as UTC internally.
        # Ensure the engine correctly handles timezone-aware datetimes.
        import pytz
        utc = pytz.UTC

        # Create a task scheduled at a specific UTC time
        utc_time = timezone.now().replace(
            hour=10, minute=0, second=0, microsecond=0, tzinfo=utc
        )
        task = self._create_task(scheduled_start=utc_time)

        # Check at exactly the UTC time
        engine_at = ReminderEngine(time_provider=FakeTimeProvider(utc_time))
        events = engine_at.check_due_reminders(self.user)
        self.assertEqual(len(events), 1)

        # Check 1 minute before — no reminder
        engine_before = ReminderEngine(
            time_provider=FakeTimeProvider(utc_time - timedelta(minutes=1))
        )
        # Need a fresh task since the first check marked it
        task.last_reminded_at = None
        task.save(update_fields=['last_reminded_at'])

        events_before = engine_before.check_due_reminders(self.user)
        self.assertEqual(events_before, [])


class Test09_RepeatedAPIRequests(ReminderEngineTestBase):
    """Test 9: Repeated API requests must not duplicate reminders."""

    def test_api_idempotency(self):
        self._create_task()
        client = APIClient()
        client.force_authenticate(user=self.user)

        # We can't easily inject FakeTimeProvider into the API view,
        # so we test at the engine level with multiple check_due_reminders calls.
        # The API layer just delegates to ReminderEngine, which is tested above.
        # Here we verify the engine-level idempotency survives multiple calls
        # from different engine instances (simulating separate HTTP requests).

        engine1 = ReminderEngine(time_provider=FakeTimeProvider(self.scheduled_time))
        events1 = engine1.check_due_reminders(self.user)
        self.assertEqual(len(events1), 1)

        # Simulate a second request with a new engine instance
        engine2 = ReminderEngine(time_provider=FakeTimeProvider(self.scheduled_time + timedelta(seconds=5)))
        events2 = engine2.check_due_reminders(self.user)
        self.assertEqual(events2, [])

        # Third request 30 seconds later
        engine3 = ReminderEngine(time_provider=FakeTimeProvider(self.scheduled_time + timedelta(seconds=30)))
        events3 = engine3.check_due_reminders(self.user)
        self.assertEqual(events3, [])


class Test10_NoScheduledTasks(ReminderEngineTestBase):
    """Test 10: No scheduled tasks → empty list, no error."""

    def test_no_tasks_returns_empty(self):
        # No tasks at all
        engine = ReminderEngine(time_provider=FakeTimeProvider(self.scheduled_time))
        events = engine.check_due_reminders(self.user)
        self.assertEqual(events, [])

    def test_unscheduled_task_not_included(self):
        # Task exists but has no scheduled_start
        Task.objects.create(
            user=self.user,
            title='Unscheduled Task',
            scheduled_start=None,
            status=Task.Status.TODO,
        )
        engine = ReminderEngine(time_provider=FakeTimeProvider(self.scheduled_time))
        events = engine.check_due_reminders(self.user)
        self.assertEqual(events, [])


class TestMissedTaskPolicy(ReminderEngineTestBase):
    """Additional: Test the MISSED vs STARTING_NOW classification."""

    def test_task_within_window_is_starting_now(self):
        """Task 10 minutes past scheduled → TASK_STARTING_NOW."""
        self._create_task()
        now = self.scheduled_time + timedelta(minutes=10)
        engine = ReminderEngine(time_provider=FakeTimeProvider(now))

        events = engine.check_due_reminders(self.user)

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]['event_type'], 'TASK_STARTING_NOW')

    def test_task_beyond_window_is_missed(self):
        """Task 20 minutes past scheduled → TASK_MISSED."""
        self._create_task()
        now = self.scheduled_time + timedelta(minutes=MISSED_WINDOW_MINUTES + 5)
        engine = ReminderEngine(time_provider=FakeTimeProvider(now))

        events = engine.check_due_reminders(self.user)

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]['event_type'], 'TASK_MISSED')


class TestReopenedTaskReminder(ReminderEngineTestBase):
    """Edge case: reopened and rescheduled task should get a new reminder."""

    def test_rescheduled_task_gets_new_reminder(self):
        task = self._create_task()
        engine = ReminderEngine(time_provider=FakeTimeProvider(self.scheduled_time))

        # First reminder fires
        events1 = engine.check_due_reminders(self.user)
        self.assertEqual(len(events1), 1)

        # Task is rescheduled to a later time
        new_time = self.scheduled_time + timedelta(hours=1)
        task.scheduled_start = new_time
        task.save(update_fields=['scheduled_start'])

        # At the new time, a new reminder should fire
        engine2 = ReminderEngine(time_provider=FakeTimeProvider(new_time))
        events2 = engine2.check_due_reminders(self.user)
        self.assertEqual(len(events2), 1)
        self.assertEqual(events2[0]['task_id'], str(task.id))


class TestAPIEndpoint(TestCase):
    """Test the /api/tasks/reminders/due/ endpoint directly."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='apiuser',
            password='apipass123',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_endpoint_requires_authentication(self):
        """Unauthenticated request → 401."""
        anon_client = APIClient()
        response = anon_client.get('/api/tasks/reminders/due/')
        self.assertIn(response.status_code, [401, 403])

    def test_endpoint_returns_reminders_key(self):
        """Response always has 'reminders' key."""
        response = self.client.get('/api/tasks/reminders/due/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('reminders', response.json())

    def test_endpoint_empty_when_no_tasks(self):
        """No tasks → empty reminders list."""
        response = self.client.get('/api/tasks/reminders/due/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['reminders'], [])

    def test_endpoint_returns_due_task(self):
        """Task with scheduled_start in the past → should appear."""
        past_time = timezone.now() - timedelta(minutes=5)
        Task.objects.create(
            user=self.user,
            title='Due Task',
            scheduled_start=past_time,
            status=Task.Status.TODO,
        )
        response = self.client.get('/api/tasks/reminders/due/')
        self.assertEqual(response.status_code, 200)
        reminders = response.json()['reminders']
        self.assertEqual(len(reminders), 1)
        self.assertEqual(reminders[0]['task_title'], 'Due Task')

    def test_endpoint_idempotent(self):
        """Two consecutive calls → only first returns the reminder."""
        past_time = timezone.now() - timedelta(minutes=5)
        Task.objects.create(
            user=self.user,
            title='Idempotent Task',
            scheduled_start=past_time,
            status=Task.Status.TODO,
        )
        # First call
        r1 = self.client.get('/api/tasks/reminders/due/')
        self.assertEqual(len(r1.json()['reminders']), 1)

        # Second call — must be empty
        r2 = self.client.get('/api/tasks/reminders/due/')
        self.assertEqual(r2.json()['reminders'], [])
