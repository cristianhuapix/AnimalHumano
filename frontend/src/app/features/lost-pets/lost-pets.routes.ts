import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const LOST_PETS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./lost-pets-list/lost-pets-list').then(m => m.LostPetsListComponent)
  },
  {
    path: 'report',
    canActivate: [authGuard],
    loadComponent: () => import('./report-form/report-form').then(m => m.ReportFormComponent)
  }
];
