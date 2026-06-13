import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard } from './core/guards/role.guard';

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
        canActivate: [roleGuard(['ADMIN', 'CONSUMER'])],
      },
      {
        path: 'distributor/tracking',
        loadComponent: () =>
          import(
            './features/distributor/distributor-inquiry-tracking/distributor-inquiry-tracking.component'
          ).then((m) => m.DistributorInquiryTrackingComponent),
        canActivate: [roleGuard(['DISTRIBUTOR'])],
      },
      {
        path: 'distributor/products',
        loadComponent: () =>
          import('./features/distributor/distributor-products/distributor-products.component').then(
            (m) => m.DistributorProductsComponent,
          ),
        canActivate: [roleGuard(['DISTRIBUTOR'])],
      },
      {
        path: 'requests',
        loadComponent: () =>
          import('./features/inquiries/my-requests/my-requests.component').then(
            (m) => m.MyRequestsComponent,
          ),
        canActivate: [roleGuard(['CONSUMER'])],
      },
      {
        path: 'tracking',
        loadComponent: () =>
          import(
            './features/inquiries/inquiry-tracking/inquiry-tracking.component'
          ).then((m) => m.InquiryTrackingComponent),
        canActivate: [roleGuard(['CONSUMER'])],
      },
      {
        path: 'admin/queries',
        loadComponent: () =>
          import('./features/inquiries/admin-query-review/admin-query-review.component').then(
            (m) => m.AdminQueryReviewComponent,
          ),
        canActivate: [roleGuard(['ADMIN'])],
      },
      {
        path: 'admin/queries/:inquiryId/distributors',
        loadComponent: () =>
          import('./features/inquiries/admin-distributor-chats/admin-distributor-chats.component').then(
            (m) => m.AdminDistributorChatsComponent,
          ),
        canActivate: [roleGuard(['ADMIN'])],
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
