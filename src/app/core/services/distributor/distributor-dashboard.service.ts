import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  DistributorDashboardOverview,
  DistributorProfile,
  UpdateDistributorProfileRequest,
} from '../../models/distributor.model';

@Injectable({ providedIn: 'root' })
export class DistributorDashboardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/distributor/dashboard`;

  getOverview(): Observable<DistributorDashboardOverview> {
    return this.http.get<DistributorDashboardOverview>(`${this.baseUrl}/overview`);
  }

  getProfile(): Observable<DistributorProfile> {
    return this.http.get<DistributorProfile>(`${this.baseUrl}/profile`).pipe(
      map((profile) => ({
        ...profile,
        contacts: profile.contacts ?? [],
      })),
    );
  }

  updateProfile(request: UpdateDistributorProfileRequest): Observable<DistributorProfile> {
    return this.http.put<DistributorProfile>(`${this.baseUrl}/profile`, request).pipe(
      map((profile) => ({
        ...profile,
        contacts: profile.contacts ?? [],
      })),
    );
  }

  uploadLogo(file: File): Observable<DistributorProfile> {
    const formData = new FormData();
    formData.append('logo', file);
    return this.http.post<DistributorProfile>(`${this.baseUrl}/profile/logo`, formData).pipe(
      map((profile) => ({
        ...profile,
        contacts: profile.contacts ?? [],
      })),
    );
  }

  loadLogoBlob(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/profile/logo/content`, { responseType: 'blob' });
  }
}
