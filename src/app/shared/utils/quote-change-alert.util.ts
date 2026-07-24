import {
  Inquiry,
  InquiryDistributor,
  InquiryFinalizationSnapshot,
  InquiryFinalizationSnapshotLine,
  InquiryItem,
} from '../../core/models/inquiry.model';

export interface QuoteChangeAlert {
  itemKey: string;
  productName: string;
  productBrand?: string;
  reasons: string[];
  distributorNames: string[];
  previousSummary?: string;
  currentSummary?: string;
}

export interface QuoteChangeContext {
  itemKey: string;
  item: InquiryItem;
  offers: ProductOfferForChange[];
}

export interface ProductOfferForChange {
  companyId: string;
  companyName: string;
  responseReceived: boolean;
  unavailable: boolean;
  amount: number | null;
}

function distributorAmountExclGst(
  mrp: number | null | undefined,
  discountPercentage: number | null | undefined,
  quantity: number,
): number | null {
  if (mrp == null || quantity <= 0) {
    return null;
  }
  const discount = discountPercentage ?? 0;
  return mrp * (1 - discount / 100) * quantity;
}

function snapshotLineAmount(line: InquiryFinalizationSnapshotLine): number | null {
  return distributorAmountExclGst(line.distributorMrp, line.distributorDiscountPercentage, line.quantity);
}

function formatAmount(value: number | null | undefined): string {
  return value == null ? '—' : `₹${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function parseSentAtMs(sentAt?: string): number | null {
  if (!sentAt) {
    return null;
  }
  const parsed = new Date(sentAt).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function distributorRespondedAfter(distributor: InquiryDistributor, sentAtMs: number): boolean {
  if (!distributor.responseReceivedAt) {
    return false;
  }
  const at = new Date(distributor.responseReceivedAt).getTime();
  return !Number.isNaN(at) && at > sentAtMs;
}

export function buildQuoteChangeAlerts(
  latestFinalization: InquiryFinalizationSnapshot | null | undefined,
  sections: QuoteChangeContext[],
  distributors: InquiryDistributor[],
): QuoteChangeAlert[] {
  const sentAtMs = parseSentAtMs(latestFinalization?.sentAt);
  if (sentAtMs == null || !latestFinalization?.items?.length) {
    return [];
  }

  const snapshotByItemId = new Map<string, InquiryFinalizationSnapshotLine>();
  for (const line of latestFinalization.items) {
    if (line.inquiryItemId) {
      snapshotByItemId.set(line.inquiryItemId, line);
    }
  }

  const alerts: QuoteChangeAlert[] = [];

  for (const section of sections) {
    const itemId = section.item.id;
    if (!itemId) {
      continue;
    }
    const snapshotLine = snapshotByItemId.get(itemId);
    if (!snapshotLine) {
      continue;
    }

    const reasons = new Set<string>();
    const distributorNames = new Set<string>();
    const quotedOffers = section.offers.filter(
      (offer) => offer.responseReceived && offer.amount != null && !offer.unavailable,
    );

    if (snapshotLine.adminAvailable === false && quotedOffers.length > 0) {
      reasons.add('New quotes available since the last finalization');
    }

    for (const offer of section.offers) {
      if (!offer.responseReceived || offer.unavailable) {
        continue;
      }
      const distributor = distributors.find((entry) => entry.companyId === offer.companyId);
      if (!distributor || !distributorRespondedAfter(distributor, sentAtMs)) {
        continue;
      }
      distributorNames.add(distributor.companyName?.trim() || offer.companyName || 'Distributor');
      if (distributor.requotationRequested) {
        reasons.add('Re-quotation received with updated pricing');
      } else {
        reasons.add('New or updated distributor quote received');
      }
    }

    const snapshotAmount = snapshotLineAmount(snapshotLine);
    const bestOffer = quotedOffers.reduce<ProductOfferForChange | null>((best, offer) => {
      if (offer.amount == null) {
        return best;
      }
      if (!best?.amount || offer.amount < best.amount) {
        return offer;
      }
      return best;
    }, null);

    if (snapshotAmount != null && bestOffer?.amount != null && bestOffer.amount < snapshotAmount - 0.01) {
      reasons.add('A lower price is now available');
    }

    if (reasons.size === 0) {
      continue;
    }

    alerts.push({
      itemKey: section.itemKey,
      productName: section.item.productName?.trim() || 'Product',
      productBrand: section.item.productBrand?.trim(),
      reasons: [...reasons],
      distributorNames: [...distributorNames],
      previousSummary:
        snapshotLine.adminAvailable === false
          ? 'Unavailable in last finalization'
          : formatAmount(snapshotAmount),
      currentSummary: bestOffer ? formatAmount(bestOffer.amount) : undefined,
    });
  }

  return alerts;
}

export function productNeedsQuoteAction(
  itemKey: string,
  alerts: QuoteChangeAlert[],
): boolean {
  return alerts.some((alert) => alert.itemKey === itemKey);
}

export function distributorNeedsQuoteAction(
  companyId: string,
  latestFinalization: InquiryFinalizationSnapshot | null | undefined,
  distributors: InquiryDistributor[],
): boolean {
  const sentAtMs = parseSentAtMs(latestFinalization?.sentAt);
  if (sentAtMs == null) {
    return false;
  }
  const distributor = distributors.find((entry) => entry.companyId === companyId);
  return distributor != null && distributorRespondedAfter(distributor, sentAtMs);
}

export function quoteChangeDismissKey(inquiry: Inquiry, latestFinalization: InquiryFinalizationSnapshot): string {
  return `quote-change-dismissed:${inquiry.id}:${latestFinalization.revisionNumber}:${latestFinalization.sentAt ?? ''}`;
}
