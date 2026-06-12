import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConsumerInquiry, Inquiry, InquiryStatus } from '../../../core/models/inquiry.model';
import { InquiryTimelineEntry } from '../../../core/models/inquiry-timeline.model';
import { InquiryService } from '../../../core/services/inquiry/inquiry.service';
import { InquiryWorkflowDialogComponent } from '../../../shared/components/inquiry-workflow-dialog/inquiry-workflow-dialog.component';
import { AuthService } from '../../../core/services/auth/auth.service';
import {
  getConsumerInquiryDisplay,
  getRequestSourceLabel,
} from '../../../shared/utils/inquiry-display.util';

type StatusFilter = 'all' | InquiryStatus | 'ACTION_REQUIRED';

@Component({
  selector: 'app-inquiry-tracking',
  imports: [FormsModule, InquiryWorkflowDialogComponent],
  templateUrl: './inquiry-tracking.component.html',
  styleUrl: './inquiry-tracking.component.css',
})
export class InquiryTrackingComponent implements OnInit {
  private readonly inquiryService = inject(InquiryService);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly inquiries = signal<ConsumerInquiry[]>([]);
  readonly searchQuery = signal('');
  readonly statusFilter = signal<StatusFilter>('all');
  readonly selectedId = signal<string | null>(null);

  readonly timelineLoading = signal(false);
  readonly timelineError = signal<string | null>(null);
  readonly timelineEntries = signal<InquiryTimelineEntry[]>([]);

  readonly messageText = signal('');
  readonly messageLoading = signal(false);
  readonly messageError = signal<string | null>(null);

  readonly deleteLoading = signal(false);
  readonly deleteError = signal<string | null>(null);
  readonly deleteConfirmOpen = signal(false);
  readonly workflowOpen = signal(false);

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

  readonly messageFieldLabel = computed(() => {
    const inquiry = this.selectedInquiry();
    if (inquiry?.needsClarification) {
      return 'Your reply to admin (clarification requested)';
    }
    return 'Message to admin (questions or updates)';
  });

  readonly messagePlaceholder = computed(() => {
    const inquiry = this.selectedInquiry();
    if (inquiry?.needsClarification) {
      return 'Provide the details admin asked for…';
    }
    return 'Type your question or update for the admin team…';
  });

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.workflowOpen()) {
      this.closeWorkflow();
    } else if (this.deleteConfirmOpen()) {
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
        if (this.selectedId()) {
          this.loadTimeline();
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
    this.messageError.set(null);
    this.messageText.set('');
    this.loadTimeline();
  }

  private syncSelection(): void {
    const visible = this.filteredInquiries();
    const current = this.selectedId();
    if (current != null && visible.some((q) => q.id === current)) {
      return;
    }
    this.selectedId.set(visible[0]?.id ?? null);
    if (this.selectedId()) {
      this.loadTimeline();
    }
  }

  loadTimeline(): void {
    const inquiry = this.selectedInquiry();
    if (!inquiry) {
      return;
    }

    this.timelineLoading.set(true);
    this.timelineError.set(null);

    this.inquiryService.getTimeline(inquiry.id).subscribe({
      next: (timeline) => {
        this.timelineEntries.set(timeline.entries);
        this.timelineLoading.set(false);
        this.inquiries.update((list) =>
          list.map((q) =>
            q.id === inquiry.id
              ? {
                  ...q,
                  needsClarification: timeline.needsClarification,
                  status: timeline.currentStatus,
                }
              : q,
          ),
        );
      },
      error: () => {
        this.timelineLoading.set(false);
        this.timelineError.set('Could not load activity.');
      },
    });
  }

  sendMessage(): void {
    const inquiry = this.selectedInquiry();
    const message = this.messageText().trim();
    if (!inquiry || !message) {
      this.messageError.set('Enter a message before sending.');
      return;
    }

    this.messageLoading.set(true);
    this.messageError.set(null);

    this.inquiryService.postMessage(inquiry.id, message).subscribe({
      next: (updated) => {
        this.messageLoading.set(false);
        this.messageText.set('');
        this.inquiries.update((list) => list.map((q) => (q.id === updated.id ? updated : q)));
        this.loadTimeline();
      },
      error: (err) => {
        this.messageLoading.set(false);
        this.messageError.set(err?.error?.message ?? 'Could not send your message.');
      },
    });
  }

  canMessage(inquiry: ConsumerInquiry): boolean {
    return inquiry.status !== 'CLOSED';
  }

  canDelete(inquiry: ConsumerInquiry): boolean {
    return inquiry.status === 'NEW';
  }

  actorLabel(entry: InquiryTimelineEntry): string {
    if (entry.actorRole === 'CONSUMER') {
      return 'You';
    }
    if (entry.actorRole === 'ADMIN') {
      return 'Admin';
    }
    return entry.actorName ?? entry.actorRole ?? 'System';
  }

  openWorkflow(): void {
    if (this.selectedInquiry()) {
      this.workflowOpen.set(true);
    }
  }

  closeWorkflow(): void {
    this.workflowOpen.set(false);
  }

  onWorkflowRefreshed(): void {
    this.load();
  }

  workflowInquiry(inquiry: ConsumerInquiry): Inquiry {
    const user = this.auth.currentUser();
    return {
      id: inquiry.id,
      inquiryId: inquiry.inquiryId,
      companyId: user?.companyId ?? '',
      companyName: user?.companyName,
      title: inquiry.title,
      description: inquiry.description,
      status: inquiry.status,
      needsClarification: inquiry.needsClarification,
      clarificationMessage: inquiry.clarificationMessage,
      requestSource: inquiry.requestSource,
      searchTerm: inquiry.searchTerm,
      items: inquiry.items,
      createdAt: inquiry.createdAt,
      updatedAt: inquiry.updatedAt,
    };
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
        if (this.selectedId()) {
          this.loadTimeline();
        }
      },
      error: (err) => {
        this.deleteLoading.set(false);
        this.deleteError.set(err?.error?.message ?? 'Could not delete this request.');
        this.deleteConfirmOpen.set(false);
      },
    });
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
