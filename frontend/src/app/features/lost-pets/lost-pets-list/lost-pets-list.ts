import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LostPetService } from '../../../core/services/lost-pet.service';
import { LostPetReport } from '../../../core/models';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-lost-pets-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lost-pets-list.html',
  styleUrl: './lost-pets-list.scss'
})
export class LostPetsListComponent implements OnInit {
  private lostPetService = inject(LostPetService);
  private authService = inject(AuthService);
  private router = inject(Router);

  reports = signal<LostPetReport[]>([]);
  isLoading = signal(false);
  errorMessage = signal('');

  // Confirmation modal
  showConfirmModal = signal(false);
  confirmingReportId: string | null = null;
  isMarkingFound = signal(false);

  // Pagination
  currentPage = signal(1);
  pageSize = 20;
  totalPages = signal(0);
  totalCount = signal(0);

  // Filters
  radiusKm = signal(10); // Default 10km
  availableRadii = [5, 10, 20, 50, 100];
  userLatitude: number | null = null;
  userLongitude: number | null = null;

  async ngOnInit() {
    await this.getUserLocation();
    await this.loadReports();
  }

  async getUserLocation() {
    if ('geolocation' in navigator) {
      return new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            this.userLatitude = position.coords.latitude;
            this.userLongitude = position.coords.longitude;
            resolve();
          },
          (error) => {
            console.warn('Geolocation error:', error);
            resolve();
          }
        );
      });
    }
  }

  async loadReports() {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const filters: any = {
        page: this.currentPage(),
        page_size: this.pageSize
      };

      // Add location filters if available
      if (this.userLatitude && this.userLongitude) {
        filters.latitude = this.userLatitude;
        filters.longitude = this.userLongitude;
        filters.radius_km = this.radiusKm();
      }

      const response = await firstValueFrom(this.lostPetService.getLostPets(filters));

      if (response.data) {
        this.reports.set(response.data.data || []);
        this.totalPages.set(response.data.total_pages || 0);
        this.totalCount.set(response.data.count || 0);
      } else {
        // Si no hay data, mostrar como lista vacía en lugar de error
        this.reports.set([]);
        this.totalPages.set(0);
        this.totalCount.set(0);
      }
    } catch (error: any) {
      // En caso de error (ej: backend no disponible), mostrar lista vacía
      console.warn('Backend not available or error loading reports:', error);
      this.reports.set([]);
      this.totalPages.set(0);
      this.totalCount.set(0);
      // No mostrar error al usuario, simplemente mostrar estado vacío
    } finally {
      this.isLoading.set(false);
    }
  }

  async onRadiusChange() {
    this.currentPage.set(1);
    await this.loadReports();
  }

  async goToPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    await this.loadReports();
  }

  openConfirmModal(reportId: string, event: Event) {
    event.stopPropagation();
    this.confirmingReportId = reportId;
    this.showConfirmModal.set(true);
  }

  closeConfirmModal() {
    this.showConfirmModal.set(false);
    this.confirmingReportId = null;
  }

  async confirmMarkAsFound() {
    if (!this.confirmingReportId) return;

    this.isMarkingFound.set(true);
    this.errorMessage.set('');

    try {
      await firstValueFrom(this.lostPetService.markAsFound(this.confirmingReportId));
      this.closeConfirmModal();
      await this.loadReports();
    } catch (error: any) {
      console.error('Error marking as found:', error);
      this.errorMessage.set(error?.error?.error || error?.message || 'Error al marcar como encontrada');
    } finally {
      this.isMarkingFound.set(false);
    }
  }

  canMarkAsFound(report: LostPetReport): boolean {
    const currentUserId = this.authService.currentUser()?.id;
    if (!currentUserId) return false;

    // User can mark as found if:
    // 1. It's their own report (they lost or found the pet)
    // 2. It's a "lost" report and they are the owner of the pet
    return report.reporter_id === currentUserId ||
           (report.report_type === 'lost' && report.pet?.owner_id === currentUserId);
  }

  navigateToReport(reportId: string) {
    // We could create a detail view, but for now we'll just show the info in the card
    console.log('View report:', reportId);
  }

  createReport() {
    this.router.navigate(['/lost-pets/report']);
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  getTimeAgo(date: string): string {
    const now = new Date();
    const reportDate = new Date(date);
    const diffMs = now.getTime() - reportDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
    } else if (diffHours > 0) {
      return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    } else if (diffMins > 0) {
      return `Hace ${diffMins} ${diffMins === 1 ? 'minuto' : 'minutos'}`;
    } else {
      return 'Hace un momento';
    }
  }

  getDistance(report: LostPetReport): string | null {
    if (!this.userLatitude || !this.userLongitude || !report.latitude || !report.longitude) {
      return null;
    }

    const distance = this.calculateDistance(
      this.userLatitude,
      this.userLongitude,
      report.latitude,
      report.longitude
    );

    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    } else {
      return `${distance.toFixed(1)}km`;
    }
  }

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  }

  deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  getPaginationPages(): number[] {
    const pages: number[] = [];
    const current = this.currentPage();
    const total = this.totalPages();

    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      if (current <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push(-1); // ellipsis
        pages.push(total);
      } else if (current >= total - 3) {
        pages.push(1);
        pages.push(-1); // ellipsis
        for (let i = total - 4; i <= total; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push(-1); // ellipsis
        for (let i = current - 1; i <= current + 1; i++) pages.push(i);
        pages.push(-1); // ellipsis
        pages.push(total);
      }
    }

    return pages;
  }
}
