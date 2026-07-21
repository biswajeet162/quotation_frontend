import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { AuthLoadingOverlayComponent } from '../../../shared/components/auth-loading-overlay/auth-loading-overlay.component';
import { extractApiErrorMessage } from '../../../core/utils/api-error.util';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, AuthLoadingOverlayComponent],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css',
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.auth.forgotPassword(this.form.getRawValue()).subscribe({
      next: (response) => {
        this.loading.set(false);
        this.successMessage.set(response.message);
        this.toast.success(response.message || 'Password reset email sent.');
      },
      error: (err) => {
        this.loading.set(false);
        const fallback = 'Request failed. Please try again.';
        this.errorMessage.set(extractApiErrorMessage(err, fallback));
        this.toast.fromApiError(err, fallback);
      },
    });
  }

  goToLogin(): void {
    void this.router.navigate(['/login']);
  }
}
