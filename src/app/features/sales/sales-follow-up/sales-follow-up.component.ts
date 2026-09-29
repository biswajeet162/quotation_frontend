import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
  readonly errorMessage = signal<string | null>(null);
  readonly rows = signal<CrmCustomerSummary[]>([]);
  readonly activeTab = signal<FollowTab>('contacts');
  readonly query = signal('');
  readonly quickFilter = signal<SalesCrmQuickFilter>('all');
  readonly customFilter = signal<SalesCrmCustomFilter>({ ...EMPTY_SALES_CUSTOM_FILTER });
  readonly sort = signal<SalesCrmSortSelection>({ ...DEFAULT_SALES_SORT });

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
    const sort = this.sort();

    let list = this.rows().filter((row) => {
      if (tab === 'contacts') return crmWorkflowStatus(row) === 'DONE' && Boolean(row.hasContacts);
      if (tab === 'follow') return crmHasFollowUpDate(row);
      return crmHasMeetingDate(row);
    });

    list = list.filter((row) => {
      if (!passesSalesQuickFilter(row, filter, custom, false)) return false;
      if (!q) return true;
      return matchesSalesCrmSearch(row, q);
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

  save(): void {
    const state = this.form();
    const detail = this.selectedDetail();
    if (!detail?.id) return;
    if (!state.industryName.trim()) {
      this.toast.warning('Industry name is required.');
      return;
    }
    this.saving.set(true);
    const purchasers = crmFormRowsToRequest(state.purchasers);
    const maintenanceContacts = crmFormRowsToRequest(state.maintenanceContacts);
    const primaryPurchaser = purchasers[0];
    const primaryMaintenance = maintenanceContacts[0];
    const body: UpdateCrmCustomerRequest = {
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
    this.crmService.update(detail.id, body).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.selectedDetail.set(updated);
        this.toast.success('CRM customer updated.');
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.fromApiError(err, 'Could not update CRM customer.');
      },
    });
  }
}
