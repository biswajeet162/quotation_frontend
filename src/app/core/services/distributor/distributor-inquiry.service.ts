import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DistributorInquiry, DistributorInquirySummary } from '../../models/distributor.model';
import { InquiryTimeline } from '../../models/inquiry-timeline.model';

@Injectable({ providedIn: 'root' })
export class DistributorInquiryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/distributor/inquiries`;

  list(): Observable<DistributorInquirySummary[]> {
    return this.http.get<DistributorInquirySummary[]>(this.baseUrl);
  }

  getById(id: string): Observable<DistributorInquiry> {
    return this.http.get<DistributorInquiry>(`${this.baseUrl}/${id}`);
  }

  getTimeline(id: string): Observable<InquiryTimeline> {
    return this.http.get<InquiryTimeline>(`${this.baseUrl}/${id}/timeline`);
  }

  downloadSubmissionPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/pdf`, { responseType: 'blob' });
  }

  downloadQuotationPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/quotation-pdf`, { responseType: 'blob' });
  }

  submitQuotation(
    id: string,
    lines: {
      inquiryItemId: string;
      hsnCode?: string;
      mrp: number;
      discountPercentage?: number;
      gstPercentage: number;
      ourDeliveryDate?: string;
    }[],
  ): Observable<DistributorInquiry> {
    return this.http.post<DistributorInquiry>(`${this.baseUrl}/${id}/quotation`, { lines });
  }

  postMessage(
    id: string,
    message: string,
    replyToMessageId?: string,
    replyToAttachmentId?: string,
  ): Observable<DistributorInquiry> {
    return this.http.post<DistributorInquiry>(`${this.baseUrl}/${id}/messages`, {
      message,
      replyToMessageId,
      replyToAttachmentId,
    });
  }

  postMessageWithAttachments(
    id: string,
    message: string,
    attachments: File[],
    replyToMessageId?: string,
    replyToAttachmentId?: string,
  ): Observable<DistributorInquiry> {
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
    return this.http.post<DistributorInquiry>(`${this.baseUrl}/${id}/messages`, formData);
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
}
