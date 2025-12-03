from flask import Blueprint, g, request
from middleware.auth import require_auth
from config import supabase, supabase_admin
from datetime import datetime, timedelta
import math

services_bp = Blueprint('services', __name__)

@services_bp.route('/service-types', methods=['GET'])
def get_service_types():
    """Get all available service types (public endpoint)"""
    try:
        category = request.args.get('category')  # Optional filter by category

        query = supabase.table('service_types').select('*').order('category').order('name')

        if category:
            query = query.eq('category', category)

        result = query.execute()
        return result.data, 200

    except Exception as e:
        print(f'[SERVICE-TYPES] Error: {str(e)}')
        return {'error': 'Failed to get service types', 'message': str(e)}, 400

def calculate_distance(lat1, lon1, lat2, lon2):
    """
    Calculate distance between two coordinates using Haversine formula
    Returns distance in kilometers
    """
    if not all([lat1, lon1, lat2, lon2]):
        return None

    # Convert to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])

    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    r = 6371  # Radius of earth in kilometers

    return c * r

@services_bp.route('/search', methods=['GET'])
@require_auth
def search_services():
    """
    Search provider services with filters
    Query params:
      - category: filter by category (veterinary, grooming, etc)
      - service_type_id: filter by specific service type
      - max_distance: maximum distance in km (default 50)
      - q: search query for business name or description
      - lat: user latitude for distance calculation
      - lon: user longitude for distance calculation
    """
    try:
        # Get query parameters (can be multiple)
        categories = request.args.getlist('category')
        service_type_ids = request.args.getlist('service_type_id')
        max_distance = float(request.args.get('max_distance', 50))
        search_query = request.args.get('q', '').lower()
        user_lat = request.args.get('lat', type=float)
        user_lon = request.args.get('lon', type=float)

        print(f'[SERVICES/SEARCH] Searching with filters:')
        print(f'  categories: {categories}')
        print(f'  service_type_ids: {service_type_ids}')
        print(f'  max_distance: {max_distance}')
        print(f'  search_query: {search_query}')
        print(f'  user_coords: ({user_lat}, {user_lon})')

        # Build query - get provider info with profile data
        query = supabase_admin.table('provider_services')\
            .select('*, service_type:service_types(*), providers(id, address, latitude, longitude, rating, rating_count, profiles(full_name, city, phone, email))')\
            .eq('active', True)

        # Filter by service type IDs (if only one, use direct filter)
        if len(service_type_ids) == 1:
            query = query.eq('service_type_id', service_type_ids[0])
        elif len(service_type_ids) > 1:
            query = query.in_('service_type_id', service_type_ids)

        # Execute query
        result = query.execute()

        print(f'[SERVICES/SEARCH] Found {len(result.data)} services from database')

        # Process results
        services = []
        for service in result.data:
            # Filter by categories (done in Python since Supabase filter doesn't work with aliases)
            if len(categories) > 0:
                service_category = service.get('service_type', {}).get('category')
                if service_category not in categories:
                    continue
            # Flatten provider data structure
            provider = service.get('providers', {})
            profile = provider.get('profiles', {})

            # Merge profile data into provider for easier access in frontend
            if profile:
                provider['business_name'] = profile.get('full_name')
                provider['city'] = profile.get('city')
                provider['phone'] = profile.get('phone')
                provider['email'] = profile.get('email')

            # Filter by search query
            if search_query:
                business_name = (provider.get('business_name') or '').lower()
                description = (service.get('description') or '').lower()

                if search_query not in business_name and search_query not in description:
                    continue

            # Calculate distance if coordinates provided
            if user_lat and user_lon:
                provider_lat = provider.get('latitude')
                provider_lon = provider.get('longitude')

                if provider_lat and provider_lon:
                    distance = calculate_distance(user_lat, user_lon, provider_lat, provider_lon)
                    provider['distance'] = round(distance, 1)

                    # Filter by max distance
                    if distance > max_distance:
                        continue
                else:
                    # No coordinates for provider, skip if distance filter is active
                    provider['distance'] = None

            services.append(service)

        # Sort by distance if available
        services.sort(key=lambda x: x.get('providers', {}).get('distance') or float('inf'))

        print(f'[SERVICES/SEARCH] Returning {len(services)} services after filtering')

        return {'services': services, 'count': len(services)}, 200

    except Exception as e:
        print(f'[SERVICES/SEARCH] Error: {str(e)}')
        import traceback
        traceback.print_exc()
        return {'error': 'Failed to search services', 'message': str(e)}, 400

@services_bp.route('/providers/<provider_id>', methods=['GET'])
@require_auth
def get_provider_details(provider_id):
    """
    Get provider details including:
    - Provider info (description, address, ratings)
    - Whether current user has contacted this provider
    - Whether current user can rate this provider (30-day rule)
    """
    try:
        user_id = g.user_id
        print(f'[SERVICES/PROVIDER-DETAILS] Getting details for provider {provider_id} requested by user {user_id}')

        # Get provider details with profile
        provider_result = supabase_admin.table('providers')\
            .select('*, profiles(full_name, email, phone, city)')\
            .eq('id', provider_id)\
            .single()\
            .execute()

        if not provider_result.data:
            return {'error': 'Provider not found'}, 404

        provider = provider_result.data

        # Check if user has ever contacted this provider
        # First get all conversations where the user is a participant
        user_conversations = supabase_admin.table('conversation_participants')\
            .select('conversation_id')\
            .eq('profile_id', user_id)\
            .execute()

        user_conv_ids = [conv['conversation_id'] for conv in user_conversations.data]

        has_contacted = False
        if user_conv_ids:
            # Check if provider is also a participant in any of these conversations
            provider_in_convs = supabase_admin.table('conversation_participants')\
                .select('conversation_id')\
                .eq('profile_id', provider_id)\
                .in_('conversation_id', user_conv_ids)\
                .execute()

            has_contacted = len(provider_in_convs.data) > 0

        # Check if user can rate this provider
        can_rate = False
        last_rating_date = None

        if has_contacted:
            # Check last rating from this user to this provider
            rating_result = supabase_admin.table('provider_ratings')\
                .select('created_at')\
                .eq('user_id', user_id)\
                .eq('provider_id', provider_id)\
                .order('created_at', desc=True)\
                .limit(1)\
                .execute()

            if len(rating_result.data) == 0:
                # Never rated, can rate
                can_rate = True
            else:
                # Check if 30 days have passed
                last_rating = rating_result.data[0]
                last_rating_date = last_rating['created_at']

                # Parse the date (format: 2024-01-15T12:30:00+00:00)
                last_rating_dt = datetime.fromisoformat(last_rating_date.replace('Z', '+00:00'))
                days_since_last_rating = (datetime.now(last_rating_dt.tzinfo) - last_rating_dt).days

                can_rate = days_since_last_rating >= 30

        return {
            'provider': provider,
            'has_contacted': has_contacted,
            'can_rate': can_rate,
            'last_rating_date': last_rating_date
        }, 200

    except Exception as e:
        print(f'[SERVICES/PROVIDER-DETAILS] Error: {str(e)}')
        import traceback
        traceback.print_exc()
        return {'error': 'Failed to get provider details', 'message': str(e)}, 400
