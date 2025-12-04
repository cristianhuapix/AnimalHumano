"""
Providers routes (PRD Section 8)
"""

from flask import Blueprint, request, g
from config import supabase, supabase_admin, DEFAULT_PAGE_SIZE, SUPABASE_URL, SUPABASE_ANON_KEY
from middleware.auth import require_auth, require_provider
from supabase import create_client

providers_bp = Blueprint('providers', __name__)

@providers_bp.route('/service-types', methods=['GET'])
def get_service_types():
    """Get all available service types (public endpoint)"""
    try:
        category = request.args.get('category')  # Optional filter by category

        query = supabase.table('service_types').select('*').order('category').order('name')

        if category:
            query = query.eq('category', category)

        result = query.execute()
        return {'data': result.data}, 200

    except Exception as e:
        return {'error': 'Failed to get service types', 'message': str(e)}, 400

@providers_bp.route('/me/features', methods=['GET'])
@require_provider
def get_my_features():
    """Get available features for current provider based on their services"""
    try:
        provider_id = g.provider_id

        # Features that are always available for all providers
        ALWAYS_AVAILABLE = {'my_services', 'qr_scanner', 'my_chats', 'my_ratings', 'lost_pets'}

        # Get available features from the view
        result = supabase.table('provider_available_features')\
            .select('*')\
            .eq('provider_id', provider_id)\
            .execute()

        available_features = result.data

        # Get all features
        all_features_result = supabase.table('provider_features')\
            .select('*')\
            .execute()

        all_features = all_features_result.data
        available_codes = {f['code'] for f in available_features}

        # Mark features as enabled/disabled
        features = []
        for feature in all_features:
            # Feature is enabled if it's always available OR if it's in the available codes
            is_enabled = feature['code'] in ALWAYS_AVAILABLE or feature['code'] in available_codes

            # Override feature name for my_services
            feature_data = {**feature, 'enabled': is_enabled}
            if feature['code'] == 'my_services':
                feature_data['name'] = 'Registrar Servicios'

            features.append(feature_data)

        # Sort: enabled first, then disabled
        features.sort(key=lambda x: (not x['enabled'], x['name']))

        return {'data': features}, 200

    except Exception as e:
        return {'error': 'Failed to get features', 'message': str(e)}, 400

@providers_bp.route('/', methods=['GET'])
def search_providers():
    """
    Search providers (public endpoint)
    PRD Section 8: Buscar servicios
    """
    service_type = request.args.get('service_type')
    city = request.args.get('city')
    page = int(request.args.get('page', 1))
    page_size = min(int(request.args.get('page_size', DEFAULT_PAGE_SIZE)), 100)
    offset = (page - 1) * page_size

    try:
        query = supabase.table('providers')\
            .select('*, profiles!inner(full_name, city, country)', count='exact')\
            .eq('active', True)

        if service_type:
            query = query.eq('service_type', service_type)

        if city:
            query = query.eq('profiles.city', city)

        # Get total count
        count_result = query.execute()
        total = count_result.count

        # Get paginated results
        result = query.order('rating', desc=True)\
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
        return {'error': 'Failed to search providers', 'message': str(e)}, 400

@providers_bp.route('/nearby', methods=['GET'])
def get_nearby_providers():
    """
    Get nearby providers using geolocation
    PRD Section 8: Google Maps integration
    """
    latitude = request.args.get('latitude', type=float)
    longitude = request.args.get('longitude', type=float)
    radius_km = request.args.get('radius', type=float, default=10)
    service_type = request.args.get('service_type')

    if not latitude or not longitude:
        return {'error': 'Latitude and longitude required'}, 400

    try:
        result = supabase.rpc('find_nearby_providers', {
            'p_latitude': latitude,
            'p_longitude': longitude,
            'p_radius_km': radius_km,
            'p_service_type': service_type
        }).execute()

        return {'data': result.data}, 200

    except Exception as e:
        return {'error': 'Failed to find nearby providers', 'message': str(e)}, 400

@providers_bp.route('/<provider_id>', methods=['GET'])
def get_provider(provider_id):
    """Get provider details (public)"""
    try:
        provider = supabase.table('providers')\
            .select('*, profiles(full_name, phone, city, country)')\
            .eq('id', provider_id)\
            .eq('active', True)\
            .single()\
            .execute()

        # Get availability schedules
        schedules = supabase.table('availability_schedules')\
            .select('*')\
            .eq('provider_id', provider_id)\
            .order('day_of_week')\
            .execute()

        provider.data['schedules'] = schedules.data

        return provider.data, 200

    except Exception as e:
        return {'error': 'Provider not found', 'message': str(e)}, 404

