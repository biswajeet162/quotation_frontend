import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';
import { extractApiErrorMessage } from '../../../core/utils/api-error.util';

@Component({
  selector: 'app-verify-email',
  imports: [RouterLink, LoadingOverlayComponent],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.css',
})
export class VerifyEmailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.loading.set(false);
      const message = 'Invalid verification link. No token provided.';
      this.errorMessage.set(message);
      this.toast.error(message);
      return;
    }

    this.auth.clearSession();

    this.auth.verifyEmail(token).subscribe({
      next: () => {
        this.loading.set(false);
        this.toast.success('Email verified successfully.');
        void this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        const fallback = 'Verification failed. The link may be invalid or expired.';
        this.errorMessage.set(extractApiErrorMessage(err, fallback));
        this.toast.fromApiError(err, fallback);
      },
    });
  }
}
