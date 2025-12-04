import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PetService } from '../../core/services/pet.service';
import { ApiService } from '../../core/services/api.service';
import { Pet } from '../../core/models';
import { firstValueFrom } from 'rxjs';

interface NutritionEntry {
  id: string;
  pet_id: string;
  pet_name: string;
  entry_date: string;
  comments: string;
  created_at: string;
}

const PAGE_SIZE = 10;

@Component({
  selector: 'app-nutrition-history',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './nutrition-history.html',
  styleUrl: './nutrition-history.scss'
})
export class NutritionHistoryComponent implements OnInit {
  private location = inject(Location);
  private petService = inject(PetService);
  private apiService = inject(ApiService);

  pets = signal<Pet[]>([]);
  entries = signal<NutritionEntry[]>([]);
  isLoading = signal(false);
  showForm = signal(false);
  errorMessage = signal('');
  showDeleteModal = signal(false);
  entryToDelete = signal<string | null>(null);

  // Paginación
  currentPage = signal(1);
  totalPages = computed(() => Math.ceil(this.entries().length / PAGE_SIZE));
  paginatedEntries = computed(() => {
    const start = (this.currentPage() - 1) * PAGE_SIZE;
    return this.entries().slice(start, start + PAGE_SIZE);
  });

  // Form fields
  selectedPetId = '';
  entryDate = '';
  comments = '';

  async ngOnInit() {
    await this.loadPets();
    await this.loadEntries();
    this.entryDate = new Date().toISOString().split('T')[0];
  }

  async loadPets() {
    this.isLoading.set(true);
    try {
      const pets = await this.petService.getPets();
      this.pets.set(pets);
    } catch (error) {
      console.error('Error loading pets:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadEntries() {
    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      const response = await firstValueFrom(
        this.apiService.get<{ data: NutritionEntry[] }>('nutrition-history')
      );
      this.entries.set(response.data || []);
    } catch (error: any) {
      console.error('Error loading nutrition history:', error);
      this.errorMessage.set('Error al cargar el historial');
    } finally {
      this.isLoading.set(false);
    }
  }

  async saveEntry() {
    if (!this.selectedPetId || !this.entryDate || !this.comments.trim()) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const response = await firstValueFrom(
        this.apiService.post<{ data: NutritionEntry }>('nutrition-history', {
          pet_id: this.selectedPetId,
          entry_date: this.entryDate,
          comments: this.comments.trim()
        })
      );

      if (response.data) {
        // Add to the beginning of the list
        const currentEntries = this.entries();
        this.entries.set([response.data, ...currentEntries]);

        // Reset form
        this.selectedPetId = '';
        this.comments = '';
        this.entryDate = new Date().toISOString().split('T')[0];
        this.showForm.set(false);
      }
    } catch (error: any) {
      console.error('Error saving entry:', error);
      this.errorMessage.set('Error al guardar el registro');
    } finally {
      this.isLoading.set(false);
    }
  }

  confirmDelete(entryId: string) {
    this.entryToDelete.set(entryId);
    this.showDeleteModal.set(true);
  }

  cancelDelete() {
    this.showDeleteModal.set(false);
    this.entryToDelete.set(null);
  }

  async deleteEntry() {
    const entryId = this.entryToDelete();
    if (!entryId) return;

    this.showDeleteModal.set(false);

    try {
      await firstValueFrom(
        this.apiService.delete(`nutrition-history/${entryId}`)
      );

      const updatedEntries = this.entries().filter(e => e.id !== entryId);
      this.entries.set(updatedEntries);
    } catch (error: any) {
      console.error('Error deleting entry:', error);
      this.errorMessage.set('Error al eliminar el registro');
    } finally {
      this.entryToDelete.set(null);
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString + 'T00:00:00');
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  goBack(): void {
    this.location.back();
  }

  toggleForm(): void {
    this.showForm.set(!this.showForm());
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.selectedPetId = '';
    this.comments = '';
    this.entryDate = new Date().toISOString().split('T')[0];
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.set(this.currentPage() + 1);
    }
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.set(this.currentPage() - 1);
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }
}
