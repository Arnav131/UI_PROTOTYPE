"""
Root URL configuration.
All API endpoints are namespaced under /api/.
"""

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('users.urls')),
    path('api/tasks/', include('tasks.urls')),
    path('api/goals/', include('goals.urls')),
    path('api/schedule/', include('scheduler.urls')),
    path('api/assistant/', include('assistant.urls')),
    path('api/preferences/', include('users.preferences_urls')),
]
