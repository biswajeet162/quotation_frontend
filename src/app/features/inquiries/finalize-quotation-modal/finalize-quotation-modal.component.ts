import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Inquiry, InquiryDistributor, InquiryItem } from '../../../core/models/inquiry.model';
import { InquiryService } from '../../../core/services/inquiry/inquiry.service';
import { formatExpectedDeliveryDate } from '../../../shared/utils/inquiry-display.util';

export interface FinalizeLineDraft {
  hsnCode?: string;
  distributorMrp?: number;
  distributorDiscountPercentage?: number;
  ourMrp?: number;
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

  readonly distributorGrandTotal = computed(() => {
    const inquiry = this.inquiry();
    if (!inquiry) {
      return null;
    }
    return this.sumNetValues((item) => this.distributorLineNetValue(inquiry.id, item));
  });

  readonly consumerGrandTotal = computed(() => {
    const inquiry = this.inquiry();
    if (!inquiry) {
      return null;
    }
    return this.sumNetValues((item) => this.consumerLineNetValue(inquiry.id, item));
  });

  readonly marginTotal = computed(() => {
    const distributor = this.distributorGrandTotal();
    const consumer = this.consumerGrandTotal();
    if (distributor == null || consumer == null) {
      return null;
    }
    return consumer - distributor;
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

  updateOurMrp(inquiryId: string, item: InquiryItem, value: string | number | null): void {
    const parsed = this.parseOptionalNumber(value);
    this.patchLineDraft(inquiryId, item, { ourMrp: parsed ?? undefined });
  }

  updateOurDiscount(
    inquiryId: string,
    item: InquiryItem,
    value: string | number | null,
  ): void {
    const parsed = this.parseOptionalNumber(value);
    this.patchLineDraft(inquiryId, item, { ourDiscountPercentage: parsed ?? undefined });
  }

  distributorLineAmount(inquiryId: string, item: InquiryItem): number | null {
    const draft = this.getLineDraft(inquiryId, item);
    return this.computeLineAmount(
      draft.distributorMrp,
      draft.distributorDiscountPercentage,
      item.quantity,
    );
  }

  distributorLineNetValue(inquiryId: string, item: InquiryItem): number | null {
    const amount = this.distributorLineAmount(inquiryId, item);
    if (amount == null) {
      return null;
    }
    const gst = this.getLineDraft(inquiryId, item).gstPercentage ?? 0;
    return amount * (1 + gst / 100);
  }

  consumerLineAmount(inquiryId: string, item: InquiryItem): number | null {
    const draft = this.getLineDraft(inquiryId, item);
    return this.computeLineAmount(draft.ourMrp, draft.ourDiscountPercentage, item.quantity);
  }

  consumerLineNetValue(inquiryId: string, item: InquiryItem): number | null {
    const amount = this.consumerLineAmount(inquiryId, item);
    if (amount == null) {
      return null;
    }
    const gst = this.getLineDraft(inquiryId, item).gstPercentage ?? 0;
    return amount * (1 + gst / 100);
  }

  lineMargin(inquiryId: string, item: InquiryItem): number | null {
    const consumer = this.consumerLineNetValue(inquiryId, item);
    const distributor = this.distributorLineNetValue(inquiryId, item);
    if (consumer == null || distributor == null) {
      return null;
    }
    return consumer - distributor;
  }

  formatCurrency(value: number | null | undefined): string {
    return value == null ? '—' : `₹${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  formatSignedCurrency(value: number | null | undefined): string {
    if (value == null) {
      return '—';
    }
    const prefix = value > 0 ? '+' : value < 0 ? '−' : '';
    return `${prefix}${this.formatCurrency(Math.abs(value))}`;
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
        if (draft.ourMrp == null) {
          return null;
        }
        return {
          inquiryItemId: item.id!,
          hsnCode: draft.hsnCode,
          mrp: draft.ourMrp,
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
      const distributorDiscount = item.distributorDiscountPercentage ?? 0;
      next.set(this.lineDraftKey(inquiry.id, item), {
        hsnCode: item.distributorHsnCode,
        distributorMrp: item.distributorMrp,
        distributorDiscountPercentage: distributorDiscount,
        ourMrp: item.distributorMrp,
        ourDiscountPercentage: distributorDiscount,
        gstPercentage: item.distributorGstPercentage,
        deliveryDate: item.distributorOurDeliveryDate,
      });
    }
    this.lineDrafts.set(next);
    this.consumerMessage.set('');
  }

  private computeLineAmount(
    mrp: number | null | undefined,
    discountPercentage: number | null | undefined,
    quantity: number,
  ): number | null {
    if (mrp == null) {
      return null;
    }
    const discount = discountPercentage ?? 0;
    const unitAfterDiscount = mrp * (1 - discount / 100);
    return unitAfterDiscount * quantity;
  }

  private sumNetValues(getter: (item: InquiryItem) => number | null): number | null {
    let total = 0;
    let hasValue = false;
    for (const item of this.items()) {
      const net = getter(item);
      if (net != null) {
        total += net;
        hasValue = true;
      }
    }
    return hasValue ? total : null;
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
