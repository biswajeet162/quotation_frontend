import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { FindOrCreateProductRequest } from '../../models/inquiry.model';
import { Product } from '../../models/product.model';
import { ProductSuggestField } from './product-catalog-lookup.service';

export interface ProductCatalogSearchOptions {
  field: ProductSuggestField;
  term: string;
  brandFilter?: string;
  size?: number;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/products`;

  getAll(): Observable<Product[]> {
    return this.http.get<Product[]>(this.baseUrl);
  }

  getById(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/${id}`);
  }

  search(search: string): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.baseUrl}/search`, {
      params: { search, size: '50' },
    });
  }

  /** Paginated catalog lookup; maps the active field to backend search params. */
  searchCatalog(options: ProductCatalogSearchOptions): Observable<Product[]> {
    const term = options.term.trim();
    const size = options.size ?? 15;
    const params: Record<string, string> = {
      size: String(size),
      sortBy: options.field === 'brand' ? 'brand' : 'designation',
      sortDirection: 'asc',
    };

    if (options.field === 'designation') {
      params['designation'] = term;
    } else if (options.field === 'brand') {
      params['brand'] = term;
    } else {
      params['search'] = term;
    }

    const brandFilter = options.brandFilter?.trim();
    if (brandFilter && options.field !== 'brand') {
      params['brand'] = brandFilter;
    }

    return this.http.get<Product[]>(`${this.baseUrl}/search`, { params });
  }

  findOrCreate(request: FindOrCreateProductRequest): Observable<Product> {
    return this.http.post<Product>(`${this.baseUrl}/find-or-create`, request);
  }
}
