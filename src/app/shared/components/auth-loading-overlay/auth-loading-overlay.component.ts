import { Component, input } from '@angular/core';

@Component({
  selector: 'app-auth-loading-overlay',
  templateUrl: './auth-loading-overlay.component.html',
  styleUrl: './auth-loading-overlay.component.css',
})
export class AuthLoadingOverlayComponent {
  readonly loading = input(false);
  readonly message = input<string | null>(null);
}
