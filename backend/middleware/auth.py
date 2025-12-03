"""
Authentication middleware
Validates JWT tokens from Supabase Auth
"""

from flask import request, g
from functools import wraps
from config import supabase
import sys
import logging

logger = logging.getLogger(__name__)

# Public endpoints that don't require authentication
PUBLIC_ENDPOINTS = [
    '/health',
    '/',
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/reset-password',
    '/api/providers',  # Public provider search
    '/api/providers/service-types',  # Public service types catalog
    '/api/data',  # Public reference data (species, breeds, vaccines)
]

# Endpoints that are public only for certain HTTP methods
PUBLIC_GET_ONLY = [
    '/api/lost-pets',  # Public GET (search), but POST/PUT/DELETE require auth
]

def is_public_endpoint(path, method='GET'):
    """Check if endpoint is public for the given HTTP method"""
    # Check fully public endpoints (all methods allowed)
    for endpoint in PUBLIC_ENDPOINTS:
        # Exact match or path starts with endpoint followed by / or ?
        # BUT: /api/providers should only match the list endpoint, not /api/providers/me/*
        if endpoint == '/api/providers':
            # Only allow exact match or query params, NOT subpaths like /me/services
            if path == endpoint or path.startswith(endpoint + '?'):
                return True
        elif path == endpoint or path.startswith(endpoint + '/') or path.startswith(endpoint + '?'):
            return True

    # Check GET-only public endpoints
    if method == 'GET':
        for endpoint in PUBLIC_GET_ONLY:
            if path == endpoint or path.startswith(endpoint + '/') or path.startswith(endpoint + '?'):
                return True

    return False

def auth_middleware():
    """Validate authentication token before each request"""
    # Skip auth for OPTIONS requests (CORS preflight)
    if request.method == 'OPTIONS':
        return None

    # Skip auth for public endpoints
    if is_public_endpoint(request.path, request.method):
        logger.info(f"Public endpoint accessed: {request.method} {request.path}")
        return None

    # Get token from Authorization header
    auth_header = request.headers.get('Authorization')

    if not auth_header:
        logger.error(f"Auth failed for {request.path}: No authorization header")
        return {'error': 'No authorization header'}, 401

    try:
        # Extract token (format: "Bearer <token>")
        token = auth_header.split(' ')[1] if ' ' in auth_header else auth_header
        logger.info(f"Validating token for {request.path}: {token[:20]}...")

        # Verify token with Supabase
        user = supabase.auth.get_user(token)
        logger.info(f"User authenticated: {user.user.id if user and user.user else 'NO USER'}")

        if not user or not user.user:
            logger.error(f"Auth failed: Invalid token")
            return {'error': 'Invalid token'}, 401

        # Store user in request context
        g.user = user.user
        g.user_id = user.user.id
        g.token = token

        logger.info(f"Auth successful for user {g.user_id}")
        return None

    except Exception as e:
        logger.error(f"Auth exception for {request.path}: {str(e)}")
        return {'error': 'Authentication failed', 'message': str(e)}, 401

def require_auth(f):
    """Decorator to require authentication for specific routes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not hasattr(g, 'user_id'):
            return {'error': 'Authentication required'}, 401
        return f(*args, **kwargs)
    return decorated_function

def require_admin(f):
    """Decorator to require admin privileges"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not hasattr(g, 'user_id'):
            return {'error': 'Authentication required'}, 401

        # Check if user is admin
        from config import supabase
        profile = supabase.table('profiles').select('is_admin').eq('id', g.user_id).single().execute()

        if not profile.data or not profile.data.get('is_admin'):
            return {'error': 'Admin privileges required'}, 403

        return f(*args, **kwargs)
    return decorated_function

def require_provider(f):
    """Decorator to require provider role"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not hasattr(g, 'user_id'):
            return {'error': 'Authentication required'}, 401

        # Check if user is provider
        from config import supabase
        profile = supabase.table('profiles').select('is_provider').eq('id', g.user_id).single().execute()

        if not profile.data or not profile.data.get('is_provider'):
            return {'error': 'Provider role required'}, 403

        # Get provider ID
        provider = supabase.table('providers').select('id').eq('profile_id', g.user_id).execute()

        if not provider.data or len(provider.data) == 0:
            return {'error': 'Provider profile not found'}, 404

        g.provider_id = provider.data[0]['id']

        return f(*args, **kwargs)
    return decorated_function
