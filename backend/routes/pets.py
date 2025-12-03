"""
Pets routes (PRD Section 6)
"""

from flask import Blueprint, request, g
from config import supabase, supabase_admin
from middleware.auth import require_auth
import base64
import uuid
from datetime import datetime

pets_bp = Blueprint('pets', __name__)

@pets_bp.route('/', methods=['GET'])
@require_auth
def get_my_pets():
    """
    Get user's pets
    PRD Section 6: Mis Mascotas
    Pagination: max 9 per page
    """
    page = int(request.args.get('page', 1))
    page_size = min(int(request.args.get('page_size', 9)), 9)
    offset = (page - 1) * page_size

    try:
        # Get total count
        count_result = supabase.table('pets')\
            .select('id', count='exact')\
            .eq('owner_id', g.user_id)\
            .eq('is_deleted', False)\
            .execute()

        total = count_result.count

        # Get pets with species and breed info
        pets = supabase.table('pets')\
            .select('*, species:species_id(name), breed:breed_id(name)')\
            .eq('owner_id', g.user_id)\
            .eq('is_deleted', False)\
            .order('created_at', desc=True)\
            .range(offset, offset + page_size - 1)\
            .execute()

        return {
            'data': pets.data,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total': total,
                'pages': (total + page_size - 1) // page_size
            }
        }, 200

    except Exception as e:
        return {'error': 'Failed to get pets', 'message': str(e)}, 400

@pets_bp.route('/<pet_id>', methods=['GET'])
@require_auth
def get_pet(pet_id):
    """Get single pet details"""
    try:
        pet = supabase.table('pets')\
            .select('*, species:species_id(name, code), breed:breed_id(name, code)')\
            .eq('id', pet_id)\
            .eq('is_deleted', False)\
            .single()\
            .execute()

        # Check ownership or QR access
        if pet.data['owner_id'] != g.user_id:
            # Check QR access
            has_access = supabase.rpc('has_qr_access', {
                'p_pet_id': pet_id,
                'p_profile_id': str(g.user_id)
            }).execute()

            if not has_access.data:
                return {'error': 'Access denied'}, 403

        return {'data': pet.data}, 200

    except Exception as e:
        return {'error': 'Pet not found', 'message': str(e)}, 404

@pets_bp.route('/', methods=['POST'])
@require_auth
def create_pet():
    """
    Create new pet
    PRD Section 6: DNIA auto-generated via trigger
    """
    data = request.json

    # Validate required fields
    required_fields = ['name', 'birth_date', 'species_id', 'breed_id', 'sex']
    for field in required_fields:
        if field not in data:
            return {'error': f'Missing required field: {field}'}, 400

    # Validate sex
    if data['sex'] not in ['M', 'F']:
        return {'error': 'Sex must be M or F'}, 400

    try:
        # Debug: print what data we receive
        print(f"DEBUG: Received data keys: {data.keys()}")
        print(f"DEBUG: Has photo_data: {'photo_data' in data}")
        print(f"DEBUG: Has papers_data: {'papers_data' in data}")

        # First create the pet to get the ID
        pet_data = {
            'owner_id': str(g.user_id),
            'name': data['name'],
            'birth_date': data['birth_date'],
            'species_id': data['species_id'],
            'breed_id': data['breed_id'],
            'sex': data['sex'],
            'crossable': data.get('crossable', False),
            'has_pedigree': data.get('has_pedigree', False)
        }

        # Add custom species/breed names if provided
        if data.get('other_species_name'):
            pet_data['other_species_name'] = data['other_species_name']
        if data.get('other_breed_name'):
            pet_data['other_breed_name'] = data['other_breed_name']

        pet = supabase.table('pets').insert(pet_data).execute()
        pet_id = pet.data[0]['id']

        # Handle photo upload if provided
        photo_url = None
        if data.get('photo_data'):
            try:
                file_bytes = base64.b64decode(data['photo_data'].split(',')[1] if ',' in data['photo_data'] else data['photo_data'])
                file_ext = data.get('photo_name', 'photo.jpg').split('.')[-1] if '.' in data.get('photo_name', '') else 'jpg'
                storage_path = f"pets/{pet_id}-{uuid.uuid4()}.{file_ext}"

                # Use admin client to bypass RLS
                supabase_admin.storage.from_('pet-photos').upload(
                    storage_path,
                    file_bytes,
                    {'content-type': f'image/{file_ext}'}
                )

                photo_url = supabase_admin.storage.from_('pet-photos').get_public_url(storage_path)
            except Exception as e:
                print(f"Error uploading photo: {e}")

        # Handle documents upload if provided
        papers_url = None
        if data.get('papers_data'):
            try:
                file_bytes = base64.b64decode(data['papers_data'].split(',')[1] if ',' in data['papers_data'] else data['papers_data'])
                file_ext = data.get('papers_name', 'document.pdf').split('.')[-1] if '.' in data.get('papers_name', '') else 'pdf'
                storage_path = f"pets/{pet_id}-{uuid.uuid4()}.{file_ext}"
                content_type = 'application/pdf' if file_ext == 'pdf' else f'image/{file_ext}'

                # Use admin client to bypass RLS
                supabase_admin.storage.from_('pet-documents').upload(
                    storage_path,
                    file_bytes,
                    {'content-type': content_type}
                )

                papers_url = supabase_admin.storage.from_('pet-documents').get_public_url(storage_path)
            except Exception as e:
                print(f"Error uploading papers: {e}")

        # Update pet with URLs if we have them
        if photo_url or papers_url:
            update_data = {}
            if photo_url:
                update_data['photo_url'] = photo_url
            if papers_url:
                update_data['papers_url'] = papers_url

            supabase.table('pets').update(update_data).eq('id', pet_id).execute()
            pet.data[0].update(update_data)

        # DNIA is auto-generated by trigger
        return {'data': pet.data[0]}, 201

    except Exception as e:
        return {'error': 'Failed to create pet', 'message': str(e)}, 400

