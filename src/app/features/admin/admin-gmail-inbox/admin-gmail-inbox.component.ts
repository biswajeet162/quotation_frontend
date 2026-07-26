import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ConvertExternalEmailToInquiryRequest,
  ExternalEmailInboxItem,
  ExternalEmailStatus,
  GmailSyncStatus,
} from '../../../core/models/admin-gmail-inbox.model';
import { AdminGmailInboxService } from '../../../core/services/admin/admin-gmail-inbox.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';

type StatusFilter = ExternalEmailStatus;

interface StatusTab {
  value: StatusFilter;
  label: string;
}

interface ConvertFormState {
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  title: string;
  description: string;
  brand: string;
  designation: string;
  productNotes: string;
  consumerCompanyId?: string;
  consumerUserId?: string;
}

const emptyConvertForm = (): ConvertFormState => ({
  companyName: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  title: '',
  description: '',
  brand: 'Email inquiry',
  designation: '',
  productNotes: 'Created from synced Gmail message',
});

@Component({
  selector: 'app-admin-gmail-inbox',
  imports: [FormsModule, RouterLink, LoadingOverlayComponent],
  templateUrl: './admin-gmail-inbox.component.html',
  styleUrl: './admin-gmail-inbox.component.css',
})
export class AdminGmailInboxComponent implements OnInit {
  private readonly gmailInboxService = inject(AdminGmailInboxService);
  private readonly toast = inject(ToastService);

  readonly statusTabs: StatusTab[] = [
    { value: 'UNLINKED', label: 'Unlinked' },
    { value: 'LINKED', label: 'Linked' },
    { value: 'CONVERTED', label: 'Converted' },
    { value: 'DISMISSED', label: 'Dismissed' },
  ];

  readonly loading = signal(true);
  readonly statusLoading = signal(false);
  readonly syncing = signal(false);
  readonly actionLoading = signal(false);

