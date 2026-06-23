import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AdminUserDetail,
  AdminUserSummary,
  CreateAdminUserRequest,
  UpdateAdminUserRequest,
  UserRole,
} from '../../../core/models/admin-user.model';
import { AdminUserService } from '../../../core/services/admin/admin-user.service';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';

type RoleTab = UserRole;
type FormMode = 'create' | 'edit';

interface UserFormState {
  name: string;
  email: string;
  password: string;
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  gstNumber: string;
  panNumber: string;
  address: string;
  city: string;
  state: string;
  country: string;
  isActive: boolean;
  emailVerified: boolean;
}

const emptyForm = (): UserFormState => ({
  name: '',
  email: '',
  password: '',
  companyName: '',
  companyEmail: '',
  companyPhone: '',
  gstNumber: '',
  panNumber: '',
  address: '',
  city: '',
  state: '',
  country: '',
  isActive: true,
  emailVerified: true,
});

const ROLE_TABS: { role: RoleTab; label: string }[] = [
  { role: 'CONSUMER', label: 'Consumers' },
  { role: 'ADMIN', label: 'Admins' },
  { role: 'DISTRIBUTOR', label: 'Distributors' },
];

@Component({
  selector: 'app-admin-users',
  imports: [FormsModule, LoadingOverlayComponent],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.css',
})
export class AdminUsersComponent implements OnInit {
  private readonly userService = inject(AdminUserService);

  readonly roleTabs = ROLE_TABS;
  readonly activeRole = signal<RoleTab>('CONSUMER');
  readonly loading = signal(true);
  readonly detailLoading = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly overlayLoading = computed(
    () => this.loading() || this.detailLoading() || this.saving() || this.deleting(),
  );
  readonly errorMessage = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly users = signal<AdminUserSummary[]>([]);
  readonly searchQuery = signal('');
  readonly showInactive = signal(false);
  readonly selectedId = signal<string | null>(null);
  readonly selectedDetail = signal<AdminUserDetail | null>(null);

  readonly formOpen = signal(false);
  readonly formMode = signal<FormMode>('create');
  readonly form = signal<UserFormState>(emptyForm());

  readonly filteredUsers = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const includeInactive = this.showInactive();

