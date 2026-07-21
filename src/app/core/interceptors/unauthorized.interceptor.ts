import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth/auth.service';
import { ToastService } from '../services/toast/toast.service';

export const unauthorizedInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !req.url.includes('/auth/')) {
        if (req.url.includes('/public/images') || router.url.startsWith('/images/')) {
          return throwError(() => error);
        }
        auth.clearSession();
        const returnUrl = router.url;
        if (!returnUrl.startsWith('/login')) {
          toast.error('Session expired. Please sign in again.');
          void router.navigate(['/login'], {
            queryParams: returnUrl && returnUrl !== '/' ? { returnUrl } : undefined,
          });
        }
      }
      return throwError(() => error);
    }),
  );
};
