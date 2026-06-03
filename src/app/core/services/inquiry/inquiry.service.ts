import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CreateInquiryRequest, Inquiry, InquiryStatus } from '../../models/inquiry.model';

@Injectable({ providedIn: 'root' })
export class InquiryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/inquiries`;

  create(request: CreateInquiryRequest, companyId: string): Observable<Inquiry> {
    return this.http.post<Inquiry>(this.baseUrl, request, {
      headers: new HttpHeaders({ 'X-Company-Id': String(companyId) }),
    });
  }

  getByCompany(companyId: string): Observable<Inquiry[]> {
    return this.http.get<Inquiry[]>(`${this.baseUrl}/company/${companyId}`);
  }

  getAll(): Observable<Inquiry[]> {
    return this.http.get<Inquiry[]>(this.baseUrl);
  }

  getByStatus(status: InquiryStatus): Observable<Inquiry[]> {
    return this.http.get<Inquiry[]>(`${this.baseUrl}/status/${status}`);
  }

  submitToDistributors(id: string): Observable<Inquiry> {
    return this.http.post<Inquiry>(`${this.baseUrl}/${id}/submit-to-distributors`, {});
  }

  requestClarification(id: string, message: string): Observable<Inquiry> {
    return this.http.post<Inquiry>(`${this.baseUrl}/${id}/request-clarification`, { message });
  }
}
