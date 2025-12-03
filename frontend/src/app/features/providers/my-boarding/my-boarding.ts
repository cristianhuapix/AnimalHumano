import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProviderServicesService, Boarding } from '../../../core/services/provider-services.service';

@Component({
  selector: 'app-my-boarding',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-boarding.html',
  styleUrl: './my-boarding.scss'
})
export class BoardingComponent implements OnInit {
  private router = inject(Router);
  private providerService = inject(ProviderServicesService);

  items = signal<Boarding[]>([]);
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
      const boardings = await this.providerService.getMyBoardings();
      this.items.set(boardings);
      this.totalItems.set(boardings.length);
      this.totalPages.set(Math.ceil(boardings.length / this.pageSize));
    } catch (err: any) {
      console.error('Error loading boardings:', err);
      this.error.set(err.message || 'Error al cargar hospedajes');
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
