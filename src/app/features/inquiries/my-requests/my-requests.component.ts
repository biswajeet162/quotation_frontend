import { Component } from '@angular/core';
import { ProductRequestPanelComponent } from '../../products/product-request-panel/product-request-panel.component';

@Component({
  selector: 'app-my-requests',
  imports: [ProductRequestPanelComponent],
  templateUrl: './my-requests.component.html',
  styleUrl: './my-requests.component.css',
})
export class MyRequestsComponent {
  onSubmitted(): void {
    // Consumer can view submitted requests under Tracking in the sidebar.
  }
}
