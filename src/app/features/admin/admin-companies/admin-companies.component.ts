import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';
import {
  AdminConsumerCompanyDetail,
  AdminConsumerCompanySummary,
  CreateAdminConsumerCompanyRequest,
  CreateAdminConsumerEmployeeRequest,
} from '../../../core/models/admin-company.model';
import { AdminCompanyService } from '../../../core/services/admin/admin-company.service';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';

interface CompanyFormState {
  name: string;
  email: string;
  phone: string;
  gstNumber: string;
  panNumber: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pinCode: string;
  isActive: boolean;
}

interface EmployeeFormState {
  name: string;
  email: string;
  phone: string;
  password: string;
}

const emptyCompanyForm = (): CompanyFormState => ({
  name: '',
  email: '',
  phone: '',
  gstNumber: '',
  panNumber: '',
  address: '',
  city: '',
  state: '',
  country: '',
  pinCode: '',
  isActive: true,
});

const emptyEmployeeForm = (): EmployeeFormState => ({
  name: '',
  email: '',
  phone: '',
  password: '',
});

@Component({
  selector: 'app-admin-companies',
  imports: [FormsModule, LoadingOverlayComponent],
  templateUrl: './admin-companies.component.html',
  styleUrl: './admin-companies.component.css',
})
export class AdminCompaniesComponent implements OnInit {
  private readonly companyService = inject(AdminCompanyService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly detailLoading = signal(false);
  readonly saving = signal(false);
  readonly uploadingLogo = signal(false);
  readonly deletingEmployee = signal(false);
  readonly overlayLoading = computed(
    () => this.loading() || this.detailLoading() || this.saving() || this.uploadingLogo() || this.deletingEmployee(),
  );

  readonly errorMessage = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly companies = signal<AdminConsumerCompanySummary[]>([]);
  readonly searchQuery = signal('');
  readonly showInactive = signal(false);
  readonly selectedId = signal<string | null>(null);
  readonly selectedDetail = signal<AdminConsumerCompanyDetail | null>(null);
  readonly logoPreviewUrl = signal<string | null>(null);

  readonly companyFormOpen = signal(false);
  readonly employeeFormOpen = signal(false);
  readonly companyFormMode = signal<'create' | 'edit'>('create');
  readonly companyForm = signal<CompanyFormState>(emptyCompanyForm());
  readonly employeeForm = signal<EmployeeFormState>(emptyEmployeeForm());

  readonly filteredCompanies = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const includeInactive = this.showInactive();

    return this.companies().filter((company) => {
      if (!includeInactive && company.isActive === false) {
        return false;
      }
      if (!query) {
        return true;
      }
      const haystack = [company.name, company.email, company.city, company.state]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  });

  private logoObjectUrl: string | null = null;

  ngOnInit(): void {
    this.load();
    this.destroyRef.onDestroy(() => this.revokeLogoUrl());
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.companyService.list(true).subscribe({
      next: (list) => {
        this.companies.set(list);
        this.loading.set(false);

        const selected = this.selectedId();
        if (selected && list.some((company) => company.id === selected)) {
          this.loadDetail(selected);
        } else {
          this.selectedId.set(null);
          this.selectedDetail.set(null);
          this.logoPreviewUrl.set(null);
        }
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Could not load companies.');
      },
    });
  }

  selectCompany(company: AdminConsumerCompanySummary): void {
    if (this.selectedId() === company.id) {
      return;
    }
    this.selectedId.set(company.id);
    this.actionError.set(null);
    this.successMessage.set(null);
    this.loadDetail(company.id);
  }

  loadDetail(id: string): void {
    this.detailLoading.set(true);
    this.actionError.set(null);

    this.companyService.getById(id).subscribe({
      next: (detail) => {
        this.selectedDetail.set(detail);
        this.detailLoading.set(false);
        this.loadLogoPreview(id, detail.consumerLogoUrl);
      },
      error: () => {
        this.detailLoading.set(false);
        this.actionError.set('Could not load company details.');
      },
    });
  }

  openCreateCompany(): void {
    this.companyFormMode.set('create');
    this.companyForm.set(emptyCompanyForm());
    this.actionError.set(null);
    this.companyFormOpen.set(true);
  }

  openEditCompany(): void {
    const detail = this.selectedDetail();
    if (!detail) {
      return;
    }

    this.companyFormMode.set('edit');
    this.companyForm.set({
      name: detail.name,
      email: detail.email,
      phone: detail.phone,
      gstNumber: detail.gstNumber ?? '',
      panNumber: detail.panNumber ?? '',
      address: detail.address ?? '',
      city: detail.city ?? '',
      state: detail.state ?? '',
      country: detail.country ?? '',
      pinCode: detail.pinCode ?? '',
      isActive: detail.isActive !== false,
    });
    this.actionError.set(null);
    this.companyFormOpen.set(true);
  }

  closeCompanyForm(): void {
    if (this.saving()) {
      return;
    }
    this.companyFormOpen.set(false);
    this.actionError.set(null);
  }

  saveCompanyForm(): void {
    const state = this.companyForm();
    if (!state.name.trim() || !state.email.trim() || !state.phone.trim()) {
      this.actionError.set('Company name, email, and phone are required.');
      return;
    }

    this.saving.set(true);
    this.actionError.set(null);

    const payload: CreateAdminConsumerCompanyRequest = {
      name: state.name.trim(),
      email: state.email.trim(),
      phone: state.phone.trim(),
      gstNumber: state.gstNumber.trim() || undefined,
      panNumber: state.panNumber.trim() || undefined,
      address: state.address.trim() || undefined,
      city: state.city.trim() || undefined,
      state: state.state.trim() || undefined,
      country: state.country.trim() || undefined,
      pinCode: state.pinCode.trim() || undefined,
    };

    if (this.companyFormMode() === 'create') {
      this.companyService.create(payload).subscribe({
        next: (created) => this.onCompanySaved(created, true),
        error: (err) => this.onSaveError(err),
      });
      return;
    }

    const selectedId = this.selectedId();
    if (!selectedId) {
      this.saving.set(false);
      return;
    }

    this.companyService
      .update(selectedId, { ...payload, isActive: state.isActive })
      .subscribe({
        next: (updated) => this.onCompanySaved(updated, false),
        error: (err) => this.onSaveError(err),
      });
  }

  onLogoSelected(event: Event): void {
    const selectedId = this.selectedId();
    if (!selectedId) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !file.type.startsWith('image/')) {
      this.actionError.set('Please choose an image file for the logo.');
      return;
    }

    this.uploadingLogo.set(true);
    this.actionError.set(null);
    this.successMessage.set(null);

    this.companyService
      .uploadLogo(selectedId, file)
      .pipe(switchMap(() => this.companyService.getById(selectedId)))
      .subscribe({
        next: (updated) => {
          this.applyDetail(updated);
          this.uploadingLogo.set(false);
          this.successMessage.set('Company logo updated.');
        },
        error: (err) => {
          this.uploadingLogo.set(false);
          this.actionError.set(this.extractError(err));
        },
      });
  }

