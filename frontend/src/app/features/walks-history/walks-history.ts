import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { firstValueFrom } from 'rxjs';

interface Walk {
  id: string;
  pet_id: string;
  walker_id: string;
  started_at: string;
  ended_at?: string;
  notes?: string;
  created_at: string;
  pets?: {
    name: string;
    photo_url?: string;
    dnia?: string;
  };
  walker?: {
    id: string;
    profile?: {
      full_name: string;
    };
  };
}

interface WalksResponse {
  data: Walk[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    pages: number;
  };
}

const PAGE_SIZE = 10;

@Component({
  selector: 'app-walks-history',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './walks-history.html',
  styleUrl: './walks-history.scss'
})
export class WalksHistoryComponent implements OnInit {
  private location = inject(Location);
  private apiService = inject(ApiService);

  walks = signal<Walk[]>([]);
  isLoading = signal(false);
  errorMessage = signal('');

  // Paginación
  currentPage = signal(1);
  totalPages = signal(0);
  totalItems = signal(0);

  async ngOnInit() {
    await this.loadWalks();
  }

  async loadWalks() {
    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      const response = await firstValueFrom(
        this.apiService.get<WalksResponse>(`walks?page=${this.currentPage()}&page_size=${PAGE_SIZE}`)
      );
      this.walks.set(response.data || []);
      this.totalPages.set(response.pagination?.pages || 0);
      this.totalItems.set(response.pagination?.total || 0);
    } catch (error: any) {
      console.error('Error loading walks:', error);
      this.errorMessage.set('Error al cargar el historial de paseos');
    } finally {
      this.isLoading.set(false);
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  goBack(): void {
    this.location.back();
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.set(this.currentPage() + 1);
      this.loadWalks();
    }
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.set(this.currentPage() - 1);
      this.loadWalks();
    }
  }
}
