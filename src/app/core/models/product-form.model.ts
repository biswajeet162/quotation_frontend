import { InquiryLineSource } from './inquiry.model';
import { TimelineAttachmentMediaType } from './inquiry-timeline.model';

export interface RowLocalAttachment {
  localId: string;
  fileName: string;
  mediaType: TimelineAttachmentMediaType;
  contentType: string;
  file: File;
  blobUrl: string;
  serverAttachmentId?: string;
  uploadStatus?: 'uploading' | 'ready' | 'error';
  uploadError?: string;
}

export interface ProductFormDraft {
  catalogProductId?: string;
  attachmentCount?: number;
  localAttachments: RowLocalAttachment[];
  brand: string;
  designation: string;
  description: string;
  specifications: string;
  quantity: number;
  lineNotes: string;
  lineSource: InquiryLineSource;
}

export const emptyProductFormDraft = (): ProductFormDraft => ({
  localAttachments: [],
  brand: '',
  designation: '',
  description: '',
  specifications: '',
  quantity: 1,
  lineNotes: '',
  lineSource: 'NEW_PRODUCT',
});

export interface ProductFormRow extends ProductFormDraft {
  rowId: string;
}

function newRowId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `row-${crypto.randomUUID()}`;
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const createProductFormRow = (patch?: Partial<ProductFormDraft>): ProductFormRow => ({
  rowId: newRowId(),
  ...emptyProductFormDraft(),
  ...patch,
});
