"""
Breeding routes (PRD Section 9 - Cruces)
"""

from flask import Blueprint, request, g
from config import supabase
from middleware.auth import require_auth

breeding_bp = Blueprint('breeding', __name__)

@breeding_bp.route('/search', methods=['GET'])
@require_auth
def search_breeding():
    """
    Search pets available for breeding
    PRD Section 9: Buscar pareja
    Filters: species, breed, pedigree, sex
    """
    species_id = request.args.get('species_id')
    breed_id = request.args.get('breed_id')
    has_pedigree = request.args.get('has_pedigree')
    sex = request.args.get('sex')
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', 20))
    offset = (page - 1) * page_size

    try:
        query = supabase.table('breeding_public')\
            .select('*', count='exact')

        if species_id:
            query = query.eq('species_id', species_id)

        if breed_id:
            query = query.eq('breed_id', breed_id)

        if has_pedigree is not None:
            query = query.eq('has_pedigree', has_pedigree == 'true')

        if sex:
            query = query.eq('sex', sex)

        # Exclude own pets
        query = query.neq('owner_id', g.user_id)

        # Get total count
        count_result = query.execute()
        total = count_result.count

        # Get paginated results
        result = query.order('age_years', desc=False)\
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
        return {'error': 'Failed to search breeding pets', 'message': str(e)}, 400

@breeding_bp.route('/intents', methods=['GET'])
@require_auth
def get_breeding_intents():
    """
    Get breeding intents received
    PRD Section 9: Ver intenciones recibidas
    """
    try:
        # Get my pets' IDs
        my_pets = supabase.table('pets')\
            .select('id')\
            .eq('owner_id', g.user_id)\
            .eq('is_deleted', False)\
            .execute()

        pet_ids = [p['id'] for p in my_pets.data]

        if not pet_ids:
            return {'data': []}, 200

        # Get intents targeting my pets
        intents = supabase.table('pet_breeding_intents')\
            .select('*, from_pet:pets!from_pet_id(name, photo_url, dnia, species_id, breed_id), to_pet:pets!to_pet_id(name, photo_url, dnia)')\
            .in_('to_pet_id', pet_ids)\
            .order('created_at', desc=True)\
            .execute()

        return {'data': intents.data}, 200

    except Exception as e:
        return {'error': 'Failed to get intents', 'message': str(e)}, 400

@breeding_bp.route('/intents/sent', methods=['GET'])
@require_auth
def get_sent_breeding_intents():
    """Get breeding intents sent by user"""
    try:
        # Get my pets' IDs
        my_pets = supabase.table('pets')\
            .select('id')\
            .eq('owner_id', g.user_id)\
            .eq('is_deleted', False)\
            .execute()

        pet_ids = [p['id'] for p in my_pets.data]

        if not pet_ids:
            return {'data': []}, 200

        # Get intents from my pets
        intents = supabase.table('pet_breeding_intents')\
            .select('*, from_pet:pets!from_pet_id(name, photo_url, dnia), to_pet:pets!to_pet_id(name, photo_url, dnia, species_id, breed_id)')\
            .in_('from_pet_id', pet_ids)\
            .order('created_at', desc=True)\
            .execute()

        return {'data': intents.data}, 200

    except Exception as e:
        return {'error': 'Failed to get sent intents', 'message': str(e)}, 400

@breeding_bp.route('/intents', methods=['POST'])
@require_auth
def create_breeding_intent():
    """
    Create breeding intent
    PRD Section 9: Max 1 intent every 7 days (enforced by rate limiting)
    """
    data = request.json

    required_fields = ['from_pet_id', 'to_pet_id']
    for field in required_fields:
        if field not in data:
            return {'error': f'Missing required field: {field}'}, 400

    try:
        # Validate compatibility
        compatibility = supabase.rpc('validate_breeding_compatibility', {
            'p_from_pet_id': data['from_pet_id'],
            'p_to_pet_id': data['to_pet_id']
        }).execute()

        if compatibility.data and len(compatibility.data) > 0:
            result = compatibility.data[0]
            if not result['compatible']:
                return {'error': result['reason']}, 400

        # Create intent
        intent_data = {
            'from_pet_id': data['from_pet_id'],
            'to_pet_id': data['to_pet_id'],
            'message': data.get('message'),
            'status': 'pending'
        }

        intent = supabase.table('pet_breeding_intents').insert(intent_data).execute()

        # TODO: Send notification to target pet's owner
        # TODO: Create conversation between owners

        return intent.data[0], 201

    except Exception as e:
        # Check for duplicate intent
        if 'no_duplicate_intent' in str(e):
            return {'error': 'You already sent an intent to this pet'}, 409
        return {'error': 'Failed to create intent', 'message': str(e)}, 400

@breeding_bp.route('/intents/<intent_id>', methods=['PUT'])
@require_auth
def update_breeding_intent(intent_id):
    """
    Update breeding intent (accept/reject)
    PRD Section 9: Only target pet owner can accept/reject
    """
    data = request.json

    if 'status' not in data:
        return {'error': 'Status required'}, 400

    valid_statuses = ['accepted', 'rejected', 'cancelled']
    if data['status'] not in valid_statuses:
        return {'error': f'Invalid status. Must be one of: {valid_statuses}'}, 400

    try:
        # Get intent
        intent = supabase.table('pet_breeding_intents')\
            .select('*, to_pet:pets!to_pet_id(owner_id), from_pet:pets!from_pet_id(owner_id)')\
            .eq('id', intent_id)\
            .single()\
            .execute()

        # Check authorization
        # Target owner can accept/reject, sender can cancel
        is_target_owner = intent.data['to_pet']['owner_id'] == g.user_id
        is_sender_owner = intent.data['from_pet']['owner_id'] == g.user_id

        if data['status'] in ['accepted', 'rejected'] and not is_target_owner:
            return {'error': 'Only target pet owner can accept/reject'}, 403

        if data['status'] == 'cancelled' and not is_sender_owner:
            return {'error': 'Only sender can cancel'}, 403

        # Update intent
        update_data = {
            'status': data['status'],
            'responded_at': 'now()'
        }

        result = supabase.table('pet_breeding_intents').update(update_data).eq('id', intent_id).execute()

        # TODO: Send notification to other party

        return result.data[0], 200

    except Exception as e:
        return {'error': 'Update failed', 'message': str(e)}, 400
