import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ConsumerInquiryCreated, CreateInquiryOnBehalfRequest, InquiryDraftAttachment } from '../../models/inquiry.model';

@Injectable({ providedIn: 'root' })
export class AdminInquiryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin/inquiries`;

  createOnBehalf(request: CreateInquiryOnBehalfRequest): Observable<ConsumerInquiryCreated> {
    return this.http.post<ConsumerInquiryCreated>(`${this.baseUrl}/on-behalf`, request);
  }

  uploadDraftAttachment(
    draftSessionId: string,
    rowClientId: string,
    consumerCompanyId: string,
    file: File,
  ): Observable<InquiryDraftAttachment> {
    const formData = new FormData();
    formData.append('draftSessionId', draftSessionId);
    formData.append('rowClientId', rowClientId);
    formData.append('consumerCompanyId', consumerCompanyId);
    formData.append('file', file, file.name);
    return this.http.post<InquiryDraftAttachment>(`${this.baseUrl}/draft-attachments`, formData);
  }

  deleteDraftAttachment(
    attachmentId: string,
    draftSessionId: string,
    consumerCompanyId: string,
  ): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/draft-attachments/${attachmentId}`, {
      params: { draftSessionId, consumerCompanyId },
    });
  }
}
