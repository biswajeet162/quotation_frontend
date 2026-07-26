import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ExternalEmailInboxItem,
  ExternalEmailStatus,
  GmailSyncRunResult,
  GmailSyncStatus,
  LinkExternalEmailRequest,
  LinkExternalEmailResult,
  ConvertExternalEmailSuggestions,
  ConvertExternalEmailToInquiryRequest,
  ConvertExternalEmailToInquiryResult,
} from '../../models/admin-gmail-inbox.model';

@Injectable({ providedIn: 'root' })
export class AdminGmailInboxService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin/gmail`;

  getStatus(): Observable<GmailSyncStatus> {
    return this.http.get<GmailSyncStatus>(`${this.baseUrl}/status`);
  }

  listInbox(status: ExternalEmailStatus = 'UNLINKED'): Observable<ExternalEmailInboxItem[]> {
    return this.http.get<ExternalEmailInboxItem[]>(`${this.baseUrl}/inbox`, {
      params: { status },
    });
  }

  getInboxItem(id: string): Observable<ExternalEmailInboxItem> {
    return this.http.get<ExternalEmailInboxItem>(`${this.baseUrl}/inbox/${id}`);
  }

  linkToInquiry(id: string, request: LinkExternalEmailRequest): Observable<LinkExternalEmailResult> {
    return this.http.post<LinkExternalEmailResult>(`${this.baseUrl}/inbox/${id}/link`, request);
  }

  dismiss(id: string): Observable<ExternalEmailInboxItem> {
    return this.http.post<ExternalEmailInboxItem>(`${this.baseUrl}/inbox/${id}/dismiss`, {});
  }

  runSync(): Observable<GmailSyncRunResult> {
    return this.http.post<GmailSyncRunResult>(`${this.baseUrl}/sync/run`, {});
  }

  getConvertSuggestions(id: string): Observable<ConvertExternalEmailSuggestions> {
    return this.http.get<ConvertExternalEmailSuggestions>(`${this.baseUrl}/inbox/${id}/convert-suggestions`);
  }

  convertToInquiry(
    id: string,
    request: ConvertExternalEmailToInquiryRequest,
  ): Observable<ConvertExternalEmailToInquiryResult> {
    return this.http.post<ConvertExternalEmailToInquiryResult>(
      `${this.baseUrl}/inbox/${id}/convert-to-inquiry`,
      request,
    );
  }
}
