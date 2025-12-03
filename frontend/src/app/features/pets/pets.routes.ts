import { Routes } from '@angular/router';

export const PETS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pets-list/pets-list').then(m => m.PetsListComponent)
  },
  {
    path: 'new',
    loadComponent: () => import('./pet-form/pet-form').then(m => m.PetFormComponent)
  },
  {
    path: ':id',
    loadComponent: () => import('./pet-detail/pet-detail').then(m => m.PetDetailComponent)
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./pet-form/pet-form').then(m => m.PetFormComponent)
  },
  {
    path: ':id/vaccines',
    loadComponent: () => import('../providers/my-vaccines/my-vaccines').then(m => m.VaccineRecordComponent)
  },
  {
    path: ':id/medical-records',
    loadComponent: () => import('./medical-records/medical-records').then(m => m.MedicalRecordsComponent)
  }
];