  readonly errorMessage = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  readonly syncStatus = signal<GmailSyncStatus | null>(null);
  readonly statusFilter = signal<StatusFilter>('UNLINKED');
  readonly searchQuery = signal('');
  readonly items = signal<ExternalEmailInboxItem[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly linkInquiryId = signal('');
  readonly convertForm = signal<ConvertFormState>(emptyConvertForm());
  readonly suggestionsLoading = signal(false);
  readonly matchedCompanyHint = signal<string | null>(null);

  readonly overlayLoading = computed(() => this.loading() || this.syncing());

  readonly filteredItems = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) {
      return this.items();
    }
    return this.items().filter((item) => {
      const haystack = [
        item.subject,
        item.fromEmail,
        item.fromName,
        item.bodyPreview,
        item.linkedInquiryId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  });

  readonly selectedItem = computed(() => {
    const id = this.selectedId();
    if (!id) {
      return null;
    }
    return this.items().find((item) => item.id === id) ?? null;
  });

  ngOnInit(): void {
    this.loadStatus();
    this.loadInbox();
  }

  load(): void {
    this.loadStatus();
    this.loadInbox(true);
  }

  onStatusFilterChange(value: StatusFilter): void {
    if (this.statusFilter() === value) {
      return;
    }
    this.statusFilter.set(value);
    this.selectedId.set(null);
    this.linkInquiryId.set('');
    this.convertForm.set(emptyConvertForm());
    this.matchedCompanyHint.set(null);
    this.actionError.set(null);
    this.loadInbox();
  }

  selectItem(item: ExternalEmailInboxItem): void {
    this.selectedId.set(item.id);
    this.linkInquiryId.set('');
    this.actionError.set(null);
    this.loadConvertSuggestions(item.id);
  }

  updateConvertField<K extends keyof ConvertFormState>(field: K, value: ConvertFormState[K]): void {
    this.convertForm.update((form) => ({ ...form, [field]: value }));
  }

  convertSelected(): void {
    const item = this.selectedItem();
    if (!item) {
      return;
    }

    const form = this.convertForm();
    if (!form.companyName.trim() || !form.contactName.trim() || !form.contactEmail.trim() || !form.title.trim()) {
      this.actionError.set('Company, contact, email, and title are required to create an inquiry.');
      this.toast.warning('Fill in company, contact, email, and title.');
      return;
    }

    const request: ConvertExternalEmailToInquiryRequest = {
      companyName: form.companyName.trim(),
      contactName: form.contactName.trim(),
      contactEmail: form.contactEmail.trim(),
      contactPhone: form.contactPhone.trim() || undefined,
      consumerCompanyId: form.consumerCompanyId,
      consumerUserId: form.consumerUserId,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      brand: form.brand.trim() || undefined,
      designation: form.designation.trim() || undefined,
      productNotes: form.productNotes.trim() || undefined,
    };

    this.actionLoading.set(true);
    this.actionError.set(null);
    this.gmailInboxService.convertToInquiry(item.id, request).subscribe({
      next: (result) => {
        this.actionLoading.set(false);
        this.toast.success(`Created inquiry ${result.inquiryId}.`);
        this.loadStatus();
        this.statusFilter.set('CONVERTED');
        this.loadInbox(true, result.inboxId);
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.actionError.set('Could not create an inquiry from this email.');
        this.toast.fromApiError(err, 'Could not create an inquiry from this email.');
      },
    });
  }

  runSync(): void {
    this.syncing.set(true);
    this.actionError.set(null);
    this.gmailInboxService.runSync().subscribe({
      next: (result) => {
        this.syncing.set(false);
        this.toast.success(result.message || 'Gmail sync completed.');
        this.loadStatus();
        this.loadInbox(true);
      },
      error: (err) => {
        this.syncing.set(false);
        this.toast.fromApiError(err, 'Gmail sync failed.');
      },
    });
  }

  linkSelected(): void {
    const item = this.selectedItem();
    const inquiryId = this.linkInquiryId().trim();
    if (!item) {
      return;
    }
    if (!inquiryId) {
      this.actionError.set('Enter an inquiry reference (e.g. INQ-20260703-00001).');
      this.toast.warning('Enter an inquiry reference to link this email.');
      return;
    }

    this.actionLoading.set(true);
    this.actionError.set(null);
    this.gmailInboxService.linkToInquiry(item.id, { inquiryId }).subscribe({
      next: (result) => {
        this.actionLoading.set(false);
        this.toast.success(`Linked to ${result.inquiryId}.`);
        this.loadStatus();
        this.statusFilter.set('LINKED');
        this.loadInbox(true, result.inboxId);
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.actionError.set('Could not link this email to the inquiry.');
        this.toast.fromApiError(err, 'Could not link this email to the inquiry.');
      },
    });
  }

  dismissSelected(): void {
    const item = this.selectedItem();
    if (!item) {
      return;
    }
    this.actionLoading.set(true);
    this.actionError.set(null);
    this.gmailInboxService.dismiss(item.id).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.toast.success('Email dismissed.');
        this.selectedId.set(null);
        this.loadStatus();
        this.loadInbox(true);
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.actionError.set('Could not dismiss this email.');
        this.toast.fromApiError(err, 'Could not dismiss this email.');
      },
    });
  }

  senderLabel(item: ExternalEmailInboxItem): string {
    const name = item.fromName?.trim();
    if (name) {
      return `${name} <${item.fromEmail}>`;
    }
    return item.fromEmail;
  }

  formatDateTime(iso?: string): string {
    if (!iso) {
      return '—';
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return iso;
    }
    return date.toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  isSyncStatusWarn(status: GmailSyncStatus): boolean {
    if (!status.enabled || !status.configured) {
      return true;
    }
    const health = status.healthStatus;
    return health === 'STALE' || health === 'ERROR' || health === 'NOT_CONFIGURED' || status.tokenHealthy === false;
  }

  formatHealthStatus(healthStatus?: string): string {
    switch (healthStatus) {
      case 'HEALTHY':
        return 'Healthy';
      case 'STALE':
        return 'Stale';
      case 'ERROR':
        return 'Error';
      case 'NOT_CONFIGURED':
        return 'Not configured';
      case 'DISABLED':
        return 'Disabled';
      default:
        return healthStatus ?? '—';
    }
  }

  healthStatusClass(healthStatus?: string): string {
    switch (healthStatus) {
      case 'HEALTHY':
        return 'sync-health sync-health--ok';
      case 'STALE':
        return 'sync-health sync-health--warn';
      case 'ERROR':
      case 'NOT_CONFIGURED':
        return 'sync-health sync-health--error';
      default:
        return 'sync-health';
    }
  }

  statusLabel(status: ExternalEmailStatus): string {
    switch (status) {
      case 'UNLINKED':
        return 'Unlinked';
      case 'LINKED':
        return 'Linked';
      case 'DISMISSED':
        return 'Dismissed';
      case 'CONVERTED':
        return 'Converted';
      default:
        return status;
    }
  }

  private loadConvertSuggestions(inboxId: string): void {
    this.suggestionsLoading.set(true);
    this.convertForm.set(emptyConvertForm());
    this.matchedCompanyHint.set(null);
    this.gmailInboxService.getConvertSuggestions(inboxId).subscribe({
      next: (suggestions) => {
        this.suggestionsLoading.set(false);
        this.convertForm.set({
          companyName: suggestions.suggestedCompanyName,
          contactName: suggestions.suggestedContactName,
          contactEmail: suggestions.suggestedContactEmail,
          contactPhone: '',
          title: suggestions.suggestedTitle,
          description: suggestions.suggestedDescription ?? '',
          brand: suggestions.suggestedBrand ?? 'Email inquiry',
          designation: suggestions.suggestedDesignation ?? '',
          productNotes: 'Created from synced Gmail message',
          consumerCompanyId: suggestions.matchedConsumerCompanyId,
          consumerUserId: suggestions.matchedConsumerUserId,
        });
        if (suggestions.matchedConsumerCompanyName) {
          this.matchedCompanyHint.set(`Matched existing company: ${suggestions.matchedConsumerCompanyName}`);
        }
      },
      error: () => {
        this.suggestionsLoading.set(false);
      },
    });
  }

  private loadStatus(): void {
    this.statusLoading.set(true);
    this.gmailInboxService.getStatus().subscribe({
      next: (status) => {
        this.syncStatus.set(status);
        this.statusLoading.set(false);
      },
      error: (err) => {
        this.statusLoading.set(false);
        this.toast.fromApiError(err, 'Could not load Gmail sync status.');
      },
    });
  }

  private loadInbox(silent = false, selectId?: string): void {
    if (!silent) {
      this.loading.set(true);
    }
    this.errorMessage.set(null);
    this.gmailInboxService.listInbox(this.statusFilter()).subscribe({
      next: (list) => {
        this.items.set(list);
        this.loading.set(false);
        if (selectId && list.some((item) => item.id === selectId)) {
          this.selectedId.set(selectId);
        } else if (this.selectedId() && !list.some((item) => item.id === this.selectedId())) {
          this.selectedId.set(null);
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set('Could not load Gmail inbox.');
        this.toast.fromApiError(err, 'Could not load Gmail inbox.');
      },
    });
  }
}
