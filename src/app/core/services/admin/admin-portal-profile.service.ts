import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AdminPortalProfile,
  UpdateAdminPortalProfileRequest,
} from '../../models/admin-portal-profile.model';

@Injectable({ providedIn: 'root' })
export class AdminPortalProfileService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin/portal`;

  getProfile(): Observable<AdminPortalProfile> {
    return this.http.get<AdminPortalProfile>(`${this.baseUrl}/profile`);
  }

  updateProfile(request: UpdateAdminPortalProfileRequest): Observable<AdminPortalProfile> {
    return this.http.put<AdminPortalProfile>(`${this.baseUrl}/profile`, request);
  }
}
