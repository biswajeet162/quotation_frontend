import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CrmChangeEdit, CrmChangeHistoryDay } from '../../../core/models/admin-crm.model';
import { AdminCrmService } from '../../../core/services/admin/admin-crm.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-sales-crm-history',
  imports: [RouterLink, LoadingOverlayComponent],
  templateUrl: './sales-crm-history.component.html',
  styleUrl: './sales-crm-history.component.css',
})
export class SalesCrmHistoryComponent implements OnInit {
  private readonly crmService = inject(AdminCrmService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly days = signal<CrmChangeHistoryDay[]>([]);
  readonly expandedBatchId = signal<string | null>(null);
  readonly excelModalEdit = signal<CrmChangeEdit | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.expandedBatchId.set(null);
    this.excelModalEdit.set(null);
    this.crmService.listChangeHistory().subscribe({
      next: (days) => {
        this.days.set(days);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set('Could not load change history.');
        this.toast.fromApiError(err, 'Could not load change history.');
      },
    });
  }

  isExcelEvent(edit: CrmChangeEdit): boolean {
    return edit.eventType === 'EXCEL_UPLOAD' || edit.eventType === 'EXCEL_ACTIVATE';
  }

  onRowClick(edit: CrmChangeEdit): void {
    if (this.isExcelEvent(edit)) {
      this.excelModalEdit.set(edit);
      return;
    }
    this.expandedBatchId.update((current) => (current === edit.batchId ? null : edit.batchId));
  }

  closeExcelModal(): void {
    this.excelModalEdit.set(null);
  }

  isExpanded(batchId: string): boolean {
    return this.expandedBatchId() === batchId;
  }

  actorRightLabel(edit: CrmChangeEdit): string {
    const name = edit.changedByName?.trim();
    const role = edit.changedByRoleLabel?.trim() || edit.changedByRole?.trim();
    if (name && role) {
      return `${name} · ${role}`;
    }
    return name || role || '—';
  }

  formatDayHeading(date: string): string {
    if (!date) {
      return 'Unknown day';
    }
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return date;
    }
    return parsed.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  formatDateTime(value?: string | null): string {
    if (!value) {
      return '—';
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  }
}
