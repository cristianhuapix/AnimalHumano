import { Component, inject, OnInit, signal, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PetService } from '../../../core/services/pet.service';
import { Pet } from '../../../core/models';
import { AuthService } from '../../../core/services/auth.service';
import { ModeService } from '../../../core/services/mode.service';
import { formatDate, getTodayISO } from '../../../shared/utils/date.utils';

interface Attachment {
  url: string;
  name: string;
}

interface MedicalRecord {
  id?: string;
  pet_id: string;
  date: string;
  title: string;
  description: string;
  attachments?: Attachment[];
  created_by?: string;
  created_by_name?: string;
  created_at?: string;
}

@Component({
  selector: 'app-medical-records',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './medical-records.html',
  styleUrl: './medical-records.scss'
})
export class MedicalRecordsComponent implements OnInit {
  private petService = inject(PetService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private modeService = inject(ModeService);

  pet = signal<Pet | null>(null);
  medicalRecords = signal<MedicalRecord[]>([]);
  isLoading = signal(false);
  errorMessage = signal('');
  petId?: string;

  // Modal states
  showAddModal = signal(false);
  showCameraModal = signal(false);
  showImageModal = signal(false);
  isSaving = signal(false);
  currentImageUrl = signal<string>('');

  // Form data
  newRecord = signal<Partial<MedicalRecord>>({
    date: getTodayISO(),
    title: '',
    description: ''
  });
  selectedFile = signal<File | null>(null);
  selectedFilePreview = signal<string | null>(null);
  stream: MediaStream | null = null;
  maxDate = getTodayISO();

  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement?: ElementRef<HTMLCanvasElement>;

  async ngOnInit() {
    this.petId = this.route.snapshot.paramMap.get('id') || undefined;
    if (this.petId) {
      await this.loadPet(this.petId);
      await this.loadMedicalRecords(this.petId);
    }
  }

  async loadPet(petId: string) {
    this.isLoading.set(true);
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

  async loadMedicalRecords(petId: string) {
    this.isLoading.set(true);
    try {
      const response = await fetch(`http://localhost:5001/api/pets/${petId}/medical-records`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${await this.authService.getAccessToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al cargar historias médicas');
      }

      const records = await response.json();
      // Ensure records is always an array
      this.medicalRecords.set(Array.isArray(records) ? records : []);
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Error al cargar historias médicas');
      console.error('Error loading medical records:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  openAddModal() {
    this.showAddModal.set(true);
    this.resetForm();
  }

  closeAddModal() {
    this.showAddModal.set(false);
    this.resetForm();
  }

  resetForm() {
    this.newRecord.set({
      date: getTodayISO(),
      title: '',
      description: ''
    });
    this.selectedFile.set(null);
    this.selectedFilePreview.set(null);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    this.selectedFile.set(file);

    // Create preview if it's an image
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.selectedFilePreview.set(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      this.selectedFilePreview.set(null);
    }
  }

  removeFile() {
    this.selectedFile.set(null);
    this.selectedFilePreview.set(null);
  }

  async openCamera() {
    this.showAddModal.set(false);
    this.showCameraModal.set(true);

    try {
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
      this.showAddModal.set(true);
    }
  }

  closeCameraModal() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.showCameraModal.set(false);
    this.showAddModal.set(true);
  }

  async capturePhoto() {
    if (!this.videoElement?.nativeElement || !this.canvasElement?.nativeElement) return;

    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;

      const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });
      this.selectedFile.set(file);

      const reader = new FileReader();
      reader.onload = (e) => {
        this.selectedFilePreview.set(e.target?.result as string);
      };
      reader.readAsDataURL(blob);

      this.closeCameraModal();
    }, 'image/jpeg', 0.9);
  }

  async saveRecord() {
    const record = this.newRecord();

    if (!record.title || !record.description || !this.petId) {
      this.errorMessage.set('Por favor completá todos los campos obligatorios');
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set('');

    try {
      // Check if user is a provider/veterinarian
      const currentUser = this.authService.currentUser();
      const isProvider = this.modeService.isProviderMode();

      const formData: any = {
        pet_id: this.petId,
        date: record.date,
        title: record.title,
        description: record.description,
        veterinarian_id: isProvider && currentUser ? currentUser.id : null,
        veterinarian_name: isProvider && currentUser ? (currentUser as any).user_metadata?.full_name || currentUser.email : null
      };

      // If there's a file, convert it to base64
      if (this.selectedFile()) {
        const base64 = await this.fileToBase64(this.selectedFile()!);
        formData.attachment_data = base64;
        formData.attachment_name = this.selectedFile()!.name;
      }

      // Call API to save medical record
      const response = await fetch(`http://localhost:5001/api/pets/${this.petId}/medical-records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.authService.getAccessToken()}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al guardar la historia médica');
      }

      this.closeAddModal();
      await this.loadMedicalRecords(this.petId);
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Error al guardar la historia médica');
      console.error('Error saving medical record:', error);
    } finally {
      this.isSaving.set(false);
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

  updateField(field: keyof MedicalRecord, value: any) {
    this.newRecord.set({
      ...this.newRecord(),
      [field]: value
    });
  }

  formatDate(date: string): string {
    return formatDate(date);
  }

  openAttachment(url: string) {
    // Clean URL by removing trailing '?' if present
    const cleanUrl = url.endsWith('?') ? url.slice(0, -1) : url;
    this.currentImageUrl.set(cleanUrl);
    this.showImageModal.set(true);
  }

  closeImageModal() {
    this.showImageModal.set(false);
    this.currentImageUrl.set('');
  }

  downloadAttachment() {
    const url = this.currentImageUrl();
    const link = document.createElement('a');
    link.href = url;
    link.download = url.split('/').pop() || 'archivo';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async shareAttachment() {
    const url = this.currentImageUrl();
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Archivo médico',
          url: url
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback: copiar al portapapeles
      navigator.clipboard.writeText(url);
      alert('Enlace copiado al portapapeles');
    }
  }

}
