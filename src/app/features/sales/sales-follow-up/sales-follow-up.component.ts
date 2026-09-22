import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CrmCustomer,
  CrmCustomerSummary,
  CrmFollowUpEntry,
  UpdateCrmCustomerRequest,
  crmHasContactPhone,
  crmHasFollowUpDate,
  crmHasMeetingDate,
  crmWorkflowStatus,
} from '../../../core/models/admin-crm.model';
import { AdminCrmService } from '../../../core/services/admin/admin-crm.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';
import {
  DEFAULT_SALES_SORT,
  EMPTY_SALES_CUSTOM_FILTER,
  SALES_SORT_OPTIONS,
  SalesCrmCustomFilter,
  SalesCrmQuickFilter,
  SalesCrmSortBy,
  SalesCrmSortSelection,
  compareSalesCrmRows,
  formatSalesCrmDate,
  formatSalesCrmDateTime,
  passesSalesQuickFilter,
} from '../sales-crm-filters';

type FollowTab = 'contacts' | 'follow' | 'meeting';

interface FormState {
  industryName: string;
  sector: string;
  location: string;
  purchaserName: string;
  purchaserPhone: string;
  purchaserEmail: string;
  maintenanceName: string;
  maintenancePhone: string;
  maintenanceEmail: string;
  meetingDate: string;
  followUpDate: string;
  coordinatorName: string;
  remark: string;
  isActive: boolean;
}

@Component({
  selector: 'app-sales-follow-up',
  imports: [FormsModule, LoadingOverlayComponent],
  templateUrl: './sales-follow-up.component.html',
  styleUrl: './sales-follow-up.component.css',
})
export class SalesFollowUpComponent implements OnInit {
  private readonly crmService = inject(AdminCrmService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly statusSaving = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly rows = signal<CrmCustomerSummary[]>([]);
  readonly activeTab = signal<FollowTab>('contacts');
  readonly query = signal('');
  readonly quickFilter = signal<SalesCrmQuickFilter>('all');
  readonly customFilter = signal<SalesCrmCustomFilter>({ ...EMPTY_SALES_CUSTOM_FILTER });
  readonly sort = signal<SalesCrmSortSelection>({ ...DEFAULT_SALES_SORT });

  readonly detailOpen = signal(false);
  readonly editOnly = signal(false);
  readonly selectedDetail = signal<CrmCustomer | null>(null);
  readonly followUps = signal<CrmFollowUpEntry[]>([]);
  readonly formOpen = signal(false);
  readonly form = signal<FormState | null>(null);
  readonly customOpen = signal(false);
  readonly sortOpen = signal(false);
  readonly customDraft = signal<SalesCrmCustomFilter>({ ...EMPTY_SALES_CUSTOM_FILTER });
  readonly sortDraft = signal<SalesCrmSortSelection>({ ...DEFAULT_SALES_SORT });

  readonly sortOptions = SALES_SORT_OPTIONS;
  readonly formatDate = formatSalesCrmDate;
  readonly formatDateTime = formatSalesCrmDateTime;
  readonly workflowStatus = crmWorkflowStatus;

  readonly filteredRows = computed(() => {
    const tab = this.activeTab();
    const q = this.query().trim().toLowerCase();
    const filter = this.quickFilter();
    const custom = this.customFilter();
    const sort = this.sort();

    let list = this.rows().filter((row) => {
      if (tab === 'contacts') return crmWorkflowStatus(row) === 'DONE' && Boolean(row.hasContacts);
      if (tab === 'follow') return crmHasFollowUpDate(row);
      return crmHasMeetingDate(row);
    });

    list = list.filter((row) => {
      if (!passesSalesQuickFilter(row, filter, custom, false)) return false;
      if (!q) return true;
      return [
        String(row.serialNumber),
        row.industryName,
        row.sector,
        row.location,
        row.purchaserName,
        row.purchaserPhone,
        row.coordinatorName,
        row.remark,
        row.followUpDate,
        row.meetingDate,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });

    if (sort.sortBy === 'serial') {
      if (tab === 'follow') {
        list = [...list].sort((a, b) => (a.followUpDate ?? '').localeCompare(b.followUpDate ?? ''));
      } else if (tab === 'meeting') {
        list = [...list].sort((a, b) => (a.meetingDate ?? '').localeCompare(b.meetingDate ?? ''));
      } else {
        list = [...list].sort((a, b) => compareSalesCrmRows(a, b, sort));
      }
    } else {
      list = [...list].sort((a, b) => compareSalesCrmRows(a, b, sort));
    }
    return list;
  });

  readonly emptyMessage = computed(() => {
    switch (this.activeTab()) {
      case 'contacts':
        return 'No Done contacts with purchaser or maintenance contact yet.';
      case 'follow':
        return 'No customers with a follow-up date.';
      case 'meeting':
        return 'No customers with a meeting date.';
    }
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.crmService.list(false).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set('Could not load follow-ups.');
        this.toast.fromApiError(err, 'Could not load follow-ups.');
      },
    });
  }

  setTab(tab: FollowTab): void {
    this.activeTab.set(tab);
  }

  dateHint(row: CrmCustomerSummary): string {
    if (this.activeTab() === 'follow') return this.formatDate(row.followUpDate);
    if (this.activeTab() === 'meeting') return this.formatDate(row.meetingDate);
    return this.formatDateTime(row.updatedAt || row.createdAt);
  }

