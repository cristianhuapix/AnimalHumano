"""
QR Code routes (PRD Section 7 - Temporal access)
"""

from flask import Blueprint, request, g
from config import supabase, QR_ACCESS_DURATION_HOURS
from middleware.auth import require_auth, require_provider
import uuid

qr_bp = Blueprint('qr', __name__)

@qr_bp.route('/generate/<pet_id>', methods=['POST'])
@require_auth
def generate_qr(pet_id):
    """
    Generate QR code for pet
    PRD Section 6: Ver QR
    """
    try:
        # Verify ownership
        pet = supabase.table('pets')\
            .select('owner_id')\
            .eq('id', pet_id)\
            .single()\
            .execute()

        if pet.data['owner_id'] != g.user_id:
            return {'error': 'Not your pet'}, 403

        # Generate unique QR code
        qr_code = str(uuid.uuid4())

        qr_data = {
            'pet_id': pet_id,
            'qr_code': qr_code,
            'is_active': True
        }

        result = supabase.table('pet_qr_codes').insert(qr_data).execute()

        return {
            'qr_code': qr_code,
            'pet_id': pet_id,
            'url': f"animal-humano://qr/{qr_code}"
        }, 201

    except Exception as e:
        return {'error': 'Failed to generate QR', 'message': str(e)}, 400

@qr_bp.route('/scan', methods=['POST'])
@require_auth
def scan_qr():
    """
    Scan QR code to get temporary access
    PRD Section 7: 2-hour temporal access for veterinarians
    """
    data = request.json

    if 'qr_code' not in data:
        return {'error': 'QR code required'}, 400

    scan_type = data.get('scan_type', 'general')  # veterinary, walk_start, walk_end, general

    try:
        # Get pet from QR code
        qr = supabase.table('pet_qr_codes')\
            .select('pet_id, is_active')\
            .eq('qr_code', data['qr_code'])\
            .single()\
            .execute()

        if not qr.data or not qr.data['is_active']:
            return {'error': 'Invalid or inactive QR code'}, 404

        pet_id = qr.data['pet_id']

        # Record scan
        scan_data = {
            'pet_id': pet_id,
            'scanned_by': str(g.user_id),
            'qr_code': data['qr_code'],
            'scan_type': scan_type
        }

        scan_result = supabase.table('qr_scans').insert(scan_data).execute()

        # Get pet info
        pet = supabase.table('pets')\
            .select('*, species(name), breeds(name)')\
            .eq('id', pet_id)\
            .single()\
            .execute()

        return {
            'message': 'QR scanned successfully',
            'access_expires_in_hours': QR_ACCESS_DURATION_HOURS,
            'pet': pet.data,
            'scan_id': scan_result.data[0]['id']
        }, 200

    except Exception as e:
        return {'error': 'Failed to scan QR', 'message': str(e)}, 400

@qr_bp.route('/verify-access/<pet_id>', methods=['GET'])
@require_auth
def verify_access(pet_id):
    """Check if user has access to pet (owner or temporary QR access)"""
    try:
        has_access = supabase.rpc('has_qr_access', {
            'p_pet_id': pet_id,
            'p_profile_id': str(g.user_id)
        }).execute()

        return {
            'has_access': has_access.data,
            'pet_id': pet_id
        }, 200

    except Exception as e:
        return {'error': 'Failed to verify access', 'message': str(e)}, 400
