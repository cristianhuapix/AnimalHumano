"""
Species and Breed Requests Routes
Handles user requests for new species and breeds
"""

from flask import Blueprint, request, g
from middleware.auth import require_auth
from config import supabase_admin

species_breed_requests_bp = Blueprint('species_breed_requests', __name__)

@species_breed_requests_bp.route('/', methods=['POST'])
@require_auth
def create_request():
    """
    Create a new species or breed request
    Expected body:
    {
        "request_type": "species" | "breed",
        "species_name": "string" (if request_type is "species"),
        "breed_name": "string" (if request_type is "breed"),
        "species_id": "uuid" (if request_type is "breed")
    }
    """
    try:
        data = request.json
        request_type = data.get('request_type')

        if request_type not in ['species', 'breed']:
            return {'error': 'Invalid request_type. Must be "species" or "breed"'}, 400

        # Prepare request data
        request_data = {
            'requested_by': str(g.user_id),
            'request_type': request_type,
            'status': 'pending'
        }

        if request_type == 'species':
            species_name = data.get('species_name')
            if not species_name:
                return {'error': 'species_name is required for species requests'}, 400
            request_data['species_name'] = species_name.strip()

        elif request_type == 'breed':
            breed_name = data.get('breed_name')
            species_id = data.get('species_id')
            if not breed_name or not species_id:
                return {'error': 'breed_name and species_id are required for breed requests'}, 400
            request_data['breed_name'] = breed_name.strip()
            request_data['species_id'] = species_id

        # Insert request
        result = supabase_admin.table('species_breed_requests').insert(request_data).execute()

        return {'data': result.data[0], 'message': 'Request submitted successfully'}, 201

    except Exception as e:
        return {'error': 'Failed to create request', 'message': str(e)}, 400


@species_breed_requests_bp.route('/', methods=['GET'])
@require_auth
def get_user_requests():
    """Get all requests from the current user"""
    try:
        result = supabase_admin.table('species_breed_requests')\
            .select('*')\
            .eq('requested_by', g.user_id)\
            .order('created_at', desc=True)\
            .execute()

        return {'data': result.data}, 200

    except Exception as e:
        return {'error': 'Failed to fetch requests', 'message': str(e)}, 400