@pets_bp.route('/<pet_id>', methods=['PUT'])
@require_auth
def update_pet(pet_id):
    """
    Update pet
    PRD: Species and breed are IMMUTABLE (enforced by trigger)
    """
    data = request.json

    # Fields that can be updated
    allowed_fields = [
        'name', 'photo_url', 'papers_url',
        'crossable', 'has_pedigree'
    ]

    try:
        # Verify ownership
        pet_check = supabase.table('pets')\
            .select('owner_id')\
            .eq('id', pet_id)\
            .single()\
            .execute()

        if pet_check.data['owner_id'] != g.user_id:
            return {'error': 'Not your pet'}, 403

        # Build update_data - include boolean fields explicitly
        update_data = {}
        for k, v in data.items():
            if k in allowed_fields:
                # Handle boolean fields explicitly (False is a valid value)
                if k in ['crossable', 'has_pedigree']:
                    update_data[k] = v
                elif v:  # Only include non-boolean fields if they have a truthy value
                    update_data[k] = v

        # Handle photo upload if provided
        if data.get('photo_data'):
            try:
                file_bytes = base64.b64decode(data['photo_data'].split(',')[1] if ',' in data['photo_data'] else data['photo_data'])
                file_ext = data.get('photo_name', 'photo.jpg').split('.')[-1] if '.' in data.get('photo_name', '') else 'jpg'
                storage_path = f"pets/{pet_id}-{uuid.uuid4()}.{file_ext}"

                # Use admin client to bypass RLS
                supabase_admin.storage.from_('pet-photos').upload(
                    storage_path,
                    file_bytes,
                    {'content-type': f'image/{file_ext}'}
                )

                photo_url = supabase_admin.storage.from_('pet-photos').get_public_url(storage_path)
                update_data['photo_url'] = photo_url
            except Exception as e:
                print(f"Error uploading photo: {e}")

        # Handle documents upload if provided
        if data.get('papers_data'):
            try:
                file_bytes = base64.b64decode(data['papers_data'].split(',')[1] if ',' in data['papers_data'] else data['papers_data'])
                file_ext = data.get('papers_name', 'document.pdf').split('.')[-1] if '.' in data.get('papers_name', '') else 'pdf'
                storage_path = f"pets/{pet_id}-{uuid.uuid4()}.{file_ext}"
                content_type = 'application/pdf' if file_ext == 'pdf' else f'image/{file_ext}'

                # Use admin client to bypass RLS
                supabase_admin.storage.from_('pet-documents').upload(
                    storage_path,
                    file_bytes,
                    {'content-type': content_type}
                )

                papers_url = supabase_admin.storage.from_('pet-documents').get_public_url(storage_path)
                update_data['papers_url'] = papers_url
            except Exception as e:
                print(f"Error uploading papers: {e}")

        if not update_data:
            return {'error': 'No valid fields to update'}, 400

        # Update the pet
        supabase.table('pets').update(update_data).eq('id', pet_id).execute()

        # Fetch the updated pet with relations
        pet = supabase.table('pets')\
            .select('*, species:species_id(name, code), breed:breed_id(name, code)')\
            .eq('id', pet_id)\
            .single()\
            .execute()

        return {'data': pet.data}, 200

    except Exception as e:
        return {'error': 'Update failed', 'message': str(e)}, 400

