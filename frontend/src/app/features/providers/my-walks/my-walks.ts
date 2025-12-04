import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProviderServicesService } from '../../../core/services/provider-services.service';

interface Walk {
  id: string;
  pet_id: string;
  provider_id: string;
  profile_id: string;
  notes?: string;
  created_at: string;
  pets?: {
    id: string;
    name: string;
    owner_id: string;
    owner_name?: string;
  };
}

@Component({
  selector: 'app-my-walks',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-walks.html',
  styleUrl: './my-walks.scss'
})
export class WalkComponent implements OnInit {
  private router = inject(Router);
  private providerService = inject(ProviderServicesService);

  items = signal<Walk[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  currentPage = signal(1);
  pageSize = 20;
  totalItems = signal(0);
  totalPages = signal(0);

  ngOnInit() {
    this.loadItems();
  }

  async loadItems() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const walks = await this.providerService.getSimpleServices('walking');
      this.items.set(walks);
      this.totalItems.set(walks.length);
      this.totalPages.set(Math.ceil(walks.length / this.pageSize));
    } catch (err: any) {
      console.error('Error loading walks:', err);
      this.error.set(err.message || 'Error al cargar paseos');
    } finally {
      this.loading.set(false);
    }
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadItems();
  }

  goBack() {
    this.router.navigate(['/home']);
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
}
