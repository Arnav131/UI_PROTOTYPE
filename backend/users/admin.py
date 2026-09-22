from django.contrib import admin
from .models import UserPreferences

@admin.register(UserPreferences)
class UserPreferencesAdmin(admin.ModelAdmin):
    list_display = ('user', 'timezone', 'preferred_work_start', 'preferred_work_end')
