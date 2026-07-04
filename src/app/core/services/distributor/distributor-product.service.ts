import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CreateDistributorProductRequest,
  DistributorBrand,
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

  listBrands(): Observable<DistributorBrand[]> {
    return this.http.get<DistributorBrand[]>(`${this.baseUrl}/brands`).pipe(
      map((brands) => brands.map((brand) => this.withResolvedLogoUrl(brand))),
    );
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
    return this.http.get(this.withCacheBust(`${environment.apiUrl}/${path}`), { responseType: 'blob' });
  }

  fetchBrandLogoBlob(url: string): Observable<Blob> {
    return this.http.get(this.withCacheBust(url), { responseType: 'blob' });
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

  private withCacheBust(url: string): string {
    if (url.startsWith('blob:')) {
      return url;
    }
    return `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
  }
}
