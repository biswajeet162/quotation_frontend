import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CreateDistributorProductRequest,
  DistributorProductAttachment,
  DistributorProductEntry,
  UpdateDistributorProductRequest,
} from '../../models/distributor.model';

@Injectable({ providedIn: 'root' })
export class DistributorProductService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/distributor/products`;

  listMine(): Observable<DistributorProductEntry[]> {
    return this.http.get<DistributorProductEntry[]>(this.baseUrl);
  }

  create(request: CreateDistributorProductRequest): Observable<DistributorProductEntry> {
    return this.http.post<DistributorProductEntry>(this.baseUrl, request);
  }

  update(id: string, request: UpdateDistributorProductRequest): Observable<DistributorProductEntry> {
    return this.http.put<DistributorProductEntry>(`${this.baseUrl}/${id}`, request);
  }

  deactivate(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/deactivate`, {});
  }

  activate(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/activate`, {});
  }

  listAttachments(productId: string): Observable<DistributorProductAttachment[]> {
    return this.http.get<DistributorProductAttachment[]>(`${this.baseUrl}/${productId}/attachments`);
  }

  uploadAttachments(productId: string, files: File[]): Observable<DistributorProductAttachment[]> {
    const formData = new FormData();
    for (const file of files) {
      formData.append('attachments', file, file.name);
    }
    return this.http.post<DistributorProductAttachment[]>(
      `${this.baseUrl}/${productId}/attachments`,
      formData,
    );
  }

  deleteAttachment(attachmentId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/attachments/${attachmentId}`);
  }

  fetchAttachmentBlob(relativeUrl: string): Observable<Blob> {
    const path = relativeUrl.startsWith('/') ? relativeUrl.slice(1) : relativeUrl;
    return this.http.get(`${environment.apiUrl}/${path}`, { responseType: 'blob' });
  }
}
