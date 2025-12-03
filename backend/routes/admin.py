"""
Admin routes (PRD Section 15)
"""

from flask import Blueprint, request, g
from config import supabase
from middleware.auth import require_admin
from datetime import datetime, timedelta

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/metrics', methods=['GET'])
@require_admin
def get_metrics():
    """
    Get admin dashboard metrics
    PRD Section 15: Panel Admin
    """
    country = request.args.get('country')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    try:
        # Default to last 30 days if no dates provided
        if not end_date:
            end_date = datetime.now().isoformat()
        if not start_date:
            start_date = (datetime.now() - timedelta(days=30)).isoformat()

        metrics = {}

        # New users per month
        user_query = supabase.table('profiles')\
            .select('id', count='exact')\
            .gte('created_at', start_date)\
            .lte('created_at', end_date)

        if country:
            user_query = user_query.eq('country', country)

        metrics['new_users'] = user_query.execute().count

        # Total users
        total_users_query = supabase.table('profiles')\
            .select('id', count='exact')\
            .eq('is_deleted', False)

        if country:
            total_users_query = total_users_query.eq('country', country)

        metrics['total_users'] = total_users_query.execute().count

        # Pets registered
        pets_query = supabase.table('pets')\
            .select('id', count='exact')\
            .eq('is_deleted', False)

        if country:
            # Join with profiles to filter by country
            pets_query = pets_query.select('*, profiles!owner_id(country)')\
                .eq('profiles.country', country)

        metrics['total_pets'] = pets_query.execute().count

        # Conversations initiated
        conv_query = supabase.table('conversations')\
            .select('id', count='exact')\
            .gte('created_at', start_date)\
            .lte('created_at', end_date)

        metrics['new_conversations'] = conv_query.execute().count

        # Appointments scheduled
        appt_query = supabase.table('appointments')\
            .select('id', count='exact')\
            .gte('created_at', start_date)\
            .lte('created_at', end_date)

        metrics['new_appointments'] = appt_query.execute().count

        # Active providers
        prov_query = supabase.table('providers')\
            .select('id', count='exact')\
            .eq('active', True)

        if country:
            prov_query = prov_query.select('*, profiles!profile_id(country)')\
                .eq('profiles.country', country)

        metrics['active_providers'] = prov_query.execute().count

        # Lost pet reports
        lost_query = supabase.table('lost_pet_reports')\
            .select('id', count='exact')\
            .eq('found', False)

        metrics['active_lost_pets'] = lost_query.execute().count

        # Total walks
        walks_query = supabase.table('walks')\
            .select('id', count='exact')\
            .gte('created_at', start_date)\
            .lte('created_at', end_date)

        metrics['total_walks'] = walks_query.execute().count

        return {
            'metrics': metrics,
            'filters': {
                'country': country,
                'start_date': start_date,
                'end_date': end_date
            }
        }, 200

    except Exception as e:
        return {'error': 'Failed to get metrics', 'message': str(e)}, 400

@admin_bp.route('/users', methods=['GET'])
@require_admin
def get_users():
    """Get all users (admin only)"""
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', 50))
    offset = (page - 1) * page_size
    country = request.args.get('country')
    is_provider = request.args.get('is_provider')

    try:
        query = supabase.table('profiles')\
            .select('*', count='exact')\
            .eq('is_deleted', False)

        if country:
            query = query.eq('country', country)

        if is_provider is not None:
            query = query.eq('is_provider', is_provider == 'true')

        # Get total count
        count_result = query.execute()
        total = count_result.count

        # Get paginated results
        result = query.order('created_at', desc=True)\
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
        return {'error': 'Failed to get users', 'message': str(e)}, 400

@admin_bp.route('/users/<user_id>', methods=['PUT'])
@require_admin
def update_user(user_id):
    """Update user (admin only)"""
    data = request.json

    allowed_fields = ['is_admin', 'is_provider', 'is_deleted']
    update_data = {k: v for k, v in data.items() if k in allowed_fields}

    if not update_data:
        return {'error': 'No valid fields to update'}, 400

    try:
        result = supabase.table('profiles').update(update_data).eq('id', user_id).execute()
        return result.data[0], 200

    except Exception as e:
        return {'error': 'Update failed', 'message': str(e)}, 400

@admin_bp.route('/reports', methods=['GET'])
@require_admin
def get_reports():
    """
    Get various reports
    PRD Section 15: Reportes
    """
    report_type = request.args.get('type', 'summary')

    try:
        if report_type == 'summary':
            # Overall summary
            return get_metrics()

        elif report_type == 'providers':
            # Provider statistics
            providers = supabase.table('providers')\
                .select('*, profiles(full_name, country), _count:provider_ratings(count)')\
                .eq('active', True)\
                .order('rating', desc=True)\
                .execute()

            return {'data': providers.data}, 200

        elif report_type == 'popular_breeds':
            # Most popular breeds
            pets = supabase.table('pets')\
                .select('breed_id, breeds(name, species(name))', count='exact')\
                .eq('is_deleted', False)\
                .execute()

            # Group by breed (this should be done in the query, but we'll do it here for simplicity)
            breed_counts = {}
            for pet in pets.data:
                breed_name = pet['breeds']['name']
                species_name = pet['breeds']['species']['name']
                key = f"{species_name} - {breed_name}"
                breed_counts[key] = breed_counts.get(key, 0) + 1

            sorted_breeds = sorted(breed_counts.items(), key=lambda x: x[1], reverse=True)[:20]

            return {
                'data': [{'breed': k, 'count': v} for k, v in sorted_breeds]
            }, 200

        elif report_type == 'vaccinations':
            # Vaccination statistics
            vaccinations = supabase.table('pet_vaccinations')\
                .select('vaccine_id, vaccines(name, species(name))', count='exact')\
                .execute()

            return {'total_vaccinations': vaccinations.count}, 200

        else:
            return {'error': f'Unknown report type: {report_type}'}, 400

    except Exception as e:
        return {'error': 'Failed to generate report', 'message': str(e)}, 400

@admin_bp.route('/verify-license/<provider_id>', methods=['POST'])
@require_admin
def verify_license(provider_id):
    """Verify provider license (admin only)"""
    data = request.json

    try:
        result = supabase.table('providers')\
            .update({'license_verified': data.get('verified', True)})\
            .eq('id', provider_id)\
            .execute()

        # TODO: Send notification to provider

        return result.data[0], 200

    except Exception as e:
        return {'error': 'Failed to verify license', 'message': str(e)}, 400