  openAddEmployee(): void {
    this.employeeForm.set(emptyEmployeeForm());
    this.actionError.set(null);
    this.employeeFormOpen.set(true);
  }

  closeEmployeeForm(): void {
    if (this.saving()) {
      return;
    }
    this.employeeFormOpen.set(false);
    this.actionError.set(null);
  }

  saveEmployeeForm(): void {
    const selectedId = this.selectedId();
    const state = this.employeeForm();
    if (!selectedId) {
      return;
    }
    if (!state.name.trim() || !state.email.trim() || !state.phone.trim() || !state.password.trim()) {
      this.actionError.set('Employee name, email, phone, and password are required.');
      return;
    }

    this.saving.set(true);
    this.actionError.set(null);

    const request: CreateAdminConsumerEmployeeRequest = {
      name: state.name.trim(),
      email: state.email.trim(),
      phone: state.phone.trim(),
      password: state.password,
    };

    this.companyService.addEmployee(selectedId, request).subscribe({
      next: (updated) => {
        this.applyDetail(updated);
        this.saving.set(false);
        this.employeeFormOpen.set(false);
        this.successMessage.set('Employee added successfully.');
      },
      error: (err) => this.onSaveError(err),
    });
  }

  deactivateEmployee(employeeId: string, employeeName: string): void {
    const selectedId = this.selectedId();
    if (!selectedId) {
      return;
    }

    const confirmed = window.confirm(`Deactivate ${employeeName}? They will no longer be able to sign in.`);
    if (!confirmed) {
      return;
    }

    this.deletingEmployee.set(true);
    this.actionError.set(null);

    this.companyService.deactivateEmployee(selectedId, employeeId).subscribe({
      next: (updated) => {
        this.applyDetail(updated);
        this.deletingEmployee.set(false);
        this.successMessage.set('Employee deactivated.');
      },
      error: (err) => {
        this.deletingEmployee.set(false);
        this.actionError.set(this.extractError(err));
      },
    });
  }

