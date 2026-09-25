from datetime import timedelta, date, time
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.utils import timezone
from django.contrib.auth import get_user_model

from tasks.models import Task
from users.models import UserPreferences

User = get_user_model()


class SchedulerAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='password')
        UserPreferences.objects.create(
            user=self.user,
            preferred_work_start=time(9, 0),
            preferred_work_end=time(17, 0)
        )
        self.client.force_authenticate(user=self.user)
        self.base = timezone.localtime(timezone.now()).replace(hour=0, minute=0, second=0, microsecond=0)

    def test_get_free_slots(self):
        # Create a task 10:00 - 12:00
        Task.objects.create(
            user=self.user,
            title='Meeting',
            scheduled_start=self.base + timedelta(hours=10),
            scheduled_end=self.base + timedelta(hours=12),
            status=Task.Status.TODO
        )
        
        url = reverse('schedule-free-slots')
        response = self.client.get(url, {'date': self.base.date().isoformat()})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # 9-10 (60m) and 12-17 (300m)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(response.data[0]['duration_minutes'], 60)
        self.assertEqual(response.data[1]['duration_minutes'], 300)

    def test_get_conflicts(self):
        Task.objects.create(
            user=self.user,
            title='A',
            scheduled_start=self.base + timedelta(hours=10),
            scheduled_end=self.base + timedelta(hours=12),
            status=Task.Status.TODO
        )
        Task.objects.create(
            user=self.user,
            title='B',
            scheduled_start=self.base + timedelta(hours=11),
            scheduled_end=self.base + timedelta(hours=13),
            status=Task.Status.TODO
        )
        
        url = reverse('schedule-conflicts')
        response = self.client.get(url, {'date': self.base.date().isoformat()})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['has_conflict'])
        self.assertEqual(len(response.data['conflicts']), 1)
        self.assertEqual(response.data['conflicts'][0]['overlap_minutes'], 60)

    def test_propose_schedule(self):
        task = Task.objects.create(
            user=self.user,
            title='New Task',
            estimated_duration=timedelta(hours=1),
            status=Task.Status.TODO
        )
        
        url = reverse('schedule-propose')
        response = self.client.post(url, {'task_id': str(task.id)})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'PROPOSED')
        self.assertIsNotNone(response.data['proposed_start'])
