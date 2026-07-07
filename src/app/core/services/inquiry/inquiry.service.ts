import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { InquiryTimeline } from '../../models/inquiry-timeline.model';
import {
  ConsumerInquiry,
  ConsumerInquiryCreated,
  CreateInquiryRequest,
  DistributorOption,
  Inquiry,
  InquiryDraftAttachment,
  InquiryItem,
  InquiryStatus,
  SubmitToDistributorsRequest,
  AdminInquiryLinePricing,
} from '../../models/inquiry.model';

@Injectable({ providedIn: 'root' })
export class InquiryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/inquiries`;

  /** One inquiry (single inquiryId) with all items in the request body. Company comes from JWT. */
  create(request: CreateInquiryRequest): Observable<ConsumerInquiryCreated> {
    return this.http.post<ConsumerInquiryCreated>(this.baseUrl, request);
  }

  uploadDraftAttachment(
    draftSessionId: string,
    rowClientId: string,
    file: File,
  ): Observable<InquiryDraftAttachment> {
    const formData = new FormData();
    formData.append('draftSessionId', draftSessionId);
    formData.append('rowClientId', rowClientId);
    formData.append('file', file, file.name);
    return this.http.post<InquiryDraftAttachment>(`${this.baseUrl}/draft-attachments`, formData);
  }

  deleteDraftAttachment(attachmentId: string, draftSessionId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/draft-attachments/${attachmentId}`, {
      params: { draftSessionId },
    });
  }

  downloadSubmissionPdf(inquiryId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${inquiryId}/pdf`, { responseType: 'blob' });
  }

  getMyInquiries(): Observable<ConsumerInquiry[]> {
    return this.http.get<ConsumerInquiry[]>(`${this.baseUrl}/my`);
  }

  getByCompany(companyId: string): Observable<Inquiry[]> {
    return this.http.get<Inquiry[]>(`${this.baseUrl}/company/${companyId}`);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  getTimeline(id: string): Observable<InquiryTimeline> {
    return this.http.get<InquiryTimeline>(`${this.baseUrl}/${id}/timeline`);
  }

  postMessage(
    id: string,
    message: string,
    replyToMessageId?: string,
    replyToAttachmentId?: string,
  ): Observable<ConsumerInquiry> {
    const body: {
      message: string;
      replyToMessageId?: string;
      replyToAttachmentId?: string;
    } = { message };
    if (replyToMessageId) {
      body.replyToMessageId = replyToMessageId;
    }
    if (replyToAttachmentId) {
      body.replyToAttachmentId = replyToAttachmentId;
    }
    return this.http.post<ConsumerInquiry>(`${this.baseUrl}/${id}/messages`, body);
  }

  postMessageWithAttachments(
    id: string,
    message: string,
    attachments: File[],
    replyToMessageId?: string,
    replyToAttachmentId?: string,
  ): Observable<ConsumerInquiry> {
    const formData = new FormData();
    if (message.trim()) {
      formData.append('message', message.trim());
    }
    if (replyToMessageId) {
      formData.append('replyToMessageId', replyToMessageId);
    }
    if (replyToAttachmentId) {
      formData.append('replyToAttachmentId', replyToAttachmentId);
    }
    for (const file of attachments) {
      formData.append('attachments', file, file.name);
    }
    return this.http.post<ConsumerInquiry>(`${this.baseUrl}/${id}/messages`, formData);
  }

  getAttachmentContentUrl(relativeUrl: string): string {
    const path = relativeUrl.startsWith('/') ? relativeUrl.slice(1) : relativeUrl;
    return `${environment.apiUrl}/${path}`;
  }

  fetchAttachmentBlob(relativeUrl: string): Observable<Blob> {
    return this.http.get(this.getAttachmentContentUrl(relativeUrl), {
      responseType: 'blob',
    });
  }

  replyToClarification(id: string, message: string): Observable<ConsumerInquiry> {
    return this.http.post<ConsumerInquiry>(`${this.baseUrl}/${id}/clarification-reply`, {
      message,
    });
  }

  getAll(): Observable<Inquiry[]> {
    return this.http.get<Inquiry[]>(this.baseUrl);
  }

  getById(id: string): Observable<Inquiry> {
    return this.http.get<Inquiry>(`${this.baseUrl}/${id}`);
  }

  getByStatus(status: InquiryStatus): Observable<Inquiry[]> {
    return this.http.get<Inquiry[]>(`${this.baseUrl}/status/${status}`);
  }

  submitToDistributors(
    id: string,
    distributorCompanyIds: string[],
    linePricing?: AdminInquiryLinePricing[],
  ): Observable<Inquiry> {
    const body: SubmitToDistributorsRequest = { distributorCompanyIds, linePricing };
    return this.http.post<Inquiry>(`${this.baseUrl}/${id}/submit-to-distributors`, body);
  }

  getDistributorOptions(id: string): Observable<DistributorOption[]> {
    return this.http.get<DistributorOption[]>(`${this.baseUrl}/${id}/distributor-options`);
  }

  requestClarification(id: string, message: string): Observable<Inquiry> {
    return this.http.post<Inquiry>(`${this.baseUrl}/${id}/request-clarification`, { message });
  }

  postAdminMessage(
    id: string,
    message: string,
    replyToMessageId?: string,
    replyToAttachmentId?: string,
    markAwaitingConsumer?: boolean,
  ): Observable<Inquiry> {
    const body: {
      message: string;
      replyToMessageId?: string;
      replyToAttachmentId?: string;
      markAwaitingConsumer?: boolean;
    } = { message };
    if (replyToMessageId) {
      body.replyToMessageId = replyToMessageId;
    }
    if (replyToAttachmentId) {
      body.replyToAttachmentId = replyToAttachmentId;
    }
    if (markAwaitingConsumer) {
      body.markAwaitingConsumer = true;
    }
    return this.http.post<Inquiry>(`${this.baseUrl}/${id}/admin-messages`, body);
  }

  postAdminMessageWithAttachments(
    id: string,
    message: string,
    attachments: File[],
    replyToMessageId?: string,
    replyToAttachmentId?: string,
    markAwaitingConsumer?: boolean,
  ): Observable<Inquiry> {
    const formData = new FormData();
    if (message.trim()) {
      formData.append('message', message.trim());
    }
    if (replyToMessageId) {
      formData.append('replyToMessageId', replyToMessageId);
    }
    if (replyToAttachmentId) {
      formData.append('replyToAttachmentId', replyToAttachmentId);
    }
    if (markAwaitingConsumer) {
      formData.append('markAwaitingConsumer', 'true');
    }
    for (const file of attachments) {
      formData.append('attachments', file, file.name);
    }
    return this.http.post<Inquiry>(`${this.baseUrl}/${id}/admin-messages`, formData);
  }

  getDistributorChannelTimeline(
    inquiryId: string,
    distributorCompanyId: string,
  ): Observable<InquiryTimeline> {
    return this.http.get<InquiryTimeline>(
      `${this.baseUrl}/${inquiryId}/distributors/${distributorCompanyId}/timeline`,
    );
  }

  getDistributorQuotationItems(
    inquiryId: string,
    distributorCompanyId: string,
  ): Observable<InquiryItem[]> {
    return this.http.get<InquiryItem[]>(
      `${this.baseUrl}/${inquiryId}/distributors/${distributorCompanyId}/quotation-items`,
    );
  }

  downloadDistributorQuotationPdf(
    inquiryId: string,
    distributorCompanyId: string,
  ): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/${inquiryId}/distributors/${distributorCompanyId}/quotation-pdf`,
      { responseType: 'blob' },
    );
  }

  postDistributorMessage(
    inquiryId: string,
    distributorCompanyId: string,
    message: string,
    replyToMessageId?: string,
    replyToAttachmentId?: string,
  ): Observable<Inquiry> {
    return this.http.post<Inquiry>(
      `${this.baseUrl}/${inquiryId}/distributors/${distributorCompanyId}/messages`,
      { message, replyToMessageId, replyToAttachmentId },
    );
  }

  postDistributorMessageWithAttachments(
    inquiryId: string,
    distributorCompanyId: string,
    message: string,
    attachments: File[],
    replyToMessageId?: string,
    replyToAttachmentId?: string,
  ): Observable<Inquiry> {
    const formData = new FormData();
    if (message.trim()) {
      formData.append('message', message.trim());
    }
    if (replyToMessageId) {
      formData.append('replyToMessageId', replyToMessageId);
    }
    if (replyToAttachmentId) {
      formData.append('replyToAttachmentId', replyToAttachmentId);
    }
    for (const file of attachments) {
      formData.append('attachments', file, file.name);
    }
    return this.http.post<Inquiry>(
      `${this.baseUrl}/${inquiryId}/distributors/${distributorCompanyId}/messages`,
      formData,
    );
  }
}
