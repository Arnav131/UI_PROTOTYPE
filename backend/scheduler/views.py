from rest_framework import viewsets, status, views
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from datetime import datetime
from django.shortcuts import get_object_or_404
from django.utils import timezone

from tasks.models import Task
from .services import SchedulerService
from .serializers import (
    SlotSerializer, ConflictReportSerializer, ScheduleProposalSerializer
)

class FreeSlotsView(views.APIView):
    """GET /api/schedule/free-slots/?date=YYYY-MM-DD"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_str = request.query_params.get('date')
        if date_str:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        else:
            target_date = timezone.now().date()
            
        slots = SchedulerService.get_free_slots(request.user, target_date)
        
        # Convert TimeSlot dataclasses to dicts for serializer
        slot_dicts = [
            {'start': s.start, 'end': s.end, 'duration_minutes': s.duration_minutes}
            for s in slots
        ]
        
        serializer = SlotSerializer(slot_dicts, many=True)
        return Response(serializer.data)


class ConflictsView(views.APIView):
    """GET /api/schedule/conflicts/?date=YYYY-MM-DD"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_str = request.query_params.get('date')
        if date_str:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        else:
            target_date = timezone.now().date()
            
        report = SchedulerService.check_conflicts_for_date(request.user, target_date)
        
        report_dict = {
            'has_conflict': report.has_conflict,
            'conflicts': [
                {
                    'task_a_id': c.task_a_id,
                    'task_a_title': c.task_a_title,
                    'task_b_id': c.task_b_id,
                    'task_b_title': c.task_b_title,
                    'overlap_start': c.overlap_start,
                    'overlap_end': c.overlap_end,
                    'overlap_minutes': c.overlap_minutes,
                }
                for c in report.conflicts
            ]
        }
        
        serializer = ConflictReportSerializer(report_dict)
        return Response(serializer.data)


from dataclasses import asdict

class ProposeScheduleView(views.APIView):
    """POST /api/schedule/propose/ - Generate proposal for an existing task"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        task_id = request.data.get('task_id')
        if not task_id:
            return Response({'error': 'task_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        task = get_object_or_404(Task, id=task_id, user=request.user)
        
        proposal = SchedulerService.propose_schedule_for_task(request.user, task)
        
        serializer = ScheduleProposalSerializer(asdict(proposal))
        return Response(serializer.data)
