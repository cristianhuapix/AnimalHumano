from flask import Blueprint, request, jsonify, g
from config import supabase, supabase_admin
from middleware.auth import require_auth
from datetime import datetime

vaccines_bp = Blueprint('vaccines', __name__)

@vaccines_bp.route('/pets/<pet_id>/vaccinations', methods=['GET'])
def get_pet_vaccinations(pet_id):
    """Get all vaccinations for a specific pet"""
    try:
        # Get vaccinations with vaccine details
        result = supabase.table('pet_vaccinations')\
            .select('*, vaccines(name, description, required)')\
            .eq('pet_id', pet_id)\
            .order('applied_on', desc=True)\
            .execute()

        return jsonify({
            'success': True,
            'data': result.data
        }), 200
    except Exception as e:
        print(f'[VACCINES] Error getting vaccinations: {str(e)}')
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@vaccines_bp.route('/pets/<pet_id>/vaccinations', methods=['POST'])
def create_pet_vaccination(pet_id):
    """Create a new vaccination record for a pet"""
    try:
        data = request.get_json()

        # Validate required fields
        if not data.get('vaccine_id') or not data.get('applied_on'):
            return jsonify({
                'success': False,
                'error': 'vaccine_id and applied_on are required'
            }), 400

        # Prepare vaccination data
        vaccination_data = {
            'pet_id': pet_id,
            'vaccine_id': data['vaccine_id'],
            'applied_on': data['applied_on'],
            'next_due_on': data.get('next_due_on'),
            'batch_number': data.get('batch_number'),
            'veterinarian_name': data.get('veterinarian_name'),
            'notes': data.get('notes')
        }

        # Add provider_id if user is authenticated
        if hasattr(g, 'user_id') and g.user_id:
            vaccination_data['provider_id'] = str(g.user_id)
            print(f'[VACCINES] Adding provider_id: {g.user_id}')
        else:
            print(f'[VACCINES] WARNING: No user_id found in g object')

        print(f'[VACCINES] Vaccination data to insert: {vaccination_data}')

        # Insert vaccination record
        result = supabase.table('pet_vaccinations')\
            .insert(vaccination_data)\
            .execute()

        return jsonify({
            'success': True,
            'data': result.data[0] if result.data else None
        }), 201
    except Exception as e:
        print(f'[VACCINES] Error creating vaccination: {str(e)}')
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@vaccines_bp.route('/vaccines', methods=['GET'])
def get_vaccines():
    """Get all available vaccines, optionally filtered by species"""
    try:
        species_id = request.args.get('species_id')

        query = supabase.table('vaccines').select('*')

        if species_id:
            query = query.eq('species_id', species_id)

        # Order by required first, then by name
        result = query.order('required', desc=True)\
            .order('name')\
            .execute()

        return jsonify({
            'success': True,
            'data': result.data
        }), 200
    except Exception as e:
        print(f'[VACCINES] Error getting vaccines: {str(e)}')
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@vaccines_bp.route('/pets/<pet_id>/pending-vaccines', methods=['GET'])
def get_pending_vaccines(pet_id):
    """Get count of pending required vaccines for a pet"""
    try:
        # First, get the pet's species
        pet_result = supabase.table('pets')\
            .select('species_id')\
            .eq('id', pet_id)\
            .single()\
            .execute()

        if not pet_result.data:
            return jsonify({
                'success': False,
                'error': 'Pet not found'
            }), 404

        species_id = pet_result.data['species_id']

        # Get all required vaccines for this species
        vaccines_result = supabase.table('vaccines')\
            .select('id')\
            .eq('species_id', species_id)\
            .eq('required', True)\
            .execute()

        required_vaccine_ids = [v['id'] for v in vaccines_result.data]

        # Get vaccines already applied to this pet
        applied_result = supabase.table('pet_vaccinations')\
            .select('vaccine_id')\
            .eq('pet_id', pet_id)\
            .in_('vaccine_id', required_vaccine_ids)\
            .execute()

        applied_vaccine_ids = [v['vaccine_id'] for v in applied_result.data]

        # Calculate pending count
        pending_count = len([vid for vid in required_vaccine_ids if vid not in applied_vaccine_ids])

        return jsonify({
            'success': True,
            'data': {
                'pending_count': pending_count,
                'total_required': len(required_vaccine_ids),
                'applied_count': len(applied_vaccine_ids)
            }
        }), 200
    except Exception as e:
        print(f'[VACCINES] Error calculating pending vaccines: {str(e)}')
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
