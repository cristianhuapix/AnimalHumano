"""
Lost Pets routes (PRD Section 11)
"""

from flask import Blueprint, request, g
from config import supabase, supabase_admin
from middleware.auth import require_auth
import math

lost_pets_bp = Blueprint('lost_pets', __name__)

def calculate_distance(lat1, lon1, lat2, lon2):
    """
    Calculate distance between two points using Haversine formula
    Returns distance in kilometers
    """
    R = 6371  # Earth's radius in kilometers

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c

@lost_pets_bp.route('/', methods=['GET'])
def search_lost_pets():
    """
    Search lost pets (public endpoint)
    PRD Section 11: Mascotas perdidas
    Supports filtering by location if latitude, longitude, and radius_km are provided
    """
    species_id = request.args.get('species_id')
    breed_id = request.args.get('breed_id')
    latitude = request.args.get('latitude', type=float)
    longitude = request.args.get('longitude', type=float)
    radius_km = request.args.get('radius_km', type=float)
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', 20))
    offset = (page - 1) * page_size

    try:
        # If location parameters provided, filter by distance in Python
        if latitude is not None and longitude is not None and radius_km is not None:
            # Get all reports with location data
            query = supabase.table('lost_pet_reports')\
                .select('*, species(name), breeds(name), pet:pets(name, dnia, photo_url, species:species_id(name), breed:breed_id(name))')\
                .eq('found', False)\
                .not_.is_('latitude', 'null')\
                .not_.is_('longitude', 'null')

            if species_id:
                query = query.eq('species_id', species_id)

            all_reports = query.execute().data

            # Filter by distance
            filtered_reports = []
            for report in all_reports:
                if report['latitude'] and report['longitude']:
                    distance = calculate_distance(latitude, longitude, report['latitude'], report['longitude'])
                    if distance <= radius_km:
                        report['distance_km'] = round(distance, 2)
                        filtered_reports.append(report)

            # Sort by created_at (newest first)
            filtered_reports.sort(key=lambda x: x.get('created_at', ''), reverse=True)

            # Apply pagination
            total = len(filtered_reports)
            paginated_reports = filtered_reports[offset:offset + page_size]

            # Get images for each report
            for report in paginated_reports:
                images = supabase.table('lost_pet_images')\
                    .select('image_url')\
                    .eq('report_id', report['id'])\
                    .execute()
                report['images'] = [img['image_url'] for img in images.data]

            return {
                'data': {
                    'data': paginated_reports,
                    'page': page,
                    'page_size': page_size,
                    'count': total,
                    'total_pages': (total + page_size - 1) // page_size if total > 0 else 0
                }
            }, 200

        # Otherwise, use regular query without location filtering
        query = supabase.table('lost_pet_reports')\
            .select('*, species(name), breeds(name), pet:pets(name, dnia, photo_url, species:species_id(name), breed:breed_id(name))', count='exact')\
            .eq('found', False)

        if species_id:
            query = query.eq('species_id', species_id)

        if breed_id:
            query = query.eq('breed_id', breed_id)

        # Get total count
        count_result = query.execute()
        total = count_result.count

        # Get paginated results with images
        reports = query.order('created_at', desc=True)\
            .range(offset, offset + page_size - 1)\
            .execute()

        # Get images for each report
        for report in reports.data:
            images = supabase.table('lost_pet_images')\
                .select('image_url')\
                .eq('report_id', report['id'])\
                .execute()
            report['images'] = [img['image_url'] for img in images.data]

        return {
            'data': {
                'data': reports.data,
                'page': page,
                'page_size': page_size,
                'count': total,
                'total_pages': (total + page_size - 1) // page_size
            }
        }, 200

    except Exception as e:
        return {'error': 'Failed to search lost pets', 'message': str(e)}, 400

@lost_pets_bp.route('/nearby', methods=['GET'])
def get_nearby_lost_pets():
    """
    Get lost pets near location
    PRD Section 11: Filtros por radio (en km)
    """
    latitude = request.args.get('latitude', type=float)
    longitude = request.args.get('longitude', type=float)
    radius_km = request.args.get('radius', type=float, default=10)
    species_id = request.args.get('species_id')

    if not latitude or not longitude:
        return {'error': 'Latitude and longitude required'}, 400

    try:
        result = supabase.rpc('find_nearby_lost_pets', {
            'p_latitude': latitude,
            'p_longitude': longitude,
            'p_radius_km': radius_km,
            'p_species_id': species_id
        }).execute()

        return {'data': result.data}, 200

    except Exception as e:
        return {'error': 'Failed to find nearby lost pets', 'message': str(e)}, 400

