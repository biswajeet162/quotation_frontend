import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  DistributorDashboardOverview,
  DistributorProfile,
} from '../../models/distributor.model';

@Injectable({ providedIn: 'root' })
export class DistributorDashboardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/distributor/dashboard`;

  getOverview(): Observable<DistributorDashboardOverview> {
    return this.http.get<DistributorDashboardOverview>(`${this.baseUrl}/overview`);
  }

  getProfile(): Observable<DistributorProfile> {
    return this.http.get<DistributorProfile>(`${this.baseUrl}/profile`);
  }
}
