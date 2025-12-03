import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PetService } from '../../../core/services/pet.service';
import { Pet } from '../../../core/models';

@Component({
  selector: 'app-pets-list',
  imports: [CommonModule, RouterLink],
  templateUrl: './pets-list.html',
  styleUrl: './pets-list.scss'
})
export class PetsListComponent implements OnInit {
  private petService = inject(PetService);
  private router = inject(Router);

  pets = signal<Pet[]>([]);
  isLoading = signal(false);
  errorMessage = signal('');

  async ngOnInit() {
    await this.loadPets();
  }

  async loadPets() {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const pets = await this.petService.getPets();
      this.pets.set(pets);
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Error al cargar las mascotas');
      console.error('Error loading pets:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async deletePet(petId: string, event: Event) {
    event.preventDefault();
    event.stopPropagation();

    if (!confirm('¿Estás seguro de que quieres eliminar esta mascota?')) {
      return;
    }

    try {
      await this.petService.removePet(petId);
      await this.loadPets();
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Error al eliminar la mascota');
      console.error('Error deleting pet:', error);
    }
  }

  navigateToPet(petId: string) {
    this.router.navigate(['/pets', petId]);
  }

  getAge(birthDate: string): string {
    const birth = new Date(birthDate);
    const now = new Date();
    const years = now.getFullYear() - birth.getFullYear();
    const months = now.getMonth() - birth.getMonth();

    if (years === 0) {
      return `${months} ${months === 1 ? 'mes' : 'meses'}`;
    }

    if (months < 0) {
      return `${years - 1} ${years - 1 === 1 ? 'año' : 'años'}`;
    }

    return `${years} ${years === 1 ? 'año' : 'años'}`;
  }
}