@lost_pets_bp.route('/', methods=['POST'])
@require_auth
def create_lost_pet_report():
    """
    Create lost pet report
    PRD Section 11: Dos opciones - reportar propia perdida o encontrada
    Max 5 reports per day (enforced by rate limiting)
    """
    print(f"[CREATE REPORT] Content-Type: {request.content_type}")
    print(f"[CREATE REPORT] Is JSON: {request.is_json}")
    print(f"[CREATE REPORT] Has files: {bool(request.files)}")

    # Handle both JSON and FormData
    if request.is_json:
        data = request.json
        print(f"[CREATE REPORT] JSON data: {data}")
    else:
        # FormData - convert to dict
        data = request.form.to_dict()
        print(f"[CREATE REPORT] Form data: {data}")
        # Convert numeric strings to numbers
        if 'latitude' in data:
            data['latitude'] = float(data['latitude'])
        if 'longitude' in data:
            data['longitude'] = float(data['longitude'])

    required_fields = ['report_type', 'description']
    for field in required_fields:
        if field not in data:
            return {'error': f'Missing required field: {field}'}, 400

    if data['report_type'] not in ['lost', 'found']:
        return {'error': 'Report type must be "lost" or "found"'}, 400

    try:
        report_data = {
            'reporter_id': str(g.user_id),
            'report_type': data['report_type'],
            'description': data['description'],
            'pet_id': data.get('pet_id'),
            'species_id': data.get('species_id'),
            'breed_id': data.get('breed_id'),
            'contact_phone': data.get('contact_phone'),
            'last_seen_at': data.get('last_seen_at'),
            'latitude': data.get('latitude'),
            'longitude': data.get('longitude'),
            'found': False
        }

        # If pet_id provided, verify ownership and check for duplicates
        if report_data['pet_id']:
            pet = supabase.table('pets')\
                .select('owner_id')\
                .eq('id', report_data['pet_id'])\
                .single()\
                .execute()

            if pet.data['owner_id'] != g.user_id:
                return {'error': 'Not your pet'}, 403

            # Check if pet already has an active lost report
            existing_report = supabase.table('lost_pet_reports')\
                .select('id')\
                .eq('pet_id', report_data['pet_id'])\
                .eq('found', False)\
                .execute()

            if existing_report.data and len(existing_report.data) > 0:
                return {'error': 'Esta mascota ya tiene un reporte activo de pérdida'}, 400

        report = supabase.table('lost_pet_reports').insert(report_data).execute()
        report_id = report.data[0]['id']

        # If reporting own pet as lost, copy pet images to lost pet images
        if report_data['pet_id'] and report_data['report_type'] == 'lost':
            try:
                pet_images = supabase.table('pet_images')\
                    .select('image_url')\
                    .eq('pet_id', report_data['pet_id'])\
                    .execute()

                if pet_images.data and len(pet_images.data) > 0:
                    for pet_image in pet_images.data:
                        supabase_admin.table('lost_pet_images').insert({
                            'report_id': report_id,
                            'image_url': pet_image['image_url']
                        }).execute()
                    print(f"Copied {len(pet_images.data)} images from pet {report_data['pet_id']} to report {report_id}")
                else:
                    print(f"Warning: Pet {report_data['pet_id']} has no images to copy")
            except Exception as e:
                print(f"Error copying pet images: {str(e)}")
                # Don't fail the whole request if image copying fails

        # Handle file uploads from FormData
        if request.files:
            files = request.files.getlist('images')
            print(f"[CREATE REPORT] Found {len(files)} files to upload")
            for file in files:
                print(f"[CREATE REPORT] Uploading file: {file.filename}, type: {file.content_type}")
                # Upload to Supabase Storage using admin client
                file_path = f"lost-pets/{report_id}/{file.filename}"
                file_bytes = file.read()

                upload_result = supabase_admin.storage.from_('pet-images').upload(
                    file_path,
                    file_bytes,
                    {'content-type': file.content_type}
                )
                print(f"[CREATE REPORT] Upload result: {upload_result}")

                # Get public URL
                public_url = supabase_admin.storage.from_('pet-images').get_public_url(file_path)
                print(f"[CREATE REPORT] Public URL: {public_url}")

                # Save to database (use admin client to bypass RLS)
                supabase_admin.table('lost_pet_images').insert({
                    'report_id': report_id,
                    'image_url': public_url
                }).execute()
                print(f"[CREATE REPORT] Saved image to database")

        # Handle images from JSON (if provided as URLs)
        elif 'images' in data and data['images']:
            for image_url in data['images']:
                supabase_admin.table('lost_pet_images').insert({
                    'report_id': report_id,
                    'image_url': image_url
                }).execute()

        # TODO: Notify nearby users if they have notifications enabled

        return {'data': report.data[0]}, 201

    except Exception as e:
        return {'error': 'Failed to create report', 'message': str(e)}, 400

