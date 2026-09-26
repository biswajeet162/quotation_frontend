import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { AuthLoadingOverlayComponent } from '../../../shared/components/auth-loading-overlay/auth-loading-overlay.component';
import { extractApiErrorMessage } from '../../../core/utils/api-error.util';
import { CustomerInvitePreview } from '../../../core/models/customer-invite.model';
import { APS_LOGO_DATA_URL } from '../../../shared/branding/aps-logo';
import { enterAppAfterAuth } from '../../../core/utils/enter-app-after-auth.util';

@Component({
  selector: 'app-accept-customer-invite',
  imports: [ReactiveFormsModule, RouterLink, AuthLoadingOverlayComponent],
  templateUrl: './accept-customer-invite.component.html',
  styleUrl: './accept-customer-invite.component.css',
})
export class AcceptCustomerInviteComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly logoSrc = APS_LOGO_DATA_URL;
  readonly loadingPreview = signal(true);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly token = signal<string | null>(null);
  readonly preview = signal<CustomerInvitePreview | null>(null);
  readonly canAccept = signal(false);
  readonly showExtraDetails = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    phone: ['', [Validators.required, Validators.maxLength(40)]],
    password: [''],
    confirmPassword: [''],
    gstNumber: [''],
    panNumber: [''],
    address: [''],
    city: [''],
    state: [''],
    country: [''],
    acceptedInvite: [false, [Validators.requiredTrue]],
  });

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.loadingPreview.set(false);
      this.errorMessage.set('Invalid invitation link. No token provided.');
      this.toast.error(this.errorMessage()!);
      return;
    }

    this.token.set(token);
    this.auth.clearSession();
    this.auth.previewCustomerInvite(token).subscribe({
      next: (preview) => {
        this.preview.set(preview);
        this.form.patchValue({
          name: preview.name ?? '',
          phone: preview.phone ?? '',
        });
        const ok = preview.status === 'PENDING' && !preview.expired;
        this.canAccept.set(ok);
        if (!ok) {
          this.errorMessage.set(preview.message || 'This invitation cannot be accepted.');
        }
        this.loadingPreview.set(false);
      },
      error: (err) => {
        this.loadingPreview.set(false);
        const fallback = 'Invalid or expired invitation link.';
        this.errorMessage.set(extractApiErrorMessage(err, fallback));
        this.toast.fromApiError(err, fallback);
      },
    });
  }

  toggleExtraDetails(): void {
    this.showExtraDetails.update((open) => !open);
  }

  onSubmit(): void {
    const token = this.token();
    if (!token || !this.canAccept()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const password = value.password.trim();
    const confirmPassword = value.confirmPassword.trim();

    if (password || confirmPassword) {
      if (password.length < 6) {
        this.errorMessage.set('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        this.errorMessage.set('Passwords do not match.');
        return;
      }
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.auth
      .acceptCustomerInvite({
        token,
        name: value.name.trim(),
        phone: value.phone.trim(),
        password: password || undefined,
        confirmPassword: password ? confirmPassword : undefined,
        gstNumber: value.gstNumber.trim() || undefined,
        panNumber: value.panNumber.trim() || undefined,
        address: value.address.trim() || undefined,
        city: value.city.trim() || undefined,
        state: value.state.trim() || undefined,
        country: value.country.trim() || undefined,
        acceptedInvite: value.acceptedInvite,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.auth.markWelcomeSplashPending();
          this.toast.success('Welcome! Your customer account is ready.');
          // Phone: hard-load Flutter /m/… (SPA navigate would stay on Angular).
          enterAppAfterAuth(this.router, '/products/all');
        },
        error: (err) => {
          this.submitting.set(false);
          const fallback = 'Could not accept invitation. Please try again.';
          this.errorMessage.set(extractApiErrorMessage(err, fallback));
          this.toast.fromApiError(err, fallback);
        },
      });
  }
}