  updateCompanyFormField<K extends keyof CompanyFormState>(field: K, value: CompanyFormState[K]): void {
    this.companyForm.update((current) => ({ ...current, [field]: value }));
  }

  updateEmployeeFormField<K extends keyof EmployeeFormState>(field: K, value: EmployeeFormState[K]): void {
    this.employeeForm.update((current) => ({ ...current, [field]: value }));
  }

  formatDate(value?: string): string {
    if (!value) {
      return '—';
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  }

  displayValue(value?: string | null): string {
    const trimmed = value?.trim();
    return trimmed ? trimmed : '—';
  }

  private onCompanySaved(detail: AdminConsumerCompanyDetail, created: boolean): void {
    const summary: AdminConsumerCompanySummary = {
      id: detail.id,
      name: detail.name,
      email: detail.email,
      phone: detail.phone,
      city: detail.city,
      state: detail.state,
      isActive: detail.isActive,
      employeeCount: detail.employees.filter((employee) => employee.isActive !== false).length,
      hasLogo: Boolean(detail.consumerLogoUrl),
      createdAt: detail.createdAt,
    };

    if (created) {
      this.companies.update((list) => [summary, ...list]);
    } else {
      this.companies.update((list) => list.map((item) => (item.id === summary.id ? summary : item)));
    }

    this.selectedId.set(detail.id);
    this.applyDetail(detail);
    this.saving.set(false);
    this.companyFormOpen.set(false);
    this.successMessage.set(created ? 'Company created successfully.' : 'Company updated successfully.');
  }

  private applyDetail(detail: AdminConsumerCompanyDetail): void {
    this.selectedDetail.set(detail);
    this.companies.update((list) =>
      list.map((item) =>
        item.id === detail.id
          ? {
              ...item,
              name: detail.name,
              email: detail.email,
              phone: detail.phone,
              city: detail.city,
              state: detail.state,
              isActive: detail.isActive,
              employeeCount: detail.employees.filter((employee) => employee.isActive !== false).length,
              hasLogo: Boolean(detail.consumerLogoUrl),
            }
          : item,
      ),
    );
    this.loadLogoPreview(detail.id, detail.consumerLogoUrl);
  }

  private onSaveError(err: { error?: { message?: string } }): void {
    this.saving.set(false);
    this.actionError.set(this.extractError(err));
  }

  private loadLogoPreview(companyId: string, logoPath?: string): void {
    this.revokeLogoUrl();
    this.logoPreviewUrl.set(null);

    if (!logoPath) {
      return;
    }

    this.companyService.loadLogoBlob(companyId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (blob) => {
        this.logoObjectUrl = URL.createObjectURL(blob);
        this.logoPreviewUrl.set(this.logoObjectUrl);
      },
    });
  }

  private revokeLogoUrl(): void {
    if (this.logoObjectUrl) {
      URL.revokeObjectURL(this.logoObjectUrl);
      this.logoObjectUrl = null;
    }
  }

  private extractError(err: { error?: { message?: string } }): string {
    return err?.error?.message ?? 'Something went wrong. Please try again.';
  }
}
