"""
Comprehensive test suite for the authentication and user management flow.

Tests:
- User registration (valid, duplicate, password mismatch, short password, missing fields)
- User login / JWT token obtain (valid, invalid password, nonexistent user, missing fields)
- Token refresh (valid refresh token, invalid token)
- Protected endpoints (/api/auth/me/, /api/preferences/)
- User isolation across accounts (profile, preferences, and task scoping)
"""

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from users.models import UserPreferences
from tasks.models import Task


class UserRegistrationTests(APITestCase):
    """Test user registration endpoint (/api/auth/register/)."""

    def setUp(self):
        self.register_url = reverse('auth-register')

    def test_registration_success(self):
        """Valid registration creates user with hashed password and preferences."""
        payload = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'StrongPassword123!',
            'password_confirm': 'StrongPassword123!',
            'first_name': 'New',
            'last_name': 'User',
        }
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('message', response.data)
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['username'], 'newuser')
        self.assertEqual(response.data['user']['email'], 'newuser@example.com')

        # Verify database state
        user = User.objects.get(username='newuser')
        self.assertTrue(user.check_password('StrongPassword123!'))
        self.assertEqual(user.first_name, 'New')
        self.assertEqual(user.last_name, 'User')

        # Verify automatic default preferences creation
        self.assertTrue(UserPreferences.objects.filter(user=user).exists())
        prefs = UserPreferences.objects.get(user=user)
        self.assertEqual(prefs.timezone, 'Asia/Kolkata')
        self.assertEqual(prefs.assistant_tone, 'friendly')

    def test_registration_without_optional_fields(self):
        """Registration succeeds with only required fields (username, password, password_confirm)."""
        payload = {
            'username': 'minimaluser',
            'password': 'SecurePassword88!',
            'password_confirm': 'SecurePassword88!',
        }
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username='minimaluser').exists())

    def test_registration_password_mismatch(self):
        """Registration fails when password and password_confirm differ."""
        payload = {
            'username': 'mismatchuser',
            'password': 'PasswordOne1!',
            'password_confirm': 'PasswordTwo2!',
        }
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password_confirm', response.data)

    def test_registration_password_too_short(self):
        """Registration fails when password is shorter than 8 characters."""
        payload = {
            'username': 'shortpassuser',
            'password': 'short',
            'password_confirm': 'short',
        }
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)

    def test_registration_duplicate_username(self):
        """Registration fails when username already exists."""
        User.objects.create_user(username='existinguser', password='Password123!')
        payload = {
            'username': 'existinguser',
            'password': 'AnotherPassword123!',
            'password_confirm': 'AnotherPassword123!',
        }
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('username', response.data)

    def test_registration_missing_required_fields(self):
        """Registration fails when required fields are missing."""
        # Missing password
        response = self.client.post(self.register_url, {'username': 'nopass'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Missing username
        response = self.client.post(
            self.register_url,
            {'password': 'Password123!', 'password_confirm': 'Password123!'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class UserLoginTests(APITestCase):
    """Test user login / token obtain endpoint (/api/auth/login/)."""

    def setUp(self):
        self.login_url = reverse('auth-login')
        self.username = 'testloginuser'
        self.password = 'ValidPassword123!'
        self.user = User.objects.create_user(
            username=self.username,
            email='login@example.com',
            password=self.password
        )

    def test_login_success(self):
        """Valid credentials return access and refresh JWT tokens."""
        payload = {
            'username': self.username,
            'password': self.password,
        }
        response = self.client.post(self.login_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

        # Validate access token claims
        token = AccessToken(response.data['access'])
        self.assertEqual(str(token['user_id']), str(self.user.id))

    def test_login_invalid_password(self):
        """Login fails with incorrect password."""
        payload = {
            'username': self.username,
            'password': 'WrongPassword123!',
        }
        response = self.client.post(self.login_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn('access', response.data)

    def test_login_nonexistent_user(self):
        """Login fails with nonexistent username."""
        payload = {
            'username': 'nobody',
            'password': self.password,
        }
        response = self.client.post(self.login_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_missing_fields(self):
        """Login fails when username or password is missing."""
        response = self.client.post(self.login_url, {'username': self.username}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.post(self.login_url, {'password': self.password}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class TokenRefreshTests(APITestCase):
    """Test token refresh endpoint (/api/auth/refresh/)."""

    def setUp(self):
        self.login_url = reverse('auth-login')
        self.refresh_url = reverse('auth-refresh')
        self.user = User.objects.create_user(username='refreshuser', password='Password123!')

        # Obtain initial tokens
        login_response = self.client.post(
            self.login_url,
            {'username': 'refreshuser', 'password': 'Password123!'},
            format='json'
        )
        self.refresh_token = login_response.data['refresh']

    def test_token_refresh_success(self):
        """Valid refresh token yields a new access token."""
        response = self.client.post(
            self.refresh_url,
            {'refresh': self.refresh_token},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

        # Validate the new access token
        token = AccessToken(response.data['access'])
        self.assertEqual(str(token['user_id']), str(self.user.id))

    def test_token_refresh_invalid_token(self):
        """Invalid refresh token returns 401."""
        response = self.client.post(
            self.refresh_url,
            {'refresh': 'invalid.token.string'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_refresh_missing_token(self):
        """Missing refresh token in body returns 400."""
        response = self.client.post(self.refresh_url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ProtectedEndpointTests(APITestCase):
    """Test access control on protected endpoints (/api/auth/me/, /api/preferences/)."""

    def setUp(self):
        self.profile_url = reverse('auth-profile')
        self.user = User.objects.create_user(
            username='authuser',
            email='authuser@example.com',
            password='Password123!',
            first_name='Auth',
            last_name='User'
        )
        login_response = self.client.post(
            reverse('auth-login'),
            {'username': 'authuser', 'password': 'Password123!'},
            format='json'
        )
        self.access_token = login_response.data['access']

    def test_profile_with_valid_token(self):
        """Authenticated request returns profile data."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'authuser')
        self.assertEqual(response.data['email'], 'authuser@example.com')
        self.assertEqual(response.data['first_name'], 'Auth')
        self.assertEqual(response.data['last_name'], 'User')

    def test_profile_unauthenticated(self):
        """Unauthenticated request to profile endpoint returns 401."""
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_invalid_token(self):
        """Request with invalid Bearer token returns 401."""
        self.client.credentials(HTTP_AUTHORIZATION='Bearer completely-invalid-token')
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_malformed_auth_header(self):
        """Request with malformed authorization header returns 401."""
        self.client.credentials(HTTP_AUTHORIZATION='Basic notatoken')
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class UserPreferencesTests(APITestCase):
    """Test user preferences endpoint (/api/preferences/)."""

    def setUp(self):
        self.preferences_url = reverse('preferences')
        self.user = User.objects.create_user(username='prefuser', password='Password123!')
        login_response = self.client.post(
            reverse('auth-login'),
            {'username': 'prefuser', 'password': 'Password123!'},
            format='json'
        )
        self.access_token = login_response.data['access']

    def test_get_preferences_authenticated(self):
        """Authenticated user can fetch their preferences."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
        response = self.client.get(self.preferences_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('timezone', response.data)
        self.assertIn('assistant_tone', response.data)

    def test_update_preferences_authenticated(self):
        """Authenticated user can update their preferences."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.access_token}')
        update_data = {
            'timezone': 'America/New_York',
            'assistant_tone': 'formal',
            'default_task_duration': 45,
        }
        response = self.client.put(self.preferences_url, update_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['timezone'], 'America/New_York')
        self.assertEqual(response.data['assistant_tone'], 'formal')
        self.assertEqual(response.data['default_task_duration'], 45)

        # Verify in DB
        prefs = UserPreferences.objects.get(user=self.user)
        self.assertEqual(prefs.timezone, 'America/New_York')
        self.assertEqual(prefs.assistant_tone, 'formal')

    def test_preferences_unauthenticated(self):
        """Unauthenticated request to preferences returns 401."""
        response = self.client.get(self.preferences_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class UserIsolationTests(APITestCase):
    """Test strict data isolation between different authenticated users."""

    def setUp(self):
        # Create User A
        self.user_a = User.objects.create_user(username='user_a', email='a@example.com', password='Password123!')
        res_a = self.client.post(reverse('auth-login'), {'username': 'user_a', 'password': 'Password123!'}, format='json')
        self.token_a = res_a.data['access']

        # Create User B
        self.user_b = User.objects.create_user(username='user_b', email='b@example.com', password='Password123!')
        res_b = self.client.post(reverse('auth-login'), {'username': 'user_b', 'password': 'Password123!'}, format='json')
        self.token_b = res_b.data['access']

    def test_profile_isolation(self):
        """Each user's token retrieves only their own profile."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_a}')
        res = self.client.get(reverse('auth-profile'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['username'], 'user_a')

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_b}')
        res = self.client.get(reverse('auth-profile'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['username'], 'user_b')

    def test_preferences_isolation(self):
        """Preferences updated by User A do not affect User B."""
        # User A updates timezone
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_a}')
        self.client.put(reverse('preferences'), {'timezone': 'Europe/London'}, format='json')

        # User B reads their preferences - should still be default
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_b}')
        res = self.client.get(reverse('preferences'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['timezone'], 'Asia/Kolkata')

    def test_task_data_isolation(self):
        """User A's tasks are completely invisible to User B."""
        # User A creates a task
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_a}')
        create_res = self.client.post(
            reverse('task-list'),
            {'title': 'Secret Task A', 'priority': 'HIGH', 'duration_minutes': 30},
            format='json'
        )
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        task_a_id = create_res.data['id']

        # User B lists tasks - should be empty
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_b}')
        list_res = self.client.get(reverse('task-list'))
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        results = list_res.data.get('results', list_res.data)
        self.assertEqual(len(results), 0)

        # User B directly queries User A's task detail - must return 404
        detail_res = self.client.get(reverse('task-detail', kwargs={'id': task_a_id}))
        self.assertEqual(detail_res.status_code, status.HTTP_404_NOT_FOUND)
