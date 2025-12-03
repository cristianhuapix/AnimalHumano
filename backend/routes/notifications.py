"""
Notifications routes (PRD Section 14)
"""

from flask import Blueprint, request, g
from config import supabase
from middleware.auth import require_auth

notifications_bp = Blueprint('notifications', __name__)

@notifications_bp.route('/', methods=['GET'])
@require_auth
def get_notifications():
    """Get user's notifications"""
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', 20))
    offset = (page - 1) * page_size
    unread_only = request.args.get('unread_only', 'false') == 'true'

    try:
        query = supabase.table('notifications')\
            .select('*', count='exact')\
            .eq('profile_id', g.user_id)

        if unread_only:
            query = query.eq('is_read', False)

        # Get total count
        count_result = query.execute()
        total = count_result.count

        # Get paginated results
        result = query.order('created_at', desc=True)\
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
        return {'error': 'Failed to get notifications', 'message': str(e)}, 400

@notifications_bp.route('/<notification_id>', methods=['PUT'])
@require_auth
def mark_notification_read(notification_id):
    """Mark notification as read"""
    try:
        result = supabase.table('notifications')\
            .update({'is_read': True})\
            .eq('id', notification_id)\
            .eq('profile_id', g.user_id)\
            .execute()

        if not result.data:
            return {'error': 'Notification not found'}, 404

        return result.data[0], 200

    except Exception as e:
        return {'error': 'Failed to update notification', 'message': str(e)}, 400

@notifications_bp.route('/mark-all-read', methods=['POST'])
@require_auth
def mark_all_read():
    """Mark all notifications as read"""
    try:
        supabase.table('notifications')\
            .update({'is_read': True})\
            .eq('profile_id', g.user_id)\
            .eq('is_read', False)\
            .execute()

        return {'message': 'All notifications marked as read'}, 200

    except Exception as e:
        return {'error': 'Failed to mark notifications', 'message': str(e)}, 400

@notifications_bp.route('/settings', methods=['GET'])
@require_auth
def get_notification_settings():
    """Get notification settings (PRD Section 14)"""
    try:
        settings = supabase.table('notification_settings')\
            .select('*')\
            .eq('profile_id', g.user_id)\
            .single()\
            .execute()

        return settings.data, 200

    except Exception as e:
        return {'error': 'Failed to get settings', 'message': str(e)}, 400

@notifications_bp.route('/settings', methods=['PUT'])
@require_auth
def update_notification_settings():
    """
    Update notification settings
    PRD Section 14: Configurar notificaciones
    """
    data = request.json

    allowed_fields = [
        'general_enabled', 'chat_enabled', 'vaccines_enabled',
        'appointments_enabled', 'lost_pets_enabled', 'lost_pets_radius_km'
    ]

    update_data = {k: v for k, v in data.items() if k in allowed_fields}

    if not update_data:
        return {'error': 'No valid fields to update'}, 400

    try:
        result = supabase.table('notification_settings')\
            .update(update_data)\
            .eq('profile_id', g.user_id)\
            .execute()

        return result.data[0], 200

    except Exception as e:
        return {'error': 'Failed to update settings', 'message': str(e)}, 400

@notifications_bp.route('/device-tokens', methods=['POST'])
@require_auth
def register_device_token():
    """
    Register device token for push notifications
    PRD: FCM (Android/Web), APNs (iOS)
    """
    data = request.json

    required_fields = ['token', 'platform']
    for field in required_fields:
        if field not in data:
            return {'error': f'Missing required field: {field}'}, 400

    if data['platform'] not in ['ios', 'android', 'web']:
        return {'error': 'Platform must be ios, android, or web'}, 400

    try:
        # Deactivate old tokens for this user/platform
        supabase.table('device_tokens')\
            .update({'is_active': False})\
            .eq('profile_id', g.user_id)\
            .eq('platform', data['platform'])\
            .execute()

        # Register new token
        token_data = {
            'profile_id': str(g.user_id),
            'token': data['token'],
            'platform': data['platform'],
            'is_active': True
        }

        token = supabase.table('device_tokens').insert(token_data).execute()
        return token.data[0], 201

    except Exception as e:
        # Handle duplicate token constraint
        if 'profile_token_unique' in str(e):
            # Token already exists, just mark it as active
            result = supabase.table('device_tokens')\
                .update({'is_active': True})\
                .eq('profile_id', g.user_id)\
                .eq('token', data['token'])\
                .execute()
            return result.data[0], 200

        return {'error': 'Failed to register token', 'message': str(e)}, 400

@notifications_bp.route('/device-tokens/<token_id>', methods=['DELETE'])
@require_auth
def unregister_device_token(token_id):
    """Unregister device token"""
    try:
        supabase.table('device_tokens')\
            .update({'is_active': False})\
            .eq('id', token_id)\
            .eq('profile_id', g.user_id)\
            .execute()

        return {'message': 'Token unregistered'}, 200

    except Exception as e:
        return {'error': 'Failed to unregister token', 'message': str(e)}, 400
