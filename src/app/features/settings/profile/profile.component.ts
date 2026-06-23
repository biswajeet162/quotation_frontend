import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DistributorProfile } from '../../../core/models/distributor.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { DistributorDashboardService } from '../../../core/services/distributor/distributor-dashboard.service';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  CONSUMER: 'Consumer',
  DISTRIBUTOR: 'Distributor',
};

@Component({
  selector: 'app-profile',
  imports: [LoadingOverlayComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit {
  private readonly distributorDashboardService = inject(DistributorDashboardService);
  protected readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly distributorProfile = signal<DistributorProfile | null>(null);

  readonly isDistributor = computed(() => this.auth.currentUser()?.role === 'DISTRIBUTOR');

  ngOnInit(): void {
    if (this.isDistributor()) {
      this.loadDistributorProfile();
    }
  }

  loadDistributorProfile(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.distributorDashboardService.getProfile().subscribe({
      next: (profile) => {
        this.distributorProfile.set(profile);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Could not load your profile details.');
      },
    });
  }

  roleLabel(role?: string): string {
    if (!role) {
      return '—';
    }
    return ROLE_LABELS[role] ?? role;
  }
}
