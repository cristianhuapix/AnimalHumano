import { Routes } from '@angular/router';
import { authGuard, providerGuard } from '../../core/guards/auth.guard';

export const PROVIDERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./providers-list/providers-list').then(m => m.ProvidersListComponent)
  },
  {
    path: 'my-services',
    canActivate: [authGuard, providerGuard],
    loadComponent: () => import('./my-services/my-services').then(m => m.MyServicesComponent)
  },
  {
    path: 'my-trainings',
    canActivate: [authGuard, providerGuard],
    loadComponent: () => import('./my-trainings/my-trainings').then(m => m.MyTrainingsComponent)
  },
  {
    path: 'my-medical-records',
    canActivate: [authGuard, providerGuard],
    loadComponent: () => import('./my-medical-records/my-medical-records').then(m => m.MyMedicalRecordsComponent)
  },
  {
    path: 'my-boarding',
    canActivate: [authGuard, providerGuard],
    loadComponent: () => import('./my-boarding/my-boarding').then(m => m.BoardingComponent)
  },
  {
    path: 'my-walks',
    canActivate: [authGuard, providerGuard],
    loadComponent: () => import('./my-walks/my-walks').then(m => m.WalkComponent)
  },
  {
    path: 'my-shelter',
    canActivate: [authGuard, providerGuard],
    loadComponent: () => import('./my-shelter/my-shelter').then(m => m.ShelterPetComponent)
  },
  {
    path: 'my-grooming',
    canActivate: [authGuard, providerGuard],
    loadComponent: () => import('./my-grooming/my-grooming').then(m => m.GroomingAppointmentComponent)
  },
  {
    path: 'my-vaccines',
    canActivate: [authGuard, providerGuard],
    loadComponent: () => import('./my-vaccines/my-vaccines').then(m => m.VaccineRecordComponent)
  },
  {
    path: ':id',
    loadComponent: () => import('./provider-detail/provider-detail').then(m => m.ProviderDetailComponent)
  }
];
