import { Injectable, inject } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { ApiService } from './api.service';

export interface ServiceType {
  id: string;
  code: string;
  name: string;
  description?: string;
  icon?: string;
  category: string;
  requires_location: boolean;
  requires_schedule: boolean;
  created_at?: string;
}

export interface ProviderService {
  id?: string;
  provider_id: string;
  service_type_id: string;
  service_type?: ServiceType;
  custom_name?: string;
  custom_description?: string;
  website_url?: string;
  instagram?: string;
  notes?: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Boarding {
  id?: string;
  pet_id: string;
  provider_id?: string;
  profile_id?: string;
  start_date: string;
  end_date: string;
  days: number;
  notes?: string;
  status: 'active' | 'completed' | 'cancelled';
  created_at?: string;
  updated_at?: string;
  pets?: {
    id: string;
    name: string;
    owner_id: string;
    owner_name?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ProviderServicesService {
  private api = inject(ApiService);

  /**
   * Get all available service types
   */
  async getServiceTypes(category?: string): Promise<ServiceType[]> {
    const params = category ? { category } : {};
    const response = await lastValueFrom(this.api.get<{ data: ServiceType[] }>('providers/service-types', { params }));
    return response.data;
  }

  /**
   * Get all services for the current provider
   */
  async getMyServices(): Promise<ProviderService[]> {
    const response = await lastValueFrom(this.api.get<{ data: ProviderService[] }>('providers/me/services'));
    return response.data;
  }

  /**
   * Add a new service
   */
  async addService(service: Omit<ProviderService, 'id' | 'provider_id' | 'created_at' | 'updated_at' | 'service_type'>): Promise<ProviderService> {
    return await lastValueFrom(this.api.post<ProviderService>('providers/me/services', service));
  }

  /**
   * Update a service
   */
  async updateService(serviceId: string, updates: Partial<ProviderService>): Promise<ProviderService> {
    return await lastValueFrom(this.api.put<ProviderService>(`providers/me/services/${serviceId}`, updates));
  }

  /**
   * Delete a service
   */
  async deleteService(serviceId: string): Promise<void> {
    await lastValueFrom(this.api.delete(`providers/me/services/${serviceId}`));
  }

  /**
   * Toggle service active status
   */
  async toggleServiceStatus(serviceId: string, active: boolean): Promise<ProviderService> {
    return await this.updateService(serviceId, { active });
  }

  /**
   * Register QR access for a pet with a specific service
   */
  async registerQrAccess(petId: string, serviceId: string): Promise<{
    message: string;
    pet_id: string;
    pet_name: string;
    scan_id: string;
    service_category: string;
    is_simple_service: boolean;
    expires_in_hours: number
  }> {
    return await lastValueFrom(this.api.post(`providers/me/qr-access`, { pet_id: petId, service_id: serviceId }));
  }

  /**
   * Get all boardings for the current provider
   */
  async getMyBoardings(): Promise<Boarding[]> {
    const response = await lastValueFrom(this.api.get<{ data: Boarding[] }>('providers/me/boardings'));
    return response.data;
  }

  /**
   * Create a new boarding record
   */
  async createBoarding(boarding: { pet_id: string; start_date: string; end_date: string; days: number; notes?: string }): Promise<Boarding> {
    const response = await lastValueFrom(this.api.post<{ data: Boarding }>('providers/me/boardings', boarding));
    return response.data;
  }

  /**
   * Update a boarding record
   */
  async updateBoarding(boardingId: string, updates: Partial<Boarding>): Promise<Boarding> {
    const response = await lastValueFrom(this.api.patch<{ data: Boarding }>(`providers/me/boardings/${boardingId}`, updates));
    return response.data;
  }

  /**
   * Get simple service records for a specific category (grooming, training, walking, shelter, petshop)
   */
  async getSimpleServices(category: 'grooming' | 'training' | 'walking' | 'shelter' | 'petshop'): Promise<any[]> {
    const response = await lastValueFrom(this.api.get<{ data: any[] }>(`providers/me/${category}`));
    return response.data;
  }
}
