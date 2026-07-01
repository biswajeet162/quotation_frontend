import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CatalogProduct, CatalogProductAttachment } from '../../models/catalog-product.model';

@Injectable({ providedIn: 'root' })
export class ConsumerProductCatalogService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/consumer/products`;

  list(): Observable<CatalogProduct[]> {
    return this.http.get<CatalogProduct[]>(this.baseUrl);
  }

  search(term: string): Observable<CatalogProduct[]> {
    return this.http.get<CatalogProduct[]>(`${this.baseUrl}/search`, {
      params: { search: term },
    });
  }

  listAttachments(productId: string): Observable<CatalogProductAttachment[]> {
    return this.http.get<CatalogProductAttachment[]>(`${this.baseUrl}/${productId}/attachments`);
  }

  fetchAttachmentBlob(relativeUrl: string): Observable<Blob> {
    const path = relativeUrl.startsWith('/') ? relativeUrl.slice(1) : relativeUrl;
    return this.http.get(`${environment.apiUrl}/${path}`, { responseType: 'blob' });
  }
}
