import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AdminCompanyProfile,
  AdminConsumerCompanyDetail,
  AdminConsumerCompanySummary,
  CreateAdminConsumerCompanyRequest,
  CreateAdminConsumerEmployeeRequest,
  UpdateAdminConsumerCompanyRequest,
} from '../../models/admin-company.model';

@Injectable({ providedIn: 'root' })
export class AdminCompanyService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin/companies`;

  list(includeInactive = false): Observable<AdminConsumerCompanySummary[]> {
    return this.http.get<AdminConsumerCompanySummary[]>(this.baseUrl, {
      params: { includeInactive },
    });
  }

  getById(id: string): Observable<AdminConsumerCompanyDetail> {
    return this.http.get<AdminConsumerCompanyDetail>(`${this.baseUrl}/${id}`);
  }

  getProfile(id: string): Observable<AdminCompanyProfile> {
    return this.http.get<AdminCompanyProfile>(`${this.baseUrl}/${id}/profile`);
  }

  create(request: CreateAdminConsumerCompanyRequest): Observable<AdminConsumerCompanyDetail> {
    return this.http.post<AdminConsumerCompanyDetail>(this.baseUrl, request);
  }

  update(id: string, request: UpdateAdminConsumerCompanyRequest): Observable<AdminConsumerCompanyDetail> {
    return this.http.put<AdminConsumerCompanyDetail>(`${this.baseUrl}/${id}`, request);
  }

  uploadLogo(id: string, file: File): Observable<AdminConsumerCompanyDetail> {
    const formData = new FormData();
    formData.append('logo', file);
    return this.http.post<AdminConsumerCompanyDetail>(`${this.baseUrl}/${id}/logo`, formData);
  }

  loadLogoBlob(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/logo/content`, { responseType: 'blob' });
  }

  loadProfileLogoBlob(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/profile/logo`, { responseType: 'blob' });
  }

  addEmployee(id: string, request: CreateAdminConsumerEmployeeRequest): Observable<AdminConsumerCompanyDetail> {
    return this.http.post<AdminConsumerCompanyDetail>(`${this.baseUrl}/${id}/employees`, request);
  }

  deactivateEmployee(companyId: string, userId: string): Observable<AdminConsumerCompanyDetail> {
    return this.http.delete<AdminConsumerCompanyDetail>(`${this.baseUrl}/${companyId}/employees/${userId}`);
  }
}