@pets_bp.route('/upload-photo', methods=['POST'])
@require_auth
def upload_photo():
    """Upload pet photo to Supabase Storage"""
    try:
        data = request.json
        pet_id = data.get('pet_id')
        file_data = data.get('file_data')  # base64 encoded
        file_name = data.get('file_name', 'photo.jpg')

        if not pet_id or not file_data:
            return {'error': 'Missing pet_id or file_data'}, 400

        # Decode base64
        file_bytes = base64.b64decode(file_data.split(',')[1] if ',' in file_data else file_data)

        # Generate unique filename
        file_ext = file_name.split('.')[-1] if '.' in file_name else 'jpg'
        storage_path = f"pets/{pet_id}-{uuid.uuid4()}.{file_ext}"

        # Upload to Supabase Storage
        result = supabase.storage.from_('pet-photos').upload(
            storage_path,
            file_bytes,
            {'content-type': f'image/{file_ext}'}
        )

        # Get public URL
        url = supabase.storage.from_('pet-photos').get_public_url(storage_path)

        return {'data': {'url': url}}, 200

    except Exception as e:
        return {'error': 'Upload failed', 'message': str(e)}, 400

@pets_bp.route('/upload-documents', methods=['POST'])
@require_auth
def upload_documents():
    """Upload pet documents to Supabase Storage"""
    try:
        data = request.json
        pet_id = data.get('pet_id')
        file_data = data.get('file_data')  # base64 encoded
        file_name = data.get('file_name', 'document.pdf')

        if not pet_id or not file_data:
            return {'error': 'Missing pet_id or file_data'}, 400

        # Decode base64
        file_bytes = base64.b64decode(file_data.split(',')[1] if ',' in file_data else file_data)

        # Generate unique filename
        file_ext = file_name.split('.')[-1] if '.' in file_name else 'pdf'
        storage_path = f"pets/{pet_id}-{uuid.uuid4()}.{file_ext}"

        # Determine content type
        content_type = 'application/pdf' if file_ext == 'pdf' else f'image/{file_ext}'

        # Upload to Supabase Storage
        result = supabase.storage.from_('pet-documents').upload(
            storage_path,
            file_bytes,
            {'content-type': content_type}
        )

        # Get public URL
        url = supabase.storage.from_('pet-documents').get_public_url(storage_path)

        return {'data': {'url': url}}, 200

    except Exception as e:
        return {'error': 'Upload failed', 'message': str(e)}, 400

@pets_bp.route('/<pet_id>', methods=['DELETE'])
@require_auth
def delete_pet(pet_id):
    """
    Soft delete pet
    PRD: Soft delete required (is_deleted=true)
    """
    try:
        # Verify ownership
        pet_check = supabase.table('pets')\
            .select('owner_id')\
            .eq('id', pet_id)\
            .single()\
            .execute()

        if pet_check.data['owner_id'] != g.user_id:
            return {'error': 'Not your pet'}, 403

        # Soft delete
        supabase.table('pets').update({'is_deleted': True}).eq('id', pet_id).execute()
        return {'message': 'Pet deleted successfully'}, 200

    except Exception as e:
        return {'error': 'Delete failed', 'message': str(e)}, 400

@pets_bp.route('/<pet_id>/vaccinations', methods=['GET'])
@require_auth
def get_pet_vaccinations(pet_id):
    """Get pet's vaccination history (PRD Section 7)"""
    try:
        # First check if pet exists and get owner
        pet_check = supabase.table('pets')\
            .select('owner_id')\
            .eq('id', pet_id)\
            .eq('is_deleted', False)\
            .single()\
            .execute()

        if not pet_check.data:
            return {'error': 'Pet not found'}, 404

        # Check if user is owner
        is_owner = pet_check.data['owner_id'] == g.user_id

        # If not owner, check QR access
        if not is_owner:
            has_access = supabase.rpc('has_qr_access', {
                'p_pet_id': pet_id,
                'p_profile_id': str(g.user_id)
            }).execute()

            if not has_access.data:
                return {'error': 'Access denied'}, 403

        vaccinations = supabase.table('pet_vaccinations')\
            .select('*, vaccines(name, description, required, contagious_to_humans)')\
            .eq('pet_id', pet_id)\
            .order('applied_on', desc=True)\
            .execute()

        return {'data': vaccinations.data}, 200

    except Exception as e:
        return {'error': 'Failed to get vaccinations', 'message': str(e)}, 400

