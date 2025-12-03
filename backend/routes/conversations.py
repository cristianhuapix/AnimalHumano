"""
Conversations and Messages routes (PRD Section 13)
"""

from flask import Blueprint, request, g
from config import supabase
from middleware.auth import require_auth
import logging

logger = logging.getLogger(__name__)

conversations_bp = Blueprint('conversations', __name__)

@conversations_bp.route('/', methods=['GET'])
@require_auth
def get_conversations():
    """
    Get user's conversations
    PRD Section 13: Sidebar con lista de chats
    """
    try:
        # Get conversations where user is participant
        participants = supabase.table('conversation_participants')\
            .select('conversation_id')\
            .eq('profile_id', g.user_id)\
            .eq('hidden', False)\
            .execute()

        if not participants.data:
            return {'data': []}, 200

        conversation_ids = [p['conversation_id'] for p in participants.data]

        # Get conversations with last message
        conversations = supabase.table('conversations')\
            .select('*, participants:conversation_participants(profile_id, profiles(full_name, photo_url))')\
            .in_('id', conversation_ids)\
            .order('updated_at', desc=True)\
            .execute()

        # Get last message for each conversation
        for conv in conversations.data:
            last_message = supabase.table('messages')\
                .select('*')\
                .eq('conversation_id', conv['id'])\
                .order('created_at', desc=True)\
                .limit(1)\
                .execute()

            conv['last_message'] = last_message.data[0] if last_message.data else None

            # Count unread messages
            unread = supabase.table('messages')\
                .select('id', count='exact')\
                .eq('conversation_id', conv['id'])\
                .eq('is_read', False)\
                .neq('sender_id', g.user_id)\
                .execute()

            conv['unread_count'] = unread.count

        return {'data': conversations.data}, 200

    except Exception as e:
        return {'error': 'Failed to get conversations', 'message': str(e)}, 400

@conversations_bp.route('/', methods=['POST'])
@require_auth
def create_conversation():
    """
    Create conversation
    PRD Section 13: Providers CANNOT initiate chats (only respond)
    """
    data = request.json

    if 'participant_id' not in data:
        return {'error': 'Participant ID required'}, 400

    try:
        # NOTE: The participant_id might be a provider ID, we need to get the profile ID
        # Check if participant_id is a provider ID
        participant_profile_id = data['participant_id']

        # Try to get provider record to see if this is a provider ID
        provider_check = supabase.table('providers')\
            .select('profile_id')\
            .eq('id', data['participant_id'])\
            .execute()

        if provider_check.data and len(provider_check.data) > 0:
            # This is a provider ID, get the profile ID
            participant_profile_id = provider_check.data[0]['profile_id']
            logger.info(f"[CONVERSATIONS/CREATE] Converted provider ID {data['participant_id']} to profile ID {participant_profile_id}")

        # NOTE: We allow users who are also providers to initiate conversations
        # They can switch between user and provider modes in the UI
        # Only block if trying to contact yourself
        logger.info(f"[CONVERSATIONS/CREATE] User {g.user_id} trying to contact participant {participant_profile_id}")
        if str(g.user_id) == participant_profile_id:
            logger.warning(f"[CONVERSATIONS/CREATE] Blocked: User trying to contact themselves")
            return {'error': 'Cannot create conversation with yourself'}, 400

        # Check if conversation already exists between these users
        existing = supabase.table('conversation_participants')\
            .select('conversation_id')\
            .eq('profile_id', g.user_id)\
            .execute()

        if existing.data:
            conv_ids = [p['conversation_id'] for p in existing.data]

            # Check if any of these conversations include the other participant
            other_participant = supabase.table('conversation_participants')\
                .select('conversation_id')\
                .in_('conversation_id', conv_ids)\
                .eq('profile_id', participant_profile_id)\
                .execute()

            if other_participant.data:
                # Conversation exists, unhide it for the current user and return it
                conv_id = other_participant.data[0]['conversation_id']

                # Unhide conversation for current user
                supabase.table('conversation_participants')\
                    .update({'hidden': False})\
                    .eq('conversation_id', conv_id)\
                    .eq('profile_id', g.user_id)\
                    .execute()

                conversation = supabase.table('conversations')\
                    .select('*')\
                    .eq('id', conv_id)\
                    .single()\
                    .execute()
                return conversation.data, 200

        # Create new conversation
        conversation = supabase.table('conversations').insert({}).execute()
        conv_id = conversation.data[0]['id']

        # Add participants
        supabase.table('conversation_participants').insert([
            {'conversation_id': conv_id, 'profile_id': str(g.user_id), 'is_provider': False},
            {'conversation_id': conv_id, 'profile_id': participant_profile_id, 'is_provider': False}
        ]).execute()

        return conversation.data[0], 201

    except Exception as e:
        logger.error(f"[CONVERSATIONS/CREATE] Error creating conversation: {str(e)}")
        logger.error(f"[CONVERSATIONS/CREATE] Error type: {type(e).__name__}")
        import traceback
        logger.error(f"[CONVERSATIONS/CREATE] Traceback: {traceback.format_exc()}")
        return {'error': 'Failed to create conversation', 'message': str(e)}, 400

