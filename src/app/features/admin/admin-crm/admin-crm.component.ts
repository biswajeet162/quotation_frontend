import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CreateCrmCustomerRequest,
  CrmCustomer,
  UpdateCrmCustomerRequest,
} from '../../../core/models/admin-crm.model';
import { AdminCrmService } from '../../../core/services/admin/admin-crm.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';

type FormMode = 'create' | 'edit';

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

  readonly loading = signal(true);
  readonly detailLoading = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly overlayLoading = computed(
    () => this.loading() || this.detailLoading() || this.saving() || this.deleting(),
  );
  readonly errorMessage = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly customers = signal<CrmCustomer[]>([]);
  readonly searchQuery = signal('');
  readonly showInactive = signal(false);
  readonly selectedId = signal<string | null>(null);
  readonly selectedDetail = signal<CrmCustomer | null>(null);

  readonly formOpen = signal(false);
  readonly formMode = signal<FormMode>('create');
  readonly form = signal<CrmFormState>(emptyForm());

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

    return this.customers().filter((customer) => {
      if (!includeInactive && customer.isActive === false) {
        return false;
      }
      if (!query) {
        return true;
      }
      const haystack = [
        customer.industryName,
        customer.sector,
        customer.location,
        customer.purchaserName,
        customer.purchaserPhone,
        customer.purchaserEmail,
        customer.maintenanceName,
        customer.coordinatorName,
        customer.remark,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.crmService.list(true).subscribe({
      next: (list) => {
        this.customers.set(list);
        this.loading.set(false);

        const selected = this.selectedId();
        if (selected && list.some((customer) => customer.id === selected)) {
          this.loadDetail(selected);
        } else {
          this.selectedId.set(null);
          this.selectedDetail.set(null);
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set('Could not load CRM customers.');
        this.toast.fromApiError(err, 'Could not load CRM customers.');
      },
    });
  }

  selectCustomer(customer: CrmCustomer): void {
    if (this.selectedId() === customer.id) {
      return;
    }
    this.selectedId.set(customer.id);
    this.selectedDetail.set(null);
    this.loadDetail(customer.id);
  }

  loadDetail(id: string): void {
    this.detailLoading.set(true);
    this.actionError.set(null);

    this.crmService.getById(id).subscribe({
      next: (detail) => {
        const fromList = this.customers().find((customer) => customer.id === id);
        this.selectedDetail.set({
          ...detail,
          isActive: detail.isActive ?? fromList?.isActive,
        });
        this.detailLoading.set(false);
      },
      error: (err) => {
        this.detailLoading.set(false);
        this.actionError.set('Could not load customer details.');
        this.toast.fromApiError(err, 'Could not load customer details.');
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
          this.customers.update((list) => [created, ...list]);
          this.saving.set(false);
          this.formOpen.set(false);
          this.selectedId.set(created.id);
          this.selectedDetail.set(created);
          this.toast.success('CRM customer created.');
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
        this.customers.update((list) =>
          list.map((item) => (item.id === updated.id ? updated : item)),
        );
        this.selectedDetail.set(updated);
        this.saving.set(false);
        this.formOpen.set(false);
        this.toast.success('CRM customer updated.');
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
        this.customers.update((list) =>
          list.map((item) =>
            item.id === detail.id ? { ...item, isActive: false } : item,
          ),
        );
        this.selectedId.set(null);
        this.selectedDetail.set(null);
        this.deleting.set(false);
        this.toast.success('CRM customer deleted.');
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
}
