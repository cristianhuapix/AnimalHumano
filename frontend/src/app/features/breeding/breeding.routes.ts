import { Routes } from '@angular/router';

export const BREEDING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./breeding-list/breeding-list').then(m => m.BreedingListComponent)
  }
];
