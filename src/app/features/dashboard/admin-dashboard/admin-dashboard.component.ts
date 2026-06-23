import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminDashboardOverview } from '../../../core/models/admin-dashboard.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { AdminDashboardService } from '../../../core/services/admin/admin-dashboard.service';
import { getRequestSourceLabel } from '../../../shared/utils/inquiry-display.util';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink, LoadingOverlayComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css',
})
export class AdminDashboardComponent implements OnInit {
  private readonly adminDashboard = inject(AdminDashboardService);
  protected readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly overview = signal<AdminDashboardOverview | null>(null);

  readonly getRequestSourceLabel = getRequestSourceLabel;

  readonly maxStatusCount = computed(() => {
    const rows = this.overview()?.inquiriesByStatus ?? [];
    return Math.max(1, ...rows.map((r) => r.count));
  });

  readonly maxSourceCount = computed(() => {
    const o = this.overview();
    if (!o) {
      return 1;
    }
    return Math.max(
      1,
      o.catalogSearchInquiries,
      o.newProductSearchInquiries,
      o.mixedInquiries,
    );
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.adminDashboard.getOverview().subscribe({
      next: (data) => {
        this.overview.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Could not load dashboard metrics. Is the backend running?');
      },
    });
  }

  statusBarWidth(count: number): string {
    const max = this.maxStatusCount();
    return `${Math.round((count / max) * 100)}%`;
  }

  sourceBarWidth(count: number): string {
    const max = this.maxSourceCount();
    return `${Math.round((count / max) * 100)}%`;
  }

  formatStatus(status: string): string {
    return status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  formatDate(iso?: string): string {
    if (!iso) {
      return '—';
    }
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
  }
}
