import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth/auth.service';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { ConsumerDashboardComponent } from './consumer-dashboard/consumer-dashboard.component';
import { DistributorDashboardComponent } from './distributor-dashboard/distributor-dashboard.component';

@Component({
  selector: 'app-dashboard',
  imports: [AdminDashboardComponent, ConsumerDashboardComponent, DistributorDashboardComponent],
  template: `
    @switch (role()) {
      @case ('ADMIN') {
        <app-admin-dashboard />
      }
      @case ('CONSUMER') {
        <app-consumer-dashboard />
      }
      @default {
        <app-distributor-dashboard />
      }
    }
  `,
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);

  readonly role = computed(() => this.auth.currentUser()?.role ?? '');
}
