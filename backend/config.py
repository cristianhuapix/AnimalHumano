"""
Configuration module for Animal Humano backend
"""

import os
from supabase import create_client, Client

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Create Supabase clients
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Google Maps API
MAPS_API_KEY = os.getenv("MAPS_API_KEY", "")

# Firebase Cloud Messaging
FCM_SERVER_KEY = os.getenv("FCM_SERVER_KEY", "")

# Rate limiting (PRD Section 17)
RATE_LIMITS = {
    'message': {'max': 20, 'window': 'hour'},
    'breeding_intent': {'max': 1, 'window': '7days'},
    'lost_pet_report': {'max': 100, 'window': 'day'},  # Aumentado para desarrollo
    'provider_rating': {'max': 1, 'window': '30days'}
}

# JWT configuration
JWT_SECRET = os.getenv("FLASK_SECRET_KEY", "dev-secret-key")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Pagination defaults
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

# QR access duration (PRD Section 7)
QR_ACCESS_DURATION_HOURS = 2

# Walk auto-close duration (PRD Section 12)
WALK_AUTOCLOSE_HOURS = 10

# File upload limits
MAX_FILE_SIZE_MB = 10
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf'}

# Supported languages (PRD Section 18)
SUPPORTED_LANGUAGES = ['es', 'en', 'pt']
DEFAULT_LANGUAGE = 'es'
