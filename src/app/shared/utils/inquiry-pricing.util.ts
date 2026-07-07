import { InquiryItem } from '../../core/models/inquiry.model';

export interface QuotationLinePricing {
  mrp: number | null;
  discountPercentage: number;
  gstPercentage: number;
  quantity: number;
  amount: number | null;
  netValue: number | null;
  ourDeliveryDate?: string;
}

export function quotationLinePricingFromDistributor(item: InquiryItem): QuotationLinePricing {
  const mrp = item.distributorMrp ?? null;
  const discountPercentage = item.distributorDiscountPercentage ?? 0;
  const gstPercentage = item.distributorGstPercentage ?? 0;
  const quantity = item.quantity ?? 0;

  if (mrp == null) {
    return {
      mrp: null,
      discountPercentage,
      gstPercentage,
      quantity,
      amount: null,
      netValue: null,
      ourDeliveryDate: item.distributorOurDeliveryDate,
    };
  }

  const unitAfterDiscount = mrp * (1 - discountPercentage / 100);
  const amount = unitAfterDiscount * quantity;
  const netValue = amount * (1 + gstPercentage / 100);

  return {
    mrp,
    discountPercentage,
    gstPercentage,
    quantity,
    amount,
    netValue,
    ourDeliveryDate: item.distributorOurDeliveryDate,
  };
}

export function quotationLinePricingFromAdmin(item: InquiryItem): QuotationLinePricing {
  const mrp = item.adminMrp ?? null;
  const discountPercentage = item.adminDiscountPercentage ?? 0;
  const gstPercentage = item.adminGstPercentage ?? 0;
  const quantity = item.quantity ?? 0;

  if (mrp == null) {
    return {
      mrp: null,
      discountPercentage,
      gstPercentage,
      quantity,
      amount: null,
      netValue: null,
    };
  }

  const unitAfterDiscount = mrp * (1 - discountPercentage / 100);
  const amount = unitAfterDiscount * quantity;
  const netValue = amount * (1 + gstPercentage / 100);

  return {
    mrp,
    discountPercentage,
    gstPercentage,
    quantity,
    amount,
    netValue,
  };
}

export function sumNetValues(items: InquiryItem[], fromDistributor = true): number | null {
  let total = 0;
  let hasValue = false;

  for (const item of items) {
    const pricing = fromDistributor
      ? quotationLinePricingFromDistributor(item)
      : quotationLinePricingFromAdmin(item);
    if (pricing.netValue != null) {
      total += pricing.netValue;
      hasValue = true;
    }
  }

  return hasValue ? total : null;
}

export function sumAmounts(items: InquiryItem[], fromDistributor = true): number | null {
  let total = 0;
  let hasValue = false;

  for (const item of items) {
    const pricing = fromDistributor
      ? quotationLinePricingFromDistributor(item)
      : quotationLinePricingFromAdmin(item);
    if (pricing.amount != null) {
      total += pricing.amount;
      hasValue = true;
    }
  }

  return hasValue ? total : null;
}

export function sumMrpBeforeDiscount(items: InquiryItem[], fromDistributor = true): number | null {
  let total = 0;
  let hasValue = false;

  for (const item of items) {
    const pricing = fromDistributor
      ? quotationLinePricingFromDistributor(item)
      : quotationLinePricingFromAdmin(item);
    if (pricing.mrp != null) {
      total += pricing.mrp * pricing.quantity;
      hasValue = true;
    }
  }

  return hasValue ? total : null;
}

export function earliestDeliveryDate(items: InquiryItem[], fromDistributor = true): string | null {
  const dates = items
    .map((item) => (fromDistributor ? item.distributorOurDeliveryDate : item.expectedDeliveryDate))
    .filter((date): date is string => !!date?.trim());

  if (dates.length === 0) {
    return null;
  }

  return dates.sort()[0];
}

export function latestDeliveryDate(items: InquiryItem[], fromDistributor = true): string | null {
  const dates = items
    .map((item) => (fromDistributor ? item.distributorOurDeliveryDate : item.expectedDeliveryDate))
    .filter((date): date is string => !!date?.trim());

  if (dates.length === 0) {
    return null;
  }

  return dates.sort().at(-1) ?? null;
}

export function averageDiscountPercentage(items: InquiryItem[], fromDistributor = true): number | null {
  let weightedSum = 0;
  let weightTotal = 0;

  for (const item of items) {
    const pricing = fromDistributor
      ? quotationLinePricingFromDistributor(item)
      : quotationLinePricingFromAdmin(item);
    if (pricing.mrp == null || pricing.quantity <= 0) {
      continue;
    }
    const weight = pricing.mrp * pricing.quantity;
    weightedSum += pricing.discountPercentage * weight;
    weightTotal += weight;
  }

  return weightTotal > 0 ? weightedSum / weightTotal : null;
}
