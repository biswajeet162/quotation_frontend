import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Observable, switchMap } from 'rxjs';
import { AdminPortalProfile, UpdateAdminPortalProfileRequest } from '../../../core/models/admin-portal-profile.model';
import { ConsumerProfile, UpdateConsumerProfileRequest } from '../../../core/models/consumer.model';
import {
  DistributorProfile,
  UpdateDistributorProfileRequest,
} from '../../../core/models/distributor.model';
import { AdminPortalProfileService } from '../../../core/services/admin/admin-portal-profile.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ConsumerDashboardService } from '../../../core/services/consumer/consumer-dashboard.service';
import { DistributorDashboardService } from '../../../core/services/distributor/distributor-dashboard.service';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  CONSUMER: 'Consumer',
  DISTRIBUTOR: 'Distributor',
};

interface ProfileFormState {
  userName: string;
  userPhone: string;
  companyName: string;
  gstNumber: string;
  panNumber: string;
  companyEmail: string;
  companyPhone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pinCode: string;
}

type CompanyProfile = DistributorProfile | ConsumerProfile | AdminPortalProfile;

const emptyForm = (): ProfileFormState => ({
  userName: '',
  userPhone: '',
  companyName: '',
  gstNumber: '',
  panNumber: '',
  companyEmail: '',
  companyPhone: '',
  address: '',
  city: '',
  state: '',
  country: '',
  pinCode: '',
});

