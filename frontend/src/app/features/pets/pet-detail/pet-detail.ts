import { Component, inject, OnInit, signal, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PetService } from '../../../core/services/pet.service';
import { Pet } from '../../../core/models';
import { AuthService } from '../../../core/services/auth.service';
import { ModeService } from '../../../core/services/mode.service';
import * as QRCode from 'qrcode';

@Component({
  selector: 'app-pet-detail',
  imports: [CommonModule, RouterLink],
  templateUrl: './pet-detail.html',
  styleUrl: './pet-detail.scss'
})
export class PetDetailComponent implements OnInit {
  private petService = inject(PetService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private modeService = inject(ModeService);

  pet = signal<Pet | null>(null);
  isLoading = signal(false);
  errorMessage = signal('');
  petId?: string;
  showDeleteModal = signal(false);
  showPhotoModal = signal(false);
  showCameraModal = signal(false);
  showQRModal = signal(false);
  qrCodeDataUrl = signal<string>('');
  stream: MediaStream | null = null;
  hasProviderAccess = signal(false);
  providerServiceCategory = signal<string | null>(null);

  @ViewChild('photoInput') photoInput?: ElementRef<HTMLInputElement>;
  @ViewChild('docsInput') docsInput?: ElementRef<HTMLInputElement>;
  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement?: ElementRef<HTMLCanvasElement>;

  async ngOnInit() {
    this.petId = this.route.snapshot.paramMap.get('id') || undefined;
    if (this.petId) {
      this.checkProviderAccess(this.petId);
      await this.loadPet(this.petId);
    }
  }

  private checkProviderAccess(petId: string) {
    // Check if user is a provider and has temporary access
    if (this.modeService.isProviderMode()) {
      const accessKey = `provider_access_${petId}`;
      const accessData = localStorage.getItem(accessKey);

      if (accessData) {
        try {
          const { expiresAt, serviceCategory } = JSON.parse(accessData);
          const now = Date.now();

          if (now < expiresAt) {
            this.hasProviderAccess.set(true);
            this.providerServiceCategory.set(serviceCategory);
            console.log('[PET DETAIL] Provider access granted with service category:', serviceCategory);
          } else {
            // Access expired, remove it
            localStorage.removeItem(accessKey);
            this.hasProviderAccess.set(false);
            this.providerServiceCategory.set(null);
          }
        } catch (error) {
          console.error('Error parsing provider access data:', error);
          localStorage.removeItem(accessKey);
          this.hasProviderAccess.set(false);
          this.providerServiceCategory.set(null);
        }
      }
    }
  }

  // Check if a feature button should be enabled for provider
  isFeatureEnabled(feature: 'vaccines' | 'medical' | 'training' | 'grooming' | 'walks' | 'shelter' | 'boarding'): boolean {
    // If not provider access, all features are enabled (owner mode)
    if (!this.hasProviderAccess()) {
      console.log(`[isFeatureEnabled] Not provider access, feature ${feature} enabled`);
      return true;
    }

    const category = this.providerServiceCategory();
    console.log(`[isFeatureEnabled] Provider access, category: ${category}, feature: ${feature}`);

    // Veterinaria: solo vacunas e historial médico
    // Note: category comes from backend as 'veterinary' (English, lowercase)
    if (category === 'veterinary' || category === 'Veterinaria') {
      const enabled = feature === 'vaccines' || feature === 'medical';
      console.log(`[isFeatureEnabled] Veterinary service - feature ${feature} enabled: ${enabled}`);
      return enabled;
    }

    // Para otros servicios, todos los botones están deshabilitados
    console.log(`[isFeatureEnabled] Other service - feature ${feature} disabled`);
    return false;
  }

  async loadPet(petId: string) {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const pet = await this.petService.getPetById(petId);
      this.pet.set(pet);
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Error al cargar la mascota');
      console.error('Error loading pet:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  openDeleteModal() {
    this.showDeleteModal.set(true);
  }

  closeDeleteModal() {
    this.showDeleteModal.set(false);
  }

  async confirmDelete() {
    if (!this.petId) return;

    try {
      await this.petService.removePet(this.petId);
      this.router.navigate(['/pets']);
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Error al eliminar la mascota');
      console.error('Error deleting pet:', error);
      this.showDeleteModal.set(false);
    }
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

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  async updatePedigree(event: Event) {
    const target = event.target as HTMLInputElement;
    const newValue = target.checked;
    const currentPet = this.pet();

    console.log('updatePedigree called - newValue:', newValue, 'petId:', this.petId);

    if (!this.petId || !currentPet) {
      console.log('Exiting early - petId or currentPet missing');
      return;
    }

    // Store original value for rollback
    const originalValue = currentPet.has_pedigree;

    try {
      console.log('About to call savePet with:', { has_pedigree: newValue }, 'petId:', this.petId);
      const updatedPet = await this.petService.savePet({ has_pedigree: newValue }, this.petId);
      console.log('SUCCESS! Response from backend:', updatedPet);
      // Update with the response from server
      this.pet.set(updatedPet);
      console.log('Pet signal updated, new value:', this.pet()?.has_pedigree);
    } catch (error: any) {
      console.error('ERROR CAUGHT! Full error:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      this.errorMessage.set(error.message || 'Error al actualizar pedigree');
      // Revert to original value in the signal
      this.pet.set({ ...currentPet, has_pedigree: originalValue });
    }
  }

  async updateCrossable(event: Event) {
    const target = event.target as HTMLInputElement;
    const newValue = target.checked;
    const currentPet = this.pet();

    console.log('updateCrossable called - newValue:', newValue, 'petId:', this.petId);

    if (!this.petId || !currentPet) {
      console.log('Exiting early - petId or currentPet missing');
      return;
    }

    // Store original value for rollback
    const originalValue = currentPet.crossable;

    try {
      console.log('About to call savePet with:', { crossable: newValue }, 'petId:', this.petId);
      const updatedPet = await this.petService.savePet({ crossable: newValue }, this.petId);
      console.log('SUCCESS! Response from backend:', updatedPet);
      // Update with the response from server
      this.pet.set(updatedPet);
      console.log('Pet signal updated, new value:', this.pet()?.crossable);
    } catch (error: any) {
      console.error('ERROR CAUGHT! Full error:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      this.errorMessage.set(error.message || 'Error al actualizar disponibilidad para cruza');
      // Revert to original value in the signal
      this.pet.set({ ...currentPet, crossable: originalValue });
    }
  }

  editPhoto() {
    this.showPhotoModal.set(true);
  }

  closePhotoModal() {
    this.showPhotoModal.set(false);
  }

  selectPhotoFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: Event) => {
      this.onPhotoSelected(e);
      this.showPhotoModal.set(false);
    };
    input.click();
  }

  async openCamera() {
    this.showPhotoModal.set(false);
    this.showCameraModal.set(true);

    try {
      // Wait for the view to update
      await new Promise(resolve => setTimeout(resolve, 100));

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });

      if (this.videoElement?.nativeElement) {
        this.videoElement.nativeElement.srcObject = this.stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      this.errorMessage.set('No se pudo acceder a la cámara');
      this.showCameraModal.set(false);
    }
  }

  closeCameraModal() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.showCameraModal.set(false);
  }

  async capturePhoto() {
    if (!this.videoElement?.nativeElement || !this.canvasElement?.nativeElement || !this.petId) return;

    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    canvas.toBlob(async (blob) => {
      if (!blob || !this.petId) return;

      this.isLoading.set(true);
      this.closeCameraModal();

      try {
        // Convert blob to base64
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result as string;
          const petData: any = { photo_data: base64, photo_name: 'camera-photo.jpg' };

          await this.petService.savePet(petData, this.petId!);

          // Reload pet to get updated photo URL
          await this.loadPet(this.petId!);
        };
        reader.readAsDataURL(blob);
      } catch (error: any) {
        this.errorMessage.set(error.message || 'Error al guardar la foto');
        console.error('Error saving camera photo:', error);
      } finally {
        this.isLoading.set(false);
      }
    }, 'image/jpeg', 0.9);
  }

