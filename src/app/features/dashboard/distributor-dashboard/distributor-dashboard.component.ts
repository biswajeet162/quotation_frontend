import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DistributorDashboardOverview } from '../../../core/models/distributor.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { DistributorDashboardService } from '../../../core/services/distributor/distributor-dashboard.service';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-distributor-dashboard',
  imports: [RouterLink, LoadingOverlayComponent],
  templateUrl: './distributor-dashboard.component.html',
  styleUrl: './distributor-dashboard.component.css',
})
export class DistributorDashboardComponent implements OnInit {
  private readonly dashboardService = inject(DistributorDashboardService);
  protected readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly overview = signal<DistributorDashboardOverview | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.dashboardService.getOverview().subscribe({
      next: (data) => {
        this.overview.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Could not load your distributor summary.');
      },
    });
  }

  formatDate(iso?: string): string {
    if (!iso) {
      return '—';
    }
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
  }
}
