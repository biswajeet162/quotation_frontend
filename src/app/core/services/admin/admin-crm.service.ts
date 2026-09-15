import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CreateCrmCustomerRequest,
  CrmCustomer,
  UpdateCrmCustomerRequest,
} from '../../models/admin-crm.model';

@Injectable({ providedIn: 'root' })
export class AdminCrmService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin/crm`;

  list(includeInactive = false): Observable<CrmCustomer[]> {
    const params = new HttpParams().set('includeInactive', String(includeInactive));
    return this.http.get<CrmCustomer[]>(this.baseUrl, { params });
  }

  getById(id: string): Observable<CrmCustomer> {
    return this.http.get<CrmCustomer>(`${this.baseUrl}/${id}`);
  }

  create(request: CreateCrmCustomerRequest): Observable<CrmCustomer> {
    return this.http.post<CrmCustomer>(this.baseUrl, request);
  }

  update(id: string, request: UpdateCrmCustomerRequest): Observable<CrmCustomer> {
    return this.http.put<CrmCustomer>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
