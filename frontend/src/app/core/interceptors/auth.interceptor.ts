import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { from, switchMap } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  console.log('[AuthInterceptor] Request:', req.method, req.url);

  // Skip adding token for auth endpoints
  if (req.url.includes('/auth/') || req.url.includes('/data/')) {
    console.log('[AuthInterceptor] Skipping auth for public endpoint');
    return next(req);
  }

  // Add auth token to request
  console.log('[AuthInterceptor] Getting access token...');
  return from(authService.getAccessToken()).pipe(
    switchMap(token => {
      console.log('[AuthInterceptor] Token received:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
      if (token) {
        const authReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });
        console.log('[AuthInterceptor] Forwarding request with auth header');
        return next(authReq);
      }
      console.warn('[AuthInterceptor] No token available, forwarding without auth');
      return next(req);
    })
  );
};
