import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import {
  CRM_MAX_CONTACTS,
  CreateCrmCustomerRequest,
  CrmContact,
  CrmContactFormRow,
  CrmCustomer,
  CrmCustomerSummary,
  CrmFollowUpEntry,
  UpdateCrmCustomerRequest,
  crmContactRankLabel,
  crmContactsToFormRows,
  crmFormRowsToRequest,
  crmHasContactPhone,
  crmWorkflowStatus,
  emptyCrmContactRow,
} from '../../../core/models/admin-crm.model';
import { AdminCrmService } from '../../../core/services/admin/admin-crm.service';
import { CrmRecentOpenedService } from '../../../core/services/crm/crm-recent-opened.service';
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
  matchesSalesCrmSearch,
  passesSalesQuickFilter,
  salesQuickFilterLabel,
} from '../sales-crm-filters';

type FormMode = 'create' | 'edit';
type ContactGroup = 'purchasers' | 'maintenanceContacts';

interface FormState {
  industryName: string;
  sector: string;
  location: string;
  purchasers: CrmContactFormRow[];
  maintenanceContacts: CrmContactFormRow[];
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
  purchasers: [emptyCrmContactRow()],
  maintenanceContacts: [emptyCrmContactRow()],
  meetingDate: '',
  followUpDate: '',
  coordinatorName: '',
  remark: '',
  isActive: true,
});

@Component({
  selector: 'app-sales-crm',
  imports: [FormsModule, DragDropModule, LoadingOverlayComponent],
  templateUrl: './sales-crm.component.html',
  styleUrl: './sales-crm.component.css',
})
export class SalesCrmComponent implements OnInit {
  private readonly crmService = inject(AdminCrmService);
  private readonly recentOpened = inject(CrmRecentOpenedService);
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
  readonly hasContactPhone = crmHasContactPhone;
  readonly rankLabel = crmContactRankLabel;
  readonly maxContacts = CRM_MAX_CONTACTS;
  readonly doneNeedsPhoneHint = 'Must need at least one phone number to mark it Done.';

