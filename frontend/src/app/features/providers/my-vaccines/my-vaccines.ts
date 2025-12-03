import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ModeService } from '../../../core/services/mode.service';


interface VaccineRecord {
  id: string;
  pet_name: string;
  owner_name: string;
  vaccine_name: string;
  application_date: string;
  next_dose_date: string;
  batch_number: string;
  veterinarian_name: string;
  notes: string;
}

interface Vaccine {
  id: string;
  name: string;
  required: boolean;
  description: string;
  interval_days: number | null;
  contagious_to_humans?: boolean;
  transmission?: string;
  importance?: string;
}

interface VaccineForm {
  vaccine_id: string;
  application_date: string;
  next_dose_date: string;
  batch_number: string;
  veterinarian_name: string;
  notes: string;
}

interface Pet {
  id: string;
  name: string;
  species_id: string;
  species?: {
    name: string;
  };
}

@Component({
  selector: 'app-my-vaccines',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './my-vaccines.html',
  styleUrl: './my-vaccines.scss'
})
export class VaccineRecordComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private modeService = inject(ModeService);
  private API_URL = 'http://localhost:5001/api';

  items = signal<VaccineRecord[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  currentPage = signal(1);
  pageSize = 20;
  totalItems = signal(0);
  totalPages = signal(0);

  petId = signal<string | null>(null);
  pet = signal<Pet | null>(null);
  showModal = signal(false);
  savingVaccine = signal(false);

  availableVaccines = signal<Vaccine[]>([]);
  pendingRequiredVaccines = signal<number>(0);
  isProviderAccess = signal(false);

  showInfoModal = signal(false);
  selectedVaccineDetail = signal<string | null>(null);

  requiredVaccines = signal<Vaccine[]>([]);
  optionalVaccines = signal<Vaccine[]>([]);

  vaccineForm = signal<VaccineForm>({
    vaccine_id: '',
    application_date: '',
    next_dose_date: '',
    batch_number: '',
    veterinarian_name: '',
    notes: ''
  });

  getSelectedVaccineDescription(): string {
    const selectedId = this.vaccineForm().vaccine_id;
    if (!selectedId) return '';
    const vaccine = this.availableVaccines().find(v => v.id === selectedId);
    return vaccine?.description || '';
  }

  ngOnInit() {
    // Get petId from route params
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.petId.set(params['id']);
        console.log('[MY VACCINES] petId from route:', params['id']);
        this.loadPetData(params['id']);
        this.checkProviderAccess(params['id']);
      }
    });
    this.loadItems();
  }

  private checkProviderAccess(petId: string) {
    const accessKey = `provider_access_${petId}`;
    const accessData = localStorage.getItem(accessKey);

    if (accessData) {
      try {
        const { expiresAt } = JSON.parse(accessData);
        const now = Date.now();

        if (now < expiresAt) {
          this.isProviderAccess.set(true);
          console.log('[MY VACCINES] Provider access detected');
        } else {
          // Access expired, clean it up
          localStorage.removeItem(accessKey);
          this.isProviderAccess.set(false);
        }
      } catch (error) {
        console.error('Error parsing provider access data:', error);
        // Clean up corrupted data
        localStorage.removeItem(accessKey);
        this.isProviderAccess.set(false);
      }
    }
  }

  async loadPetData(petId: string) {
    try {
      const token = await this.authService.getAccessToken();
      const response = await fetch(`${this.API_URL}/pets/${petId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al cargar datos de la mascota');
      }

      const result = await response.json();
      const petData = result.data;

      const pet: Pet = {
        id: petData.id,
        name: petData.name,
        species_id: petData.species_id,
        species: petData.species
      };

      this.pet.set(pet);

      // Load available vaccines for this species
      await this.loadAvailableVaccines(pet.species_id);

      // Calculate pending required vaccines
      await this.calculatePendingVaccines(petId);
    } catch (err: any) {
      console.error('Error loading pet data:', err);
      this.error.set(err.message);
    }
  }

  async loadAvailableVaccines(speciesId: string) {
    try {
      const token = await this.authService.getAccessToken();
      const response = await fetch(`${this.API_URL}/vaccines?species_id=${speciesId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al cargar vacunas disponibles');
      }

      const result = await response.json();
      const vaccines = result.data || [];
      this.availableVaccines.set(vaccines);

      // Separate vaccines into required and optional
      this.requiredVaccines.set(vaccines.filter((v: Vaccine) => v.required));
      this.optionalVaccines.set(vaccines.filter((v: Vaccine) => !v.required));
    } catch (err: any) {
      console.error('Error loading vaccines:', err);
      this.error.set(err.message);
    }
  }

  async calculatePendingVaccines(petId: string) {
    try {
      const token = await this.authService.getAccessToken();
      const response = await fetch(`${this.API_URL}/pets/${petId}/pending-vaccines`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al calcular vacunas pendientes');
      }

      const result = await response.json();
      this.pendingRequiredVaccines.set(result.data?.pending_count || 0);
    } catch (err: any) {
      console.error('Error calculating pending vaccines:', err);
    }
  }

  async loadItems() {
    this.loading.set(true);
    this.error.set(null);

    const petId = this.petId();

    try {
      const token = await this.authService.getAccessToken();

      // If no petId, load all vaccinations applied by this provider
      const url = petId
        ? `${this.API_URL}/pets/${petId}/vaccinations`
        : `${this.API_URL}/providers/me/vaccinations`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al cargar historial de vacunas');
      }

      const result = await response.json();
      const vaccinations = result.data || [];

      // Transform API data to match our interface
      this.items.set(vaccinations.map((v: any) => ({
        id: v.id,
        pet_name: v.pets?.name || '',
        owner_name: v.pets?.owner_name || 'Desconocido',
        vaccine_name: v.vaccines?.name || 'Vacuna desconocida',
        application_date: v.applied_on,
        next_dose_date: v.next_due_on || '',
        batch_number: v.batch_number || '',
        veterinarian_name: v.veterinarian_name || '',
        notes: v.notes || ''
      })));

      this.totalItems.set(vaccinations.length);
      this.totalPages.set(1);
    } catch (err: any) {
      this.error.set(err.message || 'Error al cargar registros de vacunas');
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
    const petId = this.petId();
    if (petId) {
      // If we have a petId, go back to pet detail
      this.router.navigate(['/pets', petId]);
    } else {
      // Otherwise go to home
      this.router.navigate(['/home']);
    }
  }

  addVaccine() {
    const petId = this.petId();
    if (!petId) {
      this.error.set('No se pudo determinar la mascota');
      return;
    }

    // Get veterinarian name ONLY if in provider mode AND has temporary access
    let vetName = '';
    if (this.modeService.isProviderMode() && this.isProviderAccess()) {
      const accessKey = `provider_access_${petId}`;
      const accessData = localStorage.getItem(accessKey);
      console.log('[ADD VACCINE] Access key:', accessKey);
      console.log('[ADD VACCINE] Access data from localStorage:', accessData);
      if (accessData) {
        try {
          const data = JSON.parse(accessData);
          console.log('[ADD VACCINE] Parsed data:', data);
          vetName = data.serviceName || 'Veterinario';
          console.log('[ADD VACCINE] Vet name:', vetName);
        } catch (error) {
          console.error('Error getting provider name:', error);
        }
      }
    }

    // Calculate next dose date (1 year from today)
    const today = new Date();
    const nextYear = new Date(today);
    nextYear.setFullYear(today.getFullYear() + 1);

    // Reset form and show modal
    this.vaccineForm.set({
      vaccine_id: '',
      application_date: today.toISOString().split('T')[0], // Today's date
      next_dose_date: nextYear.toISOString().split('T')[0], // 1 year from today
      batch_number: '',
      veterinarian_name: vetName,
      notes: ''
    });
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  updateFormField(field: keyof VaccineForm, value: any) {
    this.vaccineForm.update(form => ({
      ...form,
      [field]: value
    }));
  }

  async saveVaccine() {
    const form = this.vaccineForm();
    const petId = this.petId();

    // Validate required fields
    if (!form.vaccine_id || !form.application_date) {
      this.error.set('Por favor completa los campos obligatorios');
      return;
    }

    if (!petId) {
      this.error.set('No se pudo determinar la mascota');
      return;
    }

    this.savingVaccine.set(true);
    this.error.set(null);

    try {
      const payload = {
        vaccine_id: form.vaccine_id,
        applied_on: form.application_date,
        next_due_on: form.next_dose_date || null,
        batch_number: form.batch_number || null,
        veterinarian_name: form.veterinarian_name || null,
        notes: form.notes || null
      };
      console.log('[SAVE VACCINE] Form data:', form);
      console.log('[SAVE VACCINE] Payload to send:', payload);

      const token = await this.authService.getAccessToken();
      const response = await fetch(`${this.API_URL}/pets/${petId}/vaccinations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al guardar la vacuna');
      }

      // Close modal and reload data
      this.closeModal();
      await this.loadItems();

      // Recalculate pending vaccines
      await this.calculatePendingVaccines(petId);

      console.log('[MY VACCINES] Vaccine saved successfully');
    } catch (err: any) {
      this.error.set(err.message || 'Error al guardar la vacuna');
    } finally {
      this.savingVaccine.set(false);
    }
  }

  showVaccineInfo() {
    this.showInfoModal.set(true);
    this.selectedVaccineDetail.set(null);
  }

  closeInfoModal() {
    this.showInfoModal.set(false);
    this.selectedVaccineDetail.set(null);
  }

  toggleVaccineDetail(vaccineId: string | null) {
    if (this.selectedVaccineDetail() === vaccineId) {
      this.selectedVaccineDetail.set(null);
    } else {
      this.selectedVaccineDetail.set(vaccineId);
    }
  }
}
