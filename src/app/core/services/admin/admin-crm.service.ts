import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CreateCrmCustomerRequest,
  CrmChangeHistoryDay,
  CrmCustomer,
  CrmCustomerSummary,
  CrmExcelUploadResult,
  CrmFollowUpEntry,
  CrmImportBatch,
  UpdateCrmCustomerRequest,
} from '../../models/admin-crm.model';

@Injectable({ providedIn: 'root' })
export class AdminCrmService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin/crm`;

  list(includeInactive = false): Observable<CrmCustomerSummary[]> {
    const params = new HttpParams().set('includeInactive', String(includeInactive));
    return this.http.get<CrmCustomerSummary[]>(this.baseUrl, { params });
  }

  /** Admin-only: all Excel columns. */
  listFull(includeInactive = false): Observable<CrmCustomer[]> {
    const params = new HttpParams().set('includeInactive', String(includeInactive));
    return this.http.get<CrmCustomer[]>(`${this.baseUrl}/full`, { params });
  }

  getById(id: string): Observable<CrmCustomer> {
    return this.http.get<CrmCustomer>(`${this.baseUrl}/${id}`);
  }

  listFollowUps(id: string): Observable<CrmFollowUpEntry[]> {
    return this.http.get<CrmFollowUpEntry[]>(`${this.baseUrl}/${id}/follow-ups`);
  }

  create(request: CreateCrmCustomerRequest): Observable<CrmCustomer> {
    return this.http.post<CrmCustomer>(this.baseUrl, request);
  }

  update(id: string, request: UpdateCrmCustomerRequest): Observable<CrmCustomer> {
    return this.http.put<CrmCustomer>(`${this.baseUrl}/${id}`, request);
  }

  updateWorkflowStatus(
    id: string,
    status: 'NONE' | 'REVIEW' | 'DONE',
  ): Observable<CrmCustomer> {
    return this.http.put<CrmCustomer>(`${this.baseUrl}/${id}/workflow-status`, { status });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /** Admin-only Excel bulk upload. */
  uploadExcel(file: File, replaceExisting = false): Observable<CrmExcelUploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    const params = new HttpParams().set('replaceExisting', String(replaceExisting));
    return this.http.post<CrmExcelUploadResult>(`${this.baseUrl}/upload`, formData, { params });
  }

  /** Admin-only: Excel upload history. */
  listImportHistory(): Observable<CrmImportBatch[]> {
    return this.http.get<CrmImportBatch[]>(`${this.baseUrl}/imports`);
  }

  /** Admin-only: load a past upload as the active CRM dataset. */
  activateImportBatch(batchId: string): Observable<CrmCustomer[]> {
    return this.http.post<CrmCustomer[]>(`${this.baseUrl}/imports/${batchId}/activate`, {});
  }

  /** Field-level edit history (sales + admin). */
  listChangeHistory(): Observable<CrmChangeHistoryDay[]> {
    return this.http.get<CrmChangeHistoryDay[]>(`${this.baseUrl}/change-history`);
  }
}
