import { Injectable, inject } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { ApiService } from './api.service';

export interface QrCodeData {
  qr_code: string;
  qr_id: string;
  pet_name: string;
  expires_at?: string;
  created_at?: string;
  is_new?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class QrService {
  private api = inject(ApiService);

  /**
   * Get active QR code for a pet (generates new one if none exists)
   */
  async getActiveQr(petId: string): Promise<QrCodeData> {
    return await lastValueFrom(this.api.get<QrCodeData>(`pets/${petId}/qr`));
  }

  /**
   * Regenerate QR code for a pet (invalidates old one)
   */
  async regenerateQr(petId: string): Promise<QrCodeData> {
    return await lastValueFrom(this.api.post<QrCodeData>(`pets/${petId}/qr/regenerate`, {}));
  }
}
