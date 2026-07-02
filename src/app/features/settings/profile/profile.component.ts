import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';
import {
  DistributorProfile,
  UpdateDistributorProfileRequest,
} from '../../../core/models/distributor.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { DistributorDashboardService } from '../../../core/services/distributor/distributor-dashboard.service';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  CONSUMER: 'Consumer',
  DISTRIBUTOR: 'Distributor',
};

interface ProfileFormState {
  companyName: string;
  gstNumber: string;
  companyEmail: string;
  companyPhone: string;
  address: string;
  city: string;
  state: string;
  country: string;
}

const emptyForm = (): ProfileFormState => ({
  companyName: '',
  gstNumber: '',
  companyEmail: '',
  companyPhone: '',
  address: '',
  city: '',
  state: '',
  country: '',
});

@Component({
  selector: 'app-profile',
  imports: [FormsModule, LoadingOverlayComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit {
  private readonly distributorDashboardService = inject(DistributorDashboardService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly editDetailsMode = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly distributorProfile = signal<DistributorProfile | null>(null);
  readonly form = signal<ProfileFormState>(emptyForm());
  readonly logoPreviewUrl = signal<string | null>(null);

  readonly isDistributor = computed(() => this.auth.currentUser()?.role === 'DISTRIBUTOR');
  readonly isBusy = computed(() => this.loading() || this.saving());

  private serverLogoObjectUrl: string | null = null;

  ngOnInit(): void {
    if (this.isDistributor()) {
      this.loadDistributorProfile();
    }

    this.destroyRef.onDestroy(() => this.revokeLogoUrls());
  }

  loadDistributorProfile(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.editDetailsMode.set(false);

    this.distributorDashboardService.getProfile().subscribe({
      next: (profile) => {
        this.applyProfile(profile);
        this.loadLogoPreview(profile);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Could not load your profile details.');
      },
    });
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.errorMessage.set('Please choose an image file for the logo.');
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.saving.set(true);

    this.distributorDashboardService
      .uploadLogo(file)
      .pipe(switchMap(() => this.distributorDashboardService.getProfile()))
      .subscribe({
        next: (updated) => {
          this.applyProfile(updated);
          this.loadLogoPreview(updated);
          this.saving.set(false);
          this.successMessage.set('Logo updated successfully.');
        },
        error: (error) => {
          this.saving.set(false);
          this.errorMessage.set(this.extractErrorMessage(error));
        },
      });
  }

  saveProfile(): void {
    if (this.saving()) {
      return;
    }

    const profile = this.distributorProfile();
    if (!profile) {
      return;
    }

    const form = this.form();
    if (!form.companyName.trim() || !form.companyEmail.trim() || !form.companyPhone.trim()) {
      this.errorMessage.set('Company name, email, and phone are required.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const request: UpdateDistributorProfileRequest = {
      companyName: form.companyName.trim(),
      companyEmail: form.companyEmail.trim(),
      companyPhone: form.companyPhone.trim(),
      gstNumber: form.gstNumber.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      country: form.country.trim() || undefined,
    };

    const save$ = this.distributorDashboardService
      .updateProfile(request)
      .pipe(switchMap(() => this.distributorDashboardService.getProfile()));

    save$.subscribe({
      next: (updated) => {
        this.applyProfile(updated);
        this.auth.updateStoredCompanyName(updated.companyName);
        this.loadLogoPreview(updated);
        this.editDetailsMode.set(false);
        this.saving.set(false);
        this.successMessage.set('Profile saved successfully.');
      },
      error: (error) => {
        this.saving.set(false);
        this.errorMessage.set(this.extractErrorMessage(error));
      },
    });
  }

  updateFormField<K extends keyof ProfileFormState>(field: K, value: ProfileFormState[K]): void {
    this.form.update((current) => ({ ...current, [field]: value }));
  }

  startDetailsEdit(): void {
    const profile = this.distributorProfile();
    if (!profile) {
      return;
    }
    this.applyProfile(profile);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.editDetailsMode.set(true);
  }

  cancelDetailsEdit(): void {
    const profile = this.distributorProfile();
    if (profile) {
      this.applyProfile(profile);
    }
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.editDetailsMode.set(false);
  }

  roleLabel(role?: string): string {
    if (!role) {
      return '—';
    }
    return ROLE_LABELS[role] ?? role;
  }

  displayValue(value?: string | null): string {
    const trimmed = value?.trim();
    return trimmed ? trimmed : '—';
  }

  formatAddress(profile: DistributorProfile): string {
    const lines: string[] = [];
    if (profile.address?.trim()) {
      lines.push(profile.address.trim());
    }
    const locality = [profile.city, profile.state].filter((part) => part?.trim()).join(', ');
    if (locality) {
      lines.push(locality);
    }
    if (profile.country?.trim()) {
      lines.push(profile.country.trim());
    }
    return lines.length ? lines.join('\n') : '—';
  }

  private applyProfile(profile: DistributorProfile): void {
    this.distributorProfile.set(profile);
    this.form.set({
      companyName: profile.companyName ?? '',
      gstNumber: profile.gstNumber ?? '',
      companyEmail: profile.companyEmail ?? '',
      companyPhone: profile.companyPhone ?? '',
      address: profile.address ?? '',
      city: profile.city ?? '',
      state: profile.state ?? '',
      country: profile.country ?? '',
    });
  }

  private loadLogoPreview(profile: DistributorProfile): void {
    if (this.serverLogoObjectUrl) {
      URL.revokeObjectURL(this.serverLogoObjectUrl);
      this.serverLogoObjectUrl = null;
    }
    this.logoPreviewUrl.set(null);

    if (!profile.distributorLogoUrl) {
      return;
    }

    this.distributorDashboardService
      .loadLogoBlob()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.serverLogoObjectUrl = URL.createObjectURL(blob);
          this.logoPreviewUrl.set(this.serverLogoObjectUrl);
        },
        error: () => {
          this.logoPreviewUrl.set(null);
        },
      });
  }

  private revokeLogoUrls(): void {
    if (this.serverLogoObjectUrl) {
      URL.revokeObjectURL(this.serverLogoObjectUrl);
      this.serverLogoObjectUrl = null;
    }
  }

  private extractErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'error' in error) {
      const payload = (error as { error?: unknown }).error;
      if (typeof payload === 'string' && payload.trim()) {
        return payload;
      }
      if (payload && typeof payload === 'object' && 'message' in payload) {
        const message = (payload as { message?: unknown }).message;
        if (typeof message === 'string' && message.trim()) {
          return message;
        }
      }
    }
    return 'Could not save your profile. Please try again.';
  }
}
