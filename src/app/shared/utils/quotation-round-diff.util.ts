import { InquiryFinalizationSnapshotLine, InquiryItem } from '../../core/models/inquiry.model';

export type QuotationHighlightField =
  | 'hsnCode'
  | 'mrp'
  | 'discountPercentage'
  | 'gstPercentage'
  | 'ourDeliveryDate';

interface QuotationLineSnapshot {
  hsnCode?: string;
  mrp?: number;
  discountPercentage?: number;
  gstPercentage?: number;
  ourDeliveryDate?: string;
}

export function quotationLineSnapshotFromItem(item: InquiryItem): QuotationLineSnapshot {
  return {
    hsnCode: item.distributorHsnCode,
    mrp: item.distributorMrp,
    discountPercentage: item.distributorDiscountPercentage,
    gstPercentage: item.distributorGstPercentage,
    ourDeliveryDate: item.distributorOurDeliveryDate,
  };
}

export function finalizationLineSnapshotFromLine(
  line: InquiryFinalizationSnapshotLine,
): QuotationLineSnapshot {
  return {
    hsnCode: line.adminHsnCode,
    mrp: line.adminMrp,
    discountPercentage: line.adminDiscountPercentage,
    gstPercentage: line.adminGstPercentage,
    ourDeliveryDate: line.expectedDeliveryDate,
  };
}

function normalizeOptionalText(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function numbersEqual(left?: number | null, right?: number | null): boolean {
  if (left == null && right == null) {
    return true;
  }
  if (left == null || right == null) {
    return false;
  }
  return Math.abs(left - right) < 0.000_001;
}

export function getChangedQuotationLineFields(
  previous: QuotationLineSnapshot,
  current: QuotationLineSnapshot,
): Set<QuotationHighlightField> {
  const changed = new Set<QuotationHighlightField>();

  if (normalizeOptionalText(previous.hsnCode) !== normalizeOptionalText(current.hsnCode)) {
    changed.add('hsnCode');
  }
  if (!numbersEqual(previous.mrp, current.mrp)) {
    changed.add('mrp');
  }
  if (!numbersEqual(previous.discountPercentage, current.discountPercentage)) {
    changed.add('discountPercentage');
  }
  if (!numbersEqual(previous.gstPercentage, current.gstPercentage)) {
    changed.add('gstPercentage');
  }
  if (
    normalizeOptionalText(previous.ourDeliveryDate) !== normalizeOptionalText(current.ourDeliveryDate)
  ) {
    changed.add('ourDeliveryDate');
  }

  return changed;
}

export function isQuotationHighlightFieldChanged(
  field: QuotationHighlightField,
  changed: Set<QuotationHighlightField>,
): boolean {
  return changed.has(field);
}
