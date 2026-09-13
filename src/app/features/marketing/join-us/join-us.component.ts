import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';

type InterestedAs = 'CUSTOMER' | 'DISTRIBUTOR';

interface JoinRequestPayload {
  interestedAs: InterestedAs;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  note: string | null;
}

interface JoinRequestResponse {
  id: string;
  message: string;
}

@Component({
  selector: 'app-join-us',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './join-us.component.html',
  styleUrl: './join-us.component.css',
})
export class JoinUsComponent {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly submitted = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');

  readonly form = this.fb.nonNullable.group({
    interestedAs: this.fb.nonNullable.control<InterestedAs>('CUSTOMER', Validators.required),
    contactName: ['', [Validators.required, Validators.maxLength(150)]],
    companyName: ['', [Validators.required, Validators.maxLength(200)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    phone: ['', [Validators.required, Validators.maxLength(40)]],
    note: ['', [Validators.maxLength(2000)]],
  });

  onSubmit(): void {
    this.errorMessage.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: JoinRequestPayload = {
      interestedAs: raw.interestedAs,
      contactName: raw.contactName.trim(),
      companyName: raw.companyName.trim(),
      email: raw.email.trim(),
      phone: raw.phone.trim(),
      note: raw.note.trim() ? raw.note.trim() : null,
    };

    this.loading.set(true);
    this.http.post<JoinRequestResponse>(`${environment.apiUrl}/public/join-requests`, payload).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.submitted.set(true);
        this.successMessage.set(
          res.message ||
            'Thanks for your interest. Our team will review your request and get back to you.',
        );
      },
      error: (err) => {
        this.loading.set(false);
        const apiMessage =
          err?.error?.message ||
          err?.error?.error ||
          (typeof err?.error === 'string' ? err.error : null);
        this.errorMessage.set(
          apiMessage || 'Could not submit your request. Please try again or email us directly.',
        );
      },
    });
  }
}
