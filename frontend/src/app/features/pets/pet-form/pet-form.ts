import { Component, inject, OnInit, OnDestroy, signal, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PetService } from '../../../core/services/pet.service';
import { StorageService } from '../../../core/services/storage.service';
import { Species, Breed, Pet } from '../../../core/models';

@Component({
  selector: 'app-pet-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './pet-form.html',
  styleUrl: './pet-form.scss'
})
export class PetFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private petService = inject(PetService);
  private storageService = inject(StorageService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  petForm: FormGroup;
  isLoading = signal(false);
  errorMessage = signal('');
  isEditMode = signal(false);
  petId?: string;

  species = signal<Species[]>([]);
  breeds = signal<Breed[]>([]);
  filteredBreeds = signal<Breed[]>([]);

  showOtherSpecies = signal(false);
  showOtherBreed = signal(false);

  selectedPhotoName = '';
  selectedPapersName = '';
  photoFile?: File;
  papersFile?: File;

  showCamera = false;
  cameraStream?: MediaStream;
  maxDate: string;

  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement?: ElementRef<HTMLCanvasElement>;

  constructor() {
    // Set max date to today
    const today = new Date();
    this.maxDate = today.toISOString().split('T')[0];

    this.petForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      birth_date: ['', Validators.required],
      species_id: ['', Validators.required],
      breed_id: ['', Validators.required],
      sex: ['M', Validators.required],
      photo_url: [''],
      papers_url: [''],
      crossable: [false],
      has_pedigree: [false],
      dnia: [''],
      other_species_name: [''],
      other_breed_name: ['']
    });
  }

  async ngOnInit() {
    this.petId = this.route.snapshot.paramMap.get('id') || undefined;
    this.isEditMode.set(!!this.petId);

    await this.loadFormData();

    if (this.petId) {
      await this.loadPet(this.petId);
    }

    // UUID for "Otra" option
    const OTHER_UUID = '00000000-0000-0000-0000-000000000001';

    // Watch for species changes
    this.petForm.get('species_id')?.valueChanges.subscribe(speciesId => {
      this.showOtherSpecies.set(speciesId === OTHER_UUID);
      if (speciesId === OTHER_UUID) {
        this.filteredBreeds.set([]);
        this.petForm.patchValue({ breed_id: OTHER_UUID });
        this.showOtherBreed.set(true);
      } else {
        this.filterBreeds(speciesId);
        this.petForm.patchValue({ breed_id: '' });
        this.showOtherBreed.set(false);
      }
    });

    // Watch for breed changes
    this.petForm.get('breed_id')?.valueChanges.subscribe(breedId => {
      this.showOtherBreed.set(breedId === OTHER_UUID);
    });
  }

  ngOnDestroy() {
    // Asegurar que la cámara se cierre cuando el componente se destruye
    this.stopCamera();
  }

  async loadFormData() {
    try {
      const [speciesList, breedsList] = await Promise.all([
        this.petService.getSpeciesList(),
        this.petService.getBreedsList()
      ]);

      this.species.set(speciesList);
      this.breeds.set(breedsList);
    } catch (error: any) {
      this.errorMessage.set('Error al cargar los datos del formulario');
      console.error('Error loading form data:', error);
    }
  }

  async loadPet(petId: string) {
    this.isLoading.set(true);
    try {
      const pet = await this.petService.getPetById(petId);

      // Filter breeds first
      this.filterBreeds(pet.species_id);

      // Then populate form
      this.petForm.patchValue({
        name: pet.name,
        birth_date: pet.birth_date,
        species_id: pet.species_id,
        breed_id: pet.breed_id,
        sex: pet.sex,
        photo_url: pet.photo_url || '',
        papers_url: pet.papers_url || '',
        crossable: pet.crossable,
        has_pedigree: pet.has_pedigree,
        dnia: pet.dnia || ''
      });
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Error al cargar la mascota');
      console.error('Error loading pet:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  filterBreeds(speciesId: string) {
    if (!speciesId) {
      this.filteredBreeds.set([]);
      return;
    }

    const filtered = this.breeds().filter(breed => breed.species_id === speciesId);
    this.filteredBreeds.set(filtered);
  }

  async onSubmit() {
    // Validate "Otra" fields if selected
    if (this.showOtherSpecies() && !this.petForm.get('other_species_name')?.value?.trim()) {
      this.errorMessage.set('Por favor especifica el nombre de la especie');
      return;
    }
    if (this.showOtherBreed() && !this.petForm.get('other_breed_name')?.value?.trim()) {
      this.errorMessage.set('Por favor especifica el nombre de la raza');
      return;
    }

    if (this.petForm.invalid) {
      this.markFormGroupTouched(this.petForm);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const petData: any = { ...this.petForm.value };

      // Convert photo to base64 if selected
      if (this.photoFile) {
        const photoBase64 = await this.fileToBase64(this.photoFile);
        petData.photo_data = photoBase64;
        petData.photo_name = this.photoFile.name;
      }

      // Convert documents to base64 if selected
      if (this.papersFile) {
        const papersBase64 = await this.fileToBase64(this.papersFile);
        petData.papers_data = papersBase64;
        petData.papers_name = this.papersFile.name;
      }

      // Save pet with inline file uploads
      await this.petService.savePet(petData, this.petId);
      this.router.navigate(['/pets']);
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Error al guardar la mascota');
      console.error('Error saving pet:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }


  cancel() {
    this.router.navigate(['/pets']);
  }

  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.photoFile = input.files[0];
      this.selectedPhotoName = input.files[0].name;
    }
  }

  onPapersSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.papersFile = input.files[0];
      this.selectedPapersName = input.files[0].name;
    }
  }

  async toggleCamera() {
    if (this.showCamera) {
      // Cerrar cámara
      this.stopCamera();
      this.showCamera = false;
    } else {
      // Abrir cámara
      this.showCamera = true;
      await this.startCamera();
    }
  }

  async startCamera() {
    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Usa cámara trasera en móviles
      });

      // Wait for view to render
      setTimeout(() => {
        if (this.videoElement) {
          this.videoElement.nativeElement.srcObject = this.cameraStream!;
        }
      }, 100);
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('No se pudo acceder a la cámara. Por favor, verifica los permisos.');
      this.showCamera = false;
    }
  }

  stopCamera() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = undefined;
    }
  }

  capturePhoto() {
    if (!this.videoElement || !this.canvasElement) return;

    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);

      // Cerrar cámara inmediatamente
      this.stopCamera();
      this.showCamera = false;

      // Convertir a blob después
      canvas.toBlob((blob) => {
        if (blob) {
          this.photoFile = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
          this.selectedPhotoName = this.photoFile.name;
        }
      }, 'image/jpeg');
    }
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.petForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getFieldError(fieldName: string): string {
    const field = this.petForm.get(fieldName);
    if (!field || !field.errors || !field.touched) return '';

    if (field.errors['required']) return 'Este campo es requerido';
    if (field.errors['minlength']) return `Mínimo ${field.errors['minlength'].requiredLength} caracteres`;

    return '';
  }
}
