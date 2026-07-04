import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  DistributorBrand,
  DistributorProductAttachment,
  DistributorProductAuditLog,
  DistributorProductEntry,
  UpdateDistributorProductRequest,
} from '../../models/distributor.model';

@Injectable({ providedIn: 'root' })
export class AdminDistributorProductService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin/distributor-products`;

  listAll(): Observable<DistributorProductEntry[]> {
    return this.http.get<DistributorProductEntry[]>(this.baseUrl);
  }

  update(id: string, request: UpdateDistributorProductRequest): Observable<DistributorProductEntry> {
    return this.http.put<DistributorProductEntry>(`${this.baseUrl}/${id}`, request);
  }

  activate(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/activate`, {});
  }

  deactivate(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/deactivate`, {});
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

  listAuditLogs(productId: string): Observable<DistributorProductAuditLog[]> {
    return this.http.get<DistributorProductAuditLog[]>(`${this.baseUrl}/${productId}/audit-logs`);
  }

  uploadBrandLogo(brandName: string, file: File): Observable<DistributorBrand> {
    const formData = new FormData();
    formData.append('brandName', brandName);
    formData.append('logo', file);
    return this.http
      .post<DistributorBrand>(`${this.baseUrl}/brands/logo`, formData)
      .pipe(map((brand) => this.withResolvedLogoUrl(brand)));
  }

  private withResolvedLogoUrl(brand: DistributorBrand): DistributorBrand {
    if (!brand.logoUrl) {
      return brand;
    }
    const logoUrl = brand.logoUrl.startsWith('http')
      ? brand.logoUrl
      : `${environment.apiUrl}${brand.logoUrl.startsWith('/') ? '' : '/'}${brand.logoUrl}`;
    return { ...brand, logoUrl };
  }
}