@Component({
  selector: 'app-profile',
  imports: [FormsModule, LoadingOverlayComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit {
  private readonly distributorDashboardService = inject(DistributorDashboardService);
  private readonly consumerDashboardService = inject(ConsumerDashboardService);
  private readonly adminPortalProfileService = inject(AdminPortalProfileService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly editDetailsMode = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly companyProfile = signal<CompanyProfile | null>(null);
  readonly form = signal<ProfileFormState>(emptyForm());
  readonly logoPreviewUrl = signal<string | null>(null);

  readonly isDistributor = computed(() => this.auth.currentUser()?.role === 'DISTRIBUTOR');
  readonly isConsumer = computed(() => this.auth.currentUser()?.role === 'CONSUMER');
  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'ADMIN');
  readonly hasCompanyProfile = computed(() => this.isDistributor() || this.isConsumer() || this.isAdmin());
  readonly isBusy = computed(() => this.loading() || this.saving());

  private serverLogoObjectUrl: string | null = null;

  ngOnInit(): void {
    if (this.hasCompanyProfile()) {
      this.loadCompanyProfile();
    }

    this.destroyRef.onDestroy(() => this.revokeLogoUrls());
  }

  loadCompanyProfile(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.editDetailsMode.set(false);

    if (this.isConsumer()) {
      this.consumerDashboardService.getProfile().subscribe({
        next: (profile) => {
          this.applyProfile(profile);
          this.loadLogoPreview();
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.errorMessage.set('Could not load your profile details.');
        },
      });
      return;
    }

    if (this.isAdmin()) {
      this.adminPortalProfileService.getProfile().subscribe({
        next: (profile) => {
          this.applyProfile(profile);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.errorMessage.set('Could not load portal company details.');
        },
      });
      return;
    }

    this.distributorDashboardService.getProfile().subscribe({
      next: (profile) => {
        this.applyProfile(profile);
        this.loadLogoPreview();
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

    if (this.isConsumer()) {
      this.consumerDashboardService
        .uploadLogo(file)
        .pipe(switchMap(() => this.consumerDashboardService.getProfile()))
        .subscribe({
          next: (updated) => this.onLogoUploaded(updated),
          error: (error: unknown) => this.onLogoUploadError(error),
        });
      return;
    }

    this.distributorDashboardService
      .uploadLogo(file)
      .pipe(switchMap(() => this.distributorDashboardService.getProfile()))
      .subscribe({
        next: (updated) => this.onLogoUploaded(updated),
        error: (error: unknown) => this.onLogoUploadError(error),
      });
  }

  private onLogoUploaded(updated: CompanyProfile): void {
    this.applyProfile(updated);
    this.loadLogoPreview();
    this.saving.set(false);
    this.successMessage.set('Logo updated successfully.');
  }

  private onLogoUploadError(error: unknown): void {
    this.saving.set(false);
    this.errorMessage.set(this.extractErrorMessage(error));
  }

  saveProfile(): void {
    if (this.saving() || !this.companyProfile()) {
      return;
    }

    const form = this.form();
    if (this.isConsumer()) {
      if (!form.userName.trim() || !form.userPhone.trim() || !form.companyName.trim()) {
        this.errorMessage.set('Your name, phone number, and company name are required.');
        return;
      }
    } else if (!form.companyName.trim() || !form.companyEmail.trim() || !form.companyPhone.trim()) {
      this.errorMessage.set('Company name, email, and phone are required.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.isConsumer()) {
      this.saveConsumerProfile(form).subscribe({
        next: (updated) => this.onProfileSaved(updated),
        error: (error: unknown) => this.onProfileSaveError(error),
      });
      return;
    }

    if (this.isAdmin()) {
      this.saveAdminProfile(form).subscribe({
        next: (updated) => this.onProfileSaved(updated),
        error: (error: unknown) => this.onProfileSaveError(error),
      });
      return;
    }

    this.saveDistributorProfile(form).subscribe({
      next: (updated) => this.onProfileSaved(updated),
      error: (error: unknown) => this.onProfileSaveError(error),
    });
  }

  private onProfileSaved(updated: CompanyProfile): void {
    this.applyProfile(updated);
    this.auth.updateStoredCompanyName(updated.companyName);
    this.loadLogoPreview();
    this.editDetailsMode.set(false);
    this.saving.set(false);
    this.successMessage.set('Profile saved successfully.');
  }

  private onProfileSaveError(error: unknown): void {
    this.saving.set(false);
    this.errorMessage.set(this.extractErrorMessage(error));
  }

  updateFormField<K extends keyof ProfileFormState>(field: K, value: ProfileFormState[K]): void {
    this.form.update((current) => ({ ...current, [field]: value }));
  }

  startDetailsEdit(): void {
    const profile = this.companyProfile();
    if (!profile) {
      return;
    }
    this.applyProfile(profile);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.editDetailsMode.set(true);
  }

  cancelDetailsEdit(): void {
    const profile = this.companyProfile();
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

  formatAddress(profile: CompanyProfile): string {
    const lines: string[] = [];
    if (profile.address?.trim()) {
      lines.push(profile.address.trim());
    }
    const locality = [profile.city, profile.state].filter((part) => part?.trim()).join(', ');
    if (locality) {
      lines.push(locality);
    }
    const pinCode = 'pinCode' in profile ? profile.pinCode : undefined;
    if (pinCode?.trim()) {
      lines.push(`PIN: ${pinCode.trim()}`);
    }
    if (profile.country?.trim()) {
      lines.push(profile.country.trim());
    }
    return lines.length ? lines.join('\n') : '—';
  }

  panNumber(profile: CompanyProfile): string | undefined {
    return 'panNumber' in profile ? profile.panNumber : undefined;
  }

  pinCode(profile: CompanyProfile): string | undefined {
    return 'pinCode' in profile ? profile.pinCode : undefined;
  }

  showExtendedCompanyFields(): boolean {
    return this.isConsumer() || this.isAdmin();
  }

  private saveConsumerProfile(form: ProfileFormState): Observable<ConsumerProfile> {
    const request: UpdateConsumerProfileRequest = {
      userName: form.userName.trim(),
      userPhone: form.userPhone.trim(),
      companyName: form.companyName.trim(),
      gstNumber: form.gstNumber.trim() || undefined,
      panNumber: form.panNumber.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      country: form.country.trim() || undefined,
      pinCode: form.pinCode.trim() || undefined,
    };

    return this.consumerDashboardService
      .updateProfile(request)
      .pipe(switchMap(() => this.consumerDashboardService.getProfile()));
  }

  private saveAdminProfile(form: ProfileFormState): Observable<AdminPortalProfile> {
    const request: UpdateAdminPortalProfileRequest = {
      companyName: form.companyName.trim(),
      companyEmail: form.companyEmail.trim(),
      companyPhone: form.companyPhone.trim(),
      gstNumber: form.gstNumber.trim() || undefined,
      panNumber: form.panNumber.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      country: form.country.trim() || undefined,
      pinCode: form.pinCode.trim() || undefined,
    };

    return this.adminPortalProfileService
      .updateProfile(request)
      .pipe(switchMap(() => this.adminPortalProfileService.getProfile()));
  }

  private saveDistributorProfile(form: ProfileFormState): Observable<DistributorProfile> {
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

    return this.distributorDashboardService
      .updateProfile(request)
      .pipe(switchMap(() => this.distributorDashboardService.getProfile()));
  }

  private applyProfile(profile: CompanyProfile): void {
    this.companyProfile.set(profile);
    const consumerProfile = this.isConsumer() ? (profile as ConsumerProfile) : null;
    this.form.set({
      userName: consumerProfile?.userName ?? profile.userName ?? '',
      userPhone: consumerProfile?.userPhone ?? '',
      companyName: profile.companyName ?? '',
      gstNumber: profile.gstNumber ?? '',
      panNumber: 'panNumber' in profile ? (profile.panNumber ?? '') : '',
      companyEmail: 'companyEmail' in profile ? (profile.companyEmail ?? '') : '',
      companyPhone: 'companyPhone' in profile ? (profile.companyPhone ?? '') : '',
      address: profile.address ?? '',
      city: profile.city ?? '',
      state: profile.state ?? '',
      country: profile.country ?? '',
      pinCode: 'pinCode' in profile ? (profile.pinCode ?? '') : '',
    });
  }

  consumerEmail(profile: CompanyProfile): string {
    return profile.email?.trim() || '—';
  }

  consumerPhone(profile: CompanyProfile): string {
    const consumerProfile = profile as ConsumerProfile;
    return consumerProfile.userPhone?.trim() || '—';
  }

  distributorCompanyEmail(profile: CompanyProfile): string | undefined {
    return 'companyEmail' in profile ? profile.companyEmail : undefined;
  }

  distributorCompanyPhone(profile: CompanyProfile): string | undefined {
    return 'companyPhone' in profile ? profile.companyPhone : undefined;
  }

  private loadLogoPreview(): void {
    if (this.serverLogoObjectUrl) {
      URL.revokeObjectURL(this.serverLogoObjectUrl);
      this.serverLogoObjectUrl = null;
    }
    this.logoPreviewUrl.set(null);

    const profile = this.companyProfile();
    if (!profile) {
      return;
    }

    const hasLogo = this.isConsumer()
      ? Boolean((profile as ConsumerProfile).consumerLogoUrl)
      : Boolean((profile as DistributorProfile).distributorLogoUrl);

    if (!hasLogo) {
      return;
    }

    const logo$ = this.isConsumer()
      ? this.consumerDashboardService.loadLogoBlob()
      : this.distributorDashboardService.loadLogoBlob();

    logo$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
