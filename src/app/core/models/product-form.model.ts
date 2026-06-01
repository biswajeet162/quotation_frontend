import { InquiryLineSource } from './inquiry.model';

export interface ProductFormDraft {
  catalogProductId?: number;
  brand: string;
  designation: string;
  groupName: string;
  category: string;
  description: string;
  specifications: string;
  aliasNames: string;
  quantity: number;
  lineNotes: string;
  lineSource: InquiryLineSource;
}

export const emptyProductFormDraft = (): ProductFormDraft => ({
  brand: '',
  designation: '',
  groupName: '',
  category: '',
  description: '',
  specifications: '',
  aliasNames: '',
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
