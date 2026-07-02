import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CatalogBrand, CatalogProduct, CatalogProductAttachment } from '../../models/catalog-product.model';

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

  listBrands(): Observable<CatalogBrand[]> {
    return this.http.get<CatalogBrand[]>(`${this.baseUrl}/brands`).pipe(
      map((brands) => brands.map((brand) => this.withResolvedLogoUrl(brand))),
    );
  }

  searchBrands(term: string, limit = 15): Observable<CatalogBrand[]> {
    return this.http
      .get<CatalogBrand[]>(`${this.baseUrl}/brands`, {
        params: { search: term, limit: String(limit) },
      })
      .pipe(map((brands) => brands.map((brand) => this.withResolvedLogoUrl(brand))));
  }

  listAttachments(productId: string): Observable<CatalogProductAttachment[]> {
    return this.http.get<CatalogProductAttachment[]>(`${this.baseUrl}/${productId}/attachments`);
  }

  fetchAttachmentBlob(relativeUrl: string): Observable<Blob> {
    const path = relativeUrl.startsWith('/') ? relativeUrl.slice(1) : relativeUrl;
    return this.http.get(`${environment.apiUrl}/${path}`, { responseType: 'blob' });
  }

  fetchBrandLogoBlob(url: string): Observable<Blob> {
    return this.http.get(url, { responseType: 'blob' });
  }

  private withResolvedLogoUrl(brand: CatalogBrand): CatalogBrand {
    if (!brand.logoUrl) {
      return brand;
    }
    const logoUrl = brand.logoUrl.startsWith('http')
      ? brand.logoUrl
      : `${environment.apiUrl}${brand.logoUrl.startsWith('/') ? '' : '/'}${brand.logoUrl}`;
    return { ...brand, logoUrl };
  }
}
