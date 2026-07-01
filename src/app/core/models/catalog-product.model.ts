import { TimelineAttachmentMediaType } from './inquiry-timeline.model';

/** Public catalog product — safe fields only (consumer/admin browse). */
export interface CatalogProduct {
  productId: string;
  brand: string;
  designation: string;
  description?: string;
  attachmentCount?: number;
}

/** Public catalog attachment — safe fields only. */
export interface CatalogProductAttachment {
  id: string;
  fileName: string;
  mediaType: TimelineAttachmentMediaType;
  url: string;
}

export function toTimelineAttachment(
  attachment: CatalogProductAttachment,
): import('./inquiry-timeline.model').InquiryTimelineAttachment {
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    contentType: 'application/octet-stream',
    mediaType: attachment.mediaType,
    url: attachment.url,
  };
}
