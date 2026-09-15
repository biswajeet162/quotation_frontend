import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AdminUserDetail,
  AdminUserSummary,
  ChangeUserRoleRequest,
  CreateAdminUserRequest,
  UpdateAdminUserRequest,
  UserRole,
} from '../../models/admin-user.model';

@Injectable({ providedIn: 'root' })
export class AdminUserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin/users`;

  list(role: UserRole, includeInactive = false): Observable<AdminUserSummary[]> {
    const params = new HttpParams()
      .set('role', role)
      .set('includeInactive', String(includeInactive));
    return this.http.get<AdminUserSummary[]>(this.baseUrl, { params });
  }

  getById(id: string): Observable<AdminUserDetail> {
    return this.http.get<AdminUserDetail>(`${this.baseUrl}/${id}`);
  }

  create(request: CreateAdminUserRequest): Observable<AdminUserDetail> {
    return this.http.post<AdminUserDetail>(this.baseUrl, request);
  }

  update(id: string, request: UpdateAdminUserRequest): Observable<AdminUserDetail> {
    return this.http.put<AdminUserDetail>(`${this.baseUrl}/${id}`, request);
  }

  changeRole(id: string, request: ChangeUserRoleRequest): Observable<AdminUserDetail> {
    return this.http.put<AdminUserDetail>(`${this.baseUrl}/${id}/role`, request);
  }

  /** Soft-delete (deactivate). */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /** Permanent delete after soft-delete. */
  hardDelete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}/permanent`);
  }
}
