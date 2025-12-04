import { Routes } from '@angular/router';
import { authGuard, adminGuard, providerGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'home',
    loadComponent: () => import('./features/home/home').then(m => m.HomeComponent)
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },
  {
    path: 'pets',
    canActivate: [authGuard],
    loadChildren: () => import('./features/pets/pets.routes').then(m => m.PETS_ROUTES)
  },
  {
    path: 'providers',
    loadChildren: () => import('./features/providers/providers.routes').then(m => m.PROVIDERS_ROUTES)
  },
  {
    path: 'breeding',
    canActivate: [authGuard],
    loadChildren: () => import('./features/breeding/breeding.routes').then(m => m.BREEDING_ROUTES)
  },
  {
    path: 'lost-pets',
    loadChildren: () => import('./features/lost-pets/lost-pets.routes').then(m => m.LOST_PETS_ROUTES)
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/profile/profile').then(m => m.ProfileComponent)
  },
  {
    path: 'qr/scan',
    canActivate: [authGuard, providerGuard],
    loadComponent: () => import('./features/qr-scanner/qr-scanner').then(m => m.QrScannerComponent)
  },
  {
    path: 'search-services',
    canActivate: [authGuard],
    loadComponent: () => import('./features/search-services/search-services').then(m => m.SearchServicesComponent)
  },
  {
    path: 'conversations',
    canActivate: [authGuard],
    loadComponent: () => import('./features/conversations/conversations').then(m => m.Conversations)
  },
  {
    path: 'help-resources',
    canActivate: [authGuard],
    loadComponent: () => import('./features/help-resources/help-resources').then(m => m.HelpResourcesComponent)
  },
  {
    path: 'nutrition-history',
    canActivate: [authGuard],
    loadComponent: () => import('./features/nutrition-history/nutrition-history').then(m => m.NutritionHistoryComponent)
  },
  {
    path: 'walks',
    canActivate: [authGuard],
    loadComponent: () => import('./features/walks-history/walks-history').then(m => m.WalksHistoryComponent)
  },
  {
    path: '**',
    redirectTo: 'home'
  }
];
