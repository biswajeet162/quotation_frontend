import { Component, input, output } from '@angular/core';
import { InquiryFinalizationSnapshotLine } from '../../../core/models/inquiry.model';
import { DealDoneSealComponent } from '../deal-done-seal/deal-done-seal.component';
import { displayProductField, formatExpectedDeliveryDate } from '../../utils/inquiry-display.util';
import { quotationLinePricingFromDistributor } from '../../utils/inquiry-pricing.util';

function formatCurrency(value: number | null | undefined): string {
  return value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatOptionalNumber(value: number | null | undefined): string {
  return value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatOptionalPercent(value: number | null | undefined): string {
  return value == null ? '—' : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

@Component({
  selector: 'app-confirmed-deal-selection-panel',
  imports: [DealDoneSealComponent],
  templateUrl: './confirmed-deal-selection-panel.component.html',
  styleUrl: './confirmed-deal-selection-panel.component.css',
})
export class ConfirmedDealSelectionPanelComponent {
  readonly included = input.required<boolean>();
  readonly selectedLines = input<InquiryFinalizationSnapshotLine[]>([]);
  readonly totalQuotedCount = input(0);
  readonly pdfFileName = input<string | null>(null);
  readonly pdfAvailable = input(false);
  readonly audience = input<'admin' | 'distributor'>('distributor');

  readonly viewPdf = output<void>();

  selectedCount(): number {
    return this.selectedLines().length;
  }

  dealTitle(): string {
    const selected = this.selectedCount();
    const total = this.totalQuotedCount();
    if (this.audience() === 'admin') {
      return `Final selection — ${selected} product${selected === 1 ? '' : 's'} from this distributor`;
    }
    if (total > 0) {
      return `Deal confirmed — ${selected} of ${total} product${total === 1 ? '' : 's'} selected`;
    }
    return `Deal confirmed — ${selected} product${selected === 1 ? '' : 's'} selected`;
  }

  dealMessage(): string {
    if (this.audience() === 'admin') {
      return 'These products were included in the consumer-confirmed final quotation mix.';
    }
    return 'The customer confirmed this quotation. Your products below are included in the final deal and this request is now closed.';
  }

  noDealTitle(): string {
    return 'Quotation request closed';
  }

  noDealMessage(): string {
    if (this.audience() === 'admin') {
      return 'None of this distributor\'s quoted products were included in the confirmed final deal. This request is closed for them.';
    }
    return 'Sorry — the requirement is fulfilled. None of your quoted products were included in the final deal, and this quotation request is now closed.';
  }

  lineAmount(line: InquiryFinalizationSnapshotLine): number | null {
    return quotationLinePricingFromDistributor(this.lineAsItem(line)).amount;
  }

  lineNetValue(line: InquiryFinalizationSnapshotLine): number | null {
    return quotationLinePricingFromDistributor(this.lineAsItem(line)).netValue;
  }

  protected readonly displayProductField = displayProductField;
  protected readonly formatExpectedDeliveryDate = formatExpectedDeliveryDate;
  protected readonly formatOptionalNumber = formatOptionalNumber;
  protected readonly formatOptionalPercent = formatOptionalPercent;
  protected readonly formatCurrency = formatCurrency;

  private lineAsItem(line: InquiryFinalizationSnapshotLine) {
    return {
      id: line.inquiryItemId,
      productId: line.productId ?? line.inquiryItemId ?? '',
      quantity: line.quantity,
      distributorMrp: line.distributorMrp,
      distributorDiscountPercentage: line.distributorDiscountPercentage,
      distributorGstPercentage: line.distributorGstPercentage,
    };
  }
}
