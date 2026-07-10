import { InquiryTimelineEntry } from '../../core/models/inquiry-timeline.model';

export type TimelineViewerRole = 'ADMIN' | 'CONSUMER' | 'DISTRIBUTOR';

export function buildChatTimelineEntries(entries: InquiryTimelineEntry[]): InquiryTimelineEntry[] {
  return entries
    .filter((entry) => entry.kind === 'MESSAGE' || isTimelineNotice(entry))
    .sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    );
}

export function buildConsumerChatTimelineEntries(entries: InquiryTimelineEntry[]): InquiryTimelineEntry[] {
  return buildChatTimelineEntries(entries).filter(isConsumerChannelEntry);
}

/** Admin ↔ consumer chat only — never includes distributor messages or distributor workflow notices. */
export function buildAdminCustomerChatTimelineEntries(
  entries: InquiryTimelineEntry[],
): InquiryTimelineEntry[] {
  return buildChatTimelineEntries(entries).filter(isAdminCustomerChannelEntry);
}

export function isConsumerChannelEntry(entry: InquiryTimelineEntry): boolean {
  if (entry.actorRole === 'DISTRIBUTOR') {
    return false;
  }
  if (isDistributorQuotationNotice(entry)) {
    return false;
  }
  if (isFinalQuotationForwardedNotice(entry)) {
    return false;
  }
  if (entry.noticeCode === 'SENT_TO_DISTRIBUTOR') {
    return false;
  }
  return true;
}

/** Same channel as consumer chat: only ADMIN/CONSUMER messages and non-distributor notices. */
export function isAdminCustomerChannelEntry(entry: InquiryTimelineEntry): boolean {
  if (entry.actorRole === 'DISTRIBUTOR') {
    return false;
  }
  if (entry.kind === 'MESSAGE') {
    return entry.actorRole === 'ADMIN' || entry.actorRole === 'CONSUMER';
  }
  if (isDistributorSendNotice(entry) || isDistributorQuotationNotice(entry)) {
    return false;
  }
  if (isSentToDistributorsNotice(entry)) {
    return false;
  }
  if (isFinalQuotationForwardedNotice(entry)) {
    return false;
  }
  if (entry.noticeCode === 'SENT_TO_DISTRIBUTOR') {
    return false;
  }
  return isTimelineNotice(entry);
}

export function isTimelineNotice(entry: InquiryTimelineEntry): boolean {
  return (
    entry.kind === 'NOTICE' ||
    (entry.kind === 'MILESTONE' && entry.title === 'Sent to distributors')
  );
}

export function isSentToDistributorsNotice(entry: InquiryTimelineEntry): boolean {
  return (
    entry.noticeCode === 'SENT_TO_DISTRIBUTORS' ||
    (entry.kind === 'MILESTONE' && entry.title === 'Sent to distributors')
  );
}

export function isDistributorSendNotice(entry: InquiryTimelineEntry): boolean {
  return entry.noticeCode === 'SENT_TO_DISTRIBUTOR';
}

export function isDistributorQuotationNotice(entry: InquiryTimelineEntry): boolean {
  return (
    entry.noticeCode === 'DISTRIBUTOR_QUOTATION_SUBMITTED' ||
    entry.title === 'Distributor shared quotation' ||
    (entry.title === 'Quotation submitted' && entry.actorRole === 'DISTRIBUTOR')
  );
}

export function isFinalQuotationNotice(entry: InquiryTimelineEntry): boolean {
  return entry.noticeCode === 'FINAL_QUOTATION_SENT' || entry.title === 'Final quotation sent';
}

export function isFinalQuotationForwardedNotice(entry: InquiryTimelineEntry): boolean {
  return (
    entry.noticeCode === 'FINAL_QUOTATION_FORWARDED' ||
    entry.title === 'Quotation sent to consumer'
  );
}

export function noticeDisplayLabel(
  entry: InquiryTimelineEntry,
  viewer: TimelineViewerRole,
): string {
  if (entry.noticeCode === 'SENT_TO_DISTRIBUTOR') {
    const distributorName = entry.detail?.trim();
    if (viewer === 'DISTRIBUTOR') {
      return 'Quotation request received';
    }
    return viewer === 'ADMIN' && distributorName
      ? `Sent to ${distributorName}`
      : 'Checking our inventory';
  }
  if (
    entry.noticeCode === 'DISTRIBUTOR_QUOTATION_SUBMITTED' ||
    entry.title === 'Distributor shared quotation' ||
    entry.title === 'Quotation submitted'
  ) {
    if (viewer === 'ADMIN') {
      const distributorName = entry.actorName?.trim() || entry.fromCompanyName?.trim();
      return distributorName
        ? `${distributorName} shared their quotation`
        : 'Distributor shared their quotation';
    }
    return entry.title === 'Quotation submitted' ? 'Quotation submitted' : 'Quotation shared';
  }
  if (isFinalQuotationNotice(entry)) {
    return viewer === 'CONSUMER' ? 'Your final quotation is ready' : 'Final quotation sent';
  }
  if (isFinalQuotationForwardedNotice(entry)) {
    return 'Quotation has been sent to consumer';
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
    entry.noticeCode === 'DISTRIBUTOR_QUOTATION_SUBMITTED' ||
    entry.title === 'Distributor shared quotation' ||
    entry.title === 'Quotation submitted'
  ) {
    if (viewer === 'ADMIN') {
      return 'They have shared their pricing below. Review the quotation table and PDF.';
    }
    return entry.message?.trim() || entry.detail?.trim() || null;
  }
  if (isFinalQuotationNotice(entry) || isFinalQuotationForwardedNotice(entry)) {
    return entry.message?.trim() || entry.detail?.trim() || null;
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
