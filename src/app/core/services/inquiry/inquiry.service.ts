import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ConsumerInquiry,
  ConsumerInquiryCreated,
  CreateInquiryRequest,
  Inquiry,
  InquiryStatus,
} from '../../models/inquiry.model';

@Injectable({ providedIn: 'root' })
export class InquiryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/inquiries`;

  /** One inquiry (single inquiryId) with all items in the request body. Company comes from JWT. */
  create(request: CreateInquiryRequest): Observable<ConsumerInquiryCreated> {
    return this.http.post<ConsumerInquiryCreated>(this.baseUrl, request);
  }

  getMyInquiries(): Observable<ConsumerInquiry[]> {
    return this.http.get<ConsumerInquiry[]>(`${this.baseUrl}/my`);
  }

  getByCompany(companyId: string): Observable<Inquiry[]> {
    return this.http.get<Inquiry[]>(`${this.baseUrl}/company/${companyId}`);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
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