@providers_bp.route('/', methods=['POST'])
@require_auth
def create_provider():
    """
    Create provider profile
    PRD Section 8: Become a provider
    """
    data = request.json

    required_fields = ['service_type', 'description']
    for field in required_fields:
        if field not in data:
            return {'error': f'Missing required field: {field}'}, 400

    valid_types = ['veterinarian', 'groomer', 'walker', 'trainer', 'sitter', 'petshop', 'shelter', 'other']
    if data['service_type'] not in valid_types:
        return {'error': f'Invalid service_type. Must be one of: {valid_types}'}, 400

    try:
        # Update profile to mark as provider
        supabase.table('profiles').update({'is_provider': True}).eq('id', g.user_id).execute()

        provider_data = {
            'profile_id': str(g.user_id),
            'service_type': data['service_type'],
            'description': data['description'],
            'license_number': data.get('license_number'),
            'address': data.get('address'),
            'google_place_id': data.get('google_place_id'),
            'latitude': data.get('latitude'),
            'longitude': data.get('longitude'),
            'active': True
        }

        provider = supabase.table('providers').insert(provider_data).execute()
        return provider.data[0], 201

    except Exception as e:
        return {'error': 'Failed to create provider', 'message': str(e)}, 400

@providers_bp.route('/<provider_id>', methods=['PUT'])
@require_auth
def update_provider(provider_id):
    """Update provider profile"""
    data = request.json

    try:
        # Verify ownership
        provider = supabase.table('providers')\
            .select('profile_id')\
            .eq('id', provider_id)\
            .single()\
            .execute()

        if provider.data['profile_id'] != g.user_id:
            return {'error': 'Not your provider profile'}, 403

        allowed_fields = [
            'description', 'license_number', 'address',
            'google_place_id', 'latitude', 'longitude', 'active'
        ]

        update_data = {k: v for k, v in data.items() if k in allowed_fields}

        if not update_data:
            return {'error': 'No valid fields to update'}, 400

        result = supabase.table('providers').update(update_data).eq('id', provider_id).execute()
        return result.data[0], 200

    except Exception as e:
        return {'error': 'Update failed', 'message': str(e)}, 400

@providers_bp.route('/<provider_id>/ratings', methods=['GET'])
def get_provider_ratings(provider_id):
    """Get provider ratings"""
    try:
        ratings = supabase.table('provider_ratings')\
            .select('*, profiles(full_name)')\
            .eq('provider_id', provider_id)\
            .order('created_at', desc=True)\
            .execute()

        return {'data': ratings.data}, 200

    except Exception as e:
        return {'error': 'Failed to get ratings', 'message': str(e)}, 400

@providers_bp.route('/<provider_id>/ratings', methods=['POST'])
@require_auth
def rate_provider(provider_id):
    """
    Rate provider
    PRD Section 8: Max 1 rating every 30 days
    Rate limiting enforced by database constraint
    """
    data = request.json

    if 'rating' not in data:
        return {'error': 'Rating required'}, 400

    if not isinstance(data['rating'], int) or not (1 <= data['rating'] <= 5):
        return {'error': 'Rating must be between 1 and 5'}, 400

    try:
        rating_data = {
            'provider_id': provider_id,
            'rated_by': str(g.user_id),
            'rating': data['rating'],
            'comment': data.get('comment')
        }

        rating = supabase.table('provider_ratings').insert(rating_data).execute()
        return rating.data[0], 201

    except Exception as e:
        # Check if it's a duplicate rating constraint error
        if 'one_rating_per_30_days' in str(e):
            return {'error': 'You can only rate a provider once every 30 days'}, 429
        return {'error': 'Failed to rate provider', 'message': str(e)}, 400

