"""
Time provider abstraction for the reminder engine.

Centralizes access to "current time" so that:
- Production code uses RealTimeProvider (django.utils.timezone.now)
- Tests use FakeTimeProvider with an injectable fixed time

This avoids scattering datetime.now() / timezone.now() calls
throughout the reminder logic and makes the engine fully testable
with deterministic time.
"""

from django.utils import timezone


class TimeProvider:
    """Abstract base for current-time access."""

    def now(self):
        """Return the current timezone-aware datetime."""
        raise NotImplementedError


class RealTimeProvider(TimeProvider):
    """Production implementation — delegates to Django's timezone.now()."""

    def now(self):
        return timezone.now()


class FakeTimeProvider(TimeProvider):
    """
    Test implementation with a controllable fixed time.

    Usage:
        provider = FakeTimeProvider(some_datetime)
        provider.now()  # returns some_datetime
        provider.advance(minutes=5)
    """

    def __init__(self, fixed_time):
        self._time = fixed_time

    def now(self):
        return self._time

    def set_time(self, new_time):
        """Replace the fixed time."""
        self._time = new_time

    def advance(self, **kwargs):
        """Advance the fixed time by a timedelta. Accepts timedelta kwargs."""
        from datetime import timedelta
        self._time += timedelta(**kwargs)
