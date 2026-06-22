import { AfterViewInit, Component, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { GoogleSignInService } from '../../../core/services/auth/google-sign-in.service';

function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  if (password !== confirmPassword) {
    return { passwordsMismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css',
})
export class SignupComponent implements AfterViewInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly googleSignIn = inject(GoogleSignInService);
  private readonly router = inject(Router);

  @ViewChild('googleButtonHost') googleButtonHost?: ElementRef<HTMLDivElement>;

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly registeredEmail = signal<string | null>(null);
  readonly googleSignInEnabled = signal(false);

  readonly form = this.fb.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator },
  );

  ngAfterViewInit(): void {
    void this.initGoogleSignUpButton();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.auth.signUp(this.form.getRawValue()).subscribe({
      next: (response) => {
        this.loading.set(false);
        this.registeredEmail.set(response.email);
        this.successMessage.set(response.message);
      },
      error: (err) => this.handleError(err, 'Signup failed. Please try again.'),
    });
  }

  goToLogin(): void {
    void this.router.navigate(['/login']);
  }

  private async initGoogleSignUpButton(): Promise<void> {
    if (!this.googleButtonHost) {
      return;
    }

    try {
      const rendered = await this.googleSignIn.renderButton(
        this.googleButtonHost.nativeElement,
        'signup',
        (credential) => {
          this.onGoogleSignUp(credential);
        },
      );
      this.googleSignInEnabled.set(rendered);
    } catch {
      this.googleSignInEnabled.set(false);
      this.errorMessage.set('Google Sign-In could not be loaded.');
    }
  }

  private onGoogleSignUp(credential: string): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.auth.googleSignUp({ idToken: credential }).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigate(['/dashboard']);
      },
      error: (err) => this.handleError(err, 'Google signup failed. Please try again.'),
    });
  }

  private handleError(err: { error?: { message?: string | Record<string, string> } }, fallback: string): void {
    this.loading.set(false);
    const message = err?.error?.message;
    if (typeof message === 'string') {
      this.errorMessage.set(message);
    } else if (typeof message === 'object' && message !== null) {
      const firstError = Object.values(message)[0];
      this.errorMessage.set(typeof firstError === 'string' ? firstError : fallback);
    } else {
      this.errorMessage.set(fallback);
    }
  }
}
