import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { AuthService } from '../services/auth/auth.service';
import { DistributorOnboardingService } from '../services/distributor/distributor-onboarding.service';

/** Forces distributors to finish brand/category onboarding before other distributor pages. */
export const distributorOnboardingGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const onboarding = inject(DistributorOnboardingService);
  const router = inject(Router);

  if (auth.currentUser()?.role !== 'DISTRIBUTOR') {
    return true;
  }

  if (state.url.startsWith('/distributor/onboarding')) {
    return true;
  }

  return onboarding.ensureStatus().pipe(
    map((status) =>
      status.completed ? true : router.createUrlTree(['/distributor/onboarding']),
    ),
    catchError(() => of(router.createUrlTree(['/distributor/onboarding']))),
  );
};

/** If onboarding already done, skip the questionnaire page. */
export const distributorOnboardingCompletedRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const onboarding = inject(DistributorOnboardingService);
  const router = inject(Router);

  if (auth.currentUser()?.role !== 'DISTRIBUTOR') {
    return router.createUrlTree(['/dashboard']);
  }

  return onboarding.ensureStatus().pipe(
    map((status) =>
      status.completed ? router.createUrlTree(['/distributor/products/my-products']) : true,
    ),
    catchError(() => of(true)),
  );
};
