import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProviderServicesService } from '../../../core/services/provider-services.service';

interface GroomingAppointment {
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
  selector: 'app-my-grooming',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-grooming.html',
  styleUrl: './my-grooming.scss'
})
export class GroomingAppointmentComponent implements OnInit {
  private router = inject(Router);
  private providerService = inject(ProviderServicesService);

  items = signal<GroomingAppointment[]>([]);
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
      const grooming = await this.providerService.getSimpleServices('grooming');
      this.items.set(grooming);
      this.totalItems.set(grooming.length);
      this.totalPages.set(Math.ceil(grooming.length / this.pageSize));
    } catch (err: any) {
      console.error('Error loading grooming:', err);
      this.error.set(err.message || 'Error al cargar citas de estética');
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
}
