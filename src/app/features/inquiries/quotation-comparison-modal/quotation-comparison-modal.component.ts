import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  Inquiry,
  InquiryDistributor,
  InquiryItem,
  InquiryItemAttachment,
} from '../../../core/models/inquiry.model';
import { InquiryService } from '../../../core/services/inquiry/inquiry.service';
import { formatExpectedDeliveryDate } from '../../../shared/utils/inquiry-display.util';
import { quotationLinePricingFromDistributor } from '../../../shared/utils/inquiry-pricing.util';
import {
  isBestRankedOffer,
  rankProductOffers,
  RankableProductOffer,
} from '../../../shared/utils/product-offer-ranking.util';
import { openPublicImages } from '../../../shared/utils/public-image.util';

export interface ProductMatrixOffer {
  companyId: string;
  companyName: string;
  amount: number | null;
  mrp: number | null;
  discountPercentage: number;
  gstPercentage: number;
  hsnCode?: string;
  deliveryDate?: string;
  isBestAmount: boolean;
}

export interface ProductMatrixRow {
  itemKey: string;
  item: InquiryItem;
  productName: string;
  productBrand?: string;
  productDescription?: string;
  quantity: number;
  expectedDeliveryDate?: string;
  attachments: InquiryItemAttachment[];
  offers: ProductMatrixOffer[];
  bestCompanyId: string | null;
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
  readonly productSelections = input<Map<string, string>>(new Map());
  readonly quotesByDistributorInput = input<Map<string, InquiryItem[]>>(new Map(), {
    alias: 'quotesByDistributor',
  });

  readonly closed = output<void>();
  readonly selectionsChange = output<Map<string, string>>();
  /** Emitted when user clicks Finalize with a complete mix. */
  readonly finalizeRequested = output<Map<string, string>>();

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly quotesByDistributor = signal<Map<string, InquiryItem[]>>(new Map());
  /** Local picks inside the modal (itemKey → companyId). */
  readonly localSelections = signal<Map<string, string>>(new Map());
  readonly finalizeError = signal<string | null>(null);

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
          gstPercentage: pricing.gstPercentage,
          hsnCode: quoteItem.distributorHsnCode,
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

      const description =
        item.productDescription?.trim() ||
        item.productSpecifications?.trim() ||
        undefined;

      return {
        itemKey,
        item,
        productName: item.productName?.trim() || '—',
        productBrand: item.productBrand?.trim(),
        productDescription: description,
        quantity: item.quantity,
        expectedDeliveryDate: item.expectedDeliveryDate,
        attachments: item.attachments ?? [],
        offers: marked,
        bestCompanyId: rank.bestCompanyId,
      };
    });
  });

  readonly pickTotal = computed(() => {
    let total = 0;
    let hasValue = false;
    for (const row of this.productMatrix()) {
      const pick = this.selectedOfferForRow(row);
      if (pick?.amount != null) {
        total += pick.amount;
        hasValue = true;
      }
    }
    return hasValue ? total : null;
  });

  readonly allProductsPicked = computed(() => {
    const rows = this.productMatrix();
    if (rows.length === 0) {
      return false;
    }
    return rows.every((row) => this.selectedOfferForRow(row) != null);
  });

  readonly formatExpectedDeliveryDate = formatExpectedDeliveryDate;

  constructor() {
    effect(() => {
      if (!this.open() || !this.inquiry()) {
        return;
      }
      this.finalizeError.set(null);
      if (this.quotesByDistributorInput().size > 0) {
        this.loading.set(false);
        this.errorMessage.set(null);
        this.syncLocalSelectionsFromSources();
        return;
      }
      this.loadComparisonData();
    });

    effect(() => {
      const rows = this.productMatrix();
      if (!this.open() || rows.length === 0) {
        return;
      }
      this.ensureDefaultPicks(rows);
    });
  }

  close(): void {
    this.closed.emit();
  }

  selectOffer(row: ProductMatrixRow, companyId: string): void {
    if (!row.offers.some((offer) => offer.companyId === companyId)) {
      return;
    }
    this.localSelections.update((current) => {
      const next = new Map(current);
      next.set(row.itemKey, companyId);
      return next;
    });
    this.selectionsChange.emit(new Map(this.localSelections()));
  }

  isSelected(row: ProductMatrixRow, companyId: string): boolean {
    return this.localSelections().get(row.itemKey) === companyId;
  }

  selectedOfferForRow(row: ProductMatrixRow): ProductMatrixOffer | null {
    const companyId = this.localSelections().get(row.itemKey);
    if (!companyId) {
      return null;
    }
    return row.offers.find((offer) => offer.companyId === companyId) ?? null;
  }

  requestFinalize(): void {
    if (!this.allProductsPicked()) {
      this.finalizeError.set('Pick an offer for every product before finalizing.');
      return;
    }
    this.finalizeError.set(null);
    const selections = new Map(this.localSelections());
    this.selectionsChange.emit(selections);
    this.finalizeRequested.emit(selections);
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

  displayProductField(value?: string): string {
    const trimmed = value?.trim();
    return trimmed ? trimmed : '—';
  }

  itemAttachmentCount(attachments: InquiryItemAttachment[]): number {
    return attachments?.length ?? 0;
  }

  openItemAttachments(attachments: InquiryItemAttachment[], event?: Event): void {
    event?.stopPropagation();
    const firstId = attachments?.[0]?.id;
    if (firstId) {
      openPublicImages(firstId);
    }
  }

  private syncLocalSelectionsFromSources(): void {
    const rows = this.productMatrix();
    if (rows.length === 0) {
      return;
    }
    this.ensureDefaultPicks(rows);
  }

  private ensureDefaultPicks(rows: ProductMatrixRow[]): void {
    const parent = this.productSelections();
    const current = this.localSelections();
    let changed = false;
    const next = new Map(current);

    for (const row of rows) {
      if (row.offers.length === 0) {
        continue;
      }
      const existing = next.get(row.itemKey);
      if (existing && row.offers.some((offer) => offer.companyId === existing)) {
        continue;
      }
      const fromParent = parent.get(row.itemKey);
      if (fromParent && row.offers.some((offer) => offer.companyId === fromParent)) {
        next.set(row.itemKey, fromParent);
        changed = true;
        continue;
      }
      if (row.bestCompanyId) {
        next.set(row.itemKey, row.bestCompanyId);
        changed = true;
      }
    }

    if (changed || next.size !== current.size) {
      this.localSelections.set(next);
    }
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
        this.syncLocalSelectionsFromSources();
      },
      error: () => {
        this.quotesByDistributor.set(new Map());
        this.loading.set(false);
        this.errorMessage.set('Could not load distributor quotations for comparison.');
      },
    });
  }
}
