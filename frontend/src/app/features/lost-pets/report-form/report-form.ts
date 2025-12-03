import { Component, OnInit, OnDestroy, signal, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LostPetService } from '../../../core/services/lost-pet.service';
import { PetService } from '../../../core/services/pet.service';
import { Pet, Species, Breed } from '../../../core/models';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-report-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './report-form.html',
  styleUrl: './report-form.scss'
})
export class ReportFormComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement?: ElementRef<HTMLCanvasElement>;

  private fb = inject(FormBuilder);
  private lostPetService = inject(LostPetService);
  private petService = inject(PetService);
  private router = inject(Router);

  reportForm!: FormGroup;
  myPets = signal<Pet[]>([]);
  allSpecies = signal<Species[]>([]);
  allBreeds = signal<Breed[]>([]);
  filteredBreeds = signal<Breed[]>([]);

  isOwnPet = signal(true);
  isSubmitting = signal(false);
  errorMessage = signal('');

  // Camera related
  showCamera = signal(false);
  capturedPhoto = signal<File | null>(null);
  capturedPhotoUrl = signal<string | null>(null);
  stream: MediaStream | null = null;

  async ngOnInit() {
    this.initForm();
    await this.loadMyPets();
    await this.loadSpecies();
    await this.loadBreeds();
    await this.getUserLocation();
  }

  initForm() {
    this.reportForm = this.fb.group({
      reportType: ['own'], // 'own' or 'found'
      petId: [''],
      speciesId: [''],
      breedId: [''],
      name: [''], // Optional name from collar
      description: ['', Validators.required],
      contactPhone: [''],
      lastSeenAddress: ['', Validators.required],
      latitude: [null],
      longitude: [null]
    });

    // Watch for reportType changes
    this.reportForm.get('reportType')?.valueChanges.subscribe(value => {
      this.isOwnPet.set(value === 'own');
      this.updateValidators();
    });

    // Watch for speciesId changes to filter breeds
    this.reportForm.get('speciesId')?.valueChanges.subscribe(speciesId => {
      this.filterBreedsBySpecies(speciesId);
    });
  }

  updateValidators() {
    const petIdControl = this.reportForm.get('petId');
    const speciesIdControl = this.reportForm.get('speciesId');

    if (this.isOwnPet()) {
      petIdControl?.setValidators([Validators.required]);
      speciesIdControl?.clearValidators();
    } else {
      petIdControl?.clearValidators();
      speciesIdControl?.setValidators([Validators.required]);
    }

    petIdControl?.updateValueAndValidity();
    speciesIdControl?.updateValueAndValidity();
  }

  async loadMyPets() {
    try {
      const response = await firstValueFrom(this.petService.getMyPets());
      if (response.data) {
        this.myPets.set(response.data);
        console.log('Mascotas cargadas:', response.data);
      } else {
        console.warn('No hay data en la respuesta de mascotas');
        this.myPets.set([]);
      }
    } catch (error) {
      console.error('Error loading pets:', error);
      // Si hay error (ej: backend no disponible), dejar array vacío
      this.myPets.set([]);
    }
  }

  async loadSpecies() {
    try {
      const response = await firstValueFrom(this.petService.getSpecies());
      if (response.data) {
        this.allSpecies.set(response.data);
      }
    } catch (error) {
      console.error('Error loading species:', error);
    }
  }

  async loadBreeds() {
    try {
      const response = await firstValueFrom(this.petService.getBreeds());
      if (response.data) {
        this.allBreeds.set(response.data);
      }
    } catch (error) {
      console.error('Error loading breeds:', error);
    }
  }

  filterBreedsBySpecies(speciesId: string) {
    if (!speciesId) {
      this.filteredBreeds.set([]);
      return;
    }
    const filtered = this.allBreeds().filter(breed => breed.species_id === speciesId);
    this.filteredBreeds.set(filtered);
  }

  async getUserLocation() {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.reportForm.patchValue({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.warn('Geolocation error:', error);
        }
      );
    }
  }

  async toggleCamera() {
    if (this.showCamera()) {
      await this.stopCamera();
    } else {
      await this.startCamera();
    }
  }

  async startCamera() {
    try {
      // First show the camera UI
      this.showCamera.set(true);

      // Wait for view to update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Then request camera access
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      if (this.videoElement?.nativeElement) {
        this.videoElement.nativeElement.srcObject = this.stream;
      } else {
        console.error('Video element not found');
        this.errorMessage.set('Error al inicializar la cámara');
        this.showCamera.set(false);
      }
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      let errorMsg = 'No se pudo acceder a la cámara. Verificá los permisos.';

      if (error.name === 'NotAllowedError') {
        errorMsg = 'Permiso de cámara denegado. Por favor permite el acceso a la cámara.';
      } else if (error.name === 'NotReadableError') {
        errorMsg = 'La cámara está siendo usada por otra aplicación. Cerrá otras apps que estén usando la cámara e intentá de nuevo.';
      } else if (error.name === 'NotFoundError') {
        errorMsg = 'No se encontró ninguna cámara en este dispositivo.';
      }

      this.errorMessage.set(errorMsg);
      this.showCamera.set(false);
    }
  }

  async stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.showCamera.set(false);
  }

  capturePhoto() {
    if (!this.videoElement?.nativeElement || !this.canvasElement?.nativeElement) {
      return;
    }

    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `found-pet-${Date.now()}.jpg`, { type: 'image/jpeg' });
        this.capturedPhoto.set(file);
        this.capturedPhotoUrl.set(URL.createObjectURL(blob));
        this.stopCamera();
      }
    }, 'image/jpeg', 0.8);
  }

  removePhoto() {
    if (this.capturedPhotoUrl()) {
      URL.revokeObjectURL(this.capturedPhotoUrl()!);
    }
    this.capturedPhoto.set(null);
    this.capturedPhotoUrl.set(null);
  }

  async onSubmit() {
    if (this.reportForm.invalid) {
      this.reportForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    try {
      const formValue = this.reportForm.value;
      const reportData: any = {
        report_type: this.isOwnPet() ? 'lost' : 'found',
        description: formValue.description,
        contact_phone: formValue.contactPhone || undefined,
        last_seen_at: new Date().toISOString(),
        latitude: formValue.latitude,
        longitude: formValue.longitude
      };

      if (this.isOwnPet()) {
        reportData.pet_id = formValue.petId;
      } else {
        reportData.species_id = formValue.speciesId;
        reportData.breed_id = formValue.breedId || undefined;

        // Add captured photo
        if (this.capturedPhoto()) {
          reportData.images = [this.capturedPhoto()!];
        }
      }

      const response = await firstValueFrom(this.lostPetService.createReport(reportData));

      if (response.data) {
        // Navigate to lost pets list
        this.router.navigate(['/lost-pets']);
      } else {
        this.errorMessage.set(response.error || 'Error al crear el reporte');
      }
    } catch (error: any) {
      console.error('Error creating report:', error);
      console.log('Error object:', JSON.stringify(error, null, 2));

      // Extract error message from backend response
      let errorMsg = 'Error al crear el reporte';

      if (error?.error?.error) {
        errorMsg = error.error.error;
      } else if (error?.error?.message) {
        errorMsg = error.error.message;
      } else if (error?.message) {
        errorMsg = error.message;
      } else if (typeof error?.error === 'string') {
        errorMsg = error.error;
      }

      this.errorMessage.set(errorMsg);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  cancel() {
    this.router.navigate(['/lost-pets']);
  }

  ngOnDestroy() {
    this.stopCamera();
    if (this.capturedPhotoUrl()) {
      URL.revokeObjectURL(this.capturedPhotoUrl()!);
    }
  }
}
