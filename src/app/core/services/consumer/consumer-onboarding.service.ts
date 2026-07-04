import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthResponse } from '../../models/auth.model';

export interface ConsumerOnboardingStatus {
  needsCompanySetup: boolean;
  phone?: string;
}

export interface ConsumerCompanyPreview {
  id: string;
  name: string;
  email: string;
  phone: string;
  gstNumber?: string;
  panNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pinCode?: string;
  consumerLogoUrl?: string;
}

export interface CompleteConsumerCompanySetupRequest {
  companyId?: string;
  companyName?: string;
  companyEmail?: string;
  companyPhone?: string;
  gstNumber?: string;
  panNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pinCode?: string;
  phone?: string;
}

@Injectable({ providedIn: 'root' })
export class ConsumerOnboardingService {
  private readonly http = inject(HttpClient);

  getStatus(): Observable<ConsumerOnboardingStatus> {
    return this.http.get<ConsumerOnboardingStatus>(`${environment.apiUrl}/consumer/onboarding/status`);
  }

  listCompanies(): Observable<ConsumerCompanyPreview[]> {
    return this.http.get<ConsumerCompanyPreview[]>(`${environment.apiUrl}/consumer/onboarding/companies`);
  }

  getCompanyLogo(companyId: string): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/consumer/onboarding/companies/${companyId}/logo/content`, {
      responseType: 'blob',
    });
  }

  completeCompanySetup(
    request: CompleteConsumerCompanySetupRequest,
    logo?: File | null,
  ): Observable<AuthResponse> {
    const formData = new FormData();
    formData.append(
      'request',
      new Blob([JSON.stringify(request)], { type: 'application/json' }),
      'request.json',
    );
    if (logo) {
      formData.append('logo', logo, logo.name);
    }
    return this.http.post<AuthResponse>(`${environment.apiUrl}/consumer/onboarding/company`, formData);
  }
}