@providers_bp.route('/<provider_id>/schedules', methods=['POST'])
@require_provider
def add_availability(provider_id):
    """Add availability schedule (PRD Section 8: Calendario de atención)"""
    data = request.json

    required_fields = ['day_of_week', 'start_time', 'end_time']
    for field in required_fields:
        if field not in data:
            return {'error': f'Missing required field: {field}'}, 400

    try:
        # Verify ownership
        provider = supabase.table('providers')\
            .select('profile_id')\
            .eq('id', provider_id)\
            .single()\
            .execute()

        if provider.data['profile_id'] != g.user_id:
            return {'error': 'Not your provider profile'}, 403

        schedule_data = {
            'provider_id': provider_id,
            'day_of_week': data['day_of_week'],
            'start_time': data['start_time'],
            'end_time': data['end_time']
        }

        schedule = supabase.table('availability_schedules').insert(schedule_data).execute()
        return schedule.data[0], 201

    except Exception as e:
        return {'error': 'Failed to add schedule', 'message': str(e)}, 400

@providers_bp.route('/me/services', methods=['GET'])
@require_provider
def get_my_services():
    """Get current provider's services with service type details"""
    try:
        # Get provider ID from user
        provider = supabase.table('providers')\
            .select('id')\
            .eq('profile_id', g.user_id)\
            .single()\
            .execute()

        provider_id = provider.data['id']

        # Get all services for this provider with service type details
        # Use admin client to bypass RLS and show both active and inactive services
        # Order by active status (active first) then by created_at
        services = supabase_admin.table('provider_services')\
            .select('*, service_type:service_types(*)')\
            .eq('provider_id', provider_id)\
            .order('active', desc=True)\
            .order('created_at', desc=False)\
            .execute()

        return {'data': services.data}, 200

    except Exception as e:
        return {'error': 'Failed to get services', 'message': str(e)}, 400

@providers_bp.route('/me/services', methods=['POST'])
@require_provider
def add_my_service():
    """Add a new service for the current provider"""
    data = request.json

    required_fields = ['service_type_id']
    for field in required_fields:
        if field not in data:
            return {'error': f'Missing required field: {field}'}, 400

    try:
        # Get provider ID from user
        provider = supabase.table('providers')\
            .select('id')\
            .eq('profile_id', g.user_id)\
            .single()\
            .execute()

        provider_id = provider.data['id']

        service_data = {
            'provider_id': provider_id,
            'service_type_id': data['service_type_id'],
            'custom_name': data.get('custom_name'),
            'custom_description': data.get('custom_description'),
            'notes': data.get('notes'),
            'active': data.get('active', True)
        }

        # Use admin client to bypass RLS
        service = supabase_admin.table('provider_services').insert(service_data).execute()

        # Fetch the complete service with service_type details using admin client
        complete_service = supabase_admin.table('provider_services')\
            .select('*, service_type:service_types(*)')\
            .eq('id', service.data[0]['id'])\
            .single()\
            .execute()

        return complete_service.data, 201

    except Exception as e:
        error_str = str(e)
        print(f"[ADD SERVICE ERROR] {type(e).__name__}: {error_str}")

        import traceback
        traceback.print_exc()
        return {'error': 'Failed to add service', 'message': error_str}, 400

@providers_bp.route('/me/services/<service_id>', methods=['PUT'])
@require_provider
def update_my_service(service_id):
    """Update a service"""
    data = request.json

    try:
        # Get provider ID and verify ownership
        provider = supabase.table('providers')\
            .select('id')\
            .eq('profile_id', g.user_id)\
            .single()\
            .execute()

        provider_id = provider.data['id']

        # Verify service belongs to provider using admin client to bypass RLS
        service = supabase_admin.table('provider_services')\
            .select('provider_id')\
            .eq('id', service_id)\
            .single()\
            .execute()

        if service.data['provider_id'] != provider_id:
            return {'error': 'Not your service'}, 403

        allowed_fields = ['custom_name', 'custom_description', 'notes', 'active']
        update_data = {k: v for k, v in data.items() if k in allowed_fields}

        if not update_data:
            return {'error': 'No valid fields to update', 'received_fields': list(data.keys()), 'allowed_fields': allowed_fields}, 400

        # Use admin client to bypass RLS
        result = supabase_admin.table('provider_services').update(update_data).eq('id', service_id).execute()

        # Fetch the complete service with service_type details using admin client
        complete_service = supabase_admin.table('provider_services')\
            .select('*, service_type:service_types(*)')\
            .eq('id', service_id)\
            .single()\
            .execute()

        return complete_service.data, 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {'error': 'Failed to update service', 'message': str(e)}, 400

