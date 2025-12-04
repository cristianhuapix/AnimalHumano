import { Component, OnInit, OnDestroy, ViewChild, ElementRef, signal, inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Html5Qrcode } from 'html5-qrcode';
import { ProviderServicesService, ProviderService } from '../../core/services/provider-services.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './qr-scanner.html',
  styleUrl: './qr-scanner.scss',
  encapsulation: ViewEncapsulation.None
})
export class QrScannerComponent implements OnInit, OnDestroy {
  @ViewChild('reader') readerElement?: ElementRef<HTMLDivElement>;

  private html5QrCode?: Html5Qrcode;
  private providerServicesService = inject(ProviderServicesService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private API_URL = 'http://localhost:5001/api';

  // Two-step flow
  showServiceSelection = signal(true);
  showScanner = signal(false);

  // Services
  myServices = signal<ProviderService[]>([]);
  selectedService = signal<ProviderService | null>(null);
  loadingServices = signal(false);

  // Scanner state
  isScanning = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  // Boarding modal state
  showBoardingModal = signal(false);
  scannedPetId = signal<string | null>(null);
  scannedPetName = signal<string>('');
  boardingForm = signal({
    start_date: '',
    end_date: '',
    days: 1,
    notes: ''
  });
  savingBoarding = signal(false);

  // Simple service modal state (grooming, training, shelter, walks)
  showSimpleServiceModal = signal(false);
  simpleServiceForm = signal({
    notes: ''
  });
  serviceCategory = signal<string>('');
  savingSimpleService = signal(false);

  ngOnInit() {
    this.loadMyServices();
  }

  ngOnDestroy() {
    this.stopScanning();
  }

  // Translate category to Spanish
  getCategoryInSpanish(category: string): string {
    const translations: Record<string, string> = {
      'veterinary': 'Veterinaria',
      'grooming': 'Peluquería y Estética',
      'walking': 'Paseos',
      'training': 'Entrenamiento',
      'boarding': 'Guardería y Hospedaje',
      'petshop': 'Tienda de Mascotas',
      'shelter': 'Refugio y Adopción'
    };
    return translations[category] || category;
  }

  async loadMyServices() {
    this.loadingServices.set(true);
    this.errorMessage.set('');

    try {
      const services = await this.providerServicesService.getMyServices();
      // Filter only active services
      const activeServices = services.filter(s => s.active);
      this.myServices.set(activeServices);

      if (activeServices.length === 0) {
        this.errorMessage.set('No tenés servicios activos. Agregá servicios en "Mis Servicios" primero.');
      }
    } catch (err: any) {
      this.errorMessage.set('Error al cargar servicios: ' + (err.message || 'Error desconocido'));
      console.error('Error loading services:', err);
    } finally {
      this.loadingServices.set(false);
    }
  }

  selectService(service: ProviderService) {
    this.selectedService.set(service);
    this.showServiceSelection.set(false);
    this.showScanner.set(true);
    // Start scanning after a short delay to allow DOM to render
    setTimeout(() => this.startScanning(), 100);
  }

  goBackToServices() {
    this.stopScanning();
    this.showScanner.set(false);
    this.showServiceSelection.set(true);
    this.selectedService.set(null);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  async startScanning() {
    try {
      this.isScanning.set(true);
      this.errorMessage.set('');

      // Esperar a que el elemento esté disponible
      await new Promise(resolve => setTimeout(resolve, 100));

      this.html5QrCode = new Html5Qrcode("reader");

      await this.html5QrCode.start(
        { facingMode: "environment" }, // Usar cámara trasera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          this.onScanSuccess(decodedText);
        },
        (errorMessage) => {
          // Ignorar errores de escaneo continuo
        }
      );
    } catch (error: any) {
      console.error('Error starting scanner:', error);
      this.errorMessage.set('No se pudo acceder a la cámara. Por favor, permite el acceso a la cámara.');
      this.isScanning.set(false);
    }
  }

  async stopScanning() {
    if (this.html5QrCode && this.isScanning()) {
      try {
        await this.html5QrCode.stop();
        this.html5QrCode.clear();
      } catch (error) {
        console.error('Error stopping scanner:', error);
      }
    }
  }

  async onScanSuccess(decodedText: string) {
    try {
      // Detener el escaneo
      await this.stopScanning();
      this.isScanning.set(false);

      // El QR contiene la URL completa de la mascota con token dinámico
      // ej: http://localhost:4200/pets/6367c06c-a0eb-4935-bfaa-d6a1527634cf?qr=abc123...
      // Extraer el ID de la mascota y el token QR
      const url = new URL(decodedText);
      const pathParts = url.pathname.split('/');
      const petId = pathParts[pathParts.length - 1];
      const qrToken = url.searchParams.get('qr'); // Token dinámico

      if (!petId) {
        this.errorMessage.set('Código QR inválido');
        return;
      }

      const selectedSvc = this.selectedService();
      if (!selectedSvc || !selectedSvc.id) {
        this.errorMessage.set('No se seleccionó un servicio válido');
        return;
      }

      // Registrar acceso en el backend con el token dinámico
      console.log('[QR SCANNER] Registrando acceso QR para pet:', petId, 'service:', selectedSvc.id, 'token:', qrToken ? qrToken.substring(0, 20) + '...' : 'none');
      const response = await this.providerServicesService.registerQrAccess(petId, selectedSvc.id, qrToken || undefined);
      console.log('[QR SCANNER] Respuesta del backend:', response);

      // Guardar acceso temporal en localStorage (expira en 2 horas)
      const accessData = {
        petId: petId,
        serviceId: selectedSvc.id,
        serviceTypeId: selectedSvc.service_type_id,
        serviceName: selectedSvc.custom_name || selectedSvc.service_type?.name,
        serviceCategory: selectedSvc.service_type?.category,
        scanId: response.scan_id,
        expiresAt: Date.now() + (2 * 60 * 60 * 1000) // 2 horas en milisegundos
      };
      console.log('[QR SCANNER] Guardando accessData en localStorage:', accessData);
      localStorage.setItem(`provider_access_${petId}`, JSON.stringify(accessData));
      console.log('[QR SCANNER] Verificando guardado:', localStorage.getItem(`provider_access_${petId}`));

      // Check what type of service this is
      console.log('[QR SCANNER] Service category:', selectedSvc.service_type?.category);
      console.log('[QR SCANNER] Full service data:', selectedSvc);
      console.log('[QR SCANNER] Backend response:', response);

      const category = selectedSvc.service_type?.category || '';
      const isSimpleService = response.is_simple_service ||
                             ['grooming', 'training', 'walking', 'petshop'].includes(category);
      const isBoardingService = category === 'boarding';

      console.log('[QR SCANNER] Is simple service?', isSimpleService);
      console.log('[QR SCANNER] Is boarding service?', isBoardingService);

      if (isBoardingService) {
        // Show boarding modal (complex form with dates)
        console.log('[QR SCANNER] Boarding service detected, showing modal');
        this.scannedPetId.set(petId);
        this.scannedPetName.set(response.pet_name);

        // Set default dates: today to tomorrow
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        this.boardingForm.set({
          start_date: today.toISOString().split('T')[0],
          end_date: tomorrow.toISOString().split('T')[0],
          days: 1,
          notes: ''
        });

        this.showBoardingModal.set(true);
        console.log('[QR SCANNER] Boarding modal state set to true');
      } else if (isSimpleService) {
        // Show simple service modal (just notes)
        console.log('[QR SCANNER] Simple service detected, showing simple modal');
        this.scannedPetId.set(petId);
        this.scannedPetName.set(response.pet_name);
        this.serviceCategory.set(category);

        this.simpleServiceForm.set({
          notes: ''
        });

        this.showSimpleServiceModal.set(true);
        console.log('[QR SCANNER] Simple modal state set to true');
      } else {
        // For other services (veterinary, etc), redirect to pet detail
        this.successMessage.set(`¡Acceso concedido a ${response.pet_name}! Redirigiendo...`);
        setTimeout(() => {
          this.router.navigate(['/pets', petId]);
        }, 1000);
      }

    } catch (error: any) {
      console.error('Error processing QR:', error);
      this.errorMessage.set(error.error?.error || 'Error al procesar el código QR');
      this.isScanning.set(false);
      // No reiniciar el escáner automáticamente - el usuario debe hacer click en Reintentar
    }
  }

  retry() {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.startScanning();
  }

  close() {
    this.stopScanning();
    this.router.navigate(['/']);
  }

  // Boarding modal methods
  updateBoardingField(field: 'start_date' | 'end_date' | 'days' | 'notes', value: any) {
    const form = this.boardingForm();
    this.boardingForm.set({
      ...form,
      [field]: value
    });

    // Calculate days when dates change
    if (field === 'start_date' || field === 'end_date') {
      this.calculateDays();
    }
  }

  calculateDays() {
    const form = this.boardingForm();
    if (form.start_date && form.end_date) {
      const start = new Date(form.start_date);
      const end = new Date(form.end_date);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      this.boardingForm.set({
        ...form,
        days: diffDays || 1
      });
    }
  }

  async saveBoarding() {
    const form = this.boardingForm();
    const petId = this.scannedPetId();

    if (!form.start_date || !form.end_date) {
      this.errorMessage.set('Por favor completa las fechas de inicio y fin');
      return;
    }

    if (!petId) {
      this.errorMessage.set('No se pudo determinar la mascota');
      return;
    }

    this.savingBoarding.set(true);
    this.errorMessage.set('');

    try {
      const payload = {
        pet_id: petId,
        start_date: form.start_date,
        end_date: form.end_date,
        days: form.days,
        notes: form.notes || null
      };

      const token = await this.authService.getAccessToken();
      const response = await fetch(`${this.API_URL}/providers/me/boardings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al registrar el hospedaje');
      }

      // Success
      this.successMessage.set('¡Hospedaje registrado exitosamente!');
      this.showBoardingModal.set(false);

      // Redirect to boarding list after a delay
      setTimeout(() => {
        this.router.navigate(['/providers/my-boarding']);
      }, 1500);

    } catch (err: any) {
      this.errorMessage.set(err.message || 'Error al registrar el hospedaje');
    } finally {
      this.savingBoarding.set(false);
    }
  }

  closeBoardingModal() {
    this.showBoardingModal.set(false);
    this.scannedPetId.set(null);
    this.scannedPetName.set('');
    this.boardingForm.set({
      start_date: '',
      end_date: '',
      days: 1,
      notes: ''
    });
    this.errorMessage.set('');
    // Return to scanner
    this.showScanner.set(false);
    this.showServiceSelection.set(true);
  }

  // Simple service modal methods
  async saveSimpleService() {
    const form = this.simpleServiceForm();
    const petId = this.scannedPetId();
    const category = this.serviceCategory();

    if (!petId || !category) {
      this.errorMessage.set('Faltan datos del servicio');
      return;
    }

    this.savingSimpleService.set(true);
    this.errorMessage.set('');

    try {
      const payload = {
        pet_id: petId,
        service_category: category,
        notes: form.notes || ''
      };

      const token = await this.authService.getAccessToken();
      const response = await fetch(`${this.API_URL}/providers/me/simple-service`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al registrar el servicio');
      }

      // Success
      const categoryNames: Record<string, string> = {
        'grooming': 'peluquería',
        'training': 'entrenamiento',
        'walking': 'paseo',
        'petshop': 'tienda',
        'shelter': 'refugio'
      };
      const categoryName = categoryNames[category] || category;

      this.successMessage.set(`¡${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)} registrado exitosamente!`);
      this.showSimpleServiceModal.set(false);

      // Redirect to corresponding list after a delay
      const routes: Record<string, string> = {
        'grooming': '/providers/my-grooming',
        'training': '/providers/my-trainings',
        'walking': '/providers/my-walks',
        'shelter': '/providers/my-shelter',
        'petshop': '/providers/my-petshop'
      };

      setTimeout(() => {
        const route = routes[category] || '/';
        this.router.navigate([route]);
      }, 1500);

    } catch (err: any) {
      this.errorMessage.set(err.message || 'Error al registrar el servicio');
    } finally {
      this.savingSimpleService.set(false);
    }
  }

  closeSimpleServiceModal() {
    this.showSimpleServiceModal.set(false);
    this.scannedPetId.set(null);
    this.scannedPetName.set('');
    this.serviceCategory.set('');
    this.simpleServiceForm.set({
      notes: ''
    });
    this.errorMessage.set('');
    // Return to scanner
    this.showScanner.set(false);
    this.showServiceSelection.set(true);
  }
}
