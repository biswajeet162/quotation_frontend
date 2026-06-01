import { Component, inject } from '@angular/core';
import { AuthService } from '../../../core/services/auth/auth.service';

@Component({
  selector: 'app-admin-dashboard',
  imports: [],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css',
})
export class AdminDashboardComponent {
  protected readonly auth = inject(AuthService);
}
