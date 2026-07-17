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

  resendEmailVerification(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/profile/resend-email-verification`, {});
  }

  sendPhoneOtp(phone: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/profile/phone/send-otp`, { phone });
  }

  verifyPhoneOtp(phone: string, otp: string): Observable<ConsumerProfile> {
    return this.http.post<ConsumerProfile>(`${this.baseUrl}/profile/phone/verify-otp`, { phone, otp });
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