@providers_bp.route('/me/services/<service_id>', methods=['DELETE'])
@require_provider
def delete_my_service(service_id):
    """Delete a service"""
    try:
        # Get provider ID and verify ownership
        provider = supabase.table('providers')\
            .select('id')\
            .eq('profile_id', g.user_id)\
            .single()\
            .execute()

        provider_id = provider.data['id']

        # Verify service belongs to provider using admin client to bypass RLS
        service = supabase_admin.table('provider_services')\
            .select('provider_id')\
            .eq('id', service_id)\
            .single()\
            .execute()

        if service.data['provider_id'] != provider_id:
            return {'error': 'Not your service'}, 403

        # Delete using admin client
        supabase_admin.table('provider_services').delete().eq('id', service_id).execute()
        return {'message': 'Service deleted'}, 200

    except Exception as e:
        return {'error': 'Failed to delete service', 'message': str(e)}, 400

@providers_bp.route('/me/qr-access', methods=['POST'])
@require_provider
def register_qr_access():
    """
    Register QR access for a provider to a pet
    Now validates dynamic QR token and marks it as used (one-time use)
    """
    data = request.json
    print(f"[QR ACCESS] Received data: {data}")

    required_fields = ['pet_id', 'service_id']
    for field in required_fields:
        if field not in data:
            print(f"[QR ACCESS ERROR] Missing field: {field}")
            return {'error': f'Missing required field: {field}'}, 400

    try:
        provider_id = g.provider_id
        pet_id = data['pet_id']
        service_id = data['service_id']
        qr_token = data.get('qr_token')  # Optional: dynamic QR token
        print(f"[QR ACCESS] Processing - provider_id: {provider_id}, pet_id: {pet_id}, service_id: {service_id}, qr_token: {qr_token[:20] if qr_token else 'None'}...")

        # Verify the service belongs to this provider
        service = supabase_admin.table('provider_services')\
            .select('*, service_type:service_types(*)')\
            .eq('id', service_id)\
            .eq('provider_id', provider_id)\
            .single()\
            .execute()

        if not service.data:
            return {'error': 'Service not found or does not belong to you'}, 403

        # Verify the pet exists
        pet = supabase_admin.table('pets')\
            .select('id, name, owner_id')\
            .eq('id', pet_id)\
            .eq('is_deleted', False)\
            .single()\
            .execute()

        if not pet.data:
            return {'error': 'Pet not found'}, 404

        # QR token is REQUIRED - validate and consume it (one-time use)
        if not qr_token:
            print(f"[QR ACCESS ERROR] No QR token provided")
            return {'error': 'Se requiere un código QR válido. Pida al dueño que genere uno nuevo.'}, 400

        # Use the validate_and_use_qr function to validate and mark as used
        service_category = service.data['service_type']['category']
        scan_type = 'veterinary' if service_category == 'veterinary' else 'general'

        qr_result = supabase_admin.rpc('validate_and_use_qr', {
            'p_pet_id': pet_id,
            'p_qr_code': qr_token,
            'p_scanned_by': str(g.user_id),
            'p_scan_type': scan_type
        }).execute()

        if qr_result.data and len(qr_result.data) > 0:
            qr_valid = qr_result.data[0].get('valid', False)
            if not qr_valid:
                print(f"[QR ACCESS ERROR] QR token invalid or already used")
                return {'error': 'Código QR inválido, ya usado o expirado. Pida al dueño que genere uno nuevo.'}, 400
            print(f"[QR ACCESS] QR token validated and consumed successfully")
        else:
            print(f"[QR ACCESS ERROR] QR validation failed - no result")
            return {'error': 'Error al validar el código QR'}, 400

        service_category = service.data['service_type']['category']
        service_name = service.data.get('custom_name') or service.data['service_type'].get('name', 'Unknown')
        print(f"[QR ACCESS] Service category: {service_category}")
        print(f"[QR ACCESS] Service name: {service_name}")

        # Determine if this is a simple service (just notes) or complex (like boarding)
        simple_categories = ['grooming', 'petshop', 'shelter', 'training', 'walking']
        is_simple_service = service_category in simple_categories

        return {
            'message': 'Access granted',
            'pet_id': pet_id,
            'pet_name': pet.data['name'],
            'scan_id': 'dynamic_qr',
            'service_category': service_category,
            'is_simple_service': is_simple_service,
            'expires_in_hours': 2,
            'qr_consumed': bool(qr_token)
        }, 201

    except Exception as e:
        print(f"[QR ACCESS ERROR] Exception: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return {'error': 'Failed to register QR access', 'message': str(e)}, 400

@providers_bp.route('/me/vaccinations', methods=['GET'])
@require_provider
def get_my_vaccinations():
    """Get all vaccinations applied by the current provider"""
    try:
        provider_profile_id = str(g.user_id)

        print(f'[PROVIDERS] Getting vaccinations for provider: {provider_profile_id}')

        # Get all vaccinations where provider_id matches the current user
        result = supabase.table('pet_vaccinations')\
            .select('*, pets(id, name, owner_id), vaccines(name, description, required, contagious_to_humans)')\
            .eq('provider_id', provider_profile_id)\
            .order('applied_on', desc=True)\
            .execute()

        print(f'[PROVIDERS] Found {len(result.data)} vaccinations')

        # Get unique owner IDs to fetch their names
        owner_ids = set()
        for vacc in result.data:
            pet_data = vacc.get('pets', {})
            if pet_data and pet_data.get('owner_id'):
                owner_ids.add(pet_data['owner_id'])

        # Fetch owner names - query each owner individually to avoid Supabase .in_() issues
        owners_map = {}
        for owner_id in owner_ids:
            try:
                owner_result = supabase.table('profiles')\
                    .select('id, full_name')\
                    .eq('id', owner_id)\
                    .single()\
                    .execute()

                if owner_result.data:
                    owners_map[owner_id] = owner_result.data.get('full_name', 'Desconocido')
            except Exception as e:
                print(f'[PROVIDERS] Error fetching owner {owner_id}: {str(e)}')
                owners_map[owner_id] = 'Desconocido'

        # Transform data to include owner name at the pet level
        vaccinations = []
        for vacc in result.data:
            pet_data = vacc.get('pets', {})
            if pet_data:
                owner_id = pet_data.get('owner_id')
                pet_data['owner_name'] = owners_map.get(owner_id, 'Desconocido')
                vacc['pets'] = pet_data
            vaccinations.append(vacc)

        return {'data': vaccinations}, 200

    except Exception as e:
        print(f'[PROVIDERS] Error getting vaccinations: {str(e)}')
        return {'error': 'Failed to get vaccinations', 'message': str(e)}, 400

@providers_bp.route('/me/boardings', methods=['POST'])
@require_provider
def create_boarding():
    """Create a new boarding record"""
    try:
        data = request.json
        provider_profile_id = str(g.user_id)

        # Validate required fields
        required_fields = ['pet_id', 'start_date', 'end_date', 'days']
        for field in required_fields:
            if field not in data:
                return {'error': f'Missing required field: {field}'}, 400

        print(f'[PROVIDERS/BOARDINGS] Creating boarding for pet {data["pet_id"]}')
        print(f'[PROVIDERS/BOARDINGS] Provider: {provider_profile_id}')
        print(f'[PROVIDERS/BOARDINGS] Dates: {data["start_date"]} to {data["end_date"]} ({data["days"]} days)')

        # Get provider_id from providers table
        provider_result = supabase.table('providers')\
            .select('id')\
            .eq('profile_id', provider_profile_id)\
            .single()\
            .execute()

        if not provider_result.data:
            return {'error': 'Provider not found'}, 404

        provider_id = provider_result.data['id']

        # Create boarding record
        boarding_data = {
            'pet_id': data['pet_id'],
            'provider_id': provider_id,
            'profile_id': provider_profile_id,
            'start_date': data['start_date'],
            'end_date': data['end_date'],
            'days': data['days'],
            'notes': data.get('notes'),
            'status': 'active'
        }

        # Use supabase_admin (service role) to bypass RLS
        # The profile_id in the data ensures ownership tracking
        result = supabase_admin.table('pet_boardings').insert(boarding_data).execute()
        print(f'[PROVIDERS/BOARDINGS] Boarding created successfully: {result.data[0]["id"]}')

        return {'data': result.data[0]}, 201

    except Exception as e:
        print(f'[PROVIDERS/BOARDINGS] Error creating boarding: {str(e)}')
        import traceback
        traceback.print_exc()
        return {'error': 'Failed to create boarding', 'message': str(e)}, 400

@providers_bp.route('/me/boardings', methods=['GET'])
@require_provider
def get_my_boardings():
    """Get all boardings for the current provider"""
    try:
        provider_profile_id = str(g.user_id)

        print(f'[PROVIDERS/BOARDINGS] Getting boardings for provider: {provider_profile_id}')

        # Get provider_id
        provider_result = supabase.table('providers')\
            .select('id')\
            .eq('profile_id', provider_profile_id)\
            .single()\
            .execute()

        if not provider_result.data:
            return {'error': 'Provider not found'}, 404

        provider_id = provider_result.data['id']

        # Get all boardings for this provider with pet and owner information
        # Use supabase_admin to bypass RLS for reading
        result = supabase_admin.table('pet_boardings')\
            .select('*, pets(id, name, owner_id)')\
            .eq('provider_id', provider_id)\
            .order('start_date', desc=True)\
            .execute()

        print(f'[PROVIDERS/BOARDINGS] Found {len(result.data)} boardings')

        # Get unique owner IDs to fetch their names
        owner_ids = set()
        for boarding in result.data:
            pet_data = boarding.get('pets', {})
            if pet_data and pet_data.get('owner_id'):
                owner_ids.add(pet_data['owner_id'])

        # Fetch owner names
        owners_map = {}
        for owner_id in owner_ids:
            try:
                owner_result = supabase.table('profiles')\
                    .select('id, full_name')\
                    .eq('id', owner_id)\
                    .single()\
                    .execute()

                if owner_result.data:
                    owners_map[owner_id] = owner_result.data.get('full_name', 'Desconocido')
            except Exception as e:
                print(f'[PROVIDERS/BOARDINGS] Error fetching owner {owner_id}: {str(e)}')
                owners_map[owner_id] = 'Desconocido'

        # Transform data to include owner name at the pet level
        boardings = []
        for boarding in result.data:
            pet_data = boarding.get('pets', {})
            if pet_data:
                owner_id = pet_data.get('owner_id')
                pet_data['owner_name'] = owners_map.get(owner_id, 'Desconocido')
                boarding['pets'] = pet_data
            boardings.append(boarding)

        return {'data': boardings}, 200

    except Exception as e:
        print(f'[PROVIDERS/BOARDINGS] Error getting boardings: {str(e)}')
        import traceback
        traceback.print_exc()
        return {'error': 'Failed to get boardings', 'message': str(e)}, 400

@providers_bp.route('/me/boardings/<boarding_id>', methods=['PATCH'])
@require_provider
def update_boarding(boarding_id):
    """Update boarding status"""
    try:
        data = request.json
        provider_profile_id = str(g.user_id)

        print(f'[PROVIDERS/BOARDINGS] Updating boarding {boarding_id}')

        # Verify the boarding belongs to this provider
        boarding = supabase.table('pet_boardings')\
            .select('*')\
            .eq('id', boarding_id)\
            .eq('profile_id', provider_profile_id)\
            .single()\
            .execute()

        if not boarding.data:
            return {'error': 'Boarding not found or access denied'}, 404

        # Update boarding
        update_data = {}
        if 'status' in data:
            update_data['status'] = data['status']
        if 'notes' in data:
            update_data['notes'] = data['notes']

        result = supabase.table('pet_boardings')\
            .update(update_data)\
            .eq('id', boarding_id)\
            .execute()

        print(f'[PROVIDERS/BOARDINGS] Boarding updated successfully')

        return {'data': result.data[0]}, 200

    except Exception as e:
        print(f'[PROVIDERS/BOARDINGS] Error updating boarding: {str(e)}')
        import traceback
        traceback.print_exc()
        return {'error': 'Failed to update boarding', 'message': str(e)}, 400

# Category to table mapping for simple services (just notes)
SIMPLE_SERVICE_TABLES = {
    'grooming': 'grooming',
    'petshop': 'pet_shop_visits',  # To be created if needed
    'shelter': 'shelter_adoptions',
    'training': 'trainings',
    'walking': 'walks'
}

@providers_bp.route('/me/simple-service', methods=['POST'])
@require_provider
def create_simple_service():
    """Create a simple service record (grooming, training, shelter, walks, petshop)"""
    try:
        data = request.json
        provider_profile_id = str(g.user_id)

        # Validate required fields
        required_fields = ['pet_id', 'service_category']
        for field in required_fields:
            if field not in data:
                return {'error': f'Missing required field: {field}'}, 400

        pet_id = data['pet_id']
        service_category = data['service_category']
        notes = data.get('notes', '')

        print(f'[PROVIDERS/SIMPLE-SERVICE] Creating {service_category} record for pet {pet_id}')
        print(f'[PROVIDERS/SIMPLE-SERVICE] Provider: {provider_profile_id}')

        # Validate service category
        if service_category not in SIMPLE_SERVICE_TABLES:
            return {'error': f'Invalid service category: {service_category}'}, 400

        table_name = SIMPLE_SERVICE_TABLES[service_category]

        # Get provider_id from providers table
        provider_result = supabase.table('providers')\
            .select('id')\
            .eq('profile_id', provider_profile_id)\
            .single()\
            .execute()

        if not provider_result.data:
            return {'error': 'Provider not found'}, 404

        provider_id = provider_result.data['id']

        # Verify pet exists
        pet = supabase.table('pets')\
            .select('id, name')\
            .eq('id', pet_id)\
            .eq('is_deleted', False)\
            .single()\
            .execute()

        if not pet.data:
            return {'error': 'Pet not found'}, 404

        # Create service record using admin client to bypass RLS
        record_data = {
            'pet_id': pet_id,
            'provider_id': provider_id,
            'profile_id': provider_profile_id,
            'notes': notes
        }

        result = supabase_admin.table(table_name).insert(record_data).execute()

        print(f'[PROVIDERS/SIMPLE-SERVICE] {service_category.capitalize()} record created successfully')

        return {
            'data': result.data[0],
            'message': f'{service_category.capitalize()} record created successfully'
        }, 201

    except Exception as e:
        print(f'[PROVIDERS/SIMPLE-SERVICE] Error creating service: {str(e)}')
        import traceback
        traceback.print_exc()
        return {'error': 'Failed to create service record', 'message': str(e)}, 400

@providers_bp.route('/me/<service_category>', methods=['GET'])
@require_provider
def get_my_simple_services(service_category):
    """Get all simple service records for a specific category"""
    try:
        provider_profile_id = str(g.user_id)

        print(f'[PROVIDERS/SIMPLE-SERVICE] Getting {service_category} records for provider: {provider_profile_id}')

        # Validate service category
        if service_category not in SIMPLE_SERVICE_TABLES:
            return {'error': f'Invalid service category: {service_category}'}, 400

        table_name = SIMPLE_SERVICE_TABLES[service_category]

        # Get provider_id from providers table
        provider_result = supabase.table('providers')\
            .select('id')\
            .eq('profile_id', provider_profile_id)\
            .single()\
            .execute()

        if not provider_result.data:
            return {'error': 'Provider not found'}, 404

        provider_id = provider_result.data['id']

        # Get all records for this provider with pet and owner information
        # Use supabase_admin to bypass RLS for reading
        result = supabase_admin.table(table_name)\
            .select('*, pets(id, name, owner_id)')\
            .eq('provider_id', provider_id)\
            .order('created_at', desc=True)\
            .execute()

        print(f'[PROVIDERS/SIMPLE-SERVICE] Found {len(result.data)} {service_category} records')

        # Get unique owner IDs to fetch their names
        owner_ids = set()
        for record in result.data:
            pet_data = record.get('pets', {})
            if pet_data and pet_data.get('owner_id'):
                owner_ids.add(pet_data['owner_id'])

        # Fetch owner names
        owners_map = {}
        for owner_id in owner_ids:
            try:
                owner_result = supabase.table('profiles')\
                    .select('id, full_name')\
                    .eq('id', owner_id)\
                    .single()\
                    .execute()

                if owner_result.data:
                    owners_map[owner_id] = owner_result.data.get('full_name', 'Desconocido')
            except Exception as e:
                print(f'[PROVIDERS/SIMPLE-SERVICE] Error fetching owner {owner_id}: {str(e)}')
                owners_map[owner_id] = 'Desconocido'

        # Transform data to include owner name at the pet level
        records = []
        for record in result.data:
            pet_data = record.get('pets', {})
            if pet_data:
                owner_id = pet_data.get('owner_id')
                pet_data['owner_name'] = owners_map.get(owner_id, 'Desconocido')
                record['pets'] = pet_data
            records.append(record)

        return {'data': records}, 200

    except Exception as e:
        print(f'[PROVIDERS/SIMPLE-SERVICE] Error getting {service_category} records: {str(e)}')
        import traceback
        traceback.print_exc()
        return {'error': f'Failed to get {service_category} records', 'message': str(e)}, 400
