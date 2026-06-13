import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CreateDistributorProductRequest,
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
}
