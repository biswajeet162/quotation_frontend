import { InquiryItem } from '../../core/models/inquiry.model';
import { quotationLinePricingFromDistributor } from './inquiry-pricing.util';

/**
 * Product-offer ranking policy (admin "By products" mix).
 *
 * Keep selection rules here so UI stays dumb and future policies
 * (delivery date, hybrid price+delivery, margin, etc.) can land in one place.
 */

export interface RankableProductOffer {
  companyId: string;
  netValue: number | null;
  deliveryDate?: string | null;
  responseReceived: boolean;
}

export interface ProductOfferRankResult {
  /** Winner under the current policy, or null when nobody has a usable quote. */
  bestCompanyId: string | null;
  /** Quoted company ids sorted best → worst (awaiting excluded). */
  rankedCompanyIds: string[];
}

/**
 * Current default policy: lowest net value wins among responded quotes.
 * Ties: earliest delivery date, then stable companyId order.
 */
export function rankProductOffers(offers: RankableProductOffer[]): ProductOfferRankResult {
  const quoted = offers.filter(
    (offer) => offer.responseReceived && offer.netValue != null,
  );

  if (quoted.length === 0) {
    return { bestCompanyId: null, rankedCompanyIds: [] };
  }

  const ranked = [...quoted].sort((left, right) => {
    const netDiff = (left.netValue as number) - (right.netValue as number);
    if (netDiff !== 0) {
      return netDiff;
    }

    const leftDate = normalizeDateKey(left.deliveryDate);
    const rightDate = normalizeDateKey(right.deliveryDate);
    if (leftDate != null && rightDate != null && leftDate !== rightDate) {
      return leftDate.localeCompare(rightDate);
    }
    if (leftDate != null && rightDate == null) {
      return -1;
    }
    if (leftDate == null && rightDate != null) {
      return 1;
    }

    return left.companyId.localeCompare(right.companyId);
  });

  return {
    bestCompanyId: ranked[0]?.companyId ?? null,
    rankedCompanyIds: ranked.map((offer) => offer.companyId),
  };
}

export function isBestRankedOffer(
  companyId: string,
  rank: ProductOfferRankResult,
): boolean {
  return rank.bestCompanyId != null && rank.bestCompanyId === companyId;
}

/** Build a rankable snapshot from a distributor quotation line item. */
export function toRankableOfferFromQuoteItem(
  companyId: string,
  quoteItem: InquiryItem,
  responseReceived: boolean,
): RankableProductOffer {
  const pricing = quotationLinePricingFromDistributor(quoteItem);
  return {
    companyId,
    netValue: pricing.netValue,
    deliveryDate: pricing.ourDeliveryDate ?? null,
    responseReceived: responseReceived && pricing.mrp != null,
  };
}

function normalizeDateKey(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }
  return parsed.toISOString().slice(0, 10);
}
