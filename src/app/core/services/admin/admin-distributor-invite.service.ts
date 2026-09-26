import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CreateDistributorInviteRequest,
  DistributorInviteResponse,
} from '../../models/distributor-invite.model';

@Injectable({ providedIn: 'root' })
export class AdminDistributorInviteService {
  private readonly http = inject(HttpClient);

  createInvite(request: CreateDistributorInviteRequest): Observable<DistributorInviteResponse> {
    return this.http.post<DistributorInviteResponse>(
      `${environment.apiUrl}/admin/distributor-invites`,
      request,
    );
  }
}
