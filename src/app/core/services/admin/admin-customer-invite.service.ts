import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CreateCustomerInviteRequest,
  CustomerInviteResponse,
} from '../../models/customer-invite.model';

@Injectable({ providedIn: 'root' })
export class AdminCustomerInviteService {
  private readonly http = inject(HttpClient);

  createInvite(request: CreateCustomerInviteRequest): Observable<CustomerInviteResponse> {
    return this.http.post<CustomerInviteResponse>(
      `${environment.apiUrl}/admin/customer-invites`,
      request,
    );
  }
}
