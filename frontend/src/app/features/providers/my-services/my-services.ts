import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProviderServicesService, ProviderService, ServiceType } from '../../../core/services/provider-services.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-my-services',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './my-services.html',
  styleUrl: './my-services.scss'
})
export class MyServicesComponent implements OnInit {
  private providerServicesService = inject(ProviderServicesService);
  private authService = inject(AuthService);
  private router = inject(Router);

  services = signal<ProviderService[]>([]);
  serviceTypes = signal<ServiceType[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // Pagination
  currentPage = signal(1);
  pageSize = 12;
  totalPages = signal(0);

  showAddForm = signal(false);
  editingService = signal<ProviderService | null>(null);

  // Delete confirmation modal
  showDeleteModal = signal(false);
  serviceToDelete = signal<ProviderService | null>(null);

  // Selected category as signal for reactivity
  selectedCategory = signal<string>('');

  // Form fields (not a signal, just a regular object for ngModel)
  formData = {
    service_name: '',
    category: '',
    service_type_ids: [] as string[], // Multiple services can be selected
    custom_description: '',
    website_url: '',
    instagram: '',
    active: true
  };

  // Category translations
  categoryNames: Record<string, string> = {
    'veterinary': 'Veterinaria',
    'grooming': 'Peluquería y Estética',
    'walking': 'Paseos',
    'training': 'Entrenamiento',
    'boarding': 'Guardería y Hospedaje',
    'petshop': 'Tienda de Mascotas',
    'shelter': 'Refugio y Adopción'
  };

  // Computed: Available categories (all categories with service types)
  availableCategories = computed(() => {
    const allTypes = this.serviceTypes();

    // Get unique categories
    const categories = [...new Set(allTypes.map(t => t.category))];

    return categories;
  });

  // Computed: Service types filtered by selected category (all types, allowing duplicates)
  availableServiceTypesForCategory = computed(() => {
    const allTypes = this.serviceTypes();
    const selectedCategory = this.selectedCategory();

    if (!selectedCategory) return [];

    return allTypes.filter(type => type.category === selectedCategory);
  });

  // Computed: Paginated services
  paginatedServices = computed(() => {
    const allServices = this.services();
    const page = this.currentPage();
    const start = (page - 1) * this.pageSize;
    const end = start + this.pageSize;
    return allServices.slice(start, end);
  });

  async ngOnInit() {
    // Verificar que el usuario es proveedor
    if (!this.authService.isProvider()) {
      this.router.navigate(['/home']);
      return;
    }

    await Promise.all([
      this.loadServices(),
      this.loadServiceTypes()
    ]);
  }

  async loadServices() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const services = await this.providerServicesService.getMyServices();
      this.services.set(services);

      // Calculate total pages
      const totalPages = Math.ceil(services.length / this.pageSize);
      this.totalPages.set(totalPages);

      // Reset to page 1 if current page is out of bounds
      if (this.currentPage() > totalPages && totalPages > 0) {
        this.currentPage.set(1);
      }
    } catch (err: any) {
      this.error.set(err.message || 'Error al cargar servicios');
      console.error('Error loading services:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async loadServiceTypes() {
    try {
      const types = await this.providerServicesService.getServiceTypes();
      this.serviceTypes.set(types);
    } catch (err: any) {
      console.error('Error loading service types:', err);
    }
  }

  openAddForm() {
    this.resetForm();
    this.editingService.set(null);
    this.showAddForm.set(true);
  }

  openEditForm(service: ProviderService) {
    const serviceType = this.serviceTypes().find(t => t.id === service.service_type_id);
    const category = serviceType?.category || '';
    this.selectedCategory.set(category);
    this.formData = {
      service_name: service.custom_name || '',
      category: category,
      service_type_ids: [service.service_type_id],
      custom_description: service.custom_description || '',
      website_url: service.website_url || '',
      instagram: service.instagram || '',
      active: service.active
    };
    this.editingService.set(service);
    this.showAddForm.set(true);
  }

  closeForm() {
    this.showAddForm.set(false);
    this.editingService.set(null);
    this.resetForm();
  }

  resetForm() {
    this.selectedCategory.set('');
    this.formData = {
      service_name: '',
      category: '',
      service_type_ids: [],
      custom_description: '',
      website_url: '',
      instagram: '',
      active: true
    };
  }

  onCategoryChange() {
    // Update the signal to trigger computed re-evaluation
    this.selectedCategory.set(this.formData.category);
    // Clear selected services when category changes
    this.formData.service_type_ids = [];
  }

  onServiceTypeToggle(serviceTypeId: string, event: any) {
    const isChecked = event.target.checked;
    if (isChecked) {
      if (!this.formData.service_type_ids.includes(serviceTypeId)) {
        this.formData.service_type_ids.push(serviceTypeId);
      }
    } else {
      this.formData.service_type_ids = this.formData.service_type_ids.filter(id => id !== serviceTypeId);
    }
  }

  async saveService() {
    const data = this.formData;

    if (!data.service_name || data.service_name.trim() === '') {
      alert('Por favor ingresá el nombre del servicio');
      return;
    }

    if (!data.category) {
      alert('Por favor seleccioná una categoría');
      return;
    }

    if (!data.service_type_ids || data.service_type_ids.length === 0) {
      alert('Por favor seleccioná al menos un servicio');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const editingService = this.editingService();

      if (editingService) {
        // Update existing service (can't change service type, only custom fields)
        await this.providerServicesService.updateService(editingService.id!, {
          custom_name: data.service_name,
          custom_description: data.custom_description,
          website_url: data.website_url,
          instagram: data.instagram,
          active: data.active
        });
      } else {
        // Create multiple services (one for each selected service type)
        for (const serviceTypeId of data.service_type_ids) {
          await this.providerServicesService.addService({
            service_type_id: serviceTypeId,
            custom_name: data.service_name,
            custom_description: data.custom_description,
            website_url: data.website_url,
            instagram: data.instagram,
            active: true
          });
        }
      }

      await this.loadServices();
      this.closeForm();
    } catch (err: any) {
      // Extract error message from HTTP error response
      const errorMessage = err.error?.error || err.message || 'Error al guardar servicio';
      this.error.set(errorMessage);
      console.error('Error saving service:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async toggleServiceStatus(service: ProviderService) {
    this.loading.set(true);
    this.error.set(null);

    try {
      await this.providerServicesService.toggleServiceStatus(service.id!, !service.active);
      await this.loadServices();
    } catch (err: any) {
      // Extract error message from HTTP error response
      const errorMessage = err.error?.error || err.message || 'Error al cambiar estado del servicio';
      this.error.set(errorMessage);
      console.error('Error toggling service status:', err);
    } finally {
      this.loading.set(false);
    }
  }

  openDeleteModal(service: ProviderService) {
    this.serviceToDelete.set(service);
    this.showDeleteModal.set(true);
  }

  closeDeleteModal() {
    this.showDeleteModal.set(false);
    this.serviceToDelete.set(null);
  }

  async confirmDelete() {
    const service = this.serviceToDelete();
    if (!service) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      await this.providerServicesService.deleteService(service.id!);
      await this.loadServices();
      this.closeDeleteModal();
    } catch (err: any) {
      this.error.set(err.message || 'Error al eliminar servicio');
      console.error('Error deleting service:', err);
    } finally {
      this.loading.set(false);
    }
  }

  // Pagination methods
  goToPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.set(this.currentPage() + 1);
    }
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.set(this.currentPage() - 1);
    }
  }

  goBack() {
    this.router.navigate(['/home']);
  }
}
