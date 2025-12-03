import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { Pet, ApiResponse, Species, Breed, Vaccine, PetVaccination, MedicalRecord } from '../models';

@Injectable({
  providedIn: 'root'
})
export class PetService {
  private api = inject(ApiService);

  /**
   * Get all pets for current user
   */
  getMyPets(): Observable<ApiResponse<Pet[]>> {
    return this.api.get<ApiResponse<Pet[]>>('pets');
  }

  /**
   * Get pet by ID
   */
  getPet(petId: string): Observable<ApiResponse<Pet>> {
    return this.api.get<ApiResponse<Pet>>(`pets/${petId}`);
  }

  /**
   * Create new pet
   */
  createPet(pet: Partial<Pet>): Observable<ApiResponse<Pet>> {
    return this.api.post<ApiResponse<Pet>>('pets', pet);
  }

  /**
   * Update pet
   */
  updatePet(petId: string, updates: Partial<Pet>): Observable<ApiResponse<Pet>> {
    return this.api.put<ApiResponse<Pet>>(`pets/${petId}`, updates);
  }

  /**
   * Delete pet (soft delete)
   */
  deletePet(petId: string): Observable<ApiResponse<void>> {
    return this.api.delete<ApiResponse<void>>(`pets/${petId}`);
  }

  /**
   * Get pet by DNIA
   */
  getPetByDnia(dnia: string): Observable<ApiResponse<Pet>> {
    return this.api.get<ApiResponse<Pet>>(`pets/dnia/${dnia}`);
  }

  /**
   * Get pet vaccinations
   */
  getVaccinations(petId: string): Observable<ApiResponse<PetVaccination[]>> {
    return this.api.get<ApiResponse<PetVaccination[]>>(`pets/${petId}/vaccinations`);
  }

  /**
   * Add vaccination record
   */
  addVaccination(petId: string, vaccination: Partial<PetVaccination>): Observable<ApiResponse<PetVaccination>> {
    return this.api.post<ApiResponse<PetVaccination>>(`pets/${petId}/vaccinations`, vaccination);
  }

  /**
   * Get medical records
   */
  getMedicalRecords(petId: string): Observable<ApiResponse<MedicalRecord[]>> {
    return this.api.get<ApiResponse<MedicalRecord[]>>(`pets/${petId}/medical-records`);
  }

  /**
   * Add medical record
   */
  addMedicalRecord(petId: string, record: Partial<MedicalRecord>): Observable<ApiResponse<MedicalRecord>> {
    return this.api.post<ApiResponse<MedicalRecord>>(`pets/${petId}/medical-records`, record);
  }

  /**
   * Get all species
   */
  getSpecies(): Observable<ApiResponse<Species[]>> {
    return this.api.get<ApiResponse<Species[]>>('data/species');
  }

  /**
   * Get all breeds
   */
  getBreeds(): Observable<ApiResponse<Breed[]>> {
    return this.api.get<ApiResponse<Breed[]>>('data/breeds');
  }

  /**
   * Get breeds by species
   */
  getBreedsBySpecies(speciesId: string): Observable<ApiResponse<Breed[]>> {
    return this.api.get<ApiResponse<Breed[]>>(`data/breeds/by-species/${speciesId}`);
  }

  /**
   * Get vaccines
   */
  getVaccines(): Observable<ApiResponse<Vaccine[]>> {
    return this.api.get<ApiResponse<Vaccine[]>>('data/vaccines');
  }

  /**
   * Get vaccines by species
   */
  getVaccinesBySpecies(speciesId: string): Observable<ApiResponse<Vaccine[]>> {
    return this.api.get<ApiResponse<Vaccine[]>>(`data/vaccines/by-species/${speciesId}`);
  }

  // Async/await helpers
  async getPets(): Promise<Pet[]> {
    const response = await firstValueFrom(this.getMyPets());
    return response.data || [];
  }

  async getPetById(petId: string): Promise<Pet> {
    const response = await firstValueFrom(this.getPet(petId));
    if (!response.data) throw new Error('Pet not found');
    return response.data;
  }

  async savePet(pet: Partial<Pet>, petId?: string): Promise<Pet> {
    console.log('[PetService.savePet] Called with pet:', pet, 'petId:', petId);
    try {
      const observable = petId
        ? this.updatePet(petId, pet)
        : this.createPet(pet);
      console.log('[PetService.savePet] Observable created, waiting for firstValueFrom...');
      const response = await firstValueFrom(observable);
      console.log('[PetService.savePet] Response received:', response);
      if (!response.data) throw new Error('Failed to save pet');
      console.log('[PetService.savePet] Returning pet data:', response.data);
      return response.data;
    } catch (error) {
      console.error('[PetService.savePet] ERROR:', error);
      throw error;
    }
  }

  async removePet(petId: string): Promise<void> {
    await firstValueFrom(this.deletePet(petId));
  }

  async getSpeciesList(): Promise<Species[]> {
    const response = await firstValueFrom(this.getSpecies());
    return response.data || [];
  }

  async getBreedsList(): Promise<Breed[]> {
    const response = await firstValueFrom(this.getBreeds());
    return response.data || [];
  }

  async getBreedsBySpeciesList(speciesId: string): Promise<Breed[]> {
    const response = await firstValueFrom(this.getBreedsBySpecies(speciesId));
    return response.data || [];
  }

  async uploadPhoto(petId: string, base64Data: string, fileName: string): Promise<{url: string}> {
    const response = await firstValueFrom(
      this.api.post<{data: {url: string}}>('pets/upload-photo', {
        pet_id: petId,
        file_data: base64Data,
        file_name: fileName
      })
    );
    return response.data;
  }

  async uploadDocuments(petId: string, base64Data: string, fileName: string): Promise<{url: string}> {
    const response = await firstValueFrom(
      this.api.post<{data: {url: string}}>('pets/upload-documents', {
        pet_id: petId,
        file_data: base64Data,
        file_name: fileName
      })
    );
    return response.data;
  }

  /**
   * Create species or breed request
   */
  async createSpeciesBreedRequest(requestData: {
    request_type: 'species' | 'breed';
    species_name?: string;
    breed_name?: string;
    species_id?: string;
  }): Promise<any> {
    const response = await firstValueFrom(
      this.api.post<ApiResponse<any>>('species-breed-requests', requestData)
    );
    return response.data;
  }
}
