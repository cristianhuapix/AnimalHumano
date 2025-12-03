import { Component, inject, OnInit, OnDestroy, signal, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { ModeService } from '../../core/services/mode.service';
import { ApiService } from '../../core/services/api.service';
import { lastValueFrom } from 'rxjs';

export interface ProviderFeature {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  route: string;
  enabled: boolean;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class HomeComponent implements OnInit {
  authService = inject(AuthService);
  modeService = inject(ModeService);
  private api = inject(ApiService);

  providerFeatures = signal<ProviderFeature[]>([]);
  loadingFeatures = signal(false);

  constructor() {
    // React to auth state changes
    effect(() => {
      const isAuth = this.authService.isAuthenticated();
      const isUserMode = this.modeService.isUserMode();

      console.log('HomeComponent effect - Auth state:', {
        isAuthenticated: isAuth,
        isUserMode: isUserMode,
        featuresLoaded: this.providerFeatures().length
      });

      // Load features when user becomes authenticated as provider
      if (isAuth && !isUserMode && this.providerFeatures().length === 0) {
        console.log('Triggering loadProviderFeatures from effect');
        this.loadProviderFeatures();
      }
    });
  }

  async ngOnInit() {
    console.log('HomeComponent ngOnInit', {
      isAuthenticated: this.authService.isAuthenticated(),
      isUserMode: this.modeService.isUserMode()
    });

    // Try to load immediately if already authenticated
    if (this.authService.isAuthenticated() && !this.modeService.isUserMode()) {
      await this.loadProviderFeatures();
    }
  }

  async loadProviderFeatures() {
    // Don't reload if already loaded and not loading
    if (this.providerFeatures().length > 0 && !this.loadingFeatures()) {
      console.log('Features already loaded, skipping...');
      return;
    }

    console.log('Loading provider features...');
    this.loadingFeatures.set(true);
    try {
      const response = await lastValueFrom(
        this.api.get<{ data: ProviderFeature[] }>('providers/me/features')
      );
      console.log('Provider features loaded:', response);

      // Define priority order for features
      const priorityOrder = ['my_services', 'qr_scanner', 'my_chats', 'my_ratings', 'lost_pets'];

      // Sort features with priority first
      const sortedFeatures = response.data.sort((a, b) => {
        const aIndex = priorityOrder.indexOf(a.code);
        const bIndex = priorityOrder.indexOf(b.code);

        // If both are in priority list, sort by their order
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }

        // If only 'a' is in priority, it comes first
        if (aIndex !== -1) return -1;

        // If only 'b' is in priority, it comes first
        if (bIndex !== -1) return 1;

        // Otherwise, keep original order
        return 0;
      });

      this.providerFeatures.set(sortedFeatures);
      console.log('Features set, total:', sortedFeatures.length);
    } catch (error) {
      console.error('Error loading provider features:', error);
      this.providerFeatures.set([]);
    } finally {
      this.loadingFeatures.set(false);
    }
  }

  getFeatureCardClass(feature: ProviderFeature): string {
    const colors = ['blue', 'purple', 'pink', 'yellow', 'orange', 'green', 'teal', 'red', 'indigo'];
    const index = this.providerFeatures().indexOf(feature);
    return `feature-card card-${colors[index % colors.length]}`;
  }
}
