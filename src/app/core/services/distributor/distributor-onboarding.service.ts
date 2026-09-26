import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CompleteDistributorOnboardingRequest,
  DistributorOnboardingOptions,
  DistributorOnboardingStatus,
} from '../../models/distributor-onboarding.model';

@Injectable({ providedIn: 'root' })
export class DistributorOnboardingService {
  private readonly http = inject(HttpClient);

  /** Cached completion flag; null = unknown. */
  readonly completed = signal<boolean | null>(null);

  getOptions(): Observable<DistributorOnboardingOptions> {
    return this.http.get<DistributorOnboardingOptions>(
      `${environment.apiUrl}/distributor/onboarding/options`,
    );
  }

  getStatus(): Observable<DistributorOnboardingStatus> {
    return this.http
      .get<DistributorOnboardingStatus>(`${environment.apiUrl}/distributor/onboarding/status`)
      .pipe(tap((status) => this.completed.set(status.completed)));
  }

  complete(request: CompleteDistributorOnboardingRequest): Observable<DistributorOnboardingStatus> {
    return this.http
      .post<DistributorOnboardingStatus>(
        `${environment.apiUrl}/distributor/onboarding/complete`,
        request,
      )
      .pipe(tap((status) => this.completed.set(status.completed)));
  }

  /** Use cached value when known; otherwise hit API. */
  ensureStatus(): Observable<DistributorOnboardingStatus> {
    const cached = this.completed();
    if (cached !== null) {
      return of({ completed: cached });
    }
    return this.getStatus();
  }

  clearCache(): void {
    this.completed.set(null);
  }
}
