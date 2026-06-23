import { AfterViewInit, Component, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth/auth.service';
import { GoogleSignInService } from '../../../core/services/auth/google-sign-in.service';
import { AuthLoadingOverlayComponent } from '../../../shared/components/auth-loading-overlay/auth-loading-overlay.component';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, AuthLoadingOverlayComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements AfterViewInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly googleSignIn = inject(GoogleSignInService);
  private readonly router = inject(Router);

  @ViewChild('googleButtonHost') googleButtonHost?: ElementRef<HTMLDivElement>;

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly googleSignInEnabled = signal(false);
  readonly infoMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(1)]],
  });

  ngAfterViewInit(): void {
    void this.initGoogleSignInButton();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigate(['/dashboard']);
      },
      error: (err: HttpErrorResponse) => this.handleError(err, 'Invalid email or password. Please try again.'),
    });
  }

  private async initGoogleSignInButton(): Promise<void> {
    if (!this.googleButtonHost) {
      return;
    }

    try {
      const rendered = await this.googleSignIn.renderButton(
        this.googleButtonHost.nativeElement,
        'signin',
        (credential) => {
          this.onGoogleSignIn(credential);
        },
      );
      this.googleSignInEnabled.set(rendered);
    } catch {
      this.googleSignInEnabled.set(false);
    }
  }

  private onGoogleSignIn(credential: string): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.auth.googleLogin({ idToken: credential }).subscribe({
      next: (response) => {
        this.loading.set(false);
        if (response.message) {
          this.infoMessage.set(response.message);
          setTimeout(() => void this.router.navigate(['/dashboard']), 2000);
          return;
        }
        void this.router.navigate(['/dashboard']);
      },
      error: (err: HttpErrorResponse) => this.handleError(err, 'Google sign-in failed. Please try again.'),
    });
  }

  private handleError(err: HttpErrorResponse, fallback: string): void {
    this.loading.set(false);
    if (typeof err.error?.message === 'string') {
      this.errorMessage.set(err.error.message);
      return;
    }
    this.errorMessage.set(fallback);
  }
}
