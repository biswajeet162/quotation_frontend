import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Inquiry, InquiryDistributor, InquiryItem } from '../../../core/models/inquiry.model';
import { InquiryService } from '../../../core/services/inquiry/inquiry.service';
import { formatExpectedDeliveryDate } from '../../../shared/utils/inquiry-display.util';
import { quotationLinePricingFromDistributor } from '../../../shared/utils/inquiry-pricing.util';
import {
  isBestRankedOffer,
  rankProductOffers,
  RankableProductOffer,
} from '../../../shared/utils/product-offer-ranking.util';

export interface ProductMatrixOffer {
  companyId: string;
  companyName: string;
  amount: number | null;
  mrp: number | null;
  discountPercentage: number;
  deliveryDate?: string;
  isBestAmount: boolean;
}

export interface ProductMatrixRow {
  itemKey: string;
  productName: string;
  productBrand?: string;
  quantity: number;
  offers: ProductMatrixOffer[];
  /** Always the lowest amount offer for this product. */
  pick: ProductMatrixOffer | null;
}

@Component({
  selector: 'app-quotation-comparison-modal',
  templateUrl: './quotation-comparison-modal.component.html',
  styleUrl: './quotation-comparison-modal.component.css',
})
export class QuotationComparisonModalComponent {
  private readonly inquiryService = inject(InquiryService);

  readonly open = input(false);
  readonly inquiry = input<Inquiry | null>(null);
  /** Kept for parent wiring; pick column always uses lowest amount. */
  readonly productSelections = input<Map<string, string>>(new Map());
  readonly quotesByDistributorInput = input<Map<string, InquiryItem[]>>(new Map(), {
    alias: 'quotesByDistributor',
  });

  readonly closed = output<void>();
  readonly distributorSelected = output<string>();

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly quotesByDistributor = signal<Map<string, InquiryItem[]>>(new Map());

  readonly quotes = computed(() => {
    const fromParent = this.quotesByDistributorInput();
    if (fromParent.size > 0) {
      return fromParent;
    }
    return this.quotesByDistributor();
  });

  readonly respondedDistributors = computed(() => {
    const distributors = this.inquiry()?.distributors ?? [];
    const quotes = this.quotes();
    return [...distributors]
      .filter((distributor) => {
        if (distributor.responseReceived) {
          return true;
        }
        const items = quotes.get(distributor.companyId) ?? [];
        return items.some((item) => quotationLinePricingFromDistributor(item).amount != null);
      })
      .sort((a, b) =>
        (a.companyName ?? '').localeCompare(b.companyName ?? '', undefined, { sensitivity: 'base' }),
      );
  });

  readonly productMatrix = computed((): ProductMatrixRow[] => {
    const items = this.inquiry()?.items ?? [];
    const distributors = this.respondedDistributors();
    const quotes = this.quotes();
    if (items.length === 0 || distributors.length === 0) {
      return [];
    }

    return items.map((item) => {
      const itemKey = item.id ?? item.productId;
      const offers: ProductMatrixOffer[] = [];

      for (const distributor of distributors) {
        const quoteItem = (quotes.get(distributor.companyId) ?? []).find(
          (line) => (line.id ?? line.productId) === itemKey,
        );
        if (!quoteItem) {
          continue;
        }
        const pricing = quotationLinePricingFromDistributor(quoteItem);
        if (pricing.amount == null) {
          continue;
        }
        offers.push({
          companyId: distributor.companyId,
          companyName: distributor.companyName?.trim() || 'Distributor',
          amount: pricing.amount,
          mrp: pricing.mrp,
          discountPercentage: pricing.discountPercentage,
          deliveryDate: pricing.ourDeliveryDate,
          isBestAmount: false,
        });
      }

      const rank = rankProductOffers(
        offers.map(
          (offer): RankableProductOffer => ({
            companyId: offer.companyId,
            amount: offer.amount,
            deliveryDate: offer.deliveryDate,
            responseReceived: true,
          }),
        ),
      );

      const marked = offers.map((offer) => ({
        ...offer,
        isBestAmount: isBestRankedOffer(offer.companyId, rank),
      }));

      const pick = marked.find((offer) => offer.isBestAmount) ?? null;

      return {
        itemKey,
        productName: item.productName?.trim() || '—',
        productBrand: item.productBrand?.trim(),
        quantity: item.quantity,
        offers: marked,
        pick,
      };
    });
  });

  readonly pickTotal = computed(() => {
    let total = 0;
    let hasValue = false;
    for (const row of this.productMatrix()) {
      if (row.pick?.amount != null) {
        total += row.pick.amount;
        hasValue = true;
      }
    }
    return hasValue ? total : null;
  });

  readonly formatExpectedDeliveryDate = formatExpectedDeliveryDate;

  constructor() {
    effect(() => {
      if (!this.open() || !this.inquiry()) {
        return;
      }
      if (this.quotesByDistributorInput().size > 0) {
        this.loading.set(false);
        this.errorMessage.set(null);
        return;
      }
      this.loadComparisonData();
    });
  }

  close(): void {
    this.closed.emit();
  }

  distributorLabel(distributor: InquiryDistributor): string {
    return distributor.companyName ?? 'Distributor';
  }

  getMatrixOffer(row: ProductMatrixRow, companyId: string): ProductMatrixOffer | null {
    return row.offers.find((offer) => offer.companyId === companyId) ?? null;
  }

  formatCurrency(value: number | null | undefined): string {
    return value == null
      ? '—'
      : `₹${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  formatPercent(value: number | null | undefined): string {
    return value == null
      ? '—'
      : `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  }

  private loadComparisonData(): void {
    const inquiry = this.inquiry();
    const distributors = inquiry?.distributors ?? [];
    if (!inquiry || distributors.length === 0) {
      this.quotesByDistributor.set(new Map());
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const requests = distributors.map((distributor) =>
      this.inquiryService.getDistributorQuotationItems(inquiry.id, distributor.companyId).pipe(
        catchError(() => of([] as InquiryItem[])),
      ),
    );

    forkJoin(requests).subscribe({
      next: (results) => {
        const map = new Map<string, InquiryItem[]>();
        distributors.forEach((distributor, index) => {
          map.set(distributor.companyId, results[index] ?? []);
        });
        this.quotesByDistributor.set(map);
        this.loading.set(false);
      },
      error: () => {
        this.quotesByDistributor.set(new Map());
        this.loading.set(false);
        this.errorMessage.set('Could not load distributor quotations for comparison.');
      },
    });
  }
}
