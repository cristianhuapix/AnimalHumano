import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey
    );
  }

  /**
   * Upload file to Supabase Storage
   */
  async uploadFile(bucket: string, path: string, file: File): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw new Error(`Error uploading file: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = this.supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return urlData.publicUrl;
  }

  /**
   * Upload pet photo
   */
  async uploadPetPhoto(petId: string, file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${petId}-${Date.now()}.${fileExt}`;
    const filePath = `pets/${fileName}`;

    return this.uploadFile('pet-photos', filePath, file);
  }

  /**
   * Upload pet papers/documents
   */
  async uploadPetPapers(petId: string, file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${petId}-${Date.now()}.${fileExt}`;
    const filePath = `pets/${fileName}`;

    return this.uploadFile('pet-documents', filePath, file);
  }

  /**
   * Delete file from storage
   */
  async deleteFile(bucket: string, path: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      throw new Error(`Error deleting file: ${error.message}`);
    }
  }
}
