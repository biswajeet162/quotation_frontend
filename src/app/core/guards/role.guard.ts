import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';

export function roleGuard(allowedRoles: string[]): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/login'], {
        queryParams: state.url && state.url !== '/' ? { returnUrl: state.url } : undefined,
      });
    }

    const role = auth.currentUser()?.role;
    if (role && allowedRoles.includes(role)) {
      return true;
    }

    return router.createUrlTree(['/dashboard']);
  };
}
