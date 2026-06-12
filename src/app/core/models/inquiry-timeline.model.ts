import { InquiryStatus } from './inquiry.model';

export type TimelineEntryKind = 'MESSAGE' | 'MILESTONE' | 'STATUS' | 'DISTRIBUTOR';

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
}

export interface InquiryTimeline {
  inquiryId: string;
  title: string;
  currentStatus: InquiryStatus;
  needsClarification?: boolean;
  entries: InquiryTimelineEntry[];
}
