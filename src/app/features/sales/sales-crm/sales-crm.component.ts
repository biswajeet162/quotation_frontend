import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CreateCrmCustomerRequest,
  CrmCustomer,
  CrmCustomerSummary,
  CrmFollowUpEntry,
  UpdateCrmCustomerRequest,
  crmHasContactPhone,
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
  SalesCrmSortSelection,
  compareSalesCrmRows,
  formatSalesCrmDate,
  formatSalesCrmDateTime,
  passesSalesQuickFilter,
  salesQuickFilterLabel,
} from '../sales-crm-filters';

type FormMode = 'create' | 'edit';

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

const emptyForm = (): FormState => ({
  industryName: '',
  sector: '',
  location: '',
  purchaserName: '',
  purchaserPhone: '',
  purchaserEmail: '',
  maintenanceName: '',
  maintenancePhone: '',
  maintenanceEmail: '',
  meetingDate: '',
  followUpDate: '',
  coordinatorName: '',
  remark: '',
  isActive: true,
});

@Component({
  selector: 'app-sales-crm',
  imports: [FormsModule, LoadingOverlayComponent],
  templateUrl: './sales-crm.component.html',
  styleUrl: './sales-crm.component.css',
})
export class SalesCrmComponent implements OnInit {
  private readonly crmService = inject(AdminCrmService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly statusSaving = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly rows = signal<CrmCustomerSummary[]>([]);
  readonly query = signal('');
  readonly quickFilter = signal<SalesCrmQuickFilter>('all');
  readonly customFilter = signal<SalesCrmCustomFilter>({ ...EMPTY_SALES_CUSTOM_FILTER });
  readonly sort = signal<SalesCrmSortSelection>({ ...DEFAULT_SALES_SORT });

  readonly detailOpen = signal(false);
  readonly editOnly = signal(false);
  readonly selectedDetail = signal<CrmCustomer | null>(null);
  readonly followUps = signal<CrmFollowUpEntry[]>([]);
  readonly formOpen = signal(false);
  readonly formMode = signal<FormMode>('create');
  readonly form = signal<FormState>(emptyForm());
  readonly customOpen = signal(false);
  readonly sortOpen = signal(false);
  readonly customDraft = signal<SalesCrmCustomFilter>({ ...EMPTY_SALES_CUSTOM_FILTER });
  readonly sortDraft = signal<SalesCrmSortSelection>({ ...DEFAULT_SALES_SORT });

  readonly sortOptions = SALES_SORT_OPTIONS;
  readonly formatDate = formatSalesCrmDate;
  readonly formatDateTime = formatSalesCrmDateTime;
  readonly filterLabel = salesQuickFilterLabel;
  readonly workflowStatus = crmWorkflowStatus;

  readonly filteredRows = computed(() => {
    const q = this.query().trim().toLowerCase();
    const filter = this.quickFilter();
    const custom = this.customFilter();
    const sort = this.sort();
    const list = this.rows().filter((row) => {
      if (!passesSalesQuickFilter(row, filter, custom)) return false;
      if (!q) return true;
      return [
        String(row.serialNumber),
        row.industryName,
        row.sector,
        row.location,
        row.purchaserName,
        row.purchaserPhone,
        row.purchaserEmail,
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
    return [...list].sort((a, b) => compareSalesCrmRows(a, b, sort));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.crmService.list(true).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set('Could not load CRM customers.');
        this.toast.fromApiError(err, 'Could not load CRM customers.');
      },
    });
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

  setCustomStatus(status: 'NONE' | 'REVIEW' | 'DONE' | null): void {
    this.customDraft.update((d) => ({ ...d, status }));
  }

  patchCustomDraft<K extends keyof SalesCrmCustomFilter>(key: K, value: SalesCrmCustomFilter[K]): void {
    this.customDraft.update((d) => ({ ...d, [key]: value }));
  }

  patchSortDraft<K extends keyof SalesCrmSortSelection>(key: K, value: SalesCrmSortSelection[K]): void {
    this.sortDraft.update((d) => ({ ...d, [key]: value }));
  }

  openCreate(): void {
    this.formMode.set('create');
    this.form.set(emptyForm());
    this.formOpen.set(true);
  }

  openRow(row: CrmCustomerSummary, editOnly = false): void {
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
    this.formMode.set('edit');
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
  }

  updateFormField<K extends keyof FormState>(key: K, value: FormState[K]): void {
    this.form.update((current) => ({ ...current, [key]: value }));
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
        this.rows.update((list) =>
          list.map((row) =>
            row.id === updated.id
              ? {
                  ...row,
                  workflowStatus: updated.workflowStatus,
                  updatedAt: updated.updatedAt,
                  hasContacts: crmHasContactPhone(updated),
                }
              : row,
          ),
        );
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
    if (!state.industryName.trim()) {
      this.toast.warning('Industry name is required.');
      return;
    }
    this.saving.set(true);
    if (this.formMode() === 'create') {
      this.crmService.create(this.toCreateRequest(state)).subscribe({
        next: () => {
          this.saving.set(false);
          this.formOpen.set(false);
          this.toast.success('CRM customer created.');
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.fromApiError(err, 'Could not create CRM customer.');
        },
      });
      return;
    }
    const detail = this.selectedDetail();
    if (!detail?.id) {
      this.saving.set(false);
      return;
    }
    this.crmService.update(detail.id, this.toUpdateRequest(state)).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.formOpen.set(false);
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

  private toCreateRequest(state: FormState): CreateCrmCustomerRequest {
    return {
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
    };
  }

  private toUpdateRequest(state: FormState): UpdateCrmCustomerRequest {
    return {
      ...this.toCreateRequest(state),
      isActive: state.isActive,
    };
  }
}
