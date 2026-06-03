import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
    canActivate: [guestGuard],
  },
  {
    path: '',
    loadComponent: () =>
      import('./layout/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/products/product-list/product-list.component').then(
            (m) => m.ProductListComponent,
          ),
      },
      {
        path: 'requests',
        loadComponent: () =>
          import('./features/inquiries/my-requests/my-requests.component').then(
            (m) => m.MyRequestsComponent,
          ),
      },
      {
        path: 'tracking',
        loadComponent: () =>
          import(
            './features/inquiries/inquiry-tracking/inquiry-tracking.component'
          ).then((m) => m.InquiryTrackingComponent),
      },
      {
        path: 'admin/queries',
        loadComponent: () =>
          import('./features/inquiries/admin-query-review/admin-query-review.component').then(
            (m) => m.AdminQueryReviewComponent,
          ),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/settings/profile/profile.component').then((m) => m.ProfileComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