@pets_bp.route('/<pet_id>/vaccinations', methods=['POST'])
@require_auth
def add_vaccination(pet_id):
    """
    Add vaccination record
    PRD Section 7: Owners or vets with QR access can add
    """
    data = request.json

    required_fields = ['vaccine_id', 'applied_on']
    for field in required_fields:
        if field not in data:
            return {'error': f'Missing required field: {field}'}, 400

    try:
        # First check if pet exists and get owner
        pet_check = supabase.table('pets')\
            .select('owner_id')\
            .eq('id', pet_id)\
            .eq('is_deleted', False)\
            .single()\
            .execute()

        if not pet_check.data:
            return {'error': 'Pet not found'}, 404

        # Check if user is owner
        is_owner = pet_check.data['owner_id'] == g.user_id

        # If not owner, check QR access
        if not is_owner:
            has_access = supabase.rpc('has_qr_access', {
                'p_pet_id': pet_id,
                'p_profile_id': str(g.user_id)
            }).execute()

            if not has_access.data:
                return {'error': 'Access denied'}, 403

        # Check if the user is a provider (only providers should have provider_id set)
        # If veterinarian_name is provided, it means a provider is applying the vaccine
        is_provider_application = bool(data.get('veterinarian_name'))

        vaccination_data = {
            'pet_id': pet_id,
            'vaccine_id': data['vaccine_id'],
            'applied_on': data['applied_on'],
            'next_due_on': data.get('next_due_on'),
            'applied_by': str(g.user_id),
            'provider_id': str(g.user_id) if is_provider_application else None,
            'veterinarian_name': data.get('veterinarian_name'),
            'batch_number': data.get('batch_number'),
            'notes': data.get('notes')
        }

        print(f'[PETS/VACCINATIONS] Adding vaccination for pet {pet_id}')
        print(f'[PETS/VACCINATIONS] User ID: {g.user_id}')
        print(f'[PETS/VACCINATIONS] Is provider application: {is_provider_application}')
        print(f'[PETS/VACCINATIONS] Provider ID: {vaccination_data["provider_id"]}')
        print(f'[PETS/VACCINATIONS] Veterinarian name: {data.get("veterinarian_name")}')
        print(f'[PETS/VACCINATIONS] Data: {vaccination_data}')

        vaccination = supabase.table('pet_vaccinations').insert(vaccination_data).execute()
        print(f'[PETS/VACCINATIONS] Vaccination added successfully')
        return vaccination.data[0], 201

    except Exception as e:
        return {'error': 'Failed to add vaccination', 'message': str(e)}, 400

@pets_bp.route('/<pet_id>/boardings', methods=['GET'])
@require_auth
def get_pet_boardings(pet_id):
    """Get boarding history for a specific pet"""
    try:
        # Check if user has access to this pet
        pet = supabase.table('pets')\
            .select('*')\
            .eq('id', pet_id)\
            .eq('owner_id', str(g.user_id))\
            .eq('is_deleted', False)\
            .single()\
            .execute()

        if not pet.data:
            return {'error': 'Pet not found or access denied'}, 404

        # Get all boardings for this pet with provider information
        result = supabase.table('pet_boardings')\
            .select('*, providers(id, business_name, profiles!providers_profile_id_fkey(full_name))')\
            .eq('pet_id', pet_id)\
            .order('start_date', desc=True)\
            .execute()

        # Transform data to flatten provider information
        boardings = []
        for boarding in result.data:
            provider_data = boarding.get('providers', {})
            if provider_data:
                profile_data = provider_data.get('profiles', {})
                boarding['provider_name'] = provider_data.get('business_name') or profile_data.get('full_name', 'Desconocido')
            else:
                boarding['provider_name'] = 'Desconocido'

            # Remove nested providers object
            boarding.pop('providers', None)
            boardings.append(boarding)

        return {'data': boardings}, 200

    except Exception as e:
        print(f'[PETS/BOARDINGS] Error getting boardings: {str(e)}')
        import traceback
        traceback.print_exc()
        return {'error': 'Failed to get boardings', 'message': str(e)}, 400
