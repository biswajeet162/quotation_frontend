import { Component, computed, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CreateCrmCustomerRequest,
  CrmCustomer,
  CrmCustomerSummary,
  UpdateCrmCustomerRequest,
} from '../../../core/models/admin-crm.model';
import { AdminCrmService } from '../../../core/services/admin/admin-crm.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';

type FormMode = 'create' | 'edit';
type SortDir = 'asc' | 'desc';
type CrmSearchScope =
  | 'all'
  | 'serialNumber'
  | 'industryName'
  | 'sector'
  | 'location'
  | 'purchaserName'
  | 'purchaserPhone'
  | 'purchaserEmail'
  | 'maintenanceName'
  | 'maintenancePhone'
  | 'maintenanceEmail'
  | 'followUpDate'
  | 'meetingDate'
  | 'coordinatorName'
  | 'remark'
  | 'updatedByName'
  | 'createdByName';
type CrmSortKey =
  | 'serialNumber'
  | 'industryName'
  | 'sector'
  | 'location'
  | 'purchaserName'
  | 'purchaserPhone'
  | 'purchaserEmail'
  | 'maintenanceName'
  | 'maintenancePhone'
  | 'maintenanceEmail'
  | 'followUpDate'
  | 'meetingDate'
  | 'coordinatorName'
  | 'remark'
  | 'quarterEnding'
  | 'updatedByName'
  | 'updatedAt'
  | 'createdAt';

const ADMIN_SEARCH_SCOPES: { value: CrmSearchScope; label: string }[] = [
  { value: 'all', label: 'All columns' },
  { value: 'serialNumber', label: 'S.No' },
  { value: 'industryName', label: 'Industry name' },
  { value: 'sector', label: 'Sector' },
  { value: 'location', label: 'Location' },
  { value: 'purchaserName', label: 'Purchaser name' },
  { value: 'purchaserPhone', label: 'Purchaser contact' },
  { value: 'purchaserEmail', label: 'Purchaser email' },
  { value: 'maintenanceName', label: 'Maintenance name' },
  { value: 'maintenancePhone', label: 'Maintenance contact' },
  { value: 'maintenanceEmail', label: 'Maintenance email' },
  { value: 'followUpDate', label: 'Follow-up date' },
  { value: 'meetingDate', label: 'Meeting date' },
  { value: 'coordinatorName', label: 'Coordinator name' },
  { value: 'remark', label: 'Remarks' },
  { value: 'updatedByName', label: 'Updated by' },
  { value: 'createdByName', label: 'Created by' },
];

interface CrmFormState {
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
  quarterEnding: string;
  coordinatorName: string;
  remark: string;
  isActive: boolean;
}

const emptyForm = (): CrmFormState => ({
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
  quarterEnding: '',
  coordinatorName: '',
  remark: '',
  isActive: true,
});

@Component({
  selector: 'app-admin-crm',
  imports: [FormsModule, LoadingOverlayComponent],
  templateUrl: './admin-crm.component.html',
  styleUrl: './admin-crm.component.css',
})
export class AdminCrmComponent implements OnInit {
  private readonly crmService = inject(AdminCrmService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('excelInput');

  readonly loading = signal(true);
  readonly detailLoading = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly uploading = signal(false);
  readonly overlayLoading = computed(
    () =>
      this.loading() ||
      this.detailLoading() ||
      this.saving() ||
      this.deleting() ||
      this.uploading(),
  );
  readonly errorMessage = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly customers = signal<CrmCustomer[]>([]);
  readonly searchQuery = signal('');
  readonly showInactive = signal(false);
  readonly replaceOnUpload = signal(false);
  readonly selectedId = signal<string | null>(null);
  readonly selectedDetail = signal<CrmCustomer | null>(null);
  readonly detailOpen = signal(false);

  readonly formOpen = signal(false);
  readonly formMode = signal<FormMode>('create');
  readonly form = signal<CrmFormState>(emptyForm());
  readonly sortKey = signal<CrmSortKey>('serialNumber');
  readonly sortDir = signal<SortDir>('asc');
  readonly searchScope = signal<CrmSearchScope>('all');
  readonly adminSearchScopes = ADMIN_SEARCH_SCOPES;

  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'ADMIN');

  readonly canDeleteSelected = computed(() => {
    const detail = this.selectedDetail();
    if (!detail) {
      return false;
    }
    return detail.isActive !== false;
  });