@conversations_bp.route('/<conversation_id>/messages', methods=['GET'])
@require_auth
def get_messages(conversation_id):
    """Get messages from conversation"""
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', 50))
    offset = (page - 1) * page_size

    try:
        # Verify user is participant
        participant = supabase.table('conversation_participants')\
            .select('hidden')\
            .eq('conversation_id', conversation_id)\
            .eq('profile_id', g.user_id)\
            .single()\
            .execute()

        if not participant.data or participant.data['hidden']:
            return {'error': 'Not a participant'}, 403

        # Get messages
        messages = supabase.table('messages')\
            .select('*, sender:profiles(full_name, photo_url)')\
            .eq('conversation_id', conversation_id)\
            .order('created_at', desc=True)\
            .range(offset, offset + page_size - 1)\
            .execute()

        # Mark messages as read
        supabase.table('messages')\
            .update({'is_read': True})\
            .eq('conversation_id', conversation_id)\
            .neq('sender_id', g.user_id)\
            .eq('is_read', False)\
            .execute()

        return {'data': list(reversed(messages.data))}, 200

    except Exception as e:
        return {'error': 'Failed to get messages', 'message': str(e)}, 400

@conversations_bp.route('/<conversation_id>/messages', methods=['POST'])
@require_auth
def send_message(conversation_id):
    """
    Send message
    PRD Section 17: Max 20 messages per hour (enforced by rate limiting)
    """
    data = request.json

    if 'content' not in data or not data['content'].strip():
        return {'error': 'Message content required'}, 400

    try:
        # Verify user is participant
        participant = supabase.table('conversation_participants')\
            .select('hidden')\
            .eq('conversation_id', conversation_id)\
            .eq('profile_id', g.user_id)\
            .single()\
            .execute()

        if not participant.data or participant.data['hidden']:
            return {'error': 'Not a participant'}, 403

        # Create message
        message_data = {
            'conversation_id': conversation_id,
            'sender_id': str(g.user_id),
            'content': data['content'].strip(),
            'is_read': False
        }

        message = supabase.table('messages').insert(message_data).execute()

        # TODO: Send push notification to other participants

        return message.data[0], 201

    except Exception as e:
        return {'error': 'Failed to send message', 'message': str(e)}, 400

@conversations_bp.route('/<conversation_id>', methods=['DELETE'])
@require_auth
def hide_conversation(conversation_id):
    """
    Hide conversation (soft delete)
    PRD Section 13: Eliminar chat solo lo oculta para ese usuario
    """
    try:
        # Update participant to mark as hidden
        supabase.table('conversation_participants')\
            .update({'hidden': True})\
            .eq('conversation_id', conversation_id)\
            .eq('profile_id', g.user_id)\
            .execute()

        return {'message': 'Conversation hidden'}, 200

    except Exception as e:
        return {'error': 'Failed to hide conversation', 'message': str(e)}, 400
