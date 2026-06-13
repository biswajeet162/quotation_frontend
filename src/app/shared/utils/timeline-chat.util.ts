import { InquiryTimelineEntry } from '../../core/models/inquiry-timeline.model';

export type TimelineViewerRole = 'ADMIN' | 'CONSUMER';

export function buildChatTimelineEntries(entries: InquiryTimelineEntry[]): InquiryTimelineEntry[] {
  return entries
    .filter((entry) => entry.kind === 'MESSAGE' || isTimelineNotice(entry))
    .sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    );
}

export function isTimelineNotice(entry: InquiryTimelineEntry): boolean {
  return (
    entry.kind === 'NOTICE' ||
    (entry.kind === 'MILESTONE' && entry.title === 'Sent to distributors')
  );
}

export function noticeDisplayLabel(
  entry: InquiryTimelineEntry,
  viewer: TimelineViewerRole,
): string {
  if (entry.noticeCode === 'SENT_TO_DISTRIBUTOR') {
    const distributorName = entry.detail?.trim();
    return viewer === 'ADMIN' && distributorName
      ? `Sent to ${distributorName}`
      : 'Checking our inventory';
  }
  if (
    entry.noticeCode === 'SENT_TO_DISTRIBUTORS' ||
    entry.title === 'Sent to distributors'
  ) {
    return viewer === 'ADMIN' ? 'Sent to distributors' : 'Checking our inventory';
  }
  return entry.title;
}

export function noticeDisplayDetail(
  entry: InquiryTimelineEntry,
  viewer: TimelineViewerRole,
): string | null {
  if (entry.noticeCode === 'SENT_TO_DISTRIBUTOR') {
    return null;
  }
  if (
    entry.noticeCode === 'SENT_TO_DISTRIBUTORS' ||
    entry.title === 'Sent to distributors'
  ) {
    if (viewer === 'CONSUMER') {
      return null;
    }
    return entry.detail?.trim() || entry.message?.trim() || null;
  }
  const detail = entry.detail?.trim() || entry.message?.trim();
  return detail || null;
}
