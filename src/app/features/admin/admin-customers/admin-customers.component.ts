import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminCustomerInviteService } from '../../../core/services/admin/admin-customer-invite.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { extractApiErrorMessage } from '../../../core/utils/api-error.util';

interface CustomerInviteFormState {
  name: string;
  email: string;
  phone: string;
  password: string;
}

const emptyInviteForm = (): CustomerInviteFormState => ({
  name: '',
  email: '',
  phone: '',
  password: '',
});

@Component({
  selector: 'app-admin-customers',
  imports: [FormsModule],
  templateUrl: './admin-customers.component.html',
  styleUrl: './admin-customers.component.css',
})
export class AdminCustomersComponent {
  private readonly adminInvites = inject(AdminCustomerInviteService);
  private readonly toast = inject(ToastService);

  readonly inviteModalOpen = signal(false);
  readonly inviteSaving = signal(false);
  readonly inviteError = signal<string | null>(null);
  readonly inviteForm = signal<CustomerInviteFormState>(emptyInviteForm());
  readonly lastInviteLink = signal<string | null>(null);
  readonly lastInviteEmail = signal<string | null>(null);

  openInviteModal(): void {
    this.inviteForm.set(emptyInviteForm());
    this.inviteError.set(null);
    this.inviteModalOpen.set(true);
  }

  closeInviteModal(): void {
    if (this.inviteSaving()) {
      return;
    }
    this.inviteModalOpen.set(false);
    this.inviteError.set(null);
  }

  updateInviteField<K extends keyof CustomerInviteFormState>(
    key: K,
    value: CustomerInviteFormState[K],
  ): void {
    this.inviteForm.update((current) => ({ ...current, [key]: value }));
  }

  submitCustomerInvite(): void {
    const form = this.inviteForm();
    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    const password = form.password;

    if (!name || !email || !phone || !password) {
      this.inviteError.set('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      this.inviteError.set('Password must be at least 6 characters.');
      return;
    }

    this.inviteSaving.set(true);
    this.inviteError.set(null);

    this.adminInvites.createInvite({ name, email, phone, password }).subscribe({
      next: (response) => {
        this.inviteSaving.set(false);
        this.inviteModalOpen.set(false);
        this.lastInviteLink.set(response.inviteLink || null);
        this.lastInviteEmail.set(response.email || email);
        this.toast.success(response.message || `Invite sent to ${email}`);
        if (response.inviteLink) {
          void this.copyInviteLink(response.inviteLink);
        }
      },
      error: (err) => {
        this.inviteSaving.set(false);
        const message = extractApiErrorMessage(err, 'Could not send invite. Please try again.');
        this.inviteError.set(message);
        this.toast.fromApiError(err, message);
      },
    });
  }

  async copyInviteLink(link?: string): Promise<void> {
    const value = (link ?? this.lastInviteLink() ?? '').trim();
    if (!value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      this.toast.success('Invite link copied — paste it or open it if mail is delayed.');
    } catch {
      this.toast.error('Could not copy link. Use the invite link shown below.');
    }
  }

  dismissInviteBanner(): void {
    this.lastInviteLink.set(null);
    this.lastInviteEmail.set(null);
  }
}
