from django.contrib import admin
from .models import Task

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'status', 'priority', 'scheduled_start', 'is_locked')
    list_filter = ('status', 'priority', 'is_locked')
    search_fields = ('title', 'description')
