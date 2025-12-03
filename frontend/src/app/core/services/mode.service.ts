import { Injectable, signal } from '@angular/core';

export type UserMode = 'user' | 'provider';

@Injectable({
  providedIn: 'root'
})
export class ModeService {
  private readonly STORAGE_KEY = 'user_mode';
  
  // Signal para el modo activo
  activeMode = signal<UserMode>('user');

  constructor() {
    // Cargar modo guardado desde localStorage
    const savedMode = localStorage.getItem(this.STORAGE_KEY) as UserMode;
    if (savedMode && (savedMode === 'user' || savedMode === 'provider')) {
      this.activeMode.set(savedMode);
    }
  }

  /**
   * Cambiar el modo activo
   */
  setMode(mode: UserMode): void {
    this.activeMode.set(mode);
    localStorage.setItem(this.STORAGE_KEY, mode);
  }

  /**
   * Obtener el modo activo
   */
  getMode(): UserMode {
    return this.activeMode();
  }

  /**
   * Verificar si está en modo usuario
   */
  isUserMode(): boolean {
    return this.activeMode() === 'user';
  }

  /**
   * Verificar si está en modo proveedor
   */
  isProviderMode(): boolean {
    return this.activeMode() === 'provider';
  }

  /**
   * Cambiar entre modos
   */
  toggleMode(): void {
    const newMode = this.activeMode() === 'user' ? 'provider' : 'user';
    this.setMode(newMode);
  }

  /**
   * Resetear al modo por defecto
   */
  reset(): void {
    this.setMode('user');
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
