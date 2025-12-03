"""
Rate limiting middleware (PRD Section 17)
Anti-spam protection
"""

from flask import request, g
from config import supabase, RATE_LIMITS

def rate_limit_middleware():
    """Check rate limits before processing request"""
    # Skip for public endpoints and GET requests
    if request.method == 'GET' or not hasattr(g, 'user_id'):
        return None

    # Determine action type based on endpoint
    action_type = get_action_type(request.path, request.method)

    if not action_type:
        return None

    # Get rate limit config
    limit_config = RATE_LIMITS.get(action_type)
    if not limit_config:
        return None

    try:
        # Check rate limit using database function
        result = supabase.rpc('check_rate_limit', {
            'p_profile_id': str(g.user_id),
            'p_action_type': action_type,
            'p_max_count': limit_config['max'],
            'p_window_interval': get_interval(limit_config['window'])
        }).execute()

        # If rate limit exceeded, return 429
        if result.data is False:
            return {
                'error': 'Rate limit exceeded',
                'message': f"Maximum {limit_config['max']} {action_type}s per {limit_config['window']}"
            }, 429

        return None

    except Exception as e:
        # Log error but don't block request
        print(f"Rate limit check error: {e}")
        return None

def get_action_type(path, method):
    """Determine action type from request path"""
    if method != 'POST':
        return None

    if '/api/conversations' in path and '/messages' in path:
        return 'message'
    elif '/api/breeding' in path:
        return 'breeding_intent'
    elif '/api/lost-pets' in path:
        return 'lost_pet_report'
    elif '/api/providers' in path and '/ratings' in path:
        return 'provider_rating'

    return None

def get_interval(window):
    """Convert window string to PostgreSQL interval"""
    intervals = {
        'hour': '1 hour',
        'day': '1 day',
        '7days': '7 days',
        '30days': '30 days'
    }
    return intervals.get(window, '1 hour')
