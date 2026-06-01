import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Inquiry } from '../../../core/models/inquiry.model';
import { InquiryService } from '../../../core/services/inquiry/inquiry.service';
import {
  getRequestSourceLabel,
} from '../../../shared/utils/inquiry-display.util';

type AdminFilter = 'all' | 'pending' | 'clarification' | 'sent';

@Component({
  selector: 'app-admin-query-review',
  imports: [FormsModule],
  templateUrl: './admin-query-review.component.html',
  styleUrl: './admin-query-review.component.css',
})
export class AdminQueryReviewComponent {
  private readonly inquiryService = inject(InquiryService);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly inquiries = signal<Inquiry[]>([]);
  readonly activeFilter = signal<AdminFilter>('pending');
  readonly selectedId = signal<number | null>(null);
  readonly actionLoading = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly clarificationText = signal('');

  readonly filteredInquiries = computed(() => {
    const list = this.inquiries();
    const filter = this.activeFilter();

    switch (filter) {
      case 'pending':
        return list.filter((q) => q.status === 'NEW' && !q.needsClarification);
      case 'clarification':
        return list.filter((q) => q.needsClarification);
      case 'sent':
        return list.filter((q) => q.status === 'SENT_TO_DISTRIBUTORS' || q.status === 'RESPONSES_RECEIVED');
      default:
        return list;
    }
  });

  readonly selectedInquiry = computed(() => {
    const id = this.selectedId();
    if (id == null) {
      return null;
    }
    return this.inquiries().find((q) => q.id === id) ?? null;
  });

  readonly getRequestSourceLabel = getRequestSourceLabel;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.inquiryService.getAll().subscribe({
      next: (list) => {
        this.inquiries.set(list);
        this.loading.set(false);
        if (this.selectedId() == null && list.length > 0) {
          const first = this.filteredInquiries()[0];
          if (first) {
            this.selectInquiry(first.id);
          }
        }
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Could not load consumer queries.');
      },
    });
  }

  setFilter(filter: AdminFilter): void {
    this.activeFilter.set(filter);
    const first = this.filteredInquiries()[0];
    this.selectedId.set(first?.id ?? null);
  }

  selectInquiry(id: number): void {
    this.selectedId.set(id);
    this.actionError.set(null);
    const inquiry = this.inquiries().find((q) => q.id === id);
    this.clarificationText.set(inquiry?.clarificationMessage ?? '');
  }

  sendToDistributors(): void {
    const inquiry = this.selectedInquiry();
    if (!inquiry) {
      return;
    }

    this.actionLoading.set(true);
    this.actionError.set(null);

    this.inquiryService.submitToDistributors(inquiry.id).subscribe({
      next: (updated) => {
        this.replaceInquiry(updated);
        this.actionLoading.set(false);
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.actionError.set(
          err?.error?.message ?? 'Could not send to distributors. Check product distributor coverage.',
        );
      },
    });
  }

  requestClarification(): void {
    const inquiry = this.selectedInquiry();
    const message = this.clarificationText().trim();
    if (!inquiry || !message) {
      this.actionError.set('Enter a message for the consumer.');
      return;
    }

    this.actionLoading.set(true);
    this.actionError.set(null);

    this.inquiryService.requestClarification(inquiry.id, message).subscribe({
      next: (updated) => {
        this.replaceInquiry(updated);
        this.actionLoading.set(false);
      },
      error: () => {
        this.actionLoading.set(false);
        this.actionError.set('Could not save clarification request.');
      },
    });
  }

  lineSourceLabel(lineSource?: string): string {
    return lineSource === 'NEW_PRODUCT' ? 'New product from search' : 'Catalog match';
  }

  private replaceInquiry(updated: Inquiry): void {
    this.inquiries.update((list) => list.map((q) => (q.id === updated.id ? updated : q)));
  }
}
