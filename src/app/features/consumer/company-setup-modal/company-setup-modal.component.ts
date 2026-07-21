import { Component, computed, DestroyRef, inject, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth/auth.service';
import {
  ConsumerCompanyPreview,
  ConsumerOnboardingService,
} from '../../../core/services/consumer/consumer-onboarding.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { extractApiErrorMessage } from '../../../core/utils/api-error.util';

type SetupMode = 'choose' | 'create';

interface CompanyFormState {
  companyName: string;
  gstNumber: string;
  panNumber: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pinCode: string;
}

const emptyCompanyForm = (): CompanyFormState => ({
  companyName: '',
  gstNumber: '',
  panNumber: '',
  address: '',
  city: '',
  state: '',
  country: 'India',
  pinCode: '',
});

@Component({
  selector: 'app-company-setup-modal',
  imports: [FormsModule],
  templateUrl: './company-setup-modal.component.html',
  styleUrl: './company-setup-modal.component.css',
})
export class CompanySetupModalComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly onboarding = inject(ConsumerOnboardingService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly completed = output<void>();

  readonly mode = signal<SetupMode>('choose');
  readonly companies = signal<ConsumerCompanyPreview[]>([]);
  readonly loadingCompanies = signal(true);
  readonly selectedCompanyId = signal('');
  readonly companyForm = signal<CompanyFormState>(emptyCompanyForm());
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly selectedLogoPreviewUrl = signal<string | null>(null);
  readonly newLogoPreviewUrl = signal<string | null>(null);
  readonly newLogoFile = signal<File | null>(null);

  readonly selectedCompany = computed(() => {
    const id = this.selectedCompanyId();
    return this.companies().find((company) => company.id === id) ?? null;
  });

  readonly bannerCompanyName = computed(() => {
    if (this.mode() === 'create') {
      return this.companyForm().companyName.trim() || 'Your new company';
    }
    return this.selectedCompany()?.name ?? 'Select a company';
  });

  ngOnInit(): void {
    this.onboarding.listCompanies().subscribe({
      next: (companies) => {
        this.companies.set(companies);
        this.loadingCompanies.set(false);
        if (companies.length === 0) {
          this.mode.set('create');
        }
      },
      error: (err: unknown) => {
        this.loadingCompanies.set(false);
        this.mode.set('create');
        this.toast.fromApiError(err, 'Could not load companies. You can still create a new one.');
      },
    });
  }

  setMode(next: SetupMode): void {
    if (next === 'choose' && this.companies().length === 0) {
      return;
    }
    this.mode.set(next);
    this.errorMessage.set(null);
    if (next === 'create') {
      this.selectedCompanyId.set('');
      this.companyForm.set(emptyCompanyForm());
      this.clearSelectedLogoPreview();
    } else {
      this.clearNewLogoPreview();
    }
  }

  onCompanyChange(companyId: string): void {
    this.selectedCompanyId.set(companyId);
    this.errorMessage.set(null);
    this.loadSelectedCompanyLogo(companyId);
  }

  onNewLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.clearNewLogoPreview();
    this.newLogoFile.set(file);
    this.newLogoPreviewUrl.set(URL.createObjectURL(file));
    input.value = '';
  }

  updateCompanyField<K extends keyof CompanyFormState>(field: K, value: CompanyFormState[K]): void {
    this.companyForm.update((form) => ({ ...form, [field]: value }));
  }

  displayValue(value?: string | null): string {
    const trimmed = value?.trim();
    return trimmed ? trimmed : '—';
  }

  companyInitials(name: string): string {
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || 'CO'
    );
  }

  formatAddress(source: {
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pinCode?: string | null;
    country?: string | null;
  }): string {
    const lines: string[] = [];
    if (source.address?.trim()) {
      lines.push(source.address.trim());
    }
    const locality = [source.city, source.state].filter((part) => part?.trim()).join(', ');
    if (locality) {
      lines.push(locality);
    }
    if (source.pinCode?.trim()) {
      lines.push(`PIN: ${source.pinCode.trim()}`);
    }
    if (source.country?.trim()) {
      lines.push(source.country.trim());
    }
    return lines.length ? lines.join('\n') : '—';
  }

  submit(): void {
    if (this.mode() === 'choose') {
      const companyId = this.selectedCompanyId().trim();
      if (!companyId) {
        const message = 'Please choose your company from the list.';
        this.errorMessage.set(message);
        this.toast.warning(message);
        return;
      }
      this.save({ companyId });
      return;
    }

    const form = this.companyForm();
    const companyName = form.companyName.trim();
    if (!companyName) {
      const message = 'Company name is required.';
      this.errorMessage.set(message);
      this.toast.warning(message);
      return;
    }

    this.save({
      companyName,
      gstNumber: form.gstNumber.trim() || undefined,
      panNumber: form.panNumber.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      country: form.country.trim() || undefined,
      pinCode: form.pinCode.trim() || undefined,
    });
  }

  private save(request: Parameters<ConsumerOnboardingService['completeCompanySetup']>[0]): void {
    this.saving.set(true);
    this.errorMessage.set(null);

    const logo = this.mode() === 'create' ? this.newLogoFile() : null;

    this.onboarding.completeCompanySetup(request, logo).subscribe({
      next: (response) => {
        this.auth.applyAuthResponse(response);
        this.saving.set(false);
        this.toast.success(
          this.mode() === 'create'
            ? 'Company created successfully.'
            : 'Company linked successfully.',
        );
        this.completed.emit();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const fallback = 'Could not link your company. Please try again.';
        this.errorMessage.set(extractApiErrorMessage(err, fallback));
        this.toast.fromApiError(err, fallback);
      },
    });
  }

  private loadSelectedCompanyLogo(companyId: string): void {
    this.clearSelectedLogoPreview();
    const company = this.companies().find((item) => item.id === companyId);
    if (!company?.consumerLogoUrl) {
      return;
    }

    this.onboarding
      .getCompanyLogo(companyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.selectedLogoPreviewUrl.set(URL.createObjectURL(blob));
        },
        error: () => {
          this.selectedLogoPreviewUrl.set(null);
        },
      });
  }

  private clearSelectedLogoPreview(): void {
    const current = this.selectedLogoPreviewUrl();
    if (current) {
      URL.revokeObjectURL(current);
    }
    this.selectedLogoPreviewUrl.set(null);
  }

  private clearNewLogoPreview(): void {
    const current = this.newLogoPreviewUrl();
    if (current) {
      URL.revokeObjectURL(current);
    }
    this.newLogoPreviewUrl.set(null);
    this.newLogoFile.set(null);
  }
}
