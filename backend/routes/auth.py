"""
Authentication routes (PRD Section 4)
"""

from flask import Blueprint, request, jsonify
from config import supabase
from middleware.auth import require_auth

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    """
    Register new user
    PRD Section 4: Registro
    """
    data = request.json

    # Validate required fields
    required_fields = ['email', 'password', 'first_name', 'last_name', 'country']
    for field in required_fields:
        if field not in data:
            return {'error': f'Missing required field: {field}'}, 400

    try:
        # Create user in Supabase Auth
        auth_response = supabase.auth.sign_up({
            'email': data['email'],
            'password': data['password']
        })

        if not auth_response.user:
            return {'error': 'Registration failed'}, 400

        # Create profile
        profile_data = {
            'id': auth_response.user.id,
            'email': data['email'],
            'first_name': data['first_name'],
            'last_name': data['last_name'],
            'full_name': f"{data['first_name']} {data['last_name']}",
            'country': data['country'],
            'language': data.get('language', 'es'),
            'phone': data.get('phone'),
            'address': data.get('address'),
            'city': data.get('city'),
            'is_provider': data.get('is_provider', False)
        }

        profile = supabase.table('profiles').insert(profile_data).execute()

        # Si se registró como proveedor, crear registro en tabla providers
        if data.get('is_provider', False):
            provider_data = {
                'profile_id': auth_response.user.id,
                'service_type': 'other',  # Por defecto, luego puede actualizar
                'active': True,
                'plan_type': 'free',
                'plan_fee': 0
            }
            supabase.table('providers').insert(provider_data).execute()

        return {
            'message': 'Registration successful. Please check your email for verification.',
            'user': {
                'id': auth_response.user.id,
                'email': auth_response.user.email
            }
        }, 201

    except Exception as e:
        return {'error': 'Registration failed', 'message': str(e)}, 400

