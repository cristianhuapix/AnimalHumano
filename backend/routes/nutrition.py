from flask import Blueprint, request, jsonify, g
from middleware.auth import require_auth
from config import supabase, supabase_admin

nutrition_bp = Blueprint('nutrition', __name__)

@nutrition_bp.route('/nutrition-history', methods=['GET'])
@require_auth
def get_nutrition_history():
    """Get nutrition history for current user's pets"""
    try:
        user_id = g.user_id

        # Get nutrition entries with pet info
        response = supabase_admin.table('nutrition_history') \
            .select('*, pets(id, name)') \
            .eq('owner_id', user_id) \
            .order('entry_date', desc=True) \
            .execute()

        entries = []
        for entry in response.data:
            entries.append({
                'id': entry['id'],
                'pet_id': entry['pet_id'],
                'pet_name': entry['pets']['name'] if entry.get('pets') else 'Desconocido',
                'entry_date': entry['entry_date'],
                'comments': entry['comments'],
                'created_at': entry['created_at']
            })

        return jsonify({'data': entries}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@nutrition_bp.route('/nutrition-history', methods=['POST'])
@require_auth
def create_nutrition_entry():
    """Create a new nutrition history entry"""
    try:
        user_id = g.user_id
        data = request.get_json()

        # Validate required fields
        if not data.get('pet_id'):
            return jsonify({'error': 'pet_id es requerido'}), 400
        if not data.get('entry_date'):
            return jsonify({'error': 'entry_date es requerido'}), 400
        if not data.get('comments'):
            return jsonify({'error': 'comments es requerido'}), 400

        # Verify the pet belongs to the user
        pet_check = supabase_admin.table('pets') \
            .select('id, name') \
            .eq('id', data['pet_id']) \
            .eq('owner_id', user_id) \
            .single() \
            .execute()

        if not pet_check.data:
            return jsonify({'error': 'Mascota no encontrada'}), 404

        # Create entry
        entry_data = {
            'pet_id': data['pet_id'],
            'owner_id': user_id,
            'entry_date': data['entry_date'],
            'comments': data['comments']
        }

        response = supabase_admin.table('nutrition_history') \
            .insert(entry_data) \
            .execute()

        if response.data:
            entry = response.data[0]
            return jsonify({
                'data': {
                    'id': entry['id'],
                    'pet_id': entry['pet_id'],
                    'pet_name': pet_check.data['name'],
                    'entry_date': entry['entry_date'],
                    'comments': entry['comments'],
                    'created_at': entry['created_at']
                }
            }), 201

        return jsonify({'error': 'Error al crear registro'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@nutrition_bp.route('/nutrition-history/<entry_id>', methods=['DELETE'])
@require_auth
def delete_nutrition_entry(entry_id):
    """Delete a nutrition history entry"""
    try:
        user_id = g.user_id

        # Verify ownership and delete
        response = supabase_admin.table('nutrition_history') \
            .delete() \
            .eq('id', entry_id) \
            .eq('owner_id', user_id) \
            .execute()

        return jsonify({'message': 'Registro eliminado'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
