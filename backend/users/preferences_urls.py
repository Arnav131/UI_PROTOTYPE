"""Preferences URL — separate from auth URLs for cleaner API."""

from django.urls import path
from .views import PreferencesView

urlpatterns = [
    path('', PreferencesView.as_view(), name='preferences'),
]
