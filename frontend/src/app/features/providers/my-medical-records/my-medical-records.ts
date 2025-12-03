import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';

interface MedicalRecord {
  id: string;
  pet_name: string;
  owner_name: string;
  diagnosis: string;
  date: string;
  treatment: string;
}

@Component({
  selector: 'app-my-medical-records',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-medical-records.html',
  styleUrl: './my-medical-records.scss'
})
export class MyMedicalRecordsComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  records = signal<MedicalRecord[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  currentPage = signal(1);
  pageSize = 20;
  totalItems = signal(0);
  totalPages = signal(0);

  petId = signal<string | null>(null);

  ngOnInit() {
    // Get petId from route params
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.petId.set(params['id']);
        console.log('[MY MEDICAL RECORDS] petId from route:', params['id']);
      }
    });
    this.loadRecords();
  }

  async loadRecords() {
    this.loading.set(true);
    this.error.set(null);

    try {
      // TODO: Implement API call
      this.records.set([]);
      this.totalItems.set(0);
      this.totalPages.set(0);
    } catch (err: any) {
      this.error.set(err.message || 'Error al cargar historias clínicas');
    } finally {
      this.loading.set(false);
    }
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadRecords();
  }

  goBack() {
    const petId = this.petId();
    if (petId) {
      // If we have a petId, go back to pet detail
      this.router.navigate(['/pets', petId]);
    } else {
      // Otherwise go to home
      this.router.navigate(['/home']);
    }
  }

  addMedicalRecord() {
    const petId = this.petId();
    if (!petId) {
      this.error.set('No se pudo determinar la mascota');
      return;
    }
    // TODO: Navigate to medical record form or open modal
    console.log('[MY MEDICAL RECORDS] Add medical record for pet:', petId);
    alert('Funcionalidad de agregar historia médica en desarrollo');
  }
}
