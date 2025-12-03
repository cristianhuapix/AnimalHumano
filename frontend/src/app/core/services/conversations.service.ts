import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender?: {
    full_name: string;
    photo_url?: string;
  };
}

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  last_message?: Message;
  unread_count: number;
  participants: Array<{
    profile_id: string;
    profiles: {
      full_name: string;
      photo_url?: string;
    };
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class ConversationsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/conversations`;

  getConversations(): Observable<{ data: Conversation[] }> {
    return this.http.get<{ data: Conversation[] }>(this.apiUrl);
  }

  createConversation(participantId: string): Observable<Conversation> {
    return this.http.post<Conversation>(this.apiUrl, {
      participant_id: participantId
    });
  }

  getMessages(conversationId: string, page: number = 1): Observable<{ data: Message[] }> {
    return this.http.get<{ data: Message[] }>(`${this.apiUrl}/${conversationId}/messages`, {
      params: { page: page.toString() }
    });
  }

  sendMessage(conversationId: string, content: string): Observable<Message> {
    return this.http.post<Message>(`${this.apiUrl}/${conversationId}/messages`, {
      content
    });
  }

  hideConversation(conversationId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${conversationId}`);
  }

  // Check if user has contacted a provider
  hasContactedProvider(providerId: string): Observable<boolean> {
    return new Observable(observer => {
      this.getConversations().subscribe({
        next: (response) => {
          const hasConversation = response.data.some(conv =>
            conv.participants.some(p => p.profile_id === providerId)
          );
          observer.next(hasConversation);
          observer.complete();
        },
        error: (err) => {
          observer.error(err);
        }
      });
    });
  }
}