@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Login user
    PRD Section 4: Login
    """
    data = request.json

    if 'email' not in data or 'password' not in data:
        return {'error': 'Email and password required'}, 400

    try:
        # Sign in with Supabase
        auth_response = supabase.auth.sign_in_with_password({
            'email': data['email'],
            'password': data['password']
        })

        if not auth_response.session:
            return {'error': 'Invalid credentials'}, 401

        # Get profile
        profile = supabase.table('profiles').select('*').eq('id', auth_response.user.id).single().execute()

        return {
            'token': auth_response.session.access_token,
            'refresh_token': auth_response.session.refresh_token,
            'user': profile.data
        }, 200

    except Exception as e:
        return {'error': 'Login failed', 'message': str(e)}, 401

@auth_bp.route('/logout', methods=['POST'])
@require_auth
def logout():
    """Logout user"""
    try:
        supabase.auth.sign_out()
        return {'message': 'Logout successful'}, 200
    except Exception as e:
        return {'error': 'Logout failed', 'message': str(e)}, 400

@auth_bp.route('/me', methods=['GET'])
@require_auth
def get_current_user():
    """Get current user profile"""
    from flask import g

    try:
        profile = supabase.table('profiles').select('*').eq('id', g.user_id).single().execute()
        return profile.data, 200
    except Exception as e:
        return {'error': 'Failed to get user', 'message': str(e)}, 400

@auth_bp.route('/me', methods=['PUT'])
@require_auth
def update_profile():
    """Update user profile (PRD Section 14)"""
    from flask import g
    data = request.json

    # Fields that can be updated
    allowed_fields = [
        'first_name', 'last_name', 'full_name', 'phone',
        'address', 'city', 'country', 'language', 'photo_url', 'primary_email'
    ]

    update_data = {k: v for k, v in data.items() if k in allowed_fields}

    if not update_data:
        return {'error': 'No valid fields to update'}, 400

    try:
        profile = supabase.table('profiles').update(update_data).eq('id', g.user_id).execute()
        return profile.data[0], 200
    except Exception as e:
        return {'error': 'Update failed', 'message': str(e)}, 400

@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """Request password reset"""
    data = request.json

    if 'email' not in data:
        return {'error': 'Email required'}, 400

    try:
        supabase.auth.reset_password_for_email(data['email'])
        return {'message': 'Password reset email sent'}, 200
    except Exception as e:
        return {'error': 'Reset failed', 'message': str(e)}, 400

@auth_bp.route('/refresh', methods=['POST'])
def refresh_token():
    """Refresh access token"""
    data = request.json

    if 'refresh_token' not in data:
        return {'error': 'Refresh token required'}, 400

    try:
        auth_response = supabase.auth.refresh_session(data['refresh_token'])
        return {
            'token': auth_response.session.access_token,
            'refresh_token': auth_response.session.refresh_token
        }, 200
    except Exception as e:
        return {'error': 'Refresh failed', 'message': str(e)}, 401

@auth_bp.route('/change-password', methods=['POST'])
@require_auth
def change_password():
    """Change user password"""
    from flask import g
    data = request.json

    if 'current_password' not in data or 'new_password' not in data:
        return {'error': 'Current password and new password required'}, 400

    if len(data['new_password']) < 6:
        return {'error': 'New password must be at least 6 characters'}, 400

    try:
        # Supabase handles password change through their auth API
        # First verify current password by trying to sign in
        profile = supabase.table('profiles').select('email').eq('id', g.user_id).single().execute()
        user_email = profile.data['email']

        # Verify current password
        supabase.auth.sign_in_with_password({
            'email': user_email,
            'password': data['current_password']
        })

        # Update password
        supabase.auth.update_user({'password': data['new_password']})

        return {'message': 'Password updated successfully'}, 200
    except Exception as e:
        error_msg = str(e)
        if 'Invalid login credentials' in error_msg:
            return {'error': 'Current password is incorrect'}, 400
        return {'error': 'Failed to change password', 'message': error_msg}, 400

@auth_bp.route('/me/notifications', methods=['GET'])
@require_auth
def get_notification_settings():
    """Get user notification settings"""
    from flask import g

    try:
        # Get notification settings from profiles table
        profile = supabase.table('profiles').select(
            'notifications_enabled, vaccine_mandatory, vaccine_optional, '
            'vaccine_days_before, birthday_notifications, chat_notifications, app_notifications'
        ).eq('id', g.user_id).single().execute()

        # Return defaults if not set
        settings = profile.data or {}
        return {
            'notifications_enabled': settings.get('notifications_enabled', True),
            'vaccine_mandatory': settings.get('vaccine_mandatory', True),
            'vaccine_optional': settings.get('vaccine_optional', False),
            'vaccine_days_before': settings.get('vaccine_days_before', 30),
            'birthday_notifications': settings.get('birthday_notifications', True),
            'chat_notifications': settings.get('chat_notifications', True),
            'app_notifications': settings.get('app_notifications', True)
        }, 200
    except Exception as e:
        return {'error': 'Failed to get notification settings', 'message': str(e)}, 400

@auth_bp.route('/me/notifications', methods=['PUT'])
@require_auth
def update_notification_settings():
    """Update user notification settings"""
    from flask import g
    data = request.json

    # Fields that can be updated for notifications
    allowed_fields = [
        'notifications_enabled', 'vaccine_mandatory', 'vaccine_optional',
        'vaccine_days_before', 'birthday_notifications', 'chat_notifications', 'app_notifications'
    ]

    update_data = {k: v for k, v in data.items() if k in allowed_fields}

    if not update_data:
        return {'error': 'No valid fields to update'}, 400

    try:
        profile = supabase.table('profiles').update(update_data).eq('id', g.user_id).execute()
        return {'message': 'Notification settings updated successfully', 'data': profile.data[0]}, 200
    except Exception as e:
        return {'error': 'Failed to update notification settings', 'message': str(e)}, 400