  onFilterChange(raw: string): void {
    if (raw === 'sortBy') {
      this.sortDraft.set({ ...this.sort() });
      this.sortOpen.set(true);
      return;
    }
    if (raw === 'custom') {
      this.customDraft.set({ ...this.customFilter() });
      this.customOpen.set(true);
      return;
    }
    this.quickFilter.set(raw as SalesCrmQuickFilter);
  }

  applyCustom(): void {
    this.customFilter.set({ ...this.customDraft() });
    this.quickFilter.set('custom');
    this.customOpen.set(false);
  }

  resetCustom(): void {
    this.customDraft.set({ ...EMPTY_SALES_CUSTOM_FILTER });
  }

  applySort(): void {
    this.sort.set({ ...this.sortDraft() });
    this.sortOpen.set(false);
  }

  setSortBy(value: SalesCrmSortBy): void {
    this.sortDraft.update((d) => ({ ...d, sortBy: value }));
  }

  patchCustomDraft<K extends keyof SalesCrmCustomFilter>(key: K, value: SalesCrmCustomFilter[K]): void {
    this.customDraft.update((d) => ({ ...d, [key]: value }));
  }

  patchSortAscending(value: boolean): void {
    this.sortDraft.update((d) => ({ ...d, ascending: value }));
  }

  openRow(row: CrmCustomerSummary): void {
    const editOnly = this.activeTab() === 'contacts';
    this.editOnly.set(editOnly);
    this.detailOpen.set(true);
    this.selectedDetail.set(null);
    this.followUps.set([]);
    this.crmService.getById(row.id).subscribe({
      next: (detail) => {
        this.selectedDetail.set(detail);
        this.crmService.listFollowUps(row.id).subscribe({
          next: (entries) => this.followUps.set(entries),
          error: () => this.followUps.set([]),
        });
      },
      error: (err) => {
        this.detailOpen.set(false);
        this.toast.fromApiError(err, 'Could not load customer details.');
      },
    });
  }

  closeDetail(): void {
    this.detailOpen.set(false);
    this.selectedDetail.set(null);
    this.followUps.set([]);
    this.editOnly.set(false);
  }

  openEdit(): void {
    const detail = this.selectedDetail();
    if (!detail) return;
    this.form.set({
      industryName: detail.industryName ?? '',
      sector: detail.sector ?? '',
      location: detail.location ?? '',
      purchaserName: detail.purchaserName ?? '',
      purchaserPhone: detail.purchaserPhone ?? '',
      purchaserEmail: detail.purchaserEmail ?? '',
      maintenanceName: detail.maintenanceName ?? '',
      maintenancePhone: detail.maintenancePhone ?? '',
      maintenanceEmail: detail.maintenanceEmail ?? '',
      meetingDate: detail.meetingDate ?? '',
      followUpDate: detail.followUpDate ?? '',
      coordinatorName: detail.coordinatorName ?? '',
      remark: detail.remark ?? '',
      isActive: detail.isActive !== false,
    });
    this.formOpen.set(true);
  }

  closeForm(): void {
    if (this.saving()) return;
    this.formOpen.set(false);
    this.form.set(null);
  }

  updateFormField<K extends keyof FormState>(key: K, value: FormState[K]): void {
    this.form.update((current) => (current ? { ...current, [key]: value } : current));
  }

  setWorkflowStatus(status: 'REVIEW' | 'DONE'): void {
    const detail = this.selectedDetail();
    if (!detail?.id || this.statusSaving()) return;
    const next = this.workflowStatus(detail) === status ? 'NONE' : status;
    if (next === 'DONE' && !crmHasContactPhone(detail)) {
      this.toast.warning('Add at least one purchaser or maintenance contact before marking Done.');
      return;
    }
    this.statusSaving.set(true);
    this.crmService.updateWorkflowStatus(detail.id, next).subscribe({
      next: (updated) => {
        this.statusSaving.set(false);
        this.selectedDetail.set(updated);
        this.load();
        const label = next === 'NONE' ? 'cleared' : next === 'DONE' ? 'Done' : 'Review';
        this.toast.success(next === 'NONE' ? 'Status cleared.' : `Marked as ${label}.`);
      },
      error: (err) => {
        this.statusSaving.set(false);
        this.toast.fromApiError(err, 'Could not update status.');
      },
    });
  }

  save(): void {
    const state = this.form();
    const detail = this.selectedDetail();
    if (!state || !detail?.id) return;
    if (!state.industryName.trim()) {
      this.toast.warning('Industry name is required.');
      return;
    }
    this.saving.set(true);
    const body: UpdateCrmCustomerRequest = {
      industryName: state.industryName.trim(),
      sector: state.sector.trim() || undefined,
      location: state.location.trim() || undefined,
      purchaserName: state.purchaserName.trim() || undefined,
      purchaserPhone: state.purchaserPhone.trim() || undefined,
      purchaserEmail: state.purchaserEmail.trim() || undefined,
      maintenanceName: state.maintenanceName.trim() || undefined,
      maintenancePhone: state.maintenancePhone.trim() || undefined,
      maintenanceEmail: state.maintenanceEmail.trim() || undefined,
      meetingDate: state.meetingDate || null,
      followUpDate: state.followUpDate || null,
      coordinatorName: state.coordinatorName.trim() || undefined,
      remark: state.remark.trim() || undefined,
      isActive: state.isActive,
    };
    this.crmService.update(detail.id, body).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.form.set(null);
        this.selectedDetail.set(updated);
        this.toast.success('CRM customer updated.');
        this.load();
        this.crmService.listFollowUps(updated.id).subscribe({
          next: (entries) => this.followUps.set(entries),
          error: () => this.followUps.set([]),
        });
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.fromApiError(err, 'Could not update CRM customer.');
      },
    });
  }
}
