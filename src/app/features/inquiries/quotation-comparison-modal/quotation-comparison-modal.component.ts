import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Inquiry, InquiryDistributor, InquiryItem } from '../../../core/models/inquiry.model';
import { InquiryService } from '../../../core/services/inquiry/inquiry.service';
import { formatExpectedDeliveryDate } from '../../../shared/utils/inquiry-display.util';
import {
  averageDiscountPercentage,
  earliestDeliveryDate,
  latestDeliveryDate,
  quotationLinePricingFromAdmin,
  quotationLinePricingFromDistributor,
  sumAmounts,
  sumMrpBeforeDiscount,
  sumNetValues,
} from '../../../shared/utils/inquiry-pricing.util';

export interface DistributorComparisonSummary {
  distributor: InquiryDistributor;
  items: InquiryItem[];
  totalNetValue: number | null;
  totalAmount: number | null;
  totalMrp: number | null;
  savingsVsMrp: number | null;
  savingsVsAdmin: number | null;
  avgDiscount: number | null;
  earliestDelivery: string | null;
  latestDelivery: string | null;
  isBestPrice: boolean;
  isFastestDelivery: boolean;
}

export interface ProductComparisonRow {
  itemKey: string;
  productName: string;
  productBrand?: string;
  quantity: number;
  expectedDeliveryDate?: string;
  adminNetValue: number | null;
  quotes: {
    companyId: string;
    netValue: number | null;
    amount: number | null;
    mrp: number | null;
    discountPercentage: number;
    deliveryDate?: string;
    isBestPrice: boolean;
  }[];
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

  readonly closed = output<void>();
  readonly distributorSelected = output<string>();

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly quotesByDistributor = signal<Map<string, InquiryItem[]>>(new Map());
  readonly highlightedCompanyId = signal<string | null>(null);

  readonly respondedDistributors = computed(() => {
    const distributors = this.inquiry()?.distributors ?? [];
    return [...distributors]
      .filter((distributor) => distributor.responseReceived)
      .sort((a, b) =>
        (a.companyName ?? '').localeCompare(b.companyName ?? '', undefined, { sensitivity: 'base' }),
      );
  });

  readonly adminBaselineItems = computed(() => this.inquiry()?.items ?? []);

  readonly adminTotalNetValue = computed(() => sumNetValues(this.adminBaselineItems(), false));

  readonly distributorSummaries = computed((): DistributorComparisonSummary[] => {
    const quotes = this.quotesByDistributor();
    const adminTotal = this.adminTotalNetValue();

    const summaries = this.respondedDistributors().map((distributor) => {
      const items = quotes.get(distributor.companyId) ?? [];
      const totalNetValue = sumNetValues(items, true);
      const totalAmount = sumAmounts(items, true);
      const totalMrp = sumMrpBeforeDiscount(items, true);
      const savingsVsMrp =
        totalMrp != null && totalAmount != null ? totalMrp - totalAmount : null;
      const savingsVsAdmin =
        adminTotal != null && totalNetValue != null ? adminTotal - totalNetValue : null;

      return {
        distributor,
        items,
        totalNetValue,
        totalAmount,
        totalMrp,
        savingsVsMrp,
        savingsVsAdmin,
        avgDiscount: averageDiscountPercentage(items, true),
        earliestDelivery: earliestDeliveryDate(items, true),
        latestDelivery: latestDeliveryDate(items, true),
        isBestPrice: false,
        isFastestDelivery: false,
      };
    });

    const priceValues = summaries
      .map((summary) => summary.totalNetValue)
      .filter((value): value is number => value != null);
    const minPrice = priceValues.length > 0 ? Math.min(...priceValues) : null;

    const deliveryValues = summaries
      .map((summary) => summary.latestDelivery)
      .filter((value): value is string => !!value);
    const fastestDelivery = deliveryValues.length > 0 ? deliveryValues.sort()[0] : null;

    return summaries.map((summary) => ({
      ...summary,
      isBestPrice: minPrice != null && summary.totalNetValue === minPrice,
      isFastestDelivery:
        fastestDelivery != null && summary.latestDelivery === fastestDelivery,
    }));
  });

  readonly productRows = computed((): ProductComparisonRow[] => {
    const baselineItems = this.adminBaselineItems();
    const summaries = this.distributorSummaries();
    if (baselineItems.length === 0 || summaries.length === 0) {
      return [];
    }

    return baselineItems.map((item) => {
      const itemKey = item.id ?? item.productId;
      const adminPricing = quotationLinePricingFromAdmin(item);
      const quotes = summaries.map((summary) => {
        const quoteItem =
          summary.items.find((line) => (line.id ?? line.productId) === itemKey) ?? item;
        const pricing = quotationLinePricingFromDistributor(quoteItem);
        return {
          companyId: summary.distributor.companyId,
          netValue: pricing.netValue,
          amount: pricing.amount,
          mrp: pricing.mrp,
          discountPercentage: pricing.discountPercentage,
          deliveryDate: pricing.ourDeliveryDate,
          isBestPrice: false,
        };
      });

      const netValues = quotes
        .map((quote) => quote.netValue)
        .filter((value): value is number => value != null);
      const minNet = netValues.length > 0 ? Math.min(...netValues) : null;

      return {
        itemKey,
        productName: item.productName?.trim() || '—',
        productBrand: item.productBrand?.trim(),
        quantity: item.quantity,
        expectedDeliveryDate: item.expectedDeliveryDate,
        adminNetValue: adminPricing.netValue,
        quotes: quotes.map((quote) => ({
          ...quote,
          isBestPrice: minNet != null && quote.netValue === minNet,
        })),
      };
    });
  });

  readonly formatExpectedDeliveryDate = formatExpectedDeliveryDate;

  constructor() {
    effect(() => {
      if (this.open() && this.inquiry()) {
        this.loadComparisonData();
      }
    });
  }

  close(): void {
    this.closed.emit();
  }

  selectDistributor(companyId: string): void {
    this.highlightedCompanyId.set(companyId);
    this.distributorSelected.emit(companyId);
    this.close();
  }

  distributorLabel(distributor: InquiryDistributor): string {
    return distributor.companyName ?? 'Distributor';
  }

  formatCurrency(value: number | null | undefined): string {
    return value == null ? '—' : `₹${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  formatPercent(value: number | null | undefined): string {
    return value == null
      ? '—'
      : `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  }

  formatSavings(value: number | null | undefined): string {
    if (value == null) {
      return '—';
    }
    const prefix = value > 0 ? 'Save ' : value < 0 ? 'Extra ' : '';
    return `${prefix}${this.formatCurrency(Math.abs(value))}`;
  }

  formatResponseDate(iso?: string): string {
    if (!iso) {
      return '—';
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return iso;
    }
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  getQuoteForRow(row: ProductComparisonRow, companyId: string) {
    return row.quotes.find((quote) => quote.companyId === companyId);
  }

  private loadComparisonData(): void {
    const inquiry = this.inquiry();
    const responded = this.respondedDistributors();
    if (!inquiry || responded.length === 0) {
      this.quotesByDistributor.set(new Map());
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const requests = responded.map((distributor) =>
      this.inquiryService.getDistributorQuotationItems(inquiry.id, distributor.companyId).pipe(
        catchError(() => of([] as InquiryItem[])),
      ),
    );

    forkJoin(requests).subscribe({
      next: (results) => {
        const map = new Map<string, InquiryItem[]>();
        responded.forEach((distributor, index) => {
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
