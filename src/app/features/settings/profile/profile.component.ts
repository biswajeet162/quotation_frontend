import { Component, inject } from '@angular/core';
import { AuthService } from '../../../core/services/auth/auth.service';

@Component({
  selector: 'app-profile',
  imports: [],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent {
  protected readonly auth = inject(AuthService);
}
