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
    path: 'signup',
    loadComponent: () =>
      import('./features/auth/signup/signup.component').then((m) => m.SignupComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'verify-email',
    loadComponent: () =>
      import('./features/auth/verify-email/verify-email.component').then((m) => m.VerifyEmailComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then((m) => m.ResetPasswordComponent),
  },
  {
    path: 'images/:imageId',
    loadComponent: () =>
      import('./features/public-images/public-image-viewer/public-image-viewer.component').then(
        (m) => m.PublicImageViewerComponent,
      ),
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
        pathMatch: 'full',
        redirectTo: 'products/all',
      },
      {
        path: 'products/all',
        loadComponent: () =>
          import('./features/products/product-list/product-list.component').then(
            (m) => m.ProductListComponent,
          ),
        canActivate: [roleGuard(['ADMIN', 'CONSUMER'])],
      },
      {
        path: 'products/brands',
        loadComponent: () =>
          import('./features/products/product-list/product-list.component').then(
            (m) => m.ProductListComponent,
          ),
        canActivate: [roleGuard(['ADMIN', 'CONSUMER'])],
      },
      {
        path: 'products/distributors',
        loadComponent: () =>
          import('./features/products/product-list/product-list.component').then(
            (m) => m.ProductListComponent,
          ),
        canActivate: [roleGuard(['ADMIN'])],
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
        pathMatch: 'full',
        redirectTo: 'distributor/products/my-products',
      },
      {
        path: 'distributor/products/my-products',
        loadComponent: () =>
          import('./features/distributor/distributor-products/distributor-products.component').then(
            (m) => m.DistributorProductsComponent,
          ),
        canActivate: [roleGuard(['DISTRIBUTOR'])],
      },
      {
        path: 'distributor/products/brands',
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
        path: 'admin/companies',
        loadComponent: () =>
          import('./features/admin/admin-companies/admin-companies.component').then(
            (m) => m.AdminCompaniesComponent,
          ),
        canActivate: [roleGuard(['ADMIN'])],
      },
      {
        path: 'admin/users',
        loadComponent: () =>
          import('./features/admin/admin-users/admin-users.component').then(
            (m) => m.AdminUsersComponent,
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
