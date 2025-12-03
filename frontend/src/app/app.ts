import { Component, inject, signal, ChangeDetectorRef, ApplicationRef } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { ModeService } from './core/services/mode.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  authService = inject(AuthService);
  modeService = inject(ModeService);
  private cdr = inject(ChangeDetectorRef);
  private appRef = inject(ApplicationRef);
  private router = inject(Router);
  isLoggingOut = signal(false);
  isMobileMenuOpen = signal(false);

  constructor() {
    // Force change detection after each navigation to ensure buttons work
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        // Trigger change detection to update header buttons
        setTimeout(() => {
          this.cdr.markForCheck();
          this.appRef.tick();
        }, 0);
      });
  }

  async signOut() {
    if (this.isLoggingOut()) return; // Prevent multiple clicks

    this.isLoggingOut.set(true);
    try {
      await this.authService.signOut();
      this.modeService.reset();
      // Force change detection after sign out
      this.cdr.markForCheck();
      this.appRef.tick();
    } catch (error) {
      console.error('Error signing out:', error);
      alert('Error al cerrar sesión. Por favor intentá de nuevo.');
    } finally {
      this.isLoggingOut.set(false);
    }
  }

  toggleMode() {
    this.modeService.toggleMode();
    // Force change detection after mode toggle
    this.cdr.markForCheck();
    this.appRef.tick();
  }

  switchToUserMode() {
    this.modeService.setMode('user');
    this.router.navigate(['/home']);
    // Force change detection after mode switch
    this.cdr.markForCheck();
    this.appRef.tick();
  }

  switchToProviderMode() {
    this.modeService.setMode('provider');
    this.router.navigate(['/home']);
    // Force change detection after mode switch
    this.cdr.markForCheck();
    this.appRef.tick();
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen.set(!this.isMobileMenuOpen());
  }

  closeMobileMenu() {
    this.isMobileMenuOpen.set(false);
  }
}
