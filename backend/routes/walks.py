"""
Walks routes (PRD Section 12)
"""

from flask import Blueprint, request, g
from config import supabase_admin
from middleware.auth import require_auth, require_provider

walks_bp = Blueprint('walks', __name__)

@walks_bp.route('/', methods=['GET'])
@require_auth
def get_walks():
    """
    Get walks (owner sees their pets' walks, walker sees their walks)
    PRD Section 12: Mis paseos (paginación 20 registros)
    """
    page = int(request.args.get('page', 1))
    page_size = min(int(request.args.get('page_size', 20)), 20)
    offset = (page - 1) * page_size

    try:
        # Check if user is a walker
        walker_provider = supabase_admin.table('providers')\
            .select('id')\
            .eq('profile_id', g.user_id)\
            .eq('service_type', 'walker')\
            .eq('active', True)\
            .execute()

        if walker_provider.data:
            # User is a walker - show their walks
            walker_id = walker_provider.data[0]['id']

            count_result = supabase_admin.table('walks')\
                .select('id', count='exact')\
                .eq('walker_id', walker_id)\
                .execute()

            total = count_result.count

            walks = supabase_admin.table('walks')\
                .select('*, pets(name, photo_url, dnia, owner:profiles(full_name))')\
                .eq('walker_id', walker_id)\
                .order('created_at', desc=True)\
                .range(offset, offset + page_size - 1)\
                .execute()

        else:
            # User is a pet owner - show their pets' walks
            my_pets = supabase_admin.table('pets')\
                .select('id')\
                .eq('owner_id', g.user_id)\
                .eq('is_deleted', False)\
                .execute()

            pet_ids = [p['id'] for p in my_pets.data]

            if not pet_ids:
                return {'data': [], 'pagination': {'page': 1, 'page_size': page_size, 'total': 0, 'pages': 0}}, 200

            count_result = supabase_admin.table('walks')\
                .select('id', count='exact')\
                .in_('pet_id', pet_ids)\
                .execute()

            total = count_result.count

            walks = supabase_admin.table('walks')\
                .select('*, pets(name, photo_url, dnia), walker:providers(*, profile:profiles(full_name))')\
                .in_('pet_id', pet_ids)\
                .order('created_at', desc=True)\
                .range(offset, offset + page_size - 1)\
                .execute()

        return {
            'data': walks.data,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total': total,
                'pages': (total + page_size - 1) // page_size
            }
        }, 200

    except Exception as e:
        return {'error': 'Failed to get walks', 'message': str(e)}, 400

@walks_bp.route('/start', methods=['POST'])
@require_provider
def start_walk():
    """
    Start walk by scanning QR
    PRD Section 12: Walker scans QR to start
    """
    data = request.json

    required_fields = ['pet_id', 'qr_code']
    for field in required_fields:
        if field not in data:
            return {'error': f'Missing required field: {field}'}, 400

    try:
        # Get walker provider ID
        walker = supabase_admin.table('providers')\
            .select('id')\
            .eq('profile_id', g.user_id)\
            .eq('service_type', 'walker')\
            .eq('active', True)\
            .single()\
            .execute()

        if not walker.data:
            return {'error': 'Not registered as walker'}, 403

        # Use database function to start walk
        result = supabase_admin.rpc('start_walk', {
            'p_pet_id': data['pet_id'],
            'p_walker_id': walker.data['id'],
            'p_qr_code': data['qr_code']
        }).execute()

        walk_id = result.data

        # Get walk details
        walk = supabase_admin.table('walks')\
            .select('*, pets(name, photo_url, dnia, owner:profiles(full_name))')\
            .eq('id', walk_id)\
            .single()\
            .execute()

        # TODO: Send notification to pet owner

        return walk.data, 201

    except Exception as e:
        return {'error': 'Failed to start walk', 'message': str(e)}, 400

@walks_bp.route('/end', methods=['POST'])
@require_provider
def end_walk():
    """
    End walk by scanning QR
    PRD Section 12: Walker scans QR to end
    """
    data = request.json

    required_fields = ['walk_id', 'qr_code']
    for field in required_fields:
        if field not in data:
            return {'error': f'Missing required field: {field}'}, 400

    try:
        # Use database function to end walk
        result = supabase_admin.rpc('end_walk', {
            'p_walk_id': data['walk_id'],
            'p_qr_code': data['qr_code']
        }).execute()

        # Get walk details
        walk = supabase_admin.table('walks')\
            .select('*, pets(name, photo_url, dnia, owner:profiles(full_name))')\
            .eq('id', data['walk_id'])\
            .single()\
            .execute()

        # TODO: Send notification to pet owner

        return walk.data, 200

    except Exception as e:
        return {'error': 'Failed to end walk', 'message': str(e)}, 400

@walks_bp.route('/<walk_id>', methods=['GET'])
@require_auth
def get_walk(walk_id):
    """Get walk details"""
    try:
        walk = supabase_admin.table('walks')\
            .select('*, pets(name, photo_url, dnia, owner_id), walker:providers(*, profile:profiles(full_name, profile_id))')\
            .eq('id', walk_id)\
            .single()\
            .execute()

        # Check access (pet owner or walker)
        is_owner = walk.data['pets']['owner_id'] == g.user_id
        is_walker = walk.data['walker']['profile']['profile_id'] == g.user_id

        if not is_owner and not is_walker:
            return {'error': 'Access denied'}, 403

        return walk.data, 200

    except Exception as e:
        return {'error': 'Walk not found', 'message': str(e)}, 404

@walks_bp.route('/autoclose', methods=['POST'])
def autoclose_walks():
    """
    Auto-close walks after 10 hours
    PRD Section 12: Autocierre a las 10h
    This endpoint should be called by a cron job
    """
    # TODO: Add API key authentication for cron jobs
    try:
        result = supabase_admin.rpc('autoclose_walks').execute()
        closed_count = result.data

        return {
            'message': f'{closed_count} walks auto-closed',
            'count': closed_count
        }, 200

    except Exception as e:
        return {'error': 'Failed to auto-close walks', 'message': str(e)}, 400

@walks_bp.route('/<walk_id>/notes', methods=['PUT'])
@require_provider
def add_walk_notes(walk_id):
    """Add notes to walk (walker only)"""
    data = request.json

    if 'notes' not in data:
        return {'error': 'Notes required'}, 400

    try:
        # Get walk
        walk = supabase_admin.table('walks')\
            .select('walker_id')\
            .eq('id', walk_id)\
            .single()\
            .execute()

        # Verify walker
        walker = supabase_admin.table('providers')\
            .select('profile_id')\
            .eq('id', walk.data['walker_id'])\
            .single()\
            .execute()

        if walker.data['profile_id'] != g.user_id:
            return {'error': 'Not your walk'}, 403

        # Update notes
        result = supabase_admin.table('walks')\
            .update({'notes': data['notes']})\
            .eq('id', walk_id)\
            .execute()

        return result.data[0], 200

    except Exception as e:
        return {'error': 'Failed to add notes', 'message': str(e)}, 400
