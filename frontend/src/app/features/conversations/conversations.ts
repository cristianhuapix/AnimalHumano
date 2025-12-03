import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ConversationsService, Conversation, Message } from '../../core/services/conversations.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-conversations',
  imports: [CommonModule, FormsModule],
  templateUrl: './conversations.html',
  styleUrl: './conversations.scss'
})
export class Conversations implements OnInit {
  private conversationsService = inject(ConversationsService);
  private route = inject(ActivatedRoute);
  authService = inject(AuthService);

  conversations = signal<Conversation[]>([]);
  selectedConversation = signal<Conversation | null>(null);
  messages = signal<Message[]>([]);
  newMessage = signal('');
  loading = signal(false);
  searchQuery = signal('');
  showDeleteModal = signal(false);
  conversationToDelete = signal<string | null>(null);

  ngOnInit() {
    // Check if there's a conversationId in query params first
    this.route.queryParams.subscribe(params => {
      const conversationId = params['conversationId'];
      this.loadConversations(conversationId);
    });
  }

  loadConversations(conversationIdToOpen?: string) {
    this.loading.set(true);
    this.conversationsService.getConversations().subscribe({
      next: (response) => {
        this.conversations.set(response.data);
        this.loading.set(false);

        // If there's a conversation ID to open, select it after loading
        if (conversationIdToOpen) {
          const conversation = this.conversations().find(c => c.id === conversationIdToOpen);
          if (conversation) {
            this.selectConversation(conversation);
          } else {
            console.warn('Conversation not found:', conversationIdToOpen);
          }
        }
      },
      error: (err) => {
        console.error('Error loading conversations:', err);
        this.loading.set(false);
      }
    });
  }

  selectConversation(conversation: Conversation) {
    this.selectedConversation.set(conversation);
    this.loadMessages(conversation.id);
  }

  loadMessages(conversationId: string) {
    this.conversationsService.getMessages(conversationId).subscribe({
      next: (response) => {
        this.messages.set(response.data);
        // Scroll to bottom after messages load
        setTimeout(() => this.scrollToBottom(), 100);
      },
      error: (err) => {
        console.error('Error loading messages:', err);
      }
    });
  }

  sendMessage() {
    const content = this.newMessage().trim();
    if (!content || !this.selectedConversation()) return;

    this.conversationsService.sendMessage(this.selectedConversation()!.id, content).subscribe({
      next: (message) => {
        this.messages.update(msgs => [...msgs, message]);
        this.newMessage.set('');
        this.scrollToBottom();
        // Update conversation list (without reopening)
        this.loadConversations();
      },
      error: (err) => {
        console.error('Error sending message:', err);
      }
    });
  }

  openDeleteModal(conversationId: string, event: Event) {
    event.stopPropagation();
    this.conversationToDelete.set(conversationId);
    this.showDeleteModal.set(true);
  }

  closeDeleteModal() {
    this.showDeleteModal.set(false);
    this.conversationToDelete.set(null);
  }

  confirmDelete() {
    const conversationId = this.conversationToDelete();
    if (!conversationId) return;

    this.conversationsService.hideConversation(conversationId).subscribe({
      next: () => {
        if (this.selectedConversation()?.id === conversationId) {
          this.selectedConversation.set(null);
          this.messages.set([]);
        }
        this.loadConversations();
        this.closeDeleteModal();
      },
      error: (err) => {
        console.error('Error deleting conversation:', err);
        this.closeDeleteModal();
      }
    });
  }

  getOtherParticipant(conversation: Conversation) {
    const currentUserId = this.authService.currentUser()?.id;
    return conversation.participants.find(p => p.profile_id !== currentUserId);
  }

  getParticipantName(conversation: Conversation): string {
    const participant = this.getOtherParticipant(conversation);
    return participant?.profiles?.full_name || 'Usuario';
  }

  getParticipantPhoto(conversation: Conversation): string | undefined {
    const participant = this.getOtherParticipant(conversation);
    return participant?.profiles?.photo_url;
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  formatDate(date: string): string {
    const messageDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (messageDate.toDateString() === today.toDateString()) {
      return messageDate.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Ayer';
    } else {
      return messageDate.toLocaleDateString('es', { day: '2-digit', month: '2-digit' });
    }
  }

  isMyMessage(message: Message): boolean {
    return message.sender_id === this.authService.currentUser()?.id;
  }

  filteredConversations() {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.conversations();

    return this.conversations().filter(conv => {
      const participant = this.getOtherParticipant(conv);
      return participant?.profiles.full_name.toLowerCase().includes(query) ||
             conv.last_message?.content.toLowerCase().includes(query);
    });
  }

  private scrollToBottom() {
    const chatContainer = document.querySelector('.chat-messages');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }
}