    return this.users().filter((user) => {
      if (!includeInactive && user.isActive === false) {
        return false;
      }
      if (!query) {
        return true;
      }
      const haystack = [user.name, user.email, user.companyName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  });

  readonly activeTabLabel = computed(() => {
    const tab = this.roleTabs.find((item) => item.role === this.activeRole());
    return tab?.label ?? 'Users';
  });

  ngOnInit(): void {
    this.load();
  }

  setRoleTab(role: RoleTab): void {
    if (this.activeRole() === role) {
      return;
    }
    this.activeRole.set(role);
    this.selectedId.set(null);
    this.selectedDetail.set(null);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.userService.list(this.activeRole(), true).subscribe({
      next: (list) => {
        this.users.set(list);
        this.loading.set(false);

        const selected = this.selectedId();
        if (selected && list.some((user) => user.id === selected)) {
          this.loadDetail(selected);
        } else {
          this.selectedId.set(null);
          this.selectedDetail.set(null);
        }
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Could not load users.');
      },
    });
  }

  selectUser(user: AdminUserSummary): void {
    if (this.selectedId() === user.id) {
      return;
    }
    this.selectedId.set(user.id);
    this.loadDetail(user.id);
  }

  loadDetail(id: string): void {
    this.detailLoading.set(true);
    this.actionError.set(null);

    this.userService.getById(id).subscribe({
      next: (detail) => {
        this.selectedDetail.set(detail);
        this.detailLoading.set(false);
      },
      error: () => {
        this.detailLoading.set(false);
        this.actionError.set('Could not load user details.');
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
      name: detail.name,
      email: detail.email,
      password: '',
      companyName: detail.company?.name ?? '',
      companyEmail: detail.company?.email ?? detail.email,
      companyPhone: detail.company?.phone ?? '',
      gstNumber: detail.company?.gstNumber ?? '',
      panNumber: detail.company?.panNumber ?? '',
      address: detail.company?.address ?? '',
      city: detail.company?.city ?? '',
      state: detail.company?.state ?? '',
      country: detail.company?.country ?? '',
      isActive: detail.isActive !== false,
      emailVerified: detail.emailVerified === true,
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
    if (!state.name.trim() || !state.email.trim()) {
      this.actionError.set('Name and email are required.');
      return;
    }
    if (!state.companyName.trim() || !state.companyEmail.trim() || !state.companyPhone.trim()) {
      this.actionError.set('Company name, email, and phone are required.');
      return;
    }
    if (this.formMode() === 'create' && !state.password.trim()) {
      this.actionError.set('Password is required for new users.');
      return;
    }

    this.saving.set(true);
    this.actionError.set(null);

    if (this.formMode() === 'create') {
      const request: CreateAdminUserRequest = this.toCreateRequest(state);
      this.userService.create(request).subscribe({
        next: (created) => {
          this.users.update((list) => [this.toSummary(created), ...list]);
          this.saving.set(false);
          this.formOpen.set(false);
          this.selectedId.set(created.id);
          this.selectedDetail.set(created);
        },
        error: (err) => {
          this.saving.set(false);
          this.actionError.set(this.extractError(err));
        },
      });
      return;
    }

    const selectedId = this.selectedId();
    if (!selectedId) {
      this.saving.set(false);
      return;
    }

    const request: UpdateAdminUserRequest = this.toUpdateRequest(state);
    this.userService.update(selectedId, request).subscribe({
      next: (updated) => {
        this.users.update((list) =>
          list.map((item) => (item.id === updated.id ? this.toSummary(updated) : item)),
        );
        this.selectedDetail.set(updated);
        this.saving.set(false);
        this.formOpen.set(false);
      },
      error: (err) => {
        this.saving.set(false);
        this.actionError.set(this.extractError(err));
      },
    });
  }

  deleteSelected(): void {
    const detail = this.selectedDetail();
    if (!detail) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${detail.name} (${detail.email})? They will no longer be able to sign in.`,
    );
    if (!confirmed) {
      return;
    }

    this.deleting.set(true);
    this.actionError.set(null);

    this.userService.delete(detail.id).subscribe({
      next: () => {
        this.users.update((list) =>
          list.map((item) =>
            item.id === detail.id ? { ...item, isActive: false } : item,
          ),
        );
        this.selectedId.set(null);
        this.selectedDetail.set(null);
        this.deleting.set(false);
      },
      error: (err) => {
        this.deleting.set(false);
        this.actionError.set(this.extractError(err));
      },
    });
  }

  updateFormField<K extends keyof UserFormState>(field: K, value: UserFormState[K]): void {
    this.form.update((current) => ({ ...current, [field]: value }));
  }

  formatDate(value?: string): string {
    if (!value) {
      return '—';
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  }

  roleLabel(role: UserRole): string {
    return this.roleTabs.find((tab) => tab.role === role)?.label.slice(0, -1) ?? role;
  }

  private toCreateRequest(state: UserFormState): CreateAdminUserRequest {
    return {
      name: state.name.trim(),
      email: state.email.trim(),
      password: state.password,
      role: this.activeRole(),
      companyName: state.companyName.trim(),
      companyEmail: state.companyEmail.trim(),
      companyPhone: state.companyPhone.trim(),
      gstNumber: state.gstNumber.trim() || undefined,
      panNumber: state.panNumber.trim() || undefined,
      address: state.address.trim() || undefined,
      city: state.city.trim() || undefined,
      state: state.state.trim() || undefined,
      country: state.country.trim() || undefined,
    };
  }

  private toUpdateRequest(state: UserFormState): UpdateAdminUserRequest {
    return {
      name: state.name.trim(),
      email: state.email.trim(),
      password: state.password.trim() || undefined,
      companyName: state.companyName.trim(),
      companyEmail: state.companyEmail.trim(),
      companyPhone: state.companyPhone.trim(),
      gstNumber: state.gstNumber.trim() || undefined,
      panNumber: state.panNumber.trim() || undefined,
      address: state.address.trim() || undefined,
      city: state.city.trim() || undefined,
      state: state.state.trim() || undefined,
      country: state.country.trim() || undefined,
      isActive: state.isActive,
      emailVerified: state.emailVerified,
    };
  }

  private toSummary(detail: AdminUserDetail): AdminUserSummary {
    return {
      id: detail.id,
      name: detail.name,
      email: detail.email,
      role: detail.role,
      companyId: detail.company?.id,
      companyName: detail.company?.name,
      isActive: detail.isActive,
      emailVerified: detail.emailVerified,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
    };
  }

  private extractError(err: { error?: { message?: string } }): string {
    return err?.error?.message ?? 'Something went wrong. Please try again.';
  }
}
