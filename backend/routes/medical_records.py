from flask import Blueprint, request, jsonify, g
from config import supabase, supabase_admin
from middleware.auth import require_auth
from datetime import datetime
import base64
import uuid

medical_records_bp = Blueprint('medical_records', __name__)

@medical_records_bp.route('/pets/<pet_id>/medical-records', methods=['GET'])
def get_pet_medical_records(pet_id):
    """Get all medical records for a specific pet"""
    try:
        # Get medical records
        result = supabase.table('medical_records')\
            .select('*')\
            .eq('pet_id', pet_id)\
            .order('record_date', desc=True)\
            .order('created_at', desc=True)\
            .execute()

        # Map record_date to date for frontend compatibility and add created_by_name
        records = result.data
        for record in records:
            if 'record_date' in record:
                record['date'] = record['record_date']

            # Get user's full name if created_by exists
            if 'created_by' in record and record['created_by']:
                try:
                    # Get profile using the auth user ID (created_by = auth.uid = profiles.id)
                    profile_result = supabase.table('profiles')\
                        .select('full_name')\
                        .eq('id', record['created_by'])\
                        .single()\
                        .execute()

                    if profile_result.data:
                        full_name = profile_result.data.get('full_name', '').strip()
                        record['created_by_name'] = full_name if full_name else 'Veterinario'
                    else:
                        record['created_by_name'] = 'Veterinario'
                except Exception as profile_error:
                    print(f'[MEDICAL_RECORDS] Error getting profile info: {str(profile_error)}')
                    record['created_by_name'] = 'Veterinario'
            else:
                record['created_by_name'] = 'Veterinario'

        return jsonify(records), 200
    except Exception as e:
        print(f'[MEDICAL_RECORDS] Error getting medical records: {str(e)}')
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@medical_records_bp.route('/pets/<pet_id>/medical-records', methods=['POST'])
@require_auth
def create_medical_record(pet_id):
    """Create a new medical record for a pet"""
    try:
        data = request.get_json()
        print(f'[MEDICAL_RECORDS] === POST REQUEST RECEIVED ===')
        print(f'[MEDICAL_RECORDS] pet_id: {pet_id}')
        print(f'[MEDICAL_RECORDS] user_id from g: {g.user_id}')
        print(f'[MEDICAL_RECORDS] Received data keys: {list(data.keys()) if data else "NO DATA"}')
        print(f'[MEDICAL_RECORDS] Full data: {data}')

        # Validate required fields
        if not data.get('title') or not data.get('description'):
            print(f'[MEDICAL_RECORDS] Validation failed: title={data.get("title")}, description={data.get("description")}')
            return jsonify({
                'success': False,
                'error': 'title and description are required'
            }), 400

        # Prepare medical record data (matching actual table schema)
        medical_record_data = {
            'pet_id': pet_id,
            'record_date': data.get('date', datetime.now().strftime('%Y-%m-%d')),
            'title': data['title'],
            'description': data['description'],
            'created_by': str(g.user_id)  # Add user ID who created the record
        }

        # Handle file attachment if present
        if data.get('attachment_data') and data.get('attachment_name'):
            try:
                # Upload file to Supabase Storage
                attachment_url = upload_medical_record_attachment(
                    pet_id,
                    data['attachment_data'],
                    data['attachment_name']
                )
                # Store attachment as JSON in attachments column
                medical_record_data['attachments'] = [{
                    'url': attachment_url,
                    'name': data['attachment_name']
                }]
                print(f'[MEDICAL_RECORDS] Attachment uploaded: {attachment_url}')
            except Exception as e:
                print(f'[MEDICAL_RECORDS] Error uploading attachment: {str(e)}')
                # Continue without attachment
                pass

        print(f'[MEDICAL_RECORDS] Medical record data to insert: {medical_record_data}')

        # Insert medical record using admin client to bypass RLS
        result = supabase_admin.table('medical_records')\
            .insert(medical_record_data)\
            .execute()

        return jsonify({
            'success': True,
            'data': result.data[0] if result.data else None
        }), 201
    except Exception as e:
        print(f'[MEDICAL_RECORDS] Error creating medical record: {str(e)}')
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@medical_records_bp.route('/pets/<pet_id>/medical-records/<record_id>', methods=['PUT'])
def update_medical_record(pet_id, record_id):
    """Update a medical record"""
    try:
        data = request.get_json()

        # Prepare update data
        update_data = {}
        if 'date' in data:
            update_data['record_date'] = data['date']
        if 'title' in data:
            update_data['title'] = data['title']
        if 'description' in data:
            update_data['description'] = data['description']
        if 'veterinarian_id' in data:
            update_data['veterinarian_id'] = data['veterinarian_id']
        if 'veterinarian_name' in data:
            update_data['veterinarian_name'] = data['veterinarian_name']

        # Handle file attachment update if present
        if data.get('attachment_data') and data.get('attachment_name'):
            try:
                # Upload new file to Supabase Storage
                attachment_url = upload_medical_record_attachment(
                    pet_id,
                    data['attachment_data'],
                    data['attachment_name']
                )
                update_data['attachment_url'] = attachment_url
                update_data['attachment_name'] = data['attachment_name']
            except Exception as e:
                print(f'[MEDICAL_RECORDS] Error uploading attachment: {str(e)}')
                pass

        if not update_data:
            return jsonify({
                'success': False,
                'error': 'No fields to update'
            }), 400

        update_data['updated_at'] = datetime.now().isoformat()

        # Update medical record
        result = supabase.table('medical_records')\
            .update(update_data)\
            .eq('id', record_id)\
            .eq('pet_id', pet_id)\
            .execute()

        return jsonify({
            'success': True,
            'data': result.data[0] if result.data else None
        }), 200
    except Exception as e:
        print(f'[MEDICAL_RECORDS] Error updating medical record: {str(e)}')
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@medical_records_bp.route('/pets/<pet_id>/medical-records/<record_id>', methods=['DELETE'])
def delete_medical_record(pet_id, record_id):
    """Delete a medical record"""
    try:
        # Get the record first to delete associated files
        record_result = supabase.table('medical_records')\
            .select('attachment_url')\
            .eq('id', record_id)\
            .eq('pet_id', pet_id)\
            .execute()

        if record_result.data and record_result.data[0].get('attachment_url'):
            # Delete attachment from storage
            try:
                file_path = extract_file_path_from_url(record_result.data[0]['attachment_url'])
                if file_path:
                    supabase.storage.from_('medical-records').remove([file_path])
            except Exception as e:
                print(f'[MEDICAL_RECORDS] Error deleting attachment: {str(e)}')
                pass

        # Delete medical record
        result = supabase.table('medical_records')\
            .delete()\
            .eq('id', record_id)\
            .eq('pet_id', pet_id)\
            .execute()

        return jsonify({
            'success': True,
            'message': 'Medical record deleted successfully'
        }), 200
    except Exception as e:
        print(f'[MEDICAL_RECORDS] Error deleting medical record: {str(e)}')
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def upload_medical_record_attachment(pet_id, base64_data, file_name):
    """Upload a medical record attachment to Supabase Storage"""
    try:
        print(f'[MEDICAL_RECORDS] Starting upload for pet {pet_id}, file: {file_name}')

        # Extract base64 data (remove data:image/png;base64, prefix if present)
        if ',' in base64_data:
            base64_data = base64_data.split(',')[1]

        # Decode base64 to binary
        file_binary = base64.b64decode(base64_data)
        print(f'[MEDICAL_RECORDS] Decoded file size: {len(file_binary)} bytes')

        # Generate unique filename
        file_extension = file_name.split('.')[-1] if '.' in file_name else 'jpg'
        unique_filename = f"{pet_id}/{uuid.uuid4()}.{file_extension}"
        print(f'[MEDICAL_RECORDS] Unique filename: {unique_filename}')

        # Upload to Supabase Storage using admin client (bypasses RLS)
        result = supabase_admin.storage.from_('medical-records').upload(
            unique_filename,
            file_binary,
            {
                'content-type': f'image/{file_extension}' if file_extension in ['jpg', 'jpeg', 'png'] else 'application/pdf',
                'upsert': 'false'
            }
        )
        print(f'[MEDICAL_RECORDS] Upload result: {result}')

        # Get public URL and clean it (remove trailing query parameters)
        public_url = supabase_admin.storage.from_('medical-records').get_public_url(unique_filename)
        # Remove any trailing '?' or query parameters that might cause issues
        if public_url.endswith('?'):
            public_url = public_url[:-1]
        print(f'[MEDICAL_RECORDS] Public URL: {public_url}')

        return public_url
    except Exception as e:
        print(f'[MEDICAL_RECORDS] Error in upload_medical_record_attachment: {str(e)}')
        import traceback
        traceback.print_exc()
        raise e

def extract_file_path_from_url(url):
    """Extract the file path from a Supabase storage URL"""
    try:
        # URL format: https://[project].supabase.co/storage/v1/object/public/medical-records/path/to/file
        parts = url.split('/medical-records/')
        if len(parts) > 1:
            return parts[1]
        return None
    except Exception:
        return None
