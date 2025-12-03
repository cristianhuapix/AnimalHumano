"""
Public data routes for species, breeds, and vaccines
These are read-only reference data endpoints
"""

from flask import Blueprint
from config import supabase

data_bp = Blueprint('data', __name__)

@data_bp.route('/species', methods=['GET'])
def get_species():
    """Get all species"""
    try:
        result = supabase.table('species')\
            .select('id, name, code')\
            .order('name')\
            .execute()

        return {'data': result.data}, 200
    except Exception as e:
        return {'error': str(e)}, 500

@data_bp.route('/breeds', methods=['GET'])
def get_breeds():
    """Get all breeds with species info"""
    try:
        result = supabase.table('breeds')\
            .select('id, name, code, species_id, species:species_id(name, code)')\
            .order('name')\
            .execute()

        return {'data': result.data}, 200
    except Exception as e:
        return {'error': str(e)}, 500

@data_bp.route('/breeds/by-species/<species_id>', methods=['GET'])
def get_breeds_by_species(species_id):
    """Get breeds for a specific species"""
    try:
        result = supabase.table('breeds')\
            .select('id, name, code')\
            .eq('species_id', species_id)\
            .order('name')\
            .execute()

        return {'data': result.data}, 200
    except Exception as e:
        return {'error': str(e)}, 500

@data_bp.route('/vaccines', methods=['GET'])
def get_vaccines():
    """Get all vaccines with species info"""
    try:
        result = supabase.table('vaccines')\
            .select('id, name, description, required, interval_days, contagious_to_humans, species_id, species:species_id(name, code)')\
            .order('name')\
            .execute()

        return {'data': result.data}, 200
    except Exception as e:
        return {'error': str(e)}, 500

@data_bp.route('/vaccines/by-species/<species_id>', methods=['GET'])
def get_vaccines_by_species(species_id):
    """Get vaccines for a specific species"""
    try:
        result = supabase.table('vaccines')\
            .select('id, name, description, required, interval_days, contagious_to_humans')\
            .eq('species_id', species_id)\
            .order('required.desc, name')\
            .execute()

        return {'data': result.data}, 200
    except Exception as e:
        return {'error': str(e)}, 500
