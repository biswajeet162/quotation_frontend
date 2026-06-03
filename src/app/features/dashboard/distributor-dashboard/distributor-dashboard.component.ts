import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';

@Component({
  selector: 'app-distributor-dashboard',
  imports: [RouterLink],
  templateUrl: './distributor-dashboard.component.html',
  styleUrl: './distributor-dashboard.component.css',
})
export class DistributorDashboardComponent {
  protected readonly auth = inject(AuthService);
}
