import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConsumerProfile } from '../../../core/models/consumer.model';
import { ConsumerDashboardService } from '../../../core/services/consumer/consumer-dashboard.service';
import { isValidEmployeePhone } from '../../../shared/utils/employee-contact.util';

@Component({
  selector: 'app-employee-contact-verify-modal',
  imports: [FormsModule],
  templateUrl: './employee-contact-verify-modal.component.html',
  styleUrl: './employee-contact-verify-modal.component.css',
})
export class EmployeeContactVerifyModalComponent {
  private readonly consumerDashboard = inject(ConsumerDashboardService);

  readonly profile = input.required<ConsumerProfile>();
  readonly closed = output<void>();
  readonly profileUpdated = output<ConsumerProfile>();

  readonly phone = signal('');
  readonly otp = signal('');
  readonly otpSent = signal(false);
  readonly busy = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly infoMessage = signal<string | null>(null);
  readonly localEmailVerified = signal(false);
  readonly localPhoneVerified = signal(false);
  readonly localPhone = signal('');

  constructor() {
    effect(() => {
      const current = this.profile();
      this.phone.set(current.userPhone?.trim() ?? '');
      this.localPhone.set(current.userPhone?.trim() ?? '');
      this.localEmailVerified.set(current.emailVerified === true);
      this.localPhoneVerified.set(current.phoneVerified === true && isValidEmployeePhone(current.userPhone));
      this.otp.set('');
      this.otpSent.set(false);
      this.errorMessage.set(null);
      this.infoMessage.set(null);
    });
  }

  emailVerified(): boolean {
    return this.localEmailVerified();
  }

  phoneVerified(): boolean {
    return this.localPhoneVerified();
  }

  close(): void {
    this.closed.emit();
  }

  resendEmailLink(): void {
    this.busy.set(true);
    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.consumerDashboard.resendEmailVerification().subscribe({
      next: (response) => {
        this.busy.set(false);
        this.infoMessage.set(response.message);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.errorMessage.set(this.extractError(error, 'Could not send verification email.'));
      },
    });
  }

  sendOtp(): void {
    const phone = this.phone().trim();
    if (!isValidEmployeePhone(phone)) {
      this.errorMessage.set('Enter a valid 10-digit mobile number (optionally with +91).');
      return;
    }

    this.busy.set(true);
    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.consumerDashboard.sendPhoneOtp(phone).subscribe({
      next: (response) => {
        this.busy.set(false);
        this.otpSent.set(true);
        this.infoMessage.set(response.message);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.errorMessage.set(this.extractError(error, 'Could not send OTP.'));
      },
    });
  }

  verifyOtp(): void {
    const phone = this.phone().trim();
    const otp = this.otp().trim();
    if (!isValidEmployeePhone(phone)) {
      this.errorMessage.set('Enter a valid 10-digit mobile number (optionally with +91).');
      return;
    }
    if (!otp) {
      this.errorMessage.set('Enter the OTP sent to your mobile.');
      return;
    }

    this.busy.set(true);
    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.consumerDashboard.verifyPhoneOtp(phone, otp).subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.localPhone.set(updated.userPhone?.trim() ?? phone);
        this.localPhoneVerified.set(updated.phoneVerified === true);
        this.localEmailVerified.set(updated.emailVerified === true);
        this.otpSent.set(false);
        this.otp.set('');
        this.infoMessage.set(
          updated.emailVerified === true && updated.phoneVerified === true
            ? 'Mobile number verified. Close this dialog, then click Submit Quotation again.'
            : 'Mobile number verified. Verify your email as well, then click Submit Quotation again.',
        );
        this.profileUpdated.emit(updated);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.errorMessage.set(this.extractError(error, 'Could not verify OTP.'));
      },
    });
  }

  private extractError(error: unknown, fallback: string): string {
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
    return fallback;
  }
}
