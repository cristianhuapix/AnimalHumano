import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check async authentication (waits for session to load)
  const isAuth = await authService.isAuthenticatedAsync();

  if (isAuth) {
    return true;
  }

  router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
  return false;
};

export const adminGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isAuth = await authService.isAuthenticatedAsync();

  if (isAuth && authService.isAdmin()) {
    return true;
  }

  router.navigate(['/']);
  return false;
};

export const providerGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isAuth = await authService.isAuthenticatedAsync();
  const isProvider = authService.isProvider();

  console.log('ProviderGuard - isAuth:', isAuth, 'isProvider:', isProvider);
  console.log('Current user:', authService.currentUser());

  if (isAuth && isProvider) {
    return true;
  }

  console.log('Access denied - redirecting to home');
  router.navigate(['/']);
  return false;
};