  readonly filteredRows = computed(() => {
    // Depend on localStorage revision so open/edit reorders without a backend call.
    this.recentOpened.revision();
    const q = this.query().trim().toLowerCase();
    const filter = this.quickFilter();
    const custom = this.customFilter();
    const sort = this.sort();
    const list = this.rows().filter((row) => {
      // Done customers live under Follow-up → Contacts, not the CRM tab.
      if (crmWorkflowStatus(row) === 'DONE') return false;
      if (!passesSalesQuickFilter(row, filter, custom)) return false;
      if (!q) return true;
      return matchesSalesCrmSearch(row, q);
    });
    return [...list].sort((a, b) =>
      compareSalesCrmRows(a, b, sort, (row) =>
        this.recentOpened.effectiveOpenedAt(row.id, row.lastOpenedAt),
      ),
    );
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

  displayValue(value?: string | null): string {
    return value?.trim() ? value : '—';
  }

  isSortedBy(key: SalesCrmSortBy): boolean {
    return this.sort().sortBy === key;
  }

  sortIndicator(key: SalesCrmSortBy): string {
    const current = this.sort();
    if (current.sortBy !== key) return '↕';
    return current.ascending ? '▲' : '▼';
  }

  toggleColumnSort(key: SalesCrmSortBy, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const current = this.sort();
    if (current.sortBy === key) {
      this.sort.set({ sortBy: key, ascending: !current.ascending });
      return;
    }
    this.sort.set({ sortBy: key, ascending: true });
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

  openRow(row: CrmCustomerSummary, _editOnly = false): void {
    this.selectedDetail.set(null);
    this.followUps.set([]);
    // Local-only bump — no backend call; hourly sync shares with other sales users.
    this.recentOpened.touch(row.id);
    this.crmService.getById(row.id).subscribe({
      next: (detail) => {
        this.selectedDetail.set(detail);
        this.populateEditForm(detail);
        this.formOpen.set(true);
        this.crmService.listFollowUps(row.id).subscribe({
          next: (entries) => this.followUps.set(entries),
          error: () => this.followUps.set([]),
        });
      },
      error: (err) => {
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
    this.populateEditForm(detail);
    this.formOpen.set(true);
  }

  private populateEditForm(detail: CrmCustomer): void {
    this.formMode.set('edit');
    this.form.set({
      industryName: detail.industryName ?? '',
      sector: detail.sector ?? '',
      location: detail.location ?? '',
      purchasers: crmContactsToFormRows(detail.purchasers, {
        name: detail.purchaserName,
        phone: detail.purchaserPhone,
        email: detail.purchaserEmail,
      }),
      maintenanceContacts: crmContactsToFormRows(detail.maintenanceContacts, {
        name: detail.maintenanceName,
        phone: detail.maintenancePhone,
        email: detail.maintenanceEmail,
      }),
      meetingDate: detail.meetingDate ?? '',
      followUpDate: detail.followUpDate ?? '',
      coordinatorName: detail.coordinatorName ?? '',
      remark: detail.remark ?? '',
      isActive: detail.isActive !== false,
    });
  }

  closeForm(): void {
    if (this.saving()) return;
    this.formOpen.set(false);
  }

  updateFormField<K extends keyof FormState>(key: K, value: FormState[K]): void {
    this.form.update((current) => ({ ...current, [key]: value }));
  }

  updateContactField(
    group: ContactGroup,
    index: number,
    field: keyof CrmContactFormRow,
    value: string,
  ): void {
    this.form.update((current) => {
      const rows = current[group].map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      );
      return { ...current, [group]: rows };
    });
  }

  addContact(group: ContactGroup): void {
    this.form.update((current) => {
      if (current[group].length >= CRM_MAX_CONTACTS) return current;
      return { ...current, [group]: [...current[group], emptyCrmContactRow()] };
    });
  }

  removeContact(group: ContactGroup, index: number): void {
    this.form.update((current) => {
      const rows = current[group].filter((_, i) => i !== index);
      return {
        ...current,
        [group]: rows.length > 0 ? rows : [emptyCrmContactRow()],
      };
    });
  }

  moveContact(group: ContactGroup, index: number, direction: -1 | 1): void {
    this.form.update((current) => {
      const target = index + direction;
      if (target < 0 || target >= current[group].length) return current;
      const rows = [...current[group]];
      const tmp = rows[index];
      rows[index] = rows[target];
      rows[target] = tmp;
      return { ...current, [group]: rows };
    });
  }

  dropContact(group: ContactGroup, event: CdkDragDrop<CrmContactFormRow[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    this.form.update((current) => {
      const rows = [...current[group]];
      moveItemInArray(rows, event.previousIndex, event.currentIndex);
      return { ...current, [group]: rows };
    });
  }

  detailContacts(
    detail: CrmCustomer,
    group: 'purchasers' | 'maintenance',
  ): CrmContact[] {
    if (group === 'purchasers') {
      if (detail.purchasers?.length) return detail.purchasers;
      if (detail.purchaserName || detail.purchaserPhone || detail.purchaserEmail) {
        return [
          {
            sortOrder: 1,
            rankLabel: 'Primary',
            name: detail.purchaserName,
            phone: detail.purchaserPhone,
            email: detail.purchaserEmail,
          },
        ];
      }
      return [];
    }
    if (detail.maintenanceContacts?.length) return detail.maintenanceContacts;
    if (detail.maintenanceName || detail.maintenancePhone || detail.maintenanceEmail) {
      return [
        {
          sortOrder: 1,
          rankLabel: 'Primary',
          name: detail.maintenanceName,
          phone: detail.maintenancePhone,
          email: detail.maintenanceEmail,
        },
      ];
    }
    return [];
  }

  setWorkflowStatus(status: 'REVIEW' | 'DONE'): void {
    const detail = this.selectedDetail();
    if (!detail?.id || this.statusSaving()) return;
    const next = this.workflowStatus(detail) === status ? 'NONE' : status;
    if (next === 'DONE' && !crmHasContactPhone(detail) && !this.formHasContactPhone()) {
      this.toast.warning(this.doneNeedsPhoneHint);
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
                  lastOpenedAt: updated.lastOpenedAt,
                  hasContacts: crmHasContactPhone(updated),
                }
              : row,
          ),
        );
        const label = next === 'NONE' ? 'cleared' : next === 'DONE' ? 'Done' : 'Review';
        this.toast.success(next === 'NONE' ? 'Status cleared.' : `Marked as ${label}.`);
        if (next === 'DONE') {
          this.formOpen.set(false);
          this.load();
        }
      },
      error: (err) => {
        this.statusSaving.set(false);
        this.toast.fromApiError(err, 'Could not update status.');
      },
    });
  }

  /** Review from form: save data, set REVIEW, stay on CRM list. */
  markReviewFromForm(): void {
    if (this.formMode() !== 'edit') return;
    this.saveAndSetStatus('REVIEW');
  }

  /** Done from form: save data, set DONE, leave CRM (shows under Follow-up → Contacts). */
  markDoneFromForm(): void {
    if (this.formMode() !== 'edit') return;
    if (!this.formHasContactPhone()) {
      this.toast.warning('Must need at least one phone number to mark it Done.');
      return;
    }
    this.saveAndSetStatus('DONE');
  }

  /** True when any purchaser or maintenance contact has a phone — required to mark Done. */
  formHasContactPhone(): boolean {
    const state = this.form();
    return state.purchasers.some((c) => c.phone.trim()) || state.maintenanceContacts.some((c) => c.phone.trim());
  }

  private saveAndSetStatus(status: 'REVIEW' | 'DONE'): void {
    const state = this.form();
    const detail = this.selectedDetail();
    if (!detail?.id) return;
    if (!state.industryName.trim()) {
      this.toast.warning('Industry name is required.');
      return;
    }
    if (this.saving() || this.statusSaving()) return;
    this.saving.set(true);
    this.recentOpened.touch(detail.id);
    this.crmService.update(detail.id, this.toUpdateRequest(state)).subscribe({
      next: (updated) => {
        this.selectedDetail.set(updated);
        this.crmService.updateWorkflowStatus(updated.id, status).subscribe({
          next: (withStatus) => {
            this.saving.set(false);
            this.selectedDetail.set(withStatus);
            this.toast.success(
              status === 'DONE'
                ? 'Saved and marked Done — moved to Follow-up Contacts.'
                : 'Saved and marked Review.',
            );
            this.formOpen.set(false);
            this.load();
          },
          error: (err) => {
            this.saving.set(false);
            this.toast.fromApiError(err, 'Saved, but could not update status.');
            this.load();
          },
        });
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.fromApiError(err, 'Could not save CRM customer.');
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
        next: (created) => {
          this.saving.set(false);
          this.formOpen.set(false);
          if (created?.id) this.recentOpened.touch(created.id);
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
    this.recentOpened.touch(detail.id);
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
    const purchasers = crmFormRowsToRequest(state.purchasers);
    const maintenanceContacts = crmFormRowsToRequest(state.maintenanceContacts);
    const primaryPurchaser = purchasers[0];
    const primaryMaintenance = maintenanceContacts[0];
    return {
      industryName: state.industryName.trim(),
      sector: state.sector.trim() || undefined,
      location: state.location.trim() || undefined,
      purchaserName: primaryPurchaser?.name,
      purchaserPhone: primaryPurchaser?.phone,
      purchaserEmail: primaryPurchaser?.email,
      maintenanceName: primaryMaintenance?.name,
      maintenancePhone: primaryMaintenance?.phone,
      maintenanceEmail: primaryMaintenance?.email,
      purchasers,
      maintenanceContacts,
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
