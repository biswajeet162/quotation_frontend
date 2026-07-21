import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  templateUrl: './toast-container.component.html',
  styleUrl: './toast-container.component.css',
})
export class ToastContainerComponent {
  readonly toast = inject(ToastService);

  dismiss(id: number): void {
    this.toast.dismiss(id);
  }
}
