import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Inquiry, InquiryDistributor, InquiryItem } from '../../../core/models/inquiry.model';
import { InquiryService } from '../../../core/services/inquiry/inquiry.service';
import { formatExpectedDeliveryDate } from '../../../shared/utils/inquiry-display.util';
import { quotationLinePricingFromDistributor } from '../../../shared/utils/inquiry-pricing.util';

export interface FinalizeLineDraft {
  hsnCode?: string;
  mrp?: number;
  distributorDiscountPercentage?: number;
  ourDiscountPercentage?: number;
  gstPercentage?: number;
  deliveryDate?: string;
}

@Component({
  selector: 'app-finalize-quotation-modal',
  imports: [FormsModule],
  templateUrl: './finalize-quotation-modal.component.html',
  styleUrl: './finalize-quotation-modal.component.css',
})
export class FinalizeQuotationModalComponent {
  private readonly inquiryService = inject(InquiryService);

  readonly open = input(false);
  readonly inquiry = input<Inquiry | null>(null);
  readonly distributor = input<InquiryDistributor | null>(null);
  readonly quotationItems = input<InquiryItem[]>([]);

  readonly closed = output<void>();
  readonly finalized = output<void>();

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly consumerMessage = signal('');
  readonly lineDrafts = signal<Map<string, FinalizeLineDraft>>(new Map());

  readonly formatExpectedDeliveryDate = formatExpectedDeliveryDate;

  readonly items = computed(() => this.quotationItems().filter((item) => item.distributorMrp != null));

  readonly grandTotalNetValue = computed(() => {
    const inquiry = this.inquiry();
    if (!inquiry) {
      return null;
    }
    let total = 0;
    let hasValue = false;
    for (const item of this.items()) {
      const net = this.lineNetValue(inquiry.id, item);
      if (net != null) {
        total += net;
        hasValue = true;
      }
    }
    return hasValue ? total : null;
  });

  readonly distributorGrandTotal = computed(() => {
    let total = 0;
    let hasValue = false;
    for (const item of this.items()) {
      const pricing = quotationLinePricingFromDistributor(item);
      if (pricing.netValue != null) {
        total += pricing.netValue;
        hasValue = true;
      }
    }
    return hasValue ? total : null;
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.initializeDrafts();
        this.errorMessage.set(null);
      }
    });
  }

  close(): void {
    this.closed.emit();
  }

  getLineDraft(inquiryId: string, item: InquiryItem): FinalizeLineDraft {
    return this.lineDrafts().get(this.lineDraftKey(inquiryId, item)) ?? {};
  }

  updateOurDiscount(
    inquiryId: string,
    item: InquiryItem,
    value: string | number | null,
  ): void {
    const parsed = this.parseOptionalNumber(value);
    this.patchLineDraft(inquiryId, item, { ourDiscountPercentage: parsed ?? undefined });
  }

  lineAmount(inquiryId: string, item: InquiryItem): number | null {
    const draft = this.getLineDraft(inquiryId, item);
    if (draft.mrp == null) {
      return null;
    }
    const discount = draft.ourDiscountPercentage ?? 0;
    const unitAfterDiscount = draft.mrp * (1 - discount / 100);
    return unitAfterDiscount * item.quantity;
  }

  lineNetValue(inquiryId: string, item: InquiryItem): number | null {
    const amount = this.lineAmount(inquiryId, item);
    if (amount == null) {
      return null;
    }
    const gst = this.getLineDraft(inquiryId, item).gstPercentage ?? 0;
    return amount * (1 + gst / 100);
  }

  distributorLineNetValue(item: InquiryItem): number | null {
    return quotationLinePricingFromDistributor(item).netValue;
  }

  formatCurrency(value: number | null | undefined): string {
    return value == null ? '—' : `₹${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  formatPercent(value: number | null | undefined): string {
    return value == null
      ? '—'
      : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
  }

  displayProductField(value?: string): string {
    const trimmed = value?.trim();
    return trimmed ? trimmed : '—';
  }

  sendToConsumer(): void {
    const inquiry = this.inquiry();
    const distributor = this.distributor();
    if (!inquiry || !distributor) {
      return;
    }

    const linePricing = this.items()
      .filter((item) => item.id)
      .map((item) => {
        const draft = this.getLineDraft(inquiry.id, item);
        if (draft.mrp == null) {
          return null;
        }
        return {
          inquiryItemId: item.id!,
          hsnCode: draft.hsnCode,
          mrp: draft.mrp,
          discountPercentage: draft.ourDiscountPercentage ?? 0,
          gstPercentage: draft.gstPercentage,
        };
      })
      .filter((line): line is NonNullable<typeof line> => line != null);

    if (linePricing.length === 0) {
      this.errorMessage.set('No priced lines available to send to the consumer.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.inquiryService
      .finalizeQuotation(inquiry.id, {
        distributorCompanyId: distributor.companyId,
        linePricing,
        message: this.consumerMessage().trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.finalized.emit();
          this.close();
        },
        error: (err) => {
          this.loading.set(false);
          this.errorMessage.set(err?.error?.message ?? 'Could not send the final quotation to the consumer.');
        },
      });
  }

  private initializeDrafts(): void {
    const inquiry = this.inquiry();
    if (!inquiry) {
      this.lineDrafts.set(new Map());
      return;
    }

    const next = new Map<string, FinalizeLineDraft>();
    for (const item of this.quotationItems()) {
      if (item.distributorMrp == null) {
        continue;
      }
      next.set(this.lineDraftKey(inquiry.id, item), {
        hsnCode: item.distributorHsnCode,
        mrp: item.distributorMrp,
        distributorDiscountPercentage: item.distributorDiscountPercentage,
        ourDiscountPercentage:
          item.adminDiscountPercentage ?? item.distributorDiscountPercentage ?? 0,
        gstPercentage: item.distributorGstPercentage,
        deliveryDate: item.distributorOurDeliveryDate,
      });
    }
    this.lineDrafts.set(next);
    this.consumerMessage.set('');
  }

  private lineDraftKey(inquiryId: string, item: InquiryItem): string {
    return `${inquiryId}:${item.id ?? item.productId}`;
  }

  private patchLineDraft(
    inquiryId: string,
    item: InquiryItem,
    patch: Partial<FinalizeLineDraft>,
  ): void {
    const key = this.lineDraftKey(inquiryId, item);
    this.lineDrafts.update((drafts) => {
      const next = new Map(drafts);
      next.set(key, { ...(next.get(key) ?? {}), ...patch });
      return next;
    });
  }

  private parseOptionalNumber(value: string | number | null | undefined): number | null {
    if (value === '' || value == null) {
      return null;
    }
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
