import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth/auth.service';

@Component({
  selector: 'app-header',
  imports: [],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent {
  protected readonly auth = inject(AuthService);

  logout(): void {
    this.auth.logout();
  }
}
