import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CrmCustomerSummary } from '../../../core/models/admin-crm.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { AdminCrmService } from '../../../core/services/admin/admin-crm.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-sales-dashboard',
  imports: [RouterLink, LoadingOverlayComponent],
  templateUrl: './sales-dashboard.component.html',
  styleUrl: './sales-dashboard.component.css',
})
export class SalesDashboardComponent implements OnInit {
  private readonly crm = inject(AdminCrmService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly customers = signal<CrmCustomerSummary[]>([]);

  readonly totalCustomers = computed(() => this.customers().length);
  readonly activeCustomers = computed(
    () => this.customers().filter((c) => c.isActive !== false).length,
  );
  readonly inactiveCustomers = computed(
    () => this.totalCustomers() - this.activeCustomers(),
  );
  readonly activePercent = computed(() => {
    const total = this.totalCustomers();
    if (total === 0) {
      return 0;
    }
    return Math.round((this.activeCustomers() / total) * 100);
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.crm.list(true).subscribe({
      next: (rows) => {
        this.customers.set(rows ?? []);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.errorMessage.set('Could not load sales metrics.');
        this.toast.fromApiError(err, 'Could not load sales metrics.');
      },
    });
  }
}
