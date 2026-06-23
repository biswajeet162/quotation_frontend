import { Component, input } from '@angular/core';
import { LoadingOverlayComponent } from '../loading-overlay/loading-overlay.component';

/** @deprecated Use LoadingOverlayComponent (`app-loading-overlay`) instead. */
@Component({
  selector: 'app-auth-loading-overlay',
  imports: [LoadingOverlayComponent],
  template: `<app-loading-overlay [loading]="loading()" [message]="message()" />`,
})
export class AuthLoadingOverlayComponent {
  readonly loading = input(false);
  readonly message = input<string | null>(null);
}
