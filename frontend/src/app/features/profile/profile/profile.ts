import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';
import { lastValueFrom } from 'rxjs';

type SettingsTab = 'profile' | 'security' | 'notifications';

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  primary_email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss'
})
export class ProfileComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private api = inject(ApiService);

  activeTab = signal<SettingsTab>('profile');
  loading = signal(false);
  saving = signal(false);
  successMessage = signal('');
  errorMessage = signal('');

  // Profile form
  profileForm = signal<UserProfile>({
    id: '',
    first_name: '',
    last_name: '',
    email: '',
    primary_email: '',
    phone: '',
    address: '',
    city: '',
    country: ''
  });

  // Security form
  securityForm = signal({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  // Notifications form
  notificationsForm = signal({
    notifications_enabled: true,
    vaccine_mandatory: true,
    vaccine_optional: false,
    vaccine_days_before: 30,
    birthday_notifications: true,
    chat_notifications: true,
    app_notifications: true
  });

  ngOnInit() {
    this.loadProfile();
  }

  async loadProfile() {
    this.loading.set(true);
    try {
      // Esperar a que el authService esté inicializado
      await this.authService.waitForInitialization();

      // Usar los datos del usuario desde authService (ya cargados desde Supabase)
      const user = this.authService.currentUser();
      console.log('ProfileComponent.loadProfile - User from authService:', user);

      if (user) {
        this.profileForm.set({
          id: user.id || '',
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          email: user.email || '',
          primary_email: (user as any).primary_email || user.email || '',
          phone: user.phone || '',
          address: (user as any).address || '',
          city: (user as any).city || '',
          country: user.country || 'Argentina'
        });

        // Cargar configuración de notificaciones si existe
        this.notificationsForm.set({
          notifications_enabled: (user as any).notifications_enabled ?? true,
          vaccine_mandatory: (user as any).vaccine_mandatory ?? true,
          vaccine_optional: (user as any).vaccine_optional ?? false,
          vaccine_days_before: (user as any).vaccine_days_before ?? 30,
          birthday_notifications: (user as any).birthday_notifications ?? true,
          chat_notifications: (user as any).chat_notifications ?? true,
          app_notifications: (user as any).app_notifications ?? true
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      this.loading.set(false);
    }
  }

  setActiveTab(tab: SettingsTab) {
    this.activeTab.set(tab);
    this.clearMessages();
  }

  clearMessages() {
    this.successMessage.set('');
    this.errorMessage.set('');
  }

  updateProfileField(field: keyof UserProfile, value: string) {
    this.profileForm.update(form => ({ ...form, [field]: value }));
  }

  updateSecurityField(field: string, value: string) {
    this.securityForm.update(form => ({ ...form, [field]: value }));
  }

  updateNotificationField(field: string, value: boolean | number) {
    this.notificationsForm.update(form => ({ ...form, [field]: value }));
  }

  async saveProfile() {
    this.saving.set(true);
    this.clearMessages();

    try {
      const form = this.profileForm();
      await lastValueFrom(this.api.put('auth/me', {
        first_name: form.first_name,
        last_name: form.last_name,
        primary_email: form.primary_email,
        phone: form.phone,
        address: form.address,
        city: form.city,
        country: form.country
      }));

      this.successMessage.set('Perfil actualizado correctamente');
    } catch (error: any) {
      this.errorMessage.set(error.error?.error || 'Error al guardar el perfil');
    } finally {
      this.saving.set(false);
    }
  }

  async changePassword() {
    this.saving.set(true);
    this.clearMessages();

    const form = this.securityForm();

    if (form.new_password !== form.confirm_password) {
      this.errorMessage.set('Las contraseñas no coinciden');
      this.saving.set(false);
      return;
    }

    if (form.new_password.length < 6) {
      this.errorMessage.set('La contraseña debe tener al menos 6 caracteres');
      this.saving.set(false);
      return;
    }

    try {
      await lastValueFrom(this.api.post('auth/change-password', {
        current_password: form.current_password,
        new_password: form.new_password
      }));

      this.successMessage.set('Contraseña actualizada correctamente');
      this.securityForm.set({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
    } catch (error: any) {
      this.errorMessage.set(error.error?.error || 'Error al cambiar la contraseña');
    } finally {
      this.saving.set(false);
    }
  }

  async saveNotifications() {
    console.log('saveNotifications() called');
    console.log('Current form values:', this.notificationsForm());
    this.saving.set(true);
    this.clearMessages();

    try {
      console.log('Making PUT request to auth/me/notifications...');
      const result = await lastValueFrom(this.api.put('auth/me/notifications', this.notificationsForm()));
      console.log('PUT response:', result);
      this.successMessage.set('Preferencias de notificaciones actualizadas');
    } catch (error: any) {
      console.error('Error saving notifications:', error);
      this.errorMessage.set(error.error?.error || 'Error al guardar las preferencias');
    } finally {
      this.saving.set(false);
    }
  }

  goBack() {
    this.router.navigate(['/home']);
  }
}
