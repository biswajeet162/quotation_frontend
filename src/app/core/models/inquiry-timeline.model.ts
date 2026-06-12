import { InquiryStatus } from './inquiry.model';

export type TimelineEntryKind = 'MESSAGE' | 'MILESTONE' | 'STATUS' | 'DISTRIBUTOR';

export type TimelineAttachmentMediaType = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';

export interface InquiryTimelineAttachment {
  id: string;
  fileName: string;
  contentType: string;
  mediaType: TimelineAttachmentMediaType;
  /** Relative API path, e.g. /inquiries/attachments/{id}/content */
  url: string;
}

export interface InquiryTimelineReplyTo {
  id: string;
  actorName?: string;
  actorRole?: string;
  preview: string;
}

export interface InquiryTimelineEntry {
  id: string;
  occurredAt: string;
  kind: TimelineEntryKind;
  title: string;
  detail?: string;
  message?: string;
  actorName?: string;
  actorRole?: string;
  fromCompanyName?: string;
  toCompanyName?: string;
  attachments?: InquiryTimelineAttachment[];
  replyTo?: InquiryTimelineReplyTo;
}

export interface InquiryTimeline {
  inquiryId: string;
  title: string;
  currentStatus: InquiryStatus;
  needsClarification?: boolean;
  entries: InquiryTimelineEntry[];
}
