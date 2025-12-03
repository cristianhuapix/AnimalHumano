import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProviderServicesService } from '../../../core/services/provider-services.service';

interface Training {
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
  selector: 'app-my-trainings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-trainings.html',
  styleUrl: './my-trainings.scss'
})
export class MyTrainingsComponent implements OnInit {
  private router = inject(Router);
  private providerService = inject(ProviderServicesService);

  trainings = signal<Training[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  currentPage = signal(1);
  pageSize = 20;
  totalItems = signal(0);
  totalPages = signal(0);

  ngOnInit() {
    this.loadTrainings();
  }

  async loadTrainings() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const trainings = await this.providerService.getSimpleServices('training');
      this.trainings.set(trainings);
      this.totalItems.set(trainings.length);
      this.totalPages.set(Math.ceil(trainings.length / this.pageSize));
    } catch (err: any) {
      console.error('Error loading trainings:', err);
      this.error.set(err.message || 'Error al cargar entrenamientos');
    } finally {
      this.loading.set(false);
    }
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadTrainings();
  }

  goBack() {
    this.router.navigate(['/home']);
  }
}