  readonly filteredCustomers = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const includeInactive = this.showInactive();
    const admin = this.isAdmin();
    const scope = this.searchScope();
    const key = this.sortKey();
    const dir = this.sortDir();
    const multiplier = dir === 'asc' ? 1 : -1;

    const filtered = this.customers().filter((customer) => {
      if (!includeInactive && customer.isActive === false) {
        return false;
      }
      if (!query) {
        return true;
      }
      return this.matchesSearch(customer, query, admin ? scope : 'all', admin);
    });

    return [...filtered].sort((left, right) => {
      const leftValue = this.readSortValue(left, key);
      const rightValue = this.readSortValue(right, key);

      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        if (leftValue === rightValue) {
          return ((left.serialNumber ?? 0) - (right.serialNumber ?? 0)) * multiplier;
        }
        return (leftValue - rightValue) * multiplier;
      }

      const leftText = String(leftValue);
      const rightText = String(rightValue);
      if (!leftText && rightText) {
        return 1 * multiplier;
      }
      if (leftText && !rightText) {
        return -1 * multiplier;
      }
      const compared = leftText.localeCompare(rightText, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      if (compared !== 0) {
        return compared * multiplier;
      }
      return ((left.serialNumber ?? 0) - (right.serialNumber ?? 0)) * multiplier;
    });
  });

  private matchesSearch(
    customer: CrmCustomer,
    query: string,
    scope: CrmSearchScope,
    admin: boolean,
  ): boolean {
    if (scope !== 'all') {
      return this.readSearchText(customer, scope).includes(query);
    }

    const haystack = admin
      ? [
          String(customer.serialNumber ?? ''),
          customer.industryName,
          customer.sector,
          customer.location,
          customer.purchaserName,
          customer.purchaserPhone,
          customer.purchaserEmail,
          customer.maintenanceName,
          customer.maintenancePhone,
          customer.maintenanceEmail,
          customer.followUpDate,
          customer.meetingDate,
          customer.coordinatorName,
          customer.remark,
          customer.updatedByName,
          customer.updatedByRole,
          customer.createdByName,
          customer.createdByRole,
        ]
      : [
          String(customer.serialNumber ?? ''),
          customer.industryName,
          customer.sector,
          customer.coordinatorName,
          customer.remark,
          customer.followUpDate,
          customer.quarterEnding,
        ];
    return haystack
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query);
  }

  private readSearchText(customer: CrmCustomer, scope: CrmSearchScope): string {
    switch (scope) {
      case 'serialNumber':
        return String(customer.serialNumber ?? '').toLowerCase();
      case 'industryName':
        return String(customer.industryName ?? '').toLowerCase();
      case 'sector':
        return String(customer.sector ?? '').toLowerCase();
      case 'location':
        return String(customer.location ?? '').toLowerCase();
      case 'purchaserName':
        return String(customer.purchaserName ?? '').toLowerCase();
      case 'purchaserPhone':
        return String(customer.purchaserPhone ?? '').toLowerCase();
      case 'purchaserEmail':
        return String(customer.purchaserEmail ?? '').toLowerCase();
      case 'maintenanceName':
        return String(customer.maintenanceName ?? '').toLowerCase();
      case 'maintenancePhone':
        return String(customer.maintenancePhone ?? '').toLowerCase();
      case 'maintenanceEmail':
        return String(customer.maintenanceEmail ?? '').toLowerCase();
      case 'followUpDate':
        return String(customer.followUpDate ?? '').toLowerCase();
      case 'meetingDate':
        return String(customer.meetingDate ?? '').toLowerCase();
      case 'coordinatorName':
        return String(customer.coordinatorName ?? '').toLowerCase();
      case 'remark':
        return String(customer.remark ?? '').toLowerCase();
      case 'updatedByName':
        return `${customer.updatedByName ?? ''} ${customer.updatedByRole ?? ''}`.toLowerCase();
      case 'createdByName':
        return `${customer.createdByName ?? ''} ${customer.createdByRole ?? ''}`.toLowerCase();
      default:
        return '';
    }
  }

  actorLabel(name?: string | null, role?: string | null): string {
    const trimmedName = name?.trim();
    const trimmedRole = role?.trim();
    if (trimmedName && trimmedRole) {
      return `${trimmedName} (${trimmedRole})`;
    }
    return trimmedName || trimmedRole || '—';
  }

  formatDateTime(value?: string | null): string {
    if (!value) {
      return '—';
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  }

  toggleSort(key: CrmSortKey, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.sortKey() === key) {
      this.sortDir.update((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    this.sortKey.set(key);
    this.sortDir.set('asc');
  }

  isSortedBy(key: CrmSortKey): boolean {
    return this.sortKey() === key;
  }

  sortIndicator(key: CrmSortKey): string {
    if (this.sortKey() !== key) {
      return '↕';
    }
    return this.sortDir() === 'asc' ? '▲' : '▼';
  }

  private readSortValue(
    row: CrmCustomer,
    key: CrmSortKey,
  ): string | number {
    if (key === 'serialNumber') {
      return row.serialNumber ?? 0;
    }
    if (key === 'followUpDate' || key === 'meetingDate' || key === 'quarterEnding') {
      return this.toSortableDate(row[key]);
    }
    if (key === 'updatedAt' || key === 'createdAt') {
      return this.toSortableDateTime(row[key]);
    }
    if (key === 'updatedByName') {
      return `${row.updatedByName ?? ''} ${row.updatedByRole ?? ''}`.trim().toLowerCase();
    }
    return String(row[key] ?? '')
      .trim()
      .toLowerCase();
  }

  private toSortableDateTime(value?: string | null): number {
    if (!value) {
      return Number.POSITIVE_INFINITY;
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
  }

  private toSortableDate(value?: string | null): number {
    if (!value) {
      return Number.POSITIVE_INFINITY;
    }
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    if (this.isAdmin()) {
      this.crmService.listFull(true).subscribe({
        next: (list: CrmCustomer[]) => this.onListLoaded(list),
        error: (err: unknown) => this.onListError(err),
      });
      return;
    }

    this.crmService.list(true).subscribe({
      next: (list: CrmCustomerSummary[]) =>
        this.onListLoaded(list.map((row) => this.summaryToRow(row))),
      error: (err: unknown) => this.onListError(err),
    });
  }

  private onListLoaded(rows: CrmCustomer[]): void {
    this.customers.set(rows);
    this.loading.set(false);

    const selected = this.selectedId();
    if (selected && rows.some((customer) => customer.id === selected)) {
      this.loadDetail(selected, false);
    } else {
      this.closeDetail();
    }
  }

  private onListError(err: unknown): void {
    this.loading.set(false);
    this.errorMessage.set('Could not load CRM customers.');
    this.toast.fromApiError(err, 'Could not load CRM customers.');
  }

  selectCustomer(customer: CrmCustomer): void {
    this.selectedId.set(customer.id);
    this.selectedDetail.set(null);
    this.detailOpen.set(true);
    this.loadDetail(customer.id, true);
  }

  editRow(customer: CrmCustomer, event: Event): void {
    event.stopPropagation();
    this.selectedId.set(customer.id);
    this.actionError.set(null);

    if (this.isAdmin()) {
      this.selectedDetail.set(customer);
      this.openEditWith(customer);
      return;
    }

    this.detailLoading.set(true);
    this.crmService.getById(customer.id).subscribe({
      next: (detail) => {
        this.selectedDetail.set(detail);
        this.detailLoading.set(false);
        this.openEditWith(detail);
      },
      error: (err) => {
        this.detailLoading.set(false);
        this.toast.fromApiError(err, 'Could not load customer for edit.');
      },
    });
  }

  closeDetail(): void {
    this.detailOpen.set(false);
    this.selectedId.set(null);
    this.selectedDetail.set(null);
    this.actionError.set(null);
  }

  loadDetail(id: string, showErrors = true): void {
    this.detailLoading.set(true);
    this.actionError.set(null);

    this.crmService.getById(id).subscribe({
      next: (detail) => {
        const fromList = this.customers().find((customer) => customer.id === id);
        this.selectedDetail.set({
          ...detail,
          serialNumber: detail.serialNumber || fromList?.serialNumber,
          isActive: detail.isActive ?? fromList?.isActive,
        });
        this.detailLoading.set(false);
      },
      error: (err) => {
        this.detailLoading.set(false);
        if (showErrors) {
          this.actionError.set('Could not load customer details.');
          this.toast.fromApiError(err, 'Could not load customer details.');
        }
      },
    });
  }

  triggerExcelPicker(): void {
    this.fileInput()?.nativeElement.click();
  }

  onExcelSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.isAdmin()) {
      return;
    }

    this.uploading.set(true);
    this.actionError.set(null);

    this.crmService.uploadExcel(file, this.replaceOnUpload()).subscribe({
      next: (result) => {
        this.uploading.set(false);
        this.toast.success(result.message || `Imported ${result.imported} row(s).`);
        this.closeDetail();
        this.load();
      },
      error: (err) => {
        this.uploading.set(false);
        this.actionError.set(this.extractError(err));
        this.toast.fromApiError(err, 'Could not upload Excel file.');
      },
    });
  }

  openCreate(): void {
    this.formMode.set('create');
    this.form.set(emptyForm());
    this.actionError.set(null);
    this.formOpen.set(true);
  }

  openEdit(): void {
    const detail = this.selectedDetail();
    if (!detail) {
      return;
    }
    this.openEditWith(detail);
  }

  private openEditWith(detail: CrmCustomer): void {
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
      quarterEnding: detail.quarterEnding ?? '',
      coordinatorName: detail.coordinatorName ?? '',
      remark: detail.remark ?? '',
      isActive: detail.isActive !== false,
    });
    this.actionError.set(null);
    this.formOpen.set(true);
  }

  closeForm(): void {
    if (this.saving()) {
      return;
    }
    this.formOpen.set(false);
    this.actionError.set(null);
  }

  saveForm(): void {
    const state = this.form();
    if (!state.industryName.trim()) {
      this.actionError.set('Industry name is required.');
      this.toast.warning('Industry name is required.');
      return;
    }

    this.saving.set(true);
    this.actionError.set(null);

    if (this.formMode() === 'create') {
      const request = this.toCreateRequest(state);
      this.crmService.create(request).subscribe({
        next: (created) => {
          this.saving.set(false);
          this.formOpen.set(false);
          this.toast.success('CRM customer created.');
          this.selectedId.set(created.id);
          this.selectedDetail.set(created);
          this.detailOpen.set(true);
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          this.actionError.set(this.extractError(err));
          this.toast.fromApiError(err, 'Could not create CRM customer.');
        },
      });
      return;
    }

    const selectedId = this.selectedId();
    if (!selectedId) {
      this.saving.set(false);
      return;
    }

    const request = this.toUpdateRequest(state);
    this.crmService.update(selectedId, request).subscribe({
      next: (updated) => {
        this.selectedDetail.set(updated);
        this.saving.set(false);
        this.formOpen.set(false);
        this.toast.success('CRM customer updated.');
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.actionError.set(this.extractError(err));
        this.toast.fromApiError(err, 'Could not update CRM customer.');
      },
    });
  }

  deleteSelected(): void {
    const detail = this.selectedDetail();
    if (!detail || !this.canDeleteSelected()) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${detail.industryName}? It will be hidden from the active CRM list.`,
    );
    if (!confirmed) {
      return;
    }

    this.deleting.set(true);
    this.actionError.set(null);

    this.crmService.delete(detail.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.toast.success('CRM customer deleted.');
        this.closeDetail();
        this.load();
      },
      error: (err) => {
        this.deleting.set(false);
        this.actionError.set(this.extractError(err));
        this.toast.fromApiError(err, 'Could not delete CRM customer.');
      },
    });
  }

  updateFormField<K extends keyof CrmFormState>(field: K, value: CrmFormState[K]): void {
    this.form.update((current) => ({ ...current, [field]: value }));
  }

  displayValue(value?: string | null): string {
    return value?.trim() ? value : '—';
  }

  formatDate(value?: string | null): string {
    if (!value) {
      return '—';
    }
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnly) {
      const year = Number(dateOnly[1]);
      const month = Number(dateOnly[2]);
      const day = Number(dateOnly[3]);
      return new Date(year, month - 1, day).toLocaleDateString();
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  }

  private toCreateRequest(state: CrmFormState): CreateCrmCustomerRequest {
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
      quarterEnding: state.quarterEnding || null,
      coordinatorName: state.coordinatorName.trim() || undefined,
      remark: state.remark.trim() || undefined,
    };
  }

  private toUpdateRequest(state: CrmFormState): UpdateCrmCustomerRequest {
    return {
      ...this.toCreateRequest(state),
      isActive: state.isActive,
    };
  }

  private extractError(err: { error?: { message?: string } }): string {
    return err?.error?.message ?? 'Something went wrong. Please try again.';
  }

  private summaryToRow(row: CrmCustomerSummary): CrmCustomer {
    return {
      id: row.id,
      serialNumber: row.serialNumber,
      industryName: row.industryName,
      sector: row.sector,
      coordinatorName: row.coordinatorName,
      remark: row.remark,
      followUpDate: row.followUpDate,
      quarterEnding: row.quarterEnding,
      isActive: row.isActive,
    };
  }
}
