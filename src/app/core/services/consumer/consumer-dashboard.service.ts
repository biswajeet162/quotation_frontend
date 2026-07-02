import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ConsumerProfile, UpdateConsumerProfileRequest } from '../../models/consumer.model';

@Injectable({ providedIn: 'root' })
export class ConsumerDashboardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/consumer/dashboard`;

  getProfile(): Observable<ConsumerProfile> {
    return this.http.get<ConsumerProfile>(`${this.baseUrl}/profile`);
  }

  updateProfile(request: UpdateConsumerProfileRequest): Observable<ConsumerProfile> {
    return this.http.put<ConsumerProfile>(`${this.baseUrl}/profile`, request);
  }

  uploadLogo(file: File): Observable<ConsumerProfile> {
    const formData = new FormData();
    formData.append('logo', file);
    return this.http.post<ConsumerProfile>(`${this.baseUrl}/profile/logo`, formData);
  }

  loadLogoBlob(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/profile/logo/content`, { responseType: 'blob' });
  }
}
