import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import {
  CRM_MAX_CONTACTS,
  CrmContactFormRow,
  CrmCustomer,
  CrmCustomerSummary,
  UpdateCrmCustomerRequest,
  crmContactRankLabel,
  crmContactsToFormRows,
  crmFollowUpEntered,
  crmFormRowsToRequest,
  crmHasFollowUpDate,
  crmHasMeetingDate,
  crmWorkflowStatus,
  emptyCrmContactRow,
} from '../../../core/models/admin-crm.model';
import { AdminCrmService } from '../../../core/services/admin/admin-crm.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';
import {
  DEFAULT_SALES_SORT,
  EMPTY_SALES_COLUMN_FILTERS,
  EMPTY_SALES_CUSTOM_FILTER,
  SALES_SORT_OPTIONS,
  SalesColumnFilters,
  SalesColumnMenu,
  SalesCrmCustomFilter,
  SalesCrmQuickFilter,
  SalesCrmSortBy,
  SalesCrmSortSelection,
  compareSalesCrmRows,
  formatSalesCrmDate,
  formatSalesCrmDateTime,
  matchesSalesCrmSearch,
  passesSalesColumnFilters,
  passesSalesQuickFilter,
  uniqueSalesFieldValues,
} from '../sales-crm-filters';

type FollowTab = 'contacts' | 'follow' | 'meeting';
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
  selector: 'app-sales-follow-up',
  imports: [FormsModule, DragDropModule, LoadingOverlayComponent],
  templateUrl: './sales-follow-up.component.html',
  styleUrl: './sales-follow-up.component.css',
})
export class SalesFollowUpComponent implements OnInit {
  private readonly crmService = inject(AdminCrmService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly statusSaving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly rows = signal<CrmCustomerSummary[]>([]);
  readonly activeTab = signal<FollowTab>('contacts');
  readonly query = signal('');
  readonly quickFilter = signal<SalesCrmQuickFilter>('all');
  readonly customFilter = signal<SalesCrmCustomFilter>({ ...EMPTY_SALES_CUSTOM_FILTER });
  readonly sort = signal<SalesCrmSortSelection>({ ...DEFAULT_SALES_SORT });
  readonly columnFilters = signal<SalesColumnFilters>({ ...EMPTY_SALES_COLUMN_FILTERS });
  readonly openColMenu = signal<SalesColumnMenu>(null);
  readonly colMenuPos = signal({ top: 0, left: 0 });
  readonly updatedFromDraft = signal('');
  readonly updatedToDraft = signal('');

  readonly selectedDetail = signal<CrmCustomer | null>(null);
  readonly formOpen = signal(false);
  readonly form = signal<FormState>(emptyForm());
  readonly customOpen = signal(false);
  readonly sortOpen = signal(false);
  readonly customDraft = signal<SalesCrmCustomFilter>({ ...EMPTY_SALES_CUSTOM_FILTER });
  readonly sortDraft = signal<SalesCrmSortSelection>({ ...DEFAULT_SALES_SORT });

  readonly sortOptions = SALES_SORT_OPTIONS;
  readonly formatDate = formatSalesCrmDate;
  readonly formatDateTime = formatSalesCrmDateTime;
  readonly workflowStatus = crmWorkflowStatus;
  readonly rankLabel = crmContactRankLabel;
  readonly maxContacts = CRM_MAX_CONTACTS;

  readonly filteredRows = computed(() => {
    const tab = this.activeTab();
    const q = this.query().trim().toLowerCase();
    const filter = this.quickFilter();
    const custom = this.customFilter();
    const columns = this.columnFilters();
    const sort = this.sort();

    let list = this.rows().filter((row) => {
      // Contacts: everyone who entered Follow-up via Done (even with empty phones / Review).
      if (tab === 'contacts') return crmFollowUpEntered(row);
      if (tab === 'follow') return crmHasFollowUpDate(row);
      return crmHasMeetingDate(row);
    });

    list = list.filter((row) => {
      if (!passesSalesQuickFilter(row, filter, custom, false)) return false;
      if (!passesSalesColumnFilters(row, columns)) return false;
      if (!q) return true;
      return matchesSalesCrmSearch(row, q);
    });

    return [...list].sort((a, b) => compareSalesCrmRows(a, b, sort));
  });

  /** Options for ⋮ menus — current Follow-up tab before column filters. */
  readonly columnFilterSourceRows = computed(() => {
    const tab = this.activeTab();
    return this.rows().filter((row) => {
      if (tab === 'contacts') return crmFollowUpEntered(row);
      if (tab === 'follow') return crmHasFollowUpDate(row);
      return crmHasMeetingDate(row);
    });
  });

  readonly sectorOptions = computed(() =>
    uniqueSalesFieldValues(this.columnFilterSourceRows(), 'sector'),
  );

  readonly locationOptions = computed(() =>
    uniqueSalesFieldValues(this.columnFilterSourceRows(), 'location'),
  );

  readonly emptyMessage = computed(() => {
    switch (this.activeTab()) {
      case 'contacts':
        return 'No Done contacts yet. Mark a CRM customer as Done to move them here.';
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
    this.openColMenu.set(null);
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

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.openColMenu()) this.openColMenu.set(null);
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onViewportChange(): void {
    if (this.openColMenu()) this.openColMenu.set(null);
  }

  toggleColMenu(menu: Exclude<SalesColumnMenu, null>, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.openColMenu() === menu) {
      this.openColMenu.set(null);
      return;
    }
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    const menuWidth = menu === 'updated' ? 260 : 220;
    const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
    this.colMenuPos.set({ top: rect.bottom + 4, left });
    if (menu === 'updated') {
      const f = this.columnFilters();
      this.updatedFromDraft.set(f.updatedFrom ?? '');
      this.updatedToDraft.set(f.updatedTo ?? '');
    }
    this.openColMenu.set(menu);
  }

  setSectorFilter(value: string | null, event?: Event): void {
    event?.stopPropagation();
    this.columnFilters.update((f) => ({ ...f, sector: value }));
    this.openColMenu.set(null);
  }

  setLocationFilter(value: string | null, event?: Event): void {
    event?.stopPropagation();
    this.columnFilters.update((f) => ({ ...f, location: value }));
    this.openColMenu.set(null);
  }

  applyUpdatedRange(event?: Event): void {
    event?.stopPropagation();
    this.columnFilters.update((f) => ({
      ...f,
      updatedFrom: this.updatedFromDraft().trim() || null,
      updatedTo: this.updatedToDraft().trim() || null,
    }));
    this.openColMenu.set(null);
  }

  clearUpdatedRange(event?: Event): void {
    event?.stopPropagation();
    this.updatedFromDraft.set('');
    this.updatedToDraft.set('');
    this.columnFilters.update((f) => ({ ...f, updatedFrom: null, updatedTo: null }));
    this.openColMenu.set(null);
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

  setCustomStatus(status: SalesCrmCustomFilter['status']): void {
    this.customDraft.update((d) => ({ ...d, status }));
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

  /** Same as CRM: open the full edit modal on row click. */
  openRow(row: CrmCustomerSummary): void {
    this.selectedDetail.set(null);
    this.crmService.getById(row.id).subscribe({
      next: (detail) => {
        this.selectedDetail.set(detail);
        this.populateEditForm(detail);
        this.formOpen.set(true);
      },
      error: (err) => {
        this.toast.fromApiError(err, 'Could not load customer details.');
      },
    });
  }

  closeForm(): void {
    if (this.saving()) return;
    this.formOpen.set(false);
  }

  private populateEditForm(detail: CrmCustomer): void {
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

  formHasContactPhone(): boolean {
    const state = this.form();
    return state.purchasers.some((c) => c.phone.trim()) || state.maintenanceContacts.some((c) => c.phone.trim());
  }

  /**
   * Review toggle in Follow-up:
   * - If already in Contacts (followUpEntered): REVIEW ↔ DONE (never back to CRM).
   * - Otherwise (Follow/Meeting from CRM): REVIEW ↔ NONE.
   */
  markReviewFromForm(): void {
    const detail = this.selectedDetail();
    if (!detail?.id || this.saving() || this.statusSaving()) return;
    const entered = crmFollowUpEntered(detail);
    const current = this.workflowStatus(detail);
    const next = current === 'REVIEW' ? (entered ? 'DONE' : 'NONE') : 'REVIEW';
    this.saveThenSetStatus(next, next === 'REVIEW' ? 'Saved and marked Review.' : 'Saved and cleared Review.');
  }

  save(): void {
    const state = this.form();
    const detail = this.selectedDetail();
    if (!detail?.id) return;
    if (!state.industryName.trim()) {
      this.toast.warning('Industry name is required.');
      return;
    }
    const entered = crmFollowUpEntered(detail);
    const noPhones = !this.formHasContactPhone();
    // Empty phones in Contacts → stay here and auto-mark Review.
    const autoReview = entered && noPhones;

    this.saving.set(true);
    this.crmService.update(detail.id, this.toUpdateRequest(state)).subscribe({
      next: (updated) => {
        this.selectedDetail.set(updated);
        if (autoReview && this.workflowStatus(updated) !== 'REVIEW') {
          this.crmService.updateWorkflowStatus(updated.id, 'REVIEW').subscribe({
            next: (withStatus) => {
              this.saving.set(false);
              this.selectedDetail.set(withStatus);
              this.formOpen.set(false);
              this.toast.success('Saved — no phone numbers, marked Review in Contacts.');
              this.load();
            },
            error: (err) => {
              this.saving.set(false);
              this.toast.fromApiError(err, 'Saved, but could not mark Review.');
              this.load();
            },
          });
          return;
        }
        this.saving.set(false);
        this.formOpen.set(false);
        this.toast.success('CRM customer updated.');
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.fromApiError(err, 'Could not update CRM customer.');
      },
    });
  }

  private saveThenSetStatus(status: 'NONE' | 'REVIEW' | 'DONE', successMessage: string): void {
    const state = this.form();
    const detail = this.selectedDetail();
    if (!detail?.id) return;
    if (!state.industryName.trim()) {
      this.toast.warning('Industry name is required.');
      return;
    }
    this.saving.set(true);
    this.crmService.update(detail.id, this.toUpdateRequest(state)).subscribe({
      next: (updated) => {
        this.selectedDetail.set(updated);
        this.statusSaving.set(true);
        this.crmService.updateWorkflowStatus(updated.id, status).subscribe({
          next: (withStatus) => {
            this.saving.set(false);
            this.statusSaving.set(false);
            this.selectedDetail.set(withStatus);
            this.formOpen.set(false);
            this.toast.success(successMessage);
            this.load();
          },
          error: (err) => {
            this.saving.set(false);
            this.statusSaving.set(false);
            this.toast.fromApiError(err, 'Saved, but could not update status.');
            this.load();
          },
        });
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.fromApiError(err, 'Could not update CRM customer.');
      },
    });
  }

  private toUpdateRequest(state: FormState): UpdateCrmCustomerRequest {
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
      isActive: state.isActive,
    };
  }
}
