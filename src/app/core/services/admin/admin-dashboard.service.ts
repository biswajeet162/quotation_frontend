import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AdminDashboardOverview } from '../../models/admin-dashboard.model';

@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin/dashboard`;

  getOverview(): Observable<AdminDashboardOverview> {
    return this.http.get<AdminDashboardOverview>(`${this.baseUrl}/overview`);
  }
}
