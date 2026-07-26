import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
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
    this.actionError.set(null);
    this.loadInbox();
  }

  selectItem(item: ExternalEmailInboxItem): void {
    this.selectedId.set(item.id);
    this.linkInquiryId.set('');
    this.actionError.set(null);
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