  editDocuments() {
    // Crear input file temporal
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png';
    input.onchange = (e: Event) => this.onDocumentsSelected(e);
    input.click();
  }

  async onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0] || !this.petId) return;

    const file = input.files[0];
    this.isLoading.set(true);

    try {
      const base64 = await this.fileToBase64(file);
      const petData: any = { photo_data: base64, photo_name: file.name };

      await this.petService.savePet(petData, this.petId);

      // Reload pet to get updated photo URL
      await this.loadPet(this.petId);
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Error al actualizar la foto');
      console.error('Error updating photo:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async onDocumentsSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0] || !this.petId) return;

    const file = input.files[0];
    this.isLoading.set(true);

    try {
      const base64 = await this.fileToBase64(file);
      const petData: any = { papers_data: base64, papers_name: file.name };

      await this.petService.savePet(petData, this.petId);

      // Reload pet to get updated documents URL
      await this.loadPet(this.petId);
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Error al actualizar los documentos');
      console.error('Error updating documents:', error);
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

  showVaccines() {
    if (!this.petId) return;

    // If provider has temporary access, navigate to vaccines page
    if (this.hasProviderAccess()) {
      this.router.navigate(['/pets', this.petId, 'vaccines']);
    } else {
      // For owners, navigate to vaccines page
      this.router.navigate(['/pets', this.petId, 'vaccines']);
    }
  }

  showMedicalRecords() {
    if (!this.petId) return;

    // If provider has temporary access, navigate to medical records page
    if (this.hasProviderAccess()) {
      this.router.navigate(['/pets', this.petId, 'medical-records']);
    } else {
      // For owners, navigate to medical records page
      this.router.navigate(['/pets', this.petId, 'medical-records']);
    }
  }

  async showQR() {
    if (!this.petId) return;

    try {
      // Generate QR code with pet URL
      const petUrl = `${window.location.origin}/pets/${this.petId}`;
      const qrDataUrl = await QRCode.toDataURL(petUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#2c3e50',
          light: '#ffffff'
        }
      });

      this.qrCodeDataUrl.set(qrDataUrl);
      this.showQRModal.set(true);
    } catch (error) {
      console.error('Error generating QR code:', error);
      this.errorMessage.set('Error al generar código QR');
    }
  }

  closeQRModal() {
    this.showQRModal.set(false);
  }

  downloadQR() {
    const currentPet = this.pet();
    if (!currentPet) return;

    const link = document.createElement('a');
    link.href = this.qrCodeDataUrl();
    link.download = `qr-${currentPet.name.toLowerCase().replace(/\s+/g, '-')}.png`;
    link.click();
  }
}
