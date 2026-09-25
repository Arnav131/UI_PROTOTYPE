"""Scheduler URLs."""

from django.urls import path
from .views import FreeSlotsView, ConflictsView, ProposeScheduleView

urlpatterns = [
    path('free-slots/', FreeSlotsView.as_view(), name='schedule-free-slots'),
    path('conflicts/', ConflictsView.as_view(), name='schedule-conflicts'),
    path('propose/', ProposeScheduleView.as_view(), name='schedule-propose'),
]
