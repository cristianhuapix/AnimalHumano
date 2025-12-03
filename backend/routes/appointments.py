"""
Appointments routes (PRD Section 10)
"""

from flask import Blueprint, request, g
from config import supabase
from middleware.auth import require_auth
from datetime import datetime

appointments_bp = Blueprint('appointments', __name__)

@appointments_bp.route('/', methods=['GET'])
@require_auth
def get_appointments():
    """
    Get user's appointments
    PRD Section 10: Calendario
    """
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', 20))
    offset = (page - 1) * page_size
    status = request.args.get('status')

    try:
        query = supabase.table('appointments')\
            .select('*, providers(*, profiles(full_name)), pets(name)', count='exact')\
            .eq('user_id', g.user_id)

        if status:
            query = query.eq('status', status)

        # Get total count
        count_result = query.execute()
        total = count_result.count

        # Get paginated results
        result = query.order('scheduled_at', desc=False)\
            .range(offset, offset + page_size - 1)\
            .execute()

        return {
            'data': result.data,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total': total,
                'pages': (total + page_size - 1) // page_size
            }
        }, 200

    except Exception as e:
        return {'error': 'Failed to get appointments', 'message': str(e)}, 400

@appointments_bp.route('/calendar', methods=['GET'])
@require_auth
def get_calendar_events():
    """
    Get calendar events (appointments + vaccines)
    PRD Section 10: Vista unificada del calendario
    """
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    try:
        query = supabase.table('calendar_events')\
            .select('*')\
            .eq('profile_id', g.user_id)\
            .order('event_date')

        if start_date:
            query = query.gte('event_date', start_date)

        if end_date:
            query = query.lte('event_date', end_date)

        result = query.execute()

        return {'data': result.data}, 200

    except Exception as e:
        return {'error': 'Failed to get calendar', 'message': str(e)}, 400

@appointments_bp.route('/', methods=['POST'])
@require_auth
def create_appointment():
    """
    Create appointment
    PRD Section 8: Agendar cita
    """
    data = request.json

    required_fields = ['provider_id', 'scheduled_at']
    for field in required_fields:
        if field not in data:
            return {'error': f'Missing required field: {field}'}, 400

    try:
        appointment_data = {
            'user_id': str(g.user_id),
            'provider_id': data['provider_id'],
            'pet_id': data.get('pet_id'),
            'scheduled_at': data['scheduled_at'],
            'duration_mins': data.get('duration_mins', 30),
            'notes': data.get('notes'),
            'status': 'pending'
        }

        appointment = supabase.table('appointments').insert(appointment_data).execute()

        # TODO: Send notification to provider

        return appointment.data[0], 201

    except Exception as e:
        return {'error': 'Failed to create appointment', 'message': str(e)}, 400

@appointments_bp.route('/<appointment_id>', methods=['GET'])
@require_auth
def get_appointment(appointment_id):
    """Get appointment details"""
    try:
        appointment = supabase.table('appointments')\
            .select('*, providers(*, profiles(full_name)), pets(name)')\
            .eq('id', appointment_id)\
            .single()\
            .execute()

        # Check access (user or provider)
        if appointment.data['user_id'] != g.user_id:
            provider = supabase.table('providers')\
                .select('profile_id')\
                .eq('id', appointment.data['provider_id'])\
                .single()\
                .execute()

            if provider.data['profile_id'] != g.user_id:
                return {'error': 'Access denied'}, 403

        return appointment.data, 200

    except Exception as e:
        return {'error': 'Appointment not found', 'message': str(e)}, 404

@appointments_bp.route('/<appointment_id>', methods=['PUT'])
@require_auth
def update_appointment(appointment_id):
    """
    Update/cancel appointment
    PRD Section 10: Cancelar cita (notifica al proveedor)
    """
    data = request.json

    try:
        # Get appointment
        appointment = supabase.table('appointments')\
            .select('user_id, provider_id, status')\
            .eq('id', appointment_id)\
            .single()\
            .execute()

        # Check access
        is_user = appointment.data['user_id'] == g.user_id

        if not is_user:
            provider = supabase.table('providers')\
                .select('profile_id')\
                .eq('id', appointment.data['provider_id'])\
                .single()\
                .execute()

            if provider.data['profile_id'] != g.user_id:
                return {'error': 'Access denied'}, 403

        # User can update: status (cancel), notes
        # Provider can update: status (confirm/complete), notes
        allowed_fields = ['status', 'notes', 'cancellation_reason']
        update_data = {k: v for k, v in data.items() if k in allowed_fields}

        if not update_data:
            return {'error': 'No valid fields to update'}, 400

        # Validate status transitions
        valid_statuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show']
        if 'status' in update_data and update_data['status'] not in valid_statuses:
            return {'error': f'Invalid status. Must be one of: {valid_statuses}'}, 400

        result = supabase.table('appointments').update(update_data).eq('id', appointment_id).execute()

        # TODO: Send notification to other party

        return result.data[0], 200

    except Exception as e:
        return {'error': 'Update failed', 'message': str(e)}, 400

@appointments_bp.route('/provider', methods=['GET'])
@require_auth
def get_provider_appointments():
    """Get appointments for provider (PRD Section 5: Provider home)"""
    try:
        # Get user's provider profiles
        providers = supabase.table('providers')\
            .select('id')\
            .eq('profile_id', g.user_id)\
            .execute()

        if not providers.data:
            return {'error': 'Not a provider'}, 403

        provider_ids = [p['id'] for p in providers.data]

        appointments = supabase.table('appointments')\
            .select('*, profiles!user_id(full_name), pets(name)')\
            .in_('provider_id', provider_ids)\
            .order('scheduled_at')\
            .execute()

        return {'data': appointments.data}, 200

    except Exception as e:
        return {'error': 'Failed to get appointments', 'message': str(e)}, 400
