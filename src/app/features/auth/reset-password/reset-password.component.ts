import { Component, inject, OnInit, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { AuthLoadingOverlayComponent } from '../../../shared/components/auth-loading-overlay/auth-loading-overlay.component';
import { extractApiErrorMessage } from '../../../core/utils/api-error.util';

function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  if (password !== confirmPassword) {
    return { passwordsMismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, AuthLoadingOverlayComponent],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css',
})
export class ResetPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly token = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator },
  );

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.errorMessage.set('Invalid reset link. No token provided.');
      return;
    }
    this.token.set(token);
  }

  onSubmit(): void {
    if (!this.token()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { password, confirmPassword } = this.form.getRawValue();
    this.auth.resetPassword({ token: this.token()!, password, confirmPassword }).subscribe({
      next: (response) => {
        this.loading.set(false);
        this.successMessage.set(response.message);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(extractApiErrorMessage(err, 'Reset failed. Please try again.'));
      },
    });
  }

  goToLogin(): void {
    void this.router.navigate(['/login']);
  }
}
