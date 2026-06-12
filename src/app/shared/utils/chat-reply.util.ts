import {
  InquiryTimelineEntry,
  InquiryTimelineReplyTo,
} from '../../core/models/inquiry-timeline.model';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function canReplyToTimelineEntry(entry: InquiryTimelineEntry): boolean {
  return entry.kind === 'MESSAGE' && UUID_PATTERN.test(entry.id);
}

export function buildReplyPreview(entry: InquiryTimelineEntry): string {
  if (entry.replyTo?.preview) {
    return entry.replyTo.preview;
  }
  if (entry.message?.trim()) {
    const text = entry.message.trim();
    return text.length > 120 ? `${text.slice(0, 120)}…` : text;
  }
  if (entry.attachments?.length) {
    const mediaType = entry.attachments[0].mediaType;
    if (entry.attachments.length === 1) {
      switch (mediaType) {
        case 'IMAGE':
          return 'Photo';
        case 'VIDEO':
          return 'Video';
        case 'AUDIO':
          return 'Voice message';
        case 'DOCUMENT':
          return entry.attachments[0].fileName || 'Document';
      }
    }
    return `${entry.attachments.length} attachments`;
  }
  return entry.title || 'Message';
}

export function replyAuthorLabel(replyTo: InquiryTimelineReplyTo): string {
  if (replyTo.actorRole === 'ADMIN') {
    return 'Admin';
  }
  if (replyTo.actorRole === 'CONSUMER') {
    return 'You';
  }
  return replyTo.actorName || 'Message';
}

export function replyTargetAuthorLabel(entry: InquiryTimelineEntry): string {
  if (entry.actorRole === 'ADMIN') {
    return 'Admin';
  }
  if (entry.actorRole === 'CONSUMER') {
    return 'You';
  }
  return entry.actorName || 'Message';
}
