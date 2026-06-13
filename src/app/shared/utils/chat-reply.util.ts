import {
  InquiryTimelineAttachment,
  InquiryTimelineEntry,
  InquiryTimelineReplyTo,
} from '../../core/models/inquiry-timeline.model';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ChatReplyTarget {
  entry: InquiryTimelineEntry;
  attachment?: InquiryTimelineAttachment;
}

export function canReplyToTimelineEntry(entry: InquiryTimelineEntry): boolean {
  return entry.kind === 'MESSAGE' && UUID_PATTERN.test(entry.id);
}

export function canReplyToAttachment(entry: InquiryTimelineEntry): boolean {
  return canReplyToTimelineEntry(entry);
}

export function attachmentReplyPreview(attachment: InquiryTimelineAttachment): string {
  switch (attachment.mediaType) {
    case 'IMAGE':
      return 'Photo';
    case 'VIDEO':
      return 'Video';
    case 'AUDIO':
      return 'Voice message';
    case 'DOCUMENT':
      return attachment.fileName || 'Document';
    default:
      return attachment.fileName || 'Attachment';
  }
}

export function buildReplyPreview(target: ChatReplyTarget): string {
  if (target.attachment) {
    return attachmentReplyPreview(target.attachment);
  }
  return buildEntryReplyPreview(target.entry);
}

export function buildEntryReplyPreview(entry: InquiryTimelineEntry): string {
  if (entry.message?.trim()) {
    const text = entry.message.trim();
    return text.length > 120 ? `${text.slice(0, 120)}…` : text;
  }
  if (entry.attachments?.length) {
    if (entry.attachments.length === 1) {
      return attachmentReplyPreview(entry.attachments[0]);
    }
    return `${entry.attachments.length} attachments`;
  }
  return entry.title || 'Message';
}

export type ChatViewerRole = 'ADMIN' | 'CONSUMER';

export function replyAuthorLabel(
  replyTo: InquiryTimelineReplyTo,
  viewer: ChatViewerRole = 'CONSUMER',
): string {
  if (replyTo.actorRole === 'ADMIN') {
    return viewer === 'ADMIN' ? 'You' : 'Admin';
  }
  if (replyTo.actorRole === 'CONSUMER') {
    return viewer === 'CONSUMER' ? 'You' : replyTo.actorName || 'Consumer';
  }
  return replyTo.actorName || 'Message';
}

export function replyTargetAuthorLabel(
  target: ChatReplyTarget,
  viewer: ChatViewerRole = 'CONSUMER',
): string {
  if (target.entry.actorRole === 'ADMIN') {
    return viewer === 'ADMIN' ? 'You' : 'Admin';
  }
  if (target.entry.actorRole === 'CONSUMER') {
    return viewer === 'CONSUMER' ? 'You' : target.entry.actorName || 'Consumer';
  }
  return target.entry.actorName || 'Message';
}

export function replyTargetLabel(target: ChatReplyTarget): string {
  if (target.attachment) {
    return attachmentReplyPreview(target.attachment);
  }
  return buildEntryReplyPreview(target.entry);
}

export function shouldShowBubbleReply(entry: InquiryTimelineEntry): boolean {
  const attachmentCount = entry.attachments?.length ?? 0;
  if (attachmentCount === 0) {
    return true;
  }
  return !!entry.message?.trim();
}

export function quotedMessageElementId(replyTo: InquiryTimelineReplyTo): string {
  if (replyTo.attachmentId) {
    return `chat-att-${replyTo.attachmentId}`;
  }
  return `chat-msg-${replyTo.id}`;
}
