import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { ConversationsService } from '../../core/services/conversations.service';

interface ServiceType {
  id: string;
  code: string;
  name: string;
  category: string;
  icon: string;
}

interface Provider {
  id: string;
  business_name: string;
  description?: string;
  address?: string;
  city?: string;
  province?: string;
  phone?: string;
  email?: string;
  distance?: number;
  rating?: number;
  rating_count?: number;
  profiles?: {
    full_name: string;
    email: string;
    phone?: string;
    city?: string;
    province?: string;
  };
}

interface ProviderDetails {
  provider: Provider;
  has_contacted: boolean;
  can_rate: boolean;
  last_rating_date?: string;
}

interface ProviderService {
  id: string;
  provider_id: string;
  service_type_id: string;
  custom_name?: string;
  description?: string;
  price?: number;
  active: boolean;
  created_at: string;
  service_type?: ServiceType;
  providers?: Provider;
}

@Component({
  selector: 'app-search-services',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-services.html',
  styleUrl: './search-services.scss'
})
export class SearchServicesComponent implements OnInit {
  private http = inject(HttpClient);
  authService = inject(AuthService);
  private router = inject(Router);
  private conversationsService = inject(ConversationsService);
  private API_URL = 'http://localhost:5001/api';

  // Search results
  services = signal<ProviderService[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // Filters
  selectedCategories = signal<string[]>([]);
  selectedServiceTypes = signal<string[]>([]);
  maxDistance = signal<number>(50); // km
  searchQuery = signal<string>('');

  // Available categories and service types
  categories = signal<{ code: string; name: string }[]>([
    { code: 'all', name: 'Todas las categorías' },
    { code: 'veterinary', name: 'Veterinaria' },
    { code: 'grooming', name: 'Peluquería y Estética' },
    { code: 'walking', name: 'Paseos' },
    { code: 'training', name: 'Entrenamiento' },
    { code: 'boarding', name: 'Guardería y Hospedaje' },
    { code: 'petshop', name: 'Tienda de Mascotas' },
    { code: 'shelter', name: 'Refugio y Adopción' }
  ]);

  serviceTypes = signal<ServiceType[]>([]);
  filteredServiceTypes = signal<ServiceType[]>([]);

  // Provider modal
  showProviderModal = signal(false);
  selectedProviderDetails = signal<ProviderDetails | null>(null);
  loadingProviderDetails = signal(false);

  ngOnInit() {
    this.loadServiceTypes();
    this.searchServices();
  }

  async loadServiceTypes() {
    try {
      const token = await this.authService.getAccessToken();
      const response = await fetch(`${this.API_URL}/services/service-types`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.serviceTypes.set(data);
        this.updateFilteredServiceTypes();
      }
    } catch (err) {
      console.error('Error loading service types:', err);
    }
  }

  updateFilteredServiceTypes() {
    const categories = this.selectedCategories();
    if (categories.length === 0) {
      this.filteredServiceTypes.set(this.serviceTypes());
    } else {
      this.filteredServiceTypes.set(
        this.serviceTypes().filter(st => categories.includes(st.category))
      );
    }
  }

  onCategorySelect(categoryCode: string) {
    if (!categoryCode) return;
    const current = this.selectedCategories();
    if (!current.includes(categoryCode)) {
      this.selectedCategories.set([...current, categoryCode]);
      this.updateFilteredServiceTypes();
      this.searchServices();
    }
  }

  removeCategory(categoryCode: string) {
    const current = this.selectedCategories();
    this.selectedCategories.set(current.filter(c => c !== categoryCode));
    this.updateFilteredServiceTypes();
    this.searchServices();
  }

  onServiceTypeSelect(serviceTypeId: string) {
    if (!serviceTypeId) return;
    const current = this.selectedServiceTypes();
    if (!current.includes(serviceTypeId)) {
      this.selectedServiceTypes.set([...current, serviceTypeId]);
      this.searchServices();
    }
  }

  removeServiceType(serviceTypeId: string) {
    const current = this.selectedServiceTypes();
    this.selectedServiceTypes.set(current.filter(st => st !== serviceTypeId));
    this.searchServices();
  }

  onDistanceChange(distance: number) {
    this.maxDistance.set(distance);
    this.searchServices();
  }

  getCategoryName(code: string): string {
    const cat = this.categories().find(c => c.code === code);
    return cat?.name || code;
  }

  getServiceTypeName(id: string): string {
    const st = this.serviceTypes().find(s => s.id === id);
    return st?.name || id;
  }

  async searchServices() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const token = await this.authService.getAccessToken();

      // Build query parameters
      const params = new URLSearchParams();

      // Add multiple categories
      const categories = this.selectedCategories();
      if (categories.length > 0) {
        categories.forEach(cat => params.append('category', cat));
      }

      // Add multiple service types
      const serviceTypes = this.selectedServiceTypes();
      if (serviceTypes.length > 0) {
        serviceTypes.forEach(st => params.append('service_type_id', st));
      }

      params.append('max_distance', this.maxDistance().toString());
      if (this.searchQuery()) {
        params.append('q', this.searchQuery());
      }

      const response = await fetch(`${this.API_URL}/services/search?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.services.set(data.services || []);
      } else {
        this.error.set('Error al buscar servicios');
      }
    } catch (err: any) {
      console.error('Error searching services:', err);
      this.error.set(err.message || 'Error al buscar servicios');
    } finally {
      this.loading.set(false);
    }
  }

  getCategoryInSpanish(category: string | undefined): string {
    if (!category) return '';
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

  clearFilters() {
    this.selectedCategories.set([]);
    this.selectedServiceTypes.set([]);
    this.maxDistance.set(50);
    this.updateFilteredServiceTypes();
    this.searchServices();
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  async openProviderModal(providerId: string) {
    console.log('[MODAL] Opening provider modal for:', providerId);
    this.loadingProviderDetails.set(true);
    this.showProviderModal.set(true);

    try {
      const token = await this.authService.getAccessToken();
      const url = `${this.API_URL}/services/providers/${providerId}`;
      console.log('[MODAL] Fetching URL:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('[MODAL] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[MODAL] Provider details loaded:', data);
        this.selectedProviderDetails.set(data);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[MODAL] Error loading provider details. Status:', response.status, 'Data:', errorData);
        this.closeProviderModal();
      }
    } catch (err) {
      console.error('[MODAL] Exception loading provider details:', err);
      this.closeProviderModal();
    } finally {
      this.loadingProviderDetails.set(false);
    }
  }

  closeProviderModal() {
    this.showProviderModal.set(false);
    this.selectedProviderDetails.set(null);
  }

  contactProvider(providerId: string) {
    // Check if trying to contact yourself
    const currentUserId = this.authService.currentUser()?.id;
    if (currentUserId === providerId) {
      alert('No puedes contactarte a ti mismo');
      return;
    }

    // Create or open conversation with this provider
    this.conversationsService.createConversation(providerId).subscribe({
      next: (conversation) => {
        console.log('Conversation created/opened:', conversation);
        // Navigate to conversations page with conversation ID
        this.router.navigate(['/conversations'], {
          queryParams: { conversationId: conversation.id }
        });
        this.closeProviderModal();
      },
      error: (err) => {
        console.error('Error creating conversation:', err);
        alert('No se pudo iniciar la conversación. Inténtalo de nuevo.');
      }
    });
  }

  openRatingModal() {
    // TODO: Implement rating modal
    console.log('Open rating modal');
  }

  viewProviderDetails(providerId: string) {
    this.router.navigate(['/providers', providerId]);
  }

  viewProviderReviews(providerId: string) {
    // Navigate to provider detail with reviews section
    this.router.navigate(['/providers', providerId], { fragment: 'reviews' });
  }
}
