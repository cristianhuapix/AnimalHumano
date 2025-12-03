import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { LostPetReport, ApiResponse, PaginatedResponse } from '../models';

export interface LostPetFilters {
  latitude?: number;
  longitude?: number;
  radius_km?: number;
  report_type?: 'lost' | 'found';
  species_id?: string;
  page?: number;
  page_size?: number;
}

export interface CreateLostPetReport {
  pet_id?: string;
  report_type: 'lost' | 'found';
  species_id?: string;
  breed_id?: string;
  description: string;
  contact_phone?: string;
  last_seen_at?: string;
  latitude?: number;
  longitude?: number;
  images?: File[];
}

@Injectable({
  providedIn: 'root'
})
export class LostPetService {
  private api = inject(ApiService);

  /**
   * Get all lost pet reports with optional filters
   */
  getLostPets(filters?: LostPetFilters): Observable<ApiResponse<PaginatedResponse<LostPetReport>>> {
    const params: any = {};

    if (filters?.latitude !== undefined) params.latitude = filters.latitude;
    if (filters?.longitude !== undefined) params.longitude = filters.longitude;
    if (filters?.radius_km !== undefined) params.radius_km = filters.radius_km;
    if (filters?.report_type) params.report_type = filters.report_type;
    if (filters?.species_id) params.species_id = filters.species_id;
    if (filters?.page !== undefined) params.page = filters.page;
    if (filters?.page_size !== undefined) params.page_size = filters.page_size;

    return this.api.get<ApiResponse<PaginatedResponse<LostPetReport>>>('lost-pets', params);
  }

  /**
   * Get a specific lost pet report by ID
   */
  getLostPet(reportId: string): Observable<ApiResponse<LostPetReport>> {
    return this.api.get<ApiResponse<LostPetReport>>(`lost-pets/${reportId}`);
  }

  /**
   * Create a new lost pet report
   */
  createReport(report: CreateLostPetReport): Observable<ApiResponse<LostPetReport>> {
    // If there are images, use FormData
    if (report.images && report.images.length > 0) {
      const formData = new FormData();

      if (report.pet_id) formData.append('pet_id', report.pet_id);
      formData.append('report_type', report.report_type);
      if (report.species_id) formData.append('species_id', report.species_id);
      if (report.breed_id) formData.append('breed_id', report.breed_id);
      formData.append('description', report.description);
      if (report.contact_phone) formData.append('contact_phone', report.contact_phone);
      if (report.last_seen_at) formData.append('last_seen_at', report.last_seen_at);
      if (report.latitude !== undefined) formData.append('latitude', report.latitude.toString());
      if (report.longitude !== undefined) formData.append('longitude', report.longitude.toString());

      // Add images
      report.images.forEach((image) => {
        formData.append('images', image);
      });

      return this.api.post<ApiResponse<LostPetReport>>('lost-pets', formData);
    }

    // Otherwise, send JSON
    const jsonData: any = {
      report_type: report.report_type,
      description: report.description
    };

    if (report.pet_id) jsonData.pet_id = report.pet_id;
    if (report.species_id) jsonData.species_id = report.species_id;
    if (report.breed_id) jsonData.breed_id = report.breed_id;
    if (report.contact_phone) jsonData.contact_phone = report.contact_phone;
    if (report.last_seen_at) jsonData.last_seen_at = report.last_seen_at;
    if (report.latitude !== undefined) jsonData.latitude = report.latitude;
    if (report.longitude !== undefined) jsonData.longitude = report.longitude;

    return this.api.post<ApiResponse<LostPetReport>>('lost-pets', jsonData);
  }

  /**
   * Mark a lost pet as found
   */
  markAsFound(reportId: string): Observable<ApiResponse<LostPetReport>> {
    return this.api.put<ApiResponse<LostPetReport>>(`lost-pets/${reportId}/found`, {});
  }

  /**
   * Get my lost pet reports (as reporter)
   */
  getMyReports(): Observable<ApiResponse<LostPetReport[]>> {
    return this.api.get<ApiResponse<LostPetReport[]>>('lost-pets/my-reports');
  }

  /**
   * Delete a lost pet report
   */
  deleteReport(reportId: string): Observable<ApiResponse<void>> {
    return this.api.delete<ApiResponse<void>>(`lost-pets/${reportId}`);
  }
}
