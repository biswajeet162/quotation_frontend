import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConsumerInquiry, InquiryStatus } from '../../../core/models/inquiry.model';
import { InquiryService } from '../../../core/services/inquiry/inquiry.service';
import {
  getConsumerInquiryDisplay,
  getRequestSourceLabel,
} from '../../../shared/utils/inquiry-display.util';

type StatusFilter = 'all' | InquiryStatus | 'ACTION_REQUIRED';

@Component({
  selector: 'app-inquiry-tracking',
  imports: [FormsModule],
  templateUrl: './inquiry-tracking.component.html',
  styleUrl: './inquiry-tracking.component.css',
})
export class InquiryTrackingComponent implements OnInit {
  private readonly inquiryService = inject(InquiryService);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly inquiries = signal<ConsumerInquiry[]>([]);
  readonly searchQuery = signal('');
  readonly statusFilter = signal<StatusFilter>('all');
  readonly selectedId = signal<string | null>(null);
  readonly deleteLoading = signal(false);
  readonly deleteError = signal<string | null>(null);
  readonly deleteConfirmOpen = signal(false);

  readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All statuses' },
    { value: 'NEW', label: 'New / submitted' },
    { value: 'ACTION_REQUIRED', label: 'Action required' },
    { value: 'SENT_TO_DISTRIBUTORS', label: 'With distributors' },
    { value: 'RESPONSES_RECEIVED', label: 'Responses received' },
    { value: 'FINAL_SENT', label: 'Quotation ready' },
    { value: 'CLOSED', label: 'Closed' },
  ];

  readonly filteredInquiries = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const status = this.statusFilter();

    return this.inquiries().filter((inquiry) => {
      if (status === 'ACTION_REQUIRED') {
        if (!inquiry.needsClarification) {
          return false;
        }
      } else if (status !== 'all' && inquiry.status !== status) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        inquiry.inquiryId,
        inquiry.title,
        inquiry.description,
        inquiry.searchTerm,
        ...(inquiry.items ?? []).flatMap((item) => [
          item.productBrand,
          item.productName,
          item.notes,
        ]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  });

  readonly selectedInquiry = computed(() => {
    const id = this.selectedId();
    if (id == null) {
      return null;
    }
    return this.inquiries().find((q) => q.id === id) ?? null;
  });

  readonly getRequestSourceLabel = getRequestSourceLabel;
  readonly getConsumerInquiryDisplay = getConsumerInquiryDisplay;

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.deleteConfirmOpen()) {
      this.closeDeleteConfirm();
    }
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.inquiryService.getMyInquiries().subscribe({
      next: (list) => {
        this.inquiries.set(list);
        this.loading.set(false);
        const current = this.selectedId();
        const stillVisible =
          current != null && this.filteredInquiries().some((q) => q.id === current);
        if (!stillVisible) {
          const first = this.filteredInquiries()[0];
          this.selectedId.set(first?.id ?? null);
        }
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Could not load your quotation requests.');
      },
    });
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.syncSelection();
  }

  onStatusFilterChange(value: string): void {
    this.statusFilter.set(value as StatusFilter);
    this.syncSelection();
  }

  selectInquiry(id: string): void {
    this.selectedId.set(id);
    this.deleteError.set(null);
  }

  private syncSelection(): void {
    const visible = this.filteredInquiries();
    const current = this.selectedId();
    if (current != null && visible.some((q) => q.id === current)) {
      return;
    }
    this.selectedId.set(visible[0]?.id ?? null);
  }

  canDelete(inquiry: ConsumerInquiry): boolean {
    return inquiry.status === 'NEW';
  }

  openDeleteConfirm(): void {
    const inquiry = this.selectedInquiry();
    if (!inquiry || !this.canDelete(inquiry)) {
      return;
    }
    this.deleteError.set(null);
    this.deleteConfirmOpen.set(true);
  }

  closeDeleteConfirm(): void {
    if (this.deleteLoading()) {
      return;
    }
    this.deleteConfirmOpen.set(false);
  }

  confirmDelete(): void {
    const inquiry = this.selectedInquiry();
    if (!inquiry || !this.canDelete(inquiry)) {
      this.closeDeleteConfirm();
      return;
    }

    this.deleteLoading.set(true);
    this.deleteError.set(null);

    this.inquiryService.delete(inquiry.id).subscribe({
      next: () => {
        this.inquiries.update((list) => list.filter((q) => q.id !== inquiry.id));
        const first = this.filteredInquiries()[0];
        this.selectedId.set(first?.id ?? null);
        this.deleteLoading.set(false);
        this.deleteConfirmOpen.set(false);
      },
      error: (err) => {
        this.deleteLoading.set(false);
        this.deleteError.set(
          err?.error?.message ??
            'Could not delete this request. Only new requests that have not been sent onward can be removed.',
        );
        this.deleteConfirmOpen.set(false);
      },
    });
  }

  productLineCount(inquiry: ConsumerInquiry): number {
    return inquiry.items?.length ?? 0;
  }

  lineSourceLabel(lineSource?: string): string {
    return lineSource === 'NEW_PRODUCT' ? 'New product from search' : 'Catalog match';
  }

  formatDate(iso?: string): string {
    if (!iso) {
      return '—';
    }
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
  }
}