@lost_pets_bp.route('/<report_id>', methods=['GET'])
def get_lost_pet_report(report_id):
    """Get lost pet report details (public)"""
    try:
        report = supabase.table('lost_pet_reports')\
            .select('*, species(name), breeds(name), pet:pets(name, dnia, photo_url), reporter:profiles(full_name)')\
            .eq('id', report_id)\
            .single()\
            .execute()

        # Get images
        images = supabase.table('lost_pet_images')\
            .select('image_url')\
            .eq('report_id', report_id)\
            .execute()

        report.data['images'] = [img['image_url'] for img in images.data]

        return report.data, 200

    except Exception as e:
        return {'error': 'Report not found', 'message': str(e)}, 404

@lost_pets_bp.route('/<report_id>', methods=['PUT'])
@require_auth
def update_lost_pet_report(report_id):
    """
    Update lost pet report
    PRD Section 11: Marcar como encontrada
    """
    data = request.json

    try:
        # Get report
        report = supabase.table('lost_pet_reports')\
            .select('reporter_id, pet_id')\
            .eq('id', report_id)\
            .single()\
            .execute()

        # Check authorization (reporter or pet owner)
        is_reporter = report.data['reporter_id'] == g.user_id
        is_owner = False

        if report.data['pet_id']:
            pet = supabase.table('pets')\
                .select('owner_id')\
                .eq('id', report.data['pet_id'])\
                .single()\
                .execute()
            is_owner = pet.data['owner_id'] == g.user_id

        if not is_reporter and not is_owner:
            return {'error': 'Not authorized'}, 403

        # Update report
        allowed_fields = ['found', 'description', 'contact_phone']
        update_data = {k: v for k, v in data.items() if k in allowed_fields}

        if 'found' in update_data and update_data['found']:
            update_data['found_at'] = 'now()'

        if not update_data:
            return {'error': 'No valid fields to update'}, 400

        result = supabase.table('lost_pet_reports').update(update_data).eq('id', report_id).execute()

        # TODO: Notify interested users

        return result.data[0], 200

    except Exception as e:
        return {'error': 'Update failed', 'message': str(e)}, 400

@lost_pets_bp.route('/<report_id>/found', methods=['PATCH', 'PUT'])
@require_auth
def mark_as_found(report_id):
    """
    Mark lost pet report as found
    PRD Section 11: Marcar como encontrada
    """
    try:
        # Get report
        report = supabase.table('lost_pet_reports')\
            .select('reporter_id, pet_id, report_type')\
            .eq('id', report_id)\
            .single()\
            .execute()

        # Check authorization (reporter or pet owner)
        is_reporter = report.data['reporter_id'] == g.user_id
        is_owner = False

        if report.data['pet_id']:
            pet = supabase.table('pets')\
                .select('owner_id')\
                .eq('id', report.data['pet_id'])\
                .single()\
                .execute()
            is_owner = pet.data['owner_id'] == g.user_id

        if not is_reporter and not is_owner:
            return {'error': 'No tenés autorización para marcar este reporte como encontrada'}, 403

        # Mark as found
        from datetime import datetime
        result = supabase.table('lost_pet_reports').update({
            'found': True,
            'found_at': datetime.utcnow().isoformat()
        }).eq('id', report_id).execute()

        # TODO: Notify interested users

        return {'data': result.data[0], 'message': 'Mascota marcada como encontrada'}, 200

    except Exception as e:
        return {'error': 'Error al marcar como encontrada', 'message': str(e)}, 400

@lost_pets_bp.route('/<report_id>/images', methods=['POST'])
@require_auth
def add_lost_pet_image(report_id):
    """Add image to lost pet report"""
    data = request.json

    if 'image_url' not in data:
        return {'error': 'Image URL required'}, 400

    try:
        # Verify authorization
        report = supabase.table('lost_pet_reports')\
            .select('reporter_id')\
            .eq('id', report_id)\
            .single()\
            .execute()

        if report.data['reporter_id'] != g.user_id:
            return {'error': 'Not your report'}, 403

        image = supabase.table('lost_pet_images').insert({
            'report_id': report_id,
            'image_url': data['image_url']
        }).execute()

        return image.data[0], 201

    except Exception as e:
        return {'error': 'Failed to add image', 'message': str(e)}, 400
